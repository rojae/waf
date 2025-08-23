// Package main implements a real-time WAF (Web Application Firewall) event processor.
//
// This service consumes high-priority security events from Kafka topics and performs
// real-time threat analysis, severity scoring, and alerting. It's designed to handle
// critical security events that require immediate attention, separate from bulk log
// analytics processing.
//
// Key features:
//   - Real-time consumption of WAF events from Kafka
//   - Dynamic severity scoring based on OWASP CRS rules and threat intelligence
//   - Time-series storage in InfluxDB for metrics and monitoring
//   - Automated alerting for high-severity security events
//   - Graceful shutdown and fault-tolerant message processing
package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/oschwald/geoip2-golang"
	"github.com/segmentio/kafka-go"
	"github.com/sirupsen/logrus"
)

// Config holds the configuration parameters for the real-time processor service.
// All configuration values can be set via environment variables with defaults provided.
type Config struct {
	// KafkaBrokers is a comma-separated list of Kafka broker addresses (e.g., "kafka:9092")
	KafkaBrokers string
	// KafkaTopic is the topic name to consume WAF events from
	KafkaTopic string
	// KafkaGroup is the consumer group ID for Kafka consumer
	KafkaGroup string
	// InfluxDBURL is the base URL for InfluxDB API (e.g., "http://localhost:8086")
	InfluxDBURL string
	// InfluxDBToken is the authentication token for InfluxDB access
	InfluxDBToken string
	// InfluxDBOrg is the organization name in InfluxDB
	InfluxDBOrg string
	// InfluxDBBucket is the bucket name where metrics will be stored
	InfluxDBBucket string
	// GeoIPDBPath is the path to the MaxMind GeoLite2 database file
	GeoIPDBPath string
}

// GeoIPInfo represents geographical information for an IP address.
// This structure is used to enrich security events with location context
// for threat intelligence and compliance reporting.
type GeoIPInfo struct {
	Country   string  `json:"country"`
	City      string  `json:"city"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// ModSecurityEvent represents a security event from ModSecurity WAF.
// This structure contains both the original transaction data from ModSecurity
// audit logs and classification metadata added by the Fluent Bit filtering pipeline.
type ModSecurityEvent struct {
	Transaction struct {
		ID           string `json:"id"`
		ClientIP     string `json:"client_ip"`
		AnomalyScore int    `json:"anomaly_score"`
		TimeStamp    string `json:"time_stamp"`
		Request      struct {
			URI     string            `json:"uri"`
			Method  string            `json:"method"`
			Headers map[string]string `json:"headers"`
		} `json:"request"`
		Response struct {
			HTTPCode int `json:"http_code"`
		} `json:"response"`
		Messages []struct {
			Details struct {
				RuleID string `json:"ruleId"`
				Msg    string `json:"msg"`
			} `json:"details"`
		} `json:"messages"`
	} `json:"transaction"`
	Classification struct {
		Track        string `json:"track"`
		AnomalyScore int    `json:"anomaly_score"`
		RuleID       string `json:"rule_id"`
		Timestamp    string `json:"timestamp"`
	} `json:"classification"`
}

// RealTimeProcessor is the main service struct that handles real-time WAF event processing.
// It maintains connections to Kafka for event consumption and InfluxDB for metrics storage.
type RealTimeProcessor struct {
	config       Config
	kafkaReader  *kafka.Reader
	influxClient influxdb2.Client
	writeAPI     api.WriteAPI
	logger       *logrus.Logger
	geoipDB      *geoip2.Reader
}

// NewRealTimeProcessor creates and initializes a new RealTimeProcessor instance.
// It establishes connections to Kafka and InfluxDB, configures structured logging,
// and sets up the InfluxDB write API for efficient batched writes.
func NewRealTimeProcessor(config Config) *RealTimeProcessor {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.DebugLevel)

	// Initialize GeoIP database for IP geolocation lookups
	var geoipDB *geoip2.Reader
	if config.GeoIPDBPath != "" {
		var err error
		geoipDB, err = geoip2.Open(config.GeoIPDBPath)
		if err != nil {
			logger.Warnf("Failed to open GeoIP database: %v. Geographic enrichment disabled.", err)
			geoipDB = nil
		} else {
			logger.Info("GeoIP database loaded successfully")
		}
	}

	// Initialize Kafka reader for consuming events from Kafka topic
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  strings.Split(config.KafkaBrokers, ","),
		GroupID:  config.KafkaGroup,
		Topic:    config.KafkaTopic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})

	// Initialize InfluxDB client connection for storing time-series metrics and events
	influxClient := influxdb2.NewClient(config.InfluxDBURL, config.InfluxDBToken)
	writeAPI := influxClient.WriteAPI(config.InfluxDBOrg, config.InfluxDBBucket)

	return &RealTimeProcessor{
		config:       config,
		kafkaReader:  reader,
		influxClient: influxClient,
		writeAPI:     writeAPI,
		logger:       logger,
		geoipDB:      geoipDB,
	}
}

// Start begins the real-time processing service with graceful shutdown support.
// This method starts consuming Kafka messages in a loop and also starts a goroutine
// for handling InfluxDB write errors. It blocks until the provided context is cancelled.
func (rtp *RealTimeProcessor) Start(ctx context.Context) error {
	rtp.logger.Info("Starting real-time processor (Kafka mode)...")

	// Handle InfluxDB write errors in a separate goroutine
	go rtp.handleInfluxDBErrors(ctx)

	// Consume Kafka messages in a loop
	for {
		m, err := rtp.kafkaReader.ReadMessage(ctx)
		if err != nil {
			if err == context.Canceled {
				break
			}
			rtp.logger.Errorf("Kafka read error: %v", err)
			continue
		}

		var event ModSecurityEvent
		if err := json.Unmarshal(m.Value, &event); err != nil {
			rtp.logger.Errorf("Error unmarshaling event: %v", err)
			continue
		}

		// Calculate severity
		severity := rtp.calculateSeverity(event)

		// Store event in InfluxDB
		rtp.writeToInfluxDB(event, severity)

		// Trigger immediate alert for high-severity security events (severity >= 80)
		if severity >= 80 {
			rtp.triggerAlert(event, severity)
		}

		rtp.logger.WithFields(logrus.Fields{
			"tx_id":     event.Transaction.ID,
			"client_ip": event.Transaction.ClientIP,
			"severity":  severity,
			"rule_id":   event.Classification.RuleID,
		}).Info("Processed real-time event")
	}

	return nil
}

// calculateSeverity computes a dynamic threat severity score for security events.
// The scoring algorithm combines multiple risk factors to prioritize critical threats.
func (rtp *RealTimeProcessor) calculateSeverity(event ModSecurityEvent) int {
	severity := event.Transaction.AnomalyScore

	if event.Classification.RuleID != "" {
		switch {
		case strings.HasPrefix(event.Classification.RuleID, "942"): // SQLi
			severity += 30
		case strings.HasPrefix(event.Classification.RuleID, "941"): // XSS
			severity += 25
		case strings.HasPrefix(event.Classification.RuleID, "932"): // RCE
			severity += 35
		case strings.HasPrefix(event.Classification.RuleID, "930"): // LFI
			severity += 20
		}
	}

	if rtp.isHighRiskIP(event.Transaction.ClientIP) {
		severity += 15
	}

	return severity
}

// isHighRiskIP checks if a client IP address is considered high-risk.
// TODO: Replace with actual threat intelligence integration.
func (rtp *RealTimeProcessor) isHighRiskIP(ip string) bool {
	highRiskIPs := []string{"192.168.1.100", "10.0.0.50"}
	for _, riskIP := range highRiskIPs {
		if ip == riskIP {
			return true
		}
	}
	return false
}

// writeToInfluxDB stores processed security events in InfluxDB for time-series analysis.
func (rtp *RealTimeProcessor) writeToInfluxDB(event ModSecurityEvent, severity int) {
	// Get geographic information for the client IP
	geoInfo := rtp.lookupGeoIP(event.Transaction.ClientIP)

	p := influxdb2.NewPointWithMeasurement("waf_events").
		AddTag("client_ip", event.Transaction.ClientIP).
		AddTag("method", event.Transaction.Request.Method).
		AddTag("rule_id", event.Classification.RuleID).
		AddTag("severity_level", rtp.getSeverityLevel(severity)).
		AddTag("geo_country", geoInfo.Country).
		AddTag("geo_city", geoInfo.City).
		AddField("anomaly_score", event.Transaction.AnomalyScore).
		AddField("severity", severity).
		AddField("response_code", event.Transaction.Response.HTTPCode).
		AddField("uri", event.Transaction.Request.URI).
		AddField("geo_latitude", geoInfo.Latitude).
		AddField("geo_longitude", geoInfo.Longitude).
		SetTime(time.Now())

	rtp.writeAPI.WritePoint(p)
}

// getSeverityLevel converts numeric severity scores to categorical labels.
func (rtp *RealTimeProcessor) getSeverityLevel(severity int) string {
	switch {
	case severity >= 80:
		return "critical"
	case severity >= 60:
		return "high"
	case severity >= 40:
		return "medium"
	default:
		return "low"
	}
}

// lookupGeoIP performs geographic IP address lookup using MaxMind GeoLite2 database.
// Returns geographic information including country, city, and coordinates for threat intelligence.
func (rtp *RealTimeProcessor) lookupGeoIP(ipAddr string) GeoIPInfo {
	rtp.logger.Debugf("GeoIP lookup started for IP: %s", ipAddr)

	if rtp.geoipDB == nil {
		rtp.logger.Debugf("GeoIP database not available, returning unknown")
		return GeoIPInfo{Country: "unknown", City: "unknown", Latitude: 0, Longitude: 0}
	}

	ip := net.ParseIP(ipAddr)
	if ip == nil {
		rtp.logger.Debugf("Invalid IP address format: %s", ipAddr)
		return GeoIPInfo{Country: "unknown", City: "unknown", Latitude: 0, Longitude: 0}
	}

	// Skip private/local IP addresses as they won't have geographic data
	if ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		rtp.logger.Debugf("IP %s is private/local - IsPrivate: %v, IsLoopback: %v, IsLinkLocal: %v",
			ipAddr, ip.IsPrivate(), ip.IsLoopback(), ip.IsLinkLocalUnicast())
		return GeoIPInfo{Country: "private", City: "private", Latitude: 0, Longitude: 0}
	}

	city, err := rtp.geoipDB.City(ip)
	if err != nil {
		rtp.logger.Debugf("GeoIP lookup failed for %s: %v", ipAddr, err)
		return GeoIPInfo{Country: "unknown", City: "unknown", Latitude: 0, Longitude: 0}
	}

	rtp.logger.Debugf("GeoIP lookup success for %s: Country=%s, City=%s",
		ipAddr, city.Country.IsoCode, city.City.Names["en"])

	return GeoIPInfo{
		Country:   city.Country.IsoCode,
		City:      city.City.Names["en"],
		Latitude:  city.Location.Latitude,
		Longitude: city.Location.Longitude,
	}
}

// triggerAlert handles immediate notification for critical security events.
// Current implementation logs critical alerts; in production integrate with Slack, PagerDuty, etc.
func (rtp *RealTimeProcessor) triggerAlert(event ModSecurityEvent, severity int) {
	geoInfo := rtp.lookupGeoIP(event.Transaction.ClientIP)

	rtp.logger.WithFields(logrus.Fields{
		"alert_type":  "CRITICAL_SECURITY_EVENT",
		"tx_id":       event.Transaction.ID,
		"client_ip":   event.Transaction.ClientIP,
		"geo_country": geoInfo.Country,
		"geo_city":    geoInfo.City,
		"severity":    severity,
		"rule_id":     event.Classification.RuleID,
		"uri":         event.Transaction.Request.URI,
	}).Warn("🚨 CRITICAL SECURITY ALERT TRIGGERED")
}

// handleInfluxDBErrors monitors and logs InfluxDB write operation failures.
func (rtp *RealTimeProcessor) handleInfluxDBErrors(ctx context.Context) {
	errorsCh := rtp.writeAPI.Errors()
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errorsCh:
			rtp.logger.Errorf("InfluxDB write error: %v", err)
		}
	}
}

// main initializes and starts the real-time WAF event processor.
// It handles configuration loading, service initialization, signal handling for
// graceful shutdown, and error reporting.
func main() {
	config := Config{
		KafkaBrokers:   getEnv("KAFKA_BROKERS", "kafka:9092"),
		KafkaTopic:     getEnv("KAFKA_TOPIC", "waf-realtime-events"),
		KafkaGroup:     getEnv("KAFKA_GROUP", "realtime-processor"),
		InfluxDBURL:    getEnv("INFLUXDB_URL", "http://localhost:8086"),
		InfluxDBToken:  getEnv("INFLUXDB_TOKEN", "admin-token-change-me"),
		InfluxDBOrg:    getEnv("INFLUXDB_ORG", "waf-org"),
		InfluxDBBucket: getEnv("INFLUXDB_BUCKET", "waf-realtime"),
		GeoIPDBPath:    getEnv("GEOIP_DB_PATH", "/data/GeoLite2-City.mmdb"),
	}

	processor := NewRealTimeProcessor(config)

	ctx, cancel := context.WithCancel(context.Background())
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("Received shutdown signal")
		cancel()
	}()

	if err := processor.Start(ctx); err != nil {
		log.Fatalf("Error starting processor: %v", err)
	}
}

// getEnv retrieves environment variables with fallback to default values.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

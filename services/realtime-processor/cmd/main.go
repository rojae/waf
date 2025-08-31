// Package main implements a real-time WAF (Web Application Firewall) event processor.
package main

import (
	"context"
	"encoding/json"
	"errors"
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

// ===== Config =====
type Config struct {
	KafkaBrokers   string
	KafkaTopic     string
	KafkaGroup     string
	InfluxDBURL    string
	InfluxDBToken  string
	InfluxDBOrg    string
	InfluxDBBucket string
	GeoIPDBPath    string
	DualWrite      bool
}

// ===== DTOs =====
type GeoIPInfo struct {
	Country   string  `json:"country"`
	City      string  `json:"city"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

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

// ===== Processor =====
type RealTimeProcessor struct {
	config       Config
	kafkaReader  *kafka.Reader
	influxClient influxdb2.Client
	writeAPI     api.WriteAPI         // async (legacy waf_events)
	writeBlk     api.WriteAPIBlocking // blocking (waf_requests)
	logger       *logrus.Logger
	geoipDB      *geoip2.Reader
}

// NewRealTimeProcessor initializes processor.
func NewRealTimeProcessor(config Config) *RealTimeProcessor {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.DebugLevel)

	// GeoIP
	var geoipDB *geoip2.Reader
	if config.GeoIPDBPath != "" {
		if db, err := geoip2.Open(config.GeoIPDBPath); err != nil {
			logger.Warnf("Failed to open GeoIP database: %v (geo enrichment disabled)", err)
		} else {
			logger.Info("GeoIP database loaded successfully")
			geoipDB = db
		}
	}

	// Kafka reader
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:           strings.Split(config.KafkaBrokers, ","),
		GroupID:           config.KafkaGroup,
		Topic:             config.KafkaTopic,
		MinBytes:          10e3,
		MaxBytes:          10e6,
		HeartbeatInterval: 3 * time.Second,
		SessionTimeout:    45 * time.Second,
		RebalanceTimeout:  60 * time.Second,
	})

	// InfluxDB
	influxClient := influxdb2.NewClient(config.InfluxDBURL, config.InfluxDBToken)
	writeAPI := influxClient.WriteAPI(config.InfluxDBOrg, config.InfluxDBBucket)
	writeBlk := influxClient.WriteAPIBlocking(config.InfluxDBOrg, config.InfluxDBBucket)

	logger.WithFields(logrus.Fields{
		"kafka_brokers": config.KafkaBrokers,
		"kafka_topic":   config.KafkaTopic,
		"kafka_group":   config.KafkaGroup,
		"influx_url":    config.InfluxDBURL,
		"influx_org":    config.InfluxDBOrg,
		"influx_bucket": config.InfluxDBBucket,
		"dual_write":    config.DualWrite,
	}).Info("Realtime processor config")

	return &RealTimeProcessor{
		config:       config,
		kafkaReader:  reader,
		influxClient: influxClient,
		writeAPI:     writeAPI,
		writeBlk:     writeBlk,
		logger:       logger,
		geoipDB:      geoipDB,
	}
}

// ===== Start / Close =====
func (rtp *RealTimeProcessor) Start(ctx context.Context) error {
	rtp.logger.Info("Starting real-time processor (Kafka mode)...")

	// drain async write errors
	go rtp.handleInfluxDBErrors(ctx)

	for {
		m, err := rtp.kafkaReader.ReadMessage(ctx)
		if err != nil {
			if err == context.Canceled {
				break
			}
			// Rebalance/취소류 잡음은 제외
			if !isNoise(err) {
				rtp.logger.Errorf("Kafka read error: %v", err)
			} else {
				rtp.logger.Debugf("Kafka transient: %v", err)
			}
			continue
		}

		var event ModSecurityEvent
		if err := json.Unmarshal(m.Value, &event); err != nil {
			rtp.logger.Errorf("Error unmarshaling event: %v", err)
			continue
		}

		severity := rtp.calculateSeverity(event)
		rtp.writeToInfluxDB(event, severity)

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

func (rtp *RealTimeProcessor) Close() {
	if rtp.writeAPI != nil {
		rtp.writeAPI.Flush()
	}
	if rtp.influxClient != nil {
		rtp.influxClient.Close()
	}
	if rtp.kafkaReader != nil {
		_ = rtp.kafkaReader.Close()
	}
}

// ===== Helper: Kafka noise filter =====
func isNoise(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return errors.Is(err, context.Canceled) ||
		errors.Is(err, context.DeadlineExceeded) ||
		strings.Contains(s, "context canceled") ||
		strings.Contains(s, "deadline exceeded") ||
		strings.Contains(s, "rebalance") ||
		strings.Contains(s, "coordinator")
}

// ===== Logic =====
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

func (rtp *RealTimeProcessor) isHighRiskIP(ip string) bool {
	for _, riskIP := range []string{"192.168.1.100", "10.0.0.50"} {
		if ip == riskIP {
			return true
		}
	}
	return false
}

// ===== Influx write =====
func (rtp *RealTimeProcessor) writeToInfluxDB(event ModSecurityEvent, severity int) {
	geoInfo := rtp.lookupGeoIP(event.Transaction.ClientIP)
	blocked := rtp.determineBlocked(event.Transaction.Response.HTTPCode, severity)
	attackType := rtp.mapAttackType(event.Classification.RuleID)
	ts := rtp.parseEventTime(event)

	// 1) legacy: waf_events (async)
	pLegacy := influxdb2.NewPointWithMeasurement("waf_events").
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
		SetTime(ts)
	rtp.writeAPI.WritePoint(pLegacy)

	// 2) new: waf_requests (blocking)
	if rtp.config.DualWrite {
		pRequests := influxdb2.NewPointWithMeasurement("waf_requests").
			AddTag("client_ip", event.Transaction.ClientIP).
			AddTag("method", event.Transaction.Request.Method).
			AddTag("rule_id", event.Classification.RuleID).
			AddTag("attack_type", attackType).
			AddTag("blocked", map[bool]string{true: "true", false: "false"}[blocked]).
			AddTag("country", geoInfo.Country).
			AddTag("city", geoInfo.City).
			AddTag("severity", rtp.getSeverityLevel(severity)).
			AddField("count", 1).
			AddField("anomaly_score", event.Transaction.AnomalyScore).
			AddField("severity_score", severity).
			AddField("response_code", event.Transaction.Response.HTTPCode).
			AddField("uri", event.Transaction.Request.URI).
			AddField("latitude", geoInfo.Latitude).
			AddField("longitude", geoInfo.Longitude).
			SetTime(ts)

		if err := rtp.writeBlk.WritePoint(context.Background(), pRequests); err != nil {
			rtp.logger.WithError(err).Error("failed to write waf_requests")
		} else {
			rtp.logger.WithFields(logrus.Fields{
				"measurement": "waf_requests",
				"bucket":      rtp.config.InfluxDBBucket,
			}).Debug("wrote waf_requests")
		}
	}
}

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

func (rtp *RealTimeProcessor) determineBlocked(httpCode, severity int) bool {
	return httpCode == 403 || severity >= 80
}

func (rtp *RealTimeProcessor) mapAttackType(ruleID string) string {
	switch {
	case strings.HasPrefix(ruleID, "942"):
		return "sqli"
	case strings.HasPrefix(ruleID, "941"):
		return "xss"
	case strings.HasPrefix(ruleID, "932"):
		return "rce"
	case strings.HasPrefix(ruleID, "930"):
		return "lfi"
	case strings.HasPrefix(ruleID, "920"):
		return "protocol"
	default:
		return "other"
	}
}

func (rtp *RealTimeProcessor) parseEventTime(event ModSecurityEvent) time.Time {
	for _, c := range []string{
		strings.TrimSpace(event.Transaction.TimeStamp),
		strings.TrimSpace(event.Classification.Timestamp),
	} {
		if c == "" {
			continue
		}
		for _, l := range []string{
			time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05Z07:00",
		} {
			if t, err := time.Parse(l, c); err == nil {
				return t
			}
		}
	}
	return time.Now()
}

func (rtp *RealTimeProcessor) lookupGeoIP(ipAddr string) GeoIPInfo {
	if rtp.geoipDB == nil {
		return GeoIPInfo{Country: "unknown", City: "unknown", Latitude: 0, Longitude: 0}
	}
	ip := net.ParseIP(ipAddr)
	if ip == nil || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return GeoIPInfo{Country: "private", City: "private", Latitude: 0, Longitude: 0}
	}
	city, err := rtp.geoipDB.City(ip)
	if err != nil {
		return GeoIPInfo{Country: "unknown", City: "unknown", Latitude: 0, Longitude: 0}
	}
	return GeoIPInfo{
		Country:   city.Country.IsoCode,
		City:      city.City.Names["en"],
		Latitude:  city.Location.Latitude,
		Longitude: city.Location.Longitude,
	}
}

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

// drain async write errors
func (rtp *RealTimeProcessor) handleInfluxDBErrors(ctx context.Context) {
	errorsCh := rtp.writeAPI.Errors()
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errorsCh:
			if err != nil {
				rtp.logger.Errorf("InfluxDB write error: %v", err)
			}
		}
	}
}

// ===== main =====
func main() {
	config := Config{
		KafkaBrokers:   getEnv("KAFKA_BROKERS", "kafka:9092"),
		KafkaTopic:     getEnv("KAFKA_TOPIC", "waf-realtime-events"),
		KafkaGroup:     getEnv("KAFKA_GROUP", "realtime-processor"),
		InfluxDBURL:    getEnv("INFLUXDB_URL", "http://waf-influxdb:8086"), // ★ 컨테이너 내 기본값
		InfluxDBToken:  getEnv("INFLUXDB_TOKEN", "admin-token-change-me"),
		InfluxDBOrg:    getEnv("INFLUXDB_ORG", "waf-org"),
		InfluxDBBucket: getEnv("INFLUXDB_BUCKET", "waf-realtime"),
		GeoIPDBPath:    getEnv("GEOIP_DB_PATH", "/data/GeoLite2-City.mmdb"),
		DualWrite:      strings.ToLower(getEnv("INFLUXDB_DUAL_WRITE", "true")) == "true",
	}

	processor := NewRealTimeProcessor(config)
	defer processor.Close()

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

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

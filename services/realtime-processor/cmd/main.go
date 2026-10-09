// Package main implements a real-time WAF (Web Application Firewall) event processor.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
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
		UniqueID     string `json:"unique_id"`
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
		Intervention struct {
			Status     int    `json:"status"`
			Disruptive bool   `json:"disruptive"`
			Action     string `json:"action"`
		} `json:"intervention"`
		Messages []struct {
			Message string `json:"message"`
			Details struct {
				RuleID   string   `json:"ruleId"`
				Msg      string   `json:"msg"`
				Message  string   `json:"message"`
				Severity string   `json:"severity"`
				Tags     []string `json:"tags"`
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

type kafkaMessageReader interface {
	FetchMessage(context.Context) (kafka.Message, error)
	CommitMessages(context.Context, ...kafka.Message) error
	Close() error
}

type eventSink interface {
	WriteEvent(context.Context, ModSecurityEvent, int) error
}

type influxPointWriter interface {
	WritePoint(context.Context, ...*write.Point) error
}

// ===== Processor =====
type RealTimeProcessor struct {
	config       Config
	kafkaReader  kafkaMessageReader
	influxClient influxdb2.Client
	writeBlk     influxPointWriter
	sink         eventSink
	retryBackoff time.Duration
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

	processor := &RealTimeProcessor{
		config:       config,
		kafkaReader:  reader,
		influxClient: influxClient,
		writeBlk:     writeBlk,
		sink:         nil,
		retryBackoff: 200 * time.Millisecond,
		logger:       logger,
		geoipDB:      geoipDB,
	}
	processor.sink = processor
	return processor
}

// ===== Start / Close =====
func (rtp *RealTimeProcessor) Start(ctx context.Context) error {
	rtp.logger.Info("Starting real-time processor (Kafka mode)...")

	for {
		m, err := rtp.kafkaReader.FetchMessage(ctx)
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

		if err := rtp.processFetchedMessage(ctx, m); err != nil {
			return err
		}
	}
	return nil
}

func (rtp *RealTimeProcessor) processFetchedMessage(ctx context.Context, m kafka.Message) error {
	var event ModSecurityEvent
	if err := json.Unmarshal(m.Value, &event); err != nil {
		rtp.logger.WithError(err).Error("rejecting malformed WAF event")
		// Malformed JSON is treated as poison input and committed so it cannot
		// block the partition forever. Valid events are never committed until
		// all required writes succeed.
		return rtp.kafkaReader.CommitMessages(ctx, m)
	}

	rtp.normalizeEvent(&event, m)
	severity := rtp.calculateSeverity(event)
	if err := rtp.writeEventWithRetry(ctx, event, severity); err != nil {
		return err
	}
	if err := rtp.kafkaReader.CommitMessages(ctx, m); err != nil {
		return err
	}

	if severity >= 80 {
		rtp.triggerAlert(event, severity)
	}

	rtp.logger.WithFields(logrus.Fields{
		"tx_id":     eventID(event),
		"client_ip": event.Transaction.ClientIP,
		"severity":  severity,
		"rule_id":   effectiveRuleID(event),
	}).Info("Processed real-time event")
	return nil
}

func (rtp *RealTimeProcessor) writeEventWithRetry(ctx context.Context, event ModSecurityEvent, severity int) error {
	backoff := rtp.retryBackoff
	if backoff <= 0 {
		backoff = 200 * time.Millisecond
	}
	for {
		if err := rtp.sink.WriteEvent(ctx, event, severity); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			rtp.logger.WithError(err).Warn("required WAF event write failed; retrying before committing Kafka offset")
			timer := time.NewTimer(backoff)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
			if backoff < 5*time.Second {
				backoff *= 2
			}
			continue
		}
		return nil
	}
}

func (rtp *RealTimeProcessor) Close() {
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
	ruleID := effectiveRuleID(event)
	if ruleID != "" {
		switch {
		case strings.HasPrefix(ruleID, "942"): // SQLi
			severity += 30
		case strings.HasPrefix(ruleID, "941"): // XSS
			severity += 25
		case strings.HasPrefix(ruleID, "932"): // RCE
			severity += 35
		case strings.HasPrefix(ruleID, "930"): // LFI
			severity += 20
		}
	}
	return severity
}

// ===== Influx write =====
func (rtp *RealTimeProcessor) WriteEvent(ctx context.Context, event ModSecurityEvent, severity int) error {
	geoInfo := rtp.lookupGeoIP(event.Transaction.ClientIP)
	ruleID := effectiveRuleID(event)
	eventID := eventID(event)
	blocked := rtp.determineBlocked(event)
	attackType := rtp.mapAttackType(ruleID)
	ts := rtp.parseEventTime(event)

	// 1) legacy: waf_events. It is written through the blocking API so the
	// Kafka offset is not committed before this required measurement is durable.
	pLegacy := influxdb2.NewPointWithMeasurement("waf_events").
		AddTag("event_id", eventID).
		AddTag("client_ip", event.Transaction.ClientIP).
		AddTag("method", event.Transaction.Request.Method).
		AddTag("rule_id", ruleID).
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
	if err := rtp.writeBlk.WritePoint(ctx, pLegacy); err != nil {
		return err
	}

	// 2) new: waf_requests (blocking)
	if rtp.config.DualWrite {
		pRequests := influxdb2.NewPointWithMeasurement("waf_requests").
			AddTag("event_id", eventID).
			AddTag("client_ip", event.Transaction.ClientIP).
			AddTag("method", event.Transaction.Request.Method).
			AddTag("rule_id", ruleID).
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

		if err := rtp.writeBlk.WritePoint(ctx, pRequests); err != nil {
			return err
		}
		rtp.logger.WithFields(logrus.Fields{
			"measurement": "waf_requests",
			"bucket":      rtp.config.InfluxDBBucket,
		}).Debug("wrote waf_requests")
	}
	return nil
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

func (rtp *RealTimeProcessor) determineBlocked(event ModSecurityEvent) bool {
	if event.Transaction.Intervention.Disruptive {
		return true
	}
	switch strings.ToLower(event.Transaction.Intervention.Action) {
	case "deny", "drop", "block":
		return true
	}
	// HTTP 403 is a response-status inference, not a severity inference.
	return event.Transaction.Response.HTTPCode == 403 || event.Transaction.Intervention.Status == 403
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

func (rtp *RealTimeProcessor) normalizeEvent(event *ModSecurityEvent, m kafka.Message) {
	if event.Transaction.ID == "" && event.Transaction.UniqueID == "" {
		event.Transaction.ID = fmt.Sprintf("kafka-%s-%d-%d", m.Topic, m.Partition, m.Offset)
	}
	if event.Classification.RuleID == "" {
		event.Classification.RuleID = firstMessageRuleID(*event)
	}
	if event.Classification.Timestamp == "" && event.Transaction.TimeStamp == "" {
		kafkaTime := m.Time
		if kafkaTime.IsZero() {
			kafkaTime = time.Now()
		}
		event.Classification.Timestamp = kafkaTime.UTC().Format(time.RFC3339Nano)
	}
}

func firstMessageRuleID(event ModSecurityEvent) string {
	for _, msg := range event.Transaction.Messages {
		if msg.Details.RuleID != "" {
			return msg.Details.RuleID
		}
	}
	return ""
}

func effectiveRuleID(event ModSecurityEvent) string {
	if event.Classification.RuleID != "" {
		return event.Classification.RuleID
	}
	return firstMessageRuleID(event)
}

func eventID(event ModSecurityEvent) string {
	if event.Transaction.ID != "" {
		return event.Transaction.ID
	}
	return event.Transaction.UniqueID
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
		"tx_id":       eventID(event),
		"client_ip":   event.Transaction.ClientIP,
		"geo_country": geoInfo.Country,
		"geo_city":    geoInfo.City,
		"severity":    severity,
		"rule_id":     effectiveRuleID(event),
		"uri":         event.Transaction.Request.URI,
	}).Warn("🚨 CRITICAL SECURITY ALERT TRIGGERED")
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

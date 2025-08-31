package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/segmentio/kafka-go"
)

type Alert struct {
	ClientIP      string `json:"CLIENT_IP"`
	Method        string `json:"METHOD"`
	URI           string `json:"URI"`
	Status        int    `json:"STATUS"`
	AlertTimestamp string `json:"ALERT_TIMESTAMP"`
	AlertType     string `json:"ALERT_TYPE"`
	Severity      string `json:"SEVERITY"`
	Description   string `json:"DESCRIPTION"`
	MetricValue   int    `json:"METRIC_VALUE"`
}

func main() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{"kafka:9092"},
		Topic:   "waf-alerts",
		GroupID: "alert-processor",
	})
	defer reader.Close()

	fmt.Println("🚨 WAF Alert Processor Started - Listening for alerts...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Println("\n⏹️  Shutting down alert processor...")
		cancel()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			msg, err := reader.ReadMessage(ctx)
			if err != nil {
				if err == context.Canceled {
					return
				}
				log.Printf("Error reading message: %v", err)
				continue
			}

			var alert Alert
			if err := json.Unmarshal(msg.Value, &alert); err != nil {
				log.Printf("Error unmarshaling alert: %v", err)
				continue
			}

			processAlert(alert)
		}
	}
}

func processAlert(alert Alert) {
	timestamp := time.Now().Format("15:04:05")
	
	// Color codes for severity
	severityColor := map[string]string{
		"CRITICAL": "\033[31m", // Red
		"HIGH":     "\033[33m", // Yellow  
		"MEDIUM":   "\033[36m", // Cyan
		"LOW":      "\033[32m", // Green
	}
	reset := "\033[0m"

	color := severityColor[alert.Severity]
	if color == "" {
		color = reset
	}

	fmt.Printf("\n%s🔥 [%s] %s ALERT %s\n", color, timestamp, alert.Severity, reset)
	fmt.Printf("   📍 Type: %s\n", alert.AlertType)
	fmt.Printf("   🌐 Client: %s\n", alert.ClientIP)
	if alert.Method != "" {
		fmt.Printf("   🔗 Request: %s %s\n", alert.Method, alert.URI)
		fmt.Printf("   📊 Status: %d\n", alert.Status)
	}
	fmt.Printf("   📝 Description: %s\n", alert.Description)
	fmt.Printf("   ⏰ Timestamp: %s\n", alert.AlertTimestamp)
	
	// Send to external systems based on severity
	switch alert.Severity {
	case "CRITICAL":
		fmt.Printf("   📢 %sNotifying PagerDuty + Slack%s\n", color, reset)
		// sendToPagerDuty(alert)
		// sendToSlack(alert)
	case "HIGH":
		fmt.Printf("   📢 %sNotifying Slack%s\n", color, reset)
		// sendToSlack(alert)
	case "MEDIUM":
		fmt.Printf("   📢 %sLogging to file%s\n", color, reset)
		// logToFile(alert)
	}
	
	fmt.Printf("%s%s%s\n", color, strings.Repeat("─", 60), reset)
}
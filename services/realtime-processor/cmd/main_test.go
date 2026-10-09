package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/influxdata/influxdb-client-go/v2/api/write"
	"github.com/segmentio/kafka-go"
	"github.com/sirupsen/logrus"
)

type fakeReader struct {
	commits int
}

func (r *fakeReader) FetchMessage(context.Context) (kafka.Message, error) {
	return kafka.Message{}, context.Canceled
}

func (r *fakeReader) CommitMessages(context.Context, ...kafka.Message) error {
	r.commits++
	return nil
}

func (r *fakeReader) Close() error {
	return nil
}

type fakeSink struct {
	failures       int
	calls          int
	seenTimestamps []string
	seenRuleIDs    []string
	seenSeverity   []int
}

func (s *fakeSink) WriteEvent(_ context.Context, event ModSecurityEvent, severity int) error {
	s.calls++
	s.seenTimestamps = append(s.seenTimestamps, event.Classification.Timestamp)
	s.seenRuleIDs = append(s.seenRuleIDs, effectiveRuleID(event))
	s.seenSeverity = append(s.seenSeverity, severity)
	if s.calls <= s.failures {
		return errors.New("sink unavailable")
	}
	return nil
}

type fakePointWriter struct {
	points []*write.Point
}

func (w *fakePointWriter) WritePoint(_ context.Context, points ...*write.Point) error {
	w.points = append(w.points, points...)
	return nil
}

func newTestProcessor(reader *fakeReader, sink *fakeSink) *RealTimeProcessor {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return &RealTimeProcessor{
		config:       Config{DualWrite: true},
		kafkaReader:  reader,
		sink:         sink,
		retryBackoff: time.Millisecond,
		logger:       logger,
	}
}

func TestProcessFetchedMessageDoesNotCommitWhenRequiredWriteNeverSucceeds(t *testing.T) {
	reader := &fakeReader{}
	sink := &fakeSink{failures: 100}
	processor := newTestProcessor(reader, sink)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()

	err := processor.processFetchedMessage(ctx, kafka.Message{Value: []byte(validEventJSON()), Time: time.Unix(1700000000, 0)})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected retry loop to stop on context deadline, got %v", err)
	}
	if reader.commits != 0 {
		t.Fatalf("expected no commit when writes fail, got %d", reader.commits)
	}
	if sink.calls < 2 {
		t.Fatalf("expected bounded retry attempts before cancellation, got %d", sink.calls)
	}
}

func TestProcessFetchedMessageRetriesThenCommitsWithStableTimestamp(t *testing.T) {
	reader := &fakeReader{}
	sink := &fakeSink{failures: 1}
	processor := newTestProcessor(reader, sink)
	kafkaTime := time.Date(2026, 9, 22, 1, 2, 3, 4, time.UTC)

	err := processor.processFetchedMessage(context.Background(), kafka.Message{
		Value: []byte(validEventJSON()),
		Time:  kafkaTime,
	})
	if err != nil {
		t.Fatalf("processFetchedMessage returned error: %v", err)
	}
	if reader.commits != 1 {
		t.Fatalf("expected one commit after successful writes, got %d", reader.commits)
	}
	if sink.calls != 2 {
		t.Fatalf("expected one retry then success, got %d calls", sink.calls)
	}
	if sink.seenTimestamps[0] != sink.seenTimestamps[1] {
		t.Fatalf("expected stable retry timestamp, got %q then %q", sink.seenTimestamps[0], sink.seenTimestamps[1])
	}
	if sink.seenTimestamps[0] != kafkaTime.Format(time.RFC3339Nano) {
		t.Fatalf("expected kafka timestamp fallback, got %q", sink.seenTimestamps[0])
	}
	if sink.seenRuleIDs[0] != "942100" {
		t.Fatalf("expected ruleId parsed from message details, got %q", sink.seenRuleIDs[0])
	}
}

func TestMalformedEventIsCommittedAsPoisonInput(t *testing.T) {
	reader := &fakeReader{}
	sink := &fakeSink{}
	processor := newTestProcessor(reader, sink)

	err := processor.processFetchedMessage(context.Background(), kafka.Message{Value: []byte("{")})
	if err != nil {
		t.Fatalf("malformed event handling returned error: %v", err)
	}
	if reader.commits != 1 {
		t.Fatalf("expected malformed poison input to be committed, got %d commits", reader.commits)
	}
	if sink.calls != 0 {
		t.Fatalf("malformed input must not be written, got %d sink calls", sink.calls)
	}
}

func TestBlockedIsNotInferredFromSeverity(t *testing.T) {
	processor := newTestProcessor(&fakeReader{}, &fakeSink{})
	var event ModSecurityEvent
	event.Transaction.Response.HTTPCode = 200

	if processor.determineBlocked(event) {
		t.Fatal("high severity alone must not imply blocked")
	}
	event.Transaction.Response.HTTPCode = 403
	if !processor.determineBlocked(event) {
		t.Fatal("HTTP 403 should be treated as blocked response inference")
	}
}

func TestWriteEventUsesEventIDToDistinguishSameTimestampEvents(t *testing.T) {
	writer := &fakePointWriter{}
	processor := &RealTimeProcessor{
		config:   Config{DualWrite: true},
		writeBlk: writer,
		logger:   logrus.New(),
	}
	processor.logger.SetOutput(io.Discard)

	eventA := mustEvent(t, validEventJSON())
	eventB := mustEvent(t, validEventJSON())
	eventB.Transaction.ID = "tx-2"

	if err := processor.WriteEvent(context.Background(), eventA, processor.calculateSeverity(eventA)); err != nil {
		t.Fatalf("WriteEvent eventA returned error: %v", err)
	}
	if err := processor.WriteEvent(context.Background(), eventB, processor.calculateSeverity(eventB)); err != nil {
		t.Fatalf("WriteEvent eventB returned error: %v", err)
	}

	if len(writer.points) != 4 {
		t.Fatalf("expected two measurements per event, got %d points", len(writer.points))
	}
	if got := pointTag(writer.points[1], "event_id"); got != "tx-1" {
		t.Fatalf("expected first waf_requests event_id tx-1, got %q", got)
	}
	if got := pointTag(writer.points[3], "event_id"); got != "tx-2" {
		t.Fatalf("expected second waf_requests event_id tx-2, got %q", got)
	}
	if !writer.points[1].Time().Equal(writer.points[3].Time()) {
		t.Fatalf("expected same raw timestamp for both events")
	}
}

func TestWriteEventRetryKeepsSameInfluxPointIdentity(t *testing.T) {
	writer := &fakePointWriter{}
	processor := &RealTimeProcessor{
		config:   Config{DualWrite: true},
		writeBlk: writer,
		logger:   logrus.New(),
	}
	processor.logger.SetOutput(io.Discard)
	event := mustEvent(t, validEventJSON())
	severity := processor.calculateSeverity(event)

	if err := processor.WriteEvent(context.Background(), event, severity); err != nil {
		t.Fatalf("first WriteEvent returned error: %v", err)
	}
	if err := processor.WriteEvent(context.Background(), event, severity); err != nil {
		t.Fatalf("retry WriteEvent returned error: %v", err)
	}

	if len(writer.points) != 4 {
		t.Fatalf("expected two dual-write attempts, got %d points", len(writer.points))
	}
	first := writer.points[1]
	retry := writer.points[3]
	if pointTag(first, "event_id") != pointTag(retry, "event_id") {
		t.Fatalf("expected retry event_id to stay stable")
	}
	if !first.Time().Equal(retry.Time()) {
		t.Fatalf("expected retry timestamp to stay stable")
	}
}

func mustEvent(t *testing.T, raw string) ModSecurityEvent {
	t.Helper()
	var event ModSecurityEvent
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("unmarshal event: %v", err)
	}
	event.Transaction.TimeStamp = "2026-09-22T00:00:00Z"
	return event
}

func pointTag(point *write.Point, key string) string {
	for _, tag := range point.TagList() {
		if tag.Key == key {
			return tag.Value
		}
	}
	return ""
}

func validEventJSON() string {
	return `{
		"transaction": {
			"id": "tx-1",
			"client_ip": "203.0.113.10",
			"anomaly_score": 5,
			"request": {"method": "GET", "uri": "/search?q='", "headers": {}},
			"response": {"http_code": 200},
			"messages": [{
				"message": "SQL injection detected",
				"details": {
					"ruleId": "942100",
					"severity": "CRITICAL",
					"tags": ["attack-sqli"]
				}
			}]
		}
	}`
}

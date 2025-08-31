-- WAF Analytics Database Schema
CREATE DATABASE IF NOT EXISTS waf_analytics;

-- Events 테이블 (분석용 로그)
CREATE TABLE IF NOT EXISTS waf_analytics.events (
    timestamp DateTime64(3) DEFAULT now(),
    date Date DEFAULT toDate(timestamp),
    tx_id String,
    client_ip IPv4,
    uri String,
    method String,
    status_code UInt16,
    rule_id String,
    anomaly_score UInt16,
    severity String,
    category String,
    msg String,
    classification_track String,
    user_agent String,
    country_code String,
    city String,
    is_scanner_detected Bool DEFAULT false,
    tags Array(String) DEFAULT []
) ENGINE = MergeTree()
PARTITION BY date
ORDER BY (timestamp, client_ip, rule_id)
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- IP별 공격 패턴 집계 테이블  
CREATE TABLE IF NOT EXISTS waf_analytics.ip_attack_summary (
    date Date,
    hour UInt8,
    client_ip IPv4,
    country_code String,
    attack_count UInt32,
    avg_anomaly_score Float32,
    max_anomaly_score UInt16,
    unique_rules UInt16,
    unique_uris UInt16,
    first_seen DateTime,
    last_seen DateTime
) ENGINE = SummingMergeTree()
PARTITION BY date
ORDER BY (date, hour, client_ip)
TTL date + INTERVAL 90 DAY;

-- 룰별 공격 통계
CREATE TABLE IF NOT EXISTS waf_analytics.rule_statistics (
    date Date,
    rule_id String,
    category String,
    severity String,
    trigger_count UInt32,
    unique_ips UInt32,
    avg_anomaly_score Float32,
    blocked_count UInt32,
    allowed_count UInt32
) ENGINE = SummingMergeTree()
PARTITION BY date  
ORDER BY (date, rule_id)
TTL date + INTERVAL 180 DAY;

-- URI별 공격 패턴
CREATE TABLE IF NOT EXISTS waf_analytics.uri_attack_patterns (
    date Date,
    uri String,
    method String,
    attack_count UInt32,
    unique_ips UInt32,
    top_rule_id String,
    avg_response_time_ms Float32,
    blocked_ratio Float32
) ENGINE = SummingMergeTree()
PARTITION BY date
ORDER BY (date, uri, method)
TTL date + INTERVAL 90 DAY;

-- 실시간 집계용 Materialized Views
CREATE MATERIALIZED VIEW IF NOT EXISTS waf_analytics.mv_ip_hourly_stats
TO waf_analytics.ip_attack_summary AS
SELECT
    toDate(timestamp) AS date,
    toHour(timestamp) AS hour,
    client_ip,
    any(country_code) AS country_code,
    count() AS attack_count,
    avg(anomaly_score) AS avg_anomaly_score,
    max(anomaly_score) AS max_anomaly_score,
    uniqExact(rule_id) AS unique_rules,
    uniqExact(uri) AS unique_uris,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
FROM waf_analytics.events
WHERE anomaly_score > 0
GROUP BY date, hour, client_ip;

CREATE MATERIALIZED VIEW IF NOT EXISTS waf_analytics.mv_rule_daily_stats  
TO waf_analytics.rule_statistics AS
SELECT
    toDate(timestamp) AS date,
    rule_id,
    any(category) AS category,
    any(severity) AS severity,
    count() AS trigger_count,
    uniqExact(client_ip) AS unique_ips,
    avg(anomaly_score) AS avg_anomaly_score,
    sumIf(1, status_code >= 400) AS blocked_count,
    sumIf(1, status_code < 400) AS allowed_count
FROM waf_analytics.events
WHERE rule_id != ''
GROUP BY date, rule_id;

-- 스캐너 감지 전용 테이블
CREATE TABLE IF NOT EXISTS waf_analytics.scanner_events (
    timestamp DateTime64(3) DEFAULT now(),
    date Date DEFAULT toDate(timestamp),
    client_ip IPv4,
    user_agent String,
    scan_type String,
    total_requests UInt32,
    unique_uris UInt16,
    scan_duration_seconds UInt32,
    detected_vulnerabilities Array(String),
    risk_score UInt8
) ENGINE = MergeTree()
PARTITION BY date
ORDER BY (timestamp, client_ip)
TTL timestamp + INTERVAL 30 DAY;

-- 분석용 뷰들
CREATE VIEW IF NOT EXISTS waf_analytics.v_top_attackers AS
SELECT
    client_ip,
    country_code,
    sum(attack_count) AS total_attacks,
    avg(avg_anomaly_score) AS avg_score,
    max(max_anomaly_score) AS max_score,
    min(first_seen) AS first_attack,
    max(last_seen) AS last_attack,
    uniqExact(date) AS active_days
FROM waf_analytics.ip_attack_summary
WHERE date >= today() - 30
GROUP BY client_ip, country_code
ORDER BY total_attacks DESC
LIMIT 100;

CREATE VIEW IF NOT EXISTS waf_analytics.v_attack_trends AS
SELECT
    date,
    sum(trigger_count) AS daily_attacks,
    uniqExact(rule_id) AS unique_rules_triggered,
    avg(avg_anomaly_score) AS avg_severity,
    sum(blocked_count) AS blocked_requests,
    sum(allowed_count) AS allowed_requests,
    blocked_requests / (blocked_requests + allowed_requests) * 100 AS block_rate
FROM waf_analytics.rule_statistics
WHERE date >= today() - 90
GROUP BY date
ORDER BY date DESC;
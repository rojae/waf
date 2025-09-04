-- Simplified DDL for Analytics Track Processing
-- Maps ModSecurity events to enriched analytics data for Kibana visualization

-- 1) RAW Stream from Fluent Bit (simplified structure)
CREATE STREAM MODSEC_RAW (
  transaction STRUCT<
    client_ip STRING,
    time_stamp STRING,
    request STRUCT<
      method STRING,
      uri STRING,
      headers MAP<STRING, STRING>
    >,
    response STRUCT<
      http_code INT
    >,
    messages ARRAY<STRUCT<
      message STRING,
      details STRUCT<
        ruleId STRING,
        match STRING,
        data STRING,
        severity STRING
      >
    >>
  >,
  track STRING,
  processed_timestamp STRING
) WITH (
  KAFKA_TOPIC='waf-realtime-events',
  VALUE_FORMAT='JSON'
);

-- 2) Analytics Stream (filter analytics track only)
CREATE STREAM MODSEC_ANALYTICS AS
SELECT 
  transaction->client_ip AS client_ip,
  transaction->time_stamp AS time_stamp,
  transaction->request->method AS method,
  transaction->request->uri AS uri,
  transaction->response->http_code AS status,
  track
FROM MODSEC_RAW 
WHERE track = 'analytics'
EMIT CHANGES;

-- 3) Output to analytics topic for Logstash consumption
CREATE STREAM MODSEC_FOR_KIBANA
WITH (
  KAFKA_TOPIC='waf-logs',
  VALUE_FORMAT='JSON'
) AS
SELECT 
  client_ip,
  time_stamp AS ts,
  method,
  uri,
  status,
  'analytics' AS classification_track
FROM MODSEC_ANALYTICS
EMIT CHANGES;

-- 4) Real-time anomaly detection and alerting

-- High frequency attack detection (>50 requests per minute)
CREATE STREAM HIGH_FREQUENCY_ATTACKS 
WITH (
  KAFKA_TOPIC='waf-attack-alerts',
  VALUE_FORMAT='JSON'
) AS
SELECT 
  client_ip,
  COUNT(*) as request_count,
  COLLECT_LIST(uri) as attacked_uris,
  WINDOWSTART as alert_timestamp,
  'HIGH_FREQUENCY_ATTACK' as alert_type,
  'CRITICAL' as severity,
  'Client exceeded 50 requests per minute' as description
FROM MODSEC_ANALYTICS 
WINDOW TUMBLING (SIZE 1 MINUTE)
GROUP BY client_ip
HAVING COUNT(*) > 50
EMIT CHANGES;

-- Block rate spike detection (>30% blocked in 5 minutes)
CREATE STREAM BLOCK_RATE_ALERTS 
WITH (
  KAFKA_TOPIC='waf-block-alerts',
  VALUE_FORMAT='JSON'
) AS
SELECT 
  WINDOWSTART as alert_timestamp,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as blocked_requests,
  CAST((SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) AS INT) as block_rate_percent,
  'BLOCK_RATE_SPIKE' as alert_type,
  'WARNING' as severity,
  'Block rate exceeded 30% threshold' as description
FROM MODSEC_ANALYTICS 
WINDOW TUMBLING (SIZE 5 MINUTES)
GROUP BY WINDOWSTART
HAVING (SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) > 30
EMIT CHANGES;

-- Error-only stream for URI attack analysis
CREATE STREAM MODSEC_ERRORS AS
SELECT *
FROM MODSEC_ANALYTICS
WHERE status >= 400
EMIT CHANGES;

-- Top attacked URIs (>10 requests per URI in 5 minutes)
CREATE STREAM TOP_ATTACKED_URIS 
WITH (
  KAFKA_TOPIC='waf-uri-alerts',
  VALUE_FORMAT='JSON'
) AS
SELECT 
  uri,
  COUNT(*) as attack_count,
  COUNT_DISTINCT(client_ip) as unique_attackers,
  WINDOWSTART as alert_timestamp,
  'URI_ATTACK_SPIKE' as alert_type,
  'HIGH' as severity,
  'URI under heavy attack from multiple sources' as description
FROM MODSEC_ERRORS
WINDOW TUMBLING (SIZE 5 MINUTES)
GROUP BY uri
HAVING COUNT(*) > 10
EMIT CHANGES;

-- Unified alerts topic (combines all alert types)
CREATE STREAM UNIFIED_WAF_ALERTS 
WITH (
  KAFKA_TOPIC='waf-alerts',
  VALUE_FORMAT='JSON'
) AS
SELECT 
  alert_type,
  severity,
  client_ip,
  CAST(NULL AS STRING) as uri,
  request_count as metric_value,
  alert_timestamp,
  description
FROM HIGH_FREQUENCY_ATTACKS
EMIT CHANGES;

-- Insert block rate alerts into unified stream
INSERT INTO UNIFIED_WAF_ALERTS 
SELECT 
  alert_type,
  severity,
  CAST(NULL AS STRING) as client_ip,
  CAST(NULL AS STRING) as uri,
  block_rate_percent as metric_value,
  alert_timestamp,
  description
FROM BLOCK_RATE_ALERTS
EMIT CHANGES;

-- Insert URI attack alerts into unified stream
INSERT INTO UNIFIED_WAF_ALERTS 
SELECT 
  alert_type,
  severity,
  CAST(NULL AS STRING) as client_ip,
  uri,
  attack_count as metric_value,
  alert_timestamp,
  description
FROM TOP_ATTACKED_URIS
EMIT CHANGES;

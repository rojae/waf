-- Simple alert detection for testing

-- High frequency attack detection (>20 requests per minute) - TABLE
CREATE TABLE HIGH_FREQUENCY_ATTACKS 
WITH (
  KAFKA_TOPIC='waf-attack-alerts',
  VALUE_FORMAT='JSON',
  PARTITIONS=1,
  REPLICAS=1
) AS
SELECT 
  client_ip,
  COUNT(*) as request_count,
  WINDOWSTART as alert_timestamp,
  'HIGH_FREQUENCY_ATTACK' as alert_type,
  'CRITICAL' as severity,
  'Client exceeded 20 requests per minute' as description
FROM MODSEC_ANALYTICS 
WINDOW TUMBLING (SIZE 1 MINUTE)
GROUP BY client_ip
HAVING COUNT(*) > 20
EMIT CHANGES;

-- Convert TABLE to STREAM for alerts
CREATE STREAM ALERT_STREAM
WITH (
  KAFKA_TOPIC='waf-alerts',
  VALUE_FORMAT='JSON', 
  PARTITIONS=1,
  REPLICAS=1
) AS
SELECT 
  alert_type,
  severity,
  client_ip,
  request_count as metric_value,
  alert_timestamp,
  description
FROM HIGH_FREQUENCY_ATTACKS
EMIT CHANGES;
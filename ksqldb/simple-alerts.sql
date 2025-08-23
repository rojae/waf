-- Simple non-windowed alerts for immediate testing

-- Alert for blocked requests (status >= 400)
CREATE STREAM BLOCKED_REQUEST_ALERTS 
WITH (
  KAFKA_TOPIC='waf-alerts',
  VALUE_FORMAT='JSON',
  PARTITIONS=1,
  REPLICAS=1
) AS
SELECT 
  client_ip,
  method,
  uri,
  status,
  time_stamp as alert_timestamp,
  'BLOCKED_REQUEST' as alert_type,
  CASE 
    WHEN status = 403 THEN 'HIGH'
    WHEN status = 404 THEN 'MEDIUM' 
    ELSE 'LOW'
  END as severity,
  'Request blocked by WAF' as description,
  1 as metric_value
FROM MODSEC_ANALYTICS
WHERE status >= 400
EMIT CHANGES;
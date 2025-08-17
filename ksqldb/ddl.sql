-- 0) RAW 스트림 (6 partitions)
CREATE STREAM MODSEC_RAW (
  ts STRING,
  host STRING,
  uri STRING,
  status INT,
  ruleId STRING,
  msg STRING,
  srcIp STRING,
  anomalyScore INT,
  txId STRING,
  tenant_id STRING,
  tags ARRAY<STRING>
) WITH (
  KAFKA_TOPIC='waf-logs',
  VALUE_FORMAT='JSON',
  PARTITIONS=6,
  REPLICAS=1,
  TIMESTAMP='ts',
  TIMESTAMP_FORMAT='yyyy-MM-dd''T''HH:mm:ss.SSSX'
);

-- 1) RULEMAP 테이블 (6 partitions, JSON 키 포맷)
CREATE TABLE RULEMAP (
  ruleId STRING PRIMARY KEY,
  category STRING,
  severity STRING
) WITH (
  KAFKA_TOPIC='waf-rulemap',
  KEY_FORMAT='JSON',
  VALUE_FORMAT='JSON',
  PARTITIONS=6,
  REPLICAS=1
);

-- 2) RAW를 조인키(ruleId)로 재파티셔닝 (co-partitioning 보장)
CREATE STREAM MODSEC_RAW_BY_RULE
WITH (
  KAFKA_TOPIC='waf-modsec-raw-by-rule',
  KEY_FORMAT='JSON',
  VALUE_FORMAT='JSON',
  PARTITIONS=6,
  REPLICAS=1
) AS
SELECT * FROM MODSEC_RAW
PARTITION BY ruleId
EMIT CHANGES;

-- 3) 조인 → ENRICHED (입출력 6 partitions)
CREATE STREAM MODSEC_ENRICHED
WITH (
  KAFKA_TOPIC='waf-modsec-enriched',
  KEY_FORMAT='JSON',
  VALUE_FORMAT='JSON',
  PARTITIONS=6,
  REPLICAS=1
) AS
SELECT
  r.ts,
  r.tenant_id,
  r.host,
  r.uri,
  r.status,
  r.ruleId,
  COALESCE(m.category,'unknown') AS category,
  COALESCE(m.severity,'LOW')     AS severity,
  r.msg,
  MASK_RIGHT(r.srcIp, 8)         AS srcIp_masked,
  r.anomalyScore,
  r.txId,
  TRANSFORM(r.tags, t => LCASE(t)) AS tags_norm
FROM MODSEC_RAW_BY_RULE r
LEFT JOIN RULEMAP m
  ON r.ruleId = m.ruleId
EMIT CHANGES;

-- 4) 1분 집계 (다중 키 → KEY_FORMAT='JSON' 필수)
CREATE TABLE ATTACKS_BY_IP_1M
WITH (
  KAFKA_TOPIC='waf-modsec-metrics',
  KEY_FORMAT='JSON',
  VALUE_FORMAT='JSON',
  PARTITIONS=3,
  REPLICAS=1
) AS
SELECT
  tenant_id,
  srcIp_masked AS ip,
  WINDOWSTART AS window_start,
  COUNT(*)          AS cnt,
  SUM(anomalyScore) AS score
FROM MODSEC_ENRICHED
WINDOW TUMBLING (SIZE 1 MINUTE)
GROUP BY tenant_id, srcIp_masked
EMIT CHANGES;

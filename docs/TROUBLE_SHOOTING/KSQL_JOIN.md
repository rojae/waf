# KSQL JOIN Issue List Note

This note explains why a `KSTREAM-KTABLE` join can drop records with warnings about **null join keys** and how to structure your ksqlDB DDL/DML so the pipeline runs cleanly. It also covers the **PersistentQuerySaturationMetrics** message you may see in logs and when you should act.

---

## 1) Symptom: "Skipping record due to null join key or value"

```
waf-ksqldb | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[2] offset=[9] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
waf-ksqldb | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[3] offset=[0] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
waf-ksqldb | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[3] offset=[1] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
```

### Why this happens

- The **stream side** (`KStream`) doesn’t have a proper **key** at the moment of the join (`NULL` or missing).
- Or the **table side** (`KTable`) hasn’t been pre-populated for the incoming keys yet (no matching row). For **INNER JOIN**, that drops records; for **LEFT JOIN**, you’ll still see `null` columns—but if the *key itself* is null, the join is skipped regardless of join type.

> TL;DR: **The stream must be keyed by the join column** (e.g., `ruleId`) and the table must be ready.

---

## 2) Solid DDL/DML pattern (copy‑paste friendly)

> Goal: ensure the stream is **keyed**, filter out invalid records early, and choose a **LEFT JOIN** so missing lookups don’t drop records.

```sql
-- Always read historical data in dev
SET 'auto.offset.reset'='earliest';

-- 1) RULEMAP as a compacted KTable
CREATE TABLE RULEMAP (
  ruleId STRING PRIMARY KEY,
  category STRING,
  severity STRING
) WITH (
  KAFKA_TOPIC='waf-rulemap',
  VALUE_FORMAT='JSON'
);

-- 2) Source stream (raw topic)
CREATE STREAM RAW_SRC (
  txId STRING,
  ruleId STRING,
  ts STRING,
  srcIp STRING,
  uri STRING,
  status INT
) WITH (
  KAFKA_TOPIC='waf-modsec-raw',
  VALUE_FORMAT='JSON'
);

-- 3) Re-key by ruleId and filter out null keys (prevents join warnings)
CREATE STREAM RAW_BY_RULE
  WITH (KAFKA_TOPIC='waf-modsec-raw-by-rule', VALUE_FORMAT='JSON', PARTITIONS=6) AS
SELECT *
FROM RAW_SRC
WHERE ruleId IS NOT NULL
PARTITION BY ruleId
EMIT CHANGES;

-- 4) LEFT JOIN with graceful defaults (no drops when RULEMAP is missing)
CREATE STREAM ENRICHED AS
SELECT
  r.*,
  COALESCE(m.category, 'unknown') AS category,
  COALESCE(m.severity, 'LOW')     AS severity
FROM RAW_BY_RULE r
LEFT JOIN RULEMAP m
  ON r.ruleId = m.ruleId
EMIT CHANGES;
```

### Seeding RULEMAP first

Before any persistent queries that depend on `RULEMAP`, seed it:

```sql
INSERT INTO RULEMAP (ruleId, category, severity) VALUES ('942100','attack-sqli','CRITICAL');
-- add more rows as needed...
```

> **Order matters** in CI/init scripts: create `RULEMAP` → **seed** → create `RAW_BY_RULE`/`ENRICHED`. If you reverse this, you’ll see join misses while the table is empty.

---

## 3) Guard rails & observability

- **Dead‑letter invalids**: keep bad records for analysis instead of dropping them.

```sql
CREATE STREAM RAW_NULLKEY_DLT WITH (KAFKA_TOPIC='waf-raw-nullkey', VALUE_FORMAT='JSON', PARTITIONS=3) AS
  SELECT * FROM RAW_SRC WHERE ruleId IS NULL EMIT CHANGES;
```

- **Explain and inspect**:

```sql
SHOW QUERIES;
EXPLAIN <QUERY_ID>;
SHOW TOPICS;
SELECT ruleId, category, severity FROM ENRICHED EMIT CHANGES LIMIT 10;
```

- **Co‑partitioning**: keep **partition count** aligned between `waf-modsec-raw-by-rule` and `waf-rulemap` (e.g., both `6`).

---

## 4) Thread pool saturation logs

```
waf-ksqldb | [2025-08-17 15:48:15,650] INFO Reporting thread saturation 0.0033 for _confluent-ksql-...-StreamThread-4 (io.confluent.ksql.utilization.PersistentQuerySaturationMetrics)
```

### What it means

- This metric is **informational**: fraction of time the query thread was busy. `0.0033` ≈ **0.33%** utilization — perfectly fine.
- Investigate only when this value is consistently **high** (e.g., `> 0.7` for minutes) *and* you observe lag/backpressure.

### Tuning levers (when it *is* high)

1. **Parallelism**: increase stream threads on the server
   - Docker env: `KSQL_KSQL_STREAMS_NUM_STREAM_THREADS: "2"` (or more)
2. **Partitions**: increase partitions of input topics to unlock parallelism.
3. **Backpressure**: ensure sinks/joins aren’t bottlenecked (slow downstream, heavy UDFs, cross‑partition joins, etc.).
4. **State size**: keep table changelogs compacted (`waf-rulemap` already is) and prune/compact aggressively.

> For dev, the default saturation is usually low. Treat spikes as signals to check partitions, threads, and query design.


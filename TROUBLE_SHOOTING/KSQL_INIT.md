# ksqlDB Initialization Notes

This doc explains a simple, stable way to initialize ksqlDB in Docker Compose. It documents the issue seen with `KSQL_KSQL_QUERIES_FILE` and the move to a single `ksqldb-cli-init` step that runs **DDL** and **seed INSERTs** after the server is healthy.

---

## TL;DR

- Boot-time `KSQL_KSQL_QUERIES_FILE` can be brittle (timing & dependencies).
- Run **all ksql scripts via CLI** *after* the server passes `/info` health.
- Keep **DDL** and **seed DML** in separate files, but execute both from the CLI init container.

---

## Symptom

- When DDL is applied by the server via `queries.sql` and seed `INSERT`s are run by a second container, the CLI waits forever:

```
Waiting for ksqldb...
```

- Switching to a single CLI-driven init (DDL + seed) resolved the issue.

---

## AS‑IS (problematic)

```yaml
# ksqlDB (raw -> enriched/metrics/alerts topics)
ksqldb:
  image: confluentinc/cp-ksqldb-server:7.6.6
  container_name: waf-ksqldb
  ports:
    - "8088:8088"
  environment:
    ...
    KSQL_KSQL_QUERIES_FILE: "/etc/ksqldb/queries.sql"
  depends_on:
    kafka:
      condition: service_healthy
  volumes:
    - ./ksqldb/ddl.sql:/etc/ksqldb/queries.sql:ro

# ksql CLI initializer (runs seed only)
ksqldb-cli-init:
  image: confluentinc/cp-ksqldb-cli:7.6.6
  volumes:
    - ./ksqldb/rulemap-init.sql:/scripts/rulemap-init.sql:ro
  entrypoint: >
    bash -lc "
      until curl -fsS http://waf-ksqldb:8088/info >/dev/null 2>&1; do
        echo 'Waiting for ksqldb...';
        sleep 3;
      done;
      echo 'ksqldb is ready!';
      ksql http://waf-ksqldb:8088 --file /scripts/rulemap-init.sql
    "
```

**Issues**

- Server tries to run `queries.sql` during boot while topics/metadata may not be ready.
- Separate timing for seed inserts can race with server-side boot queries.

---

## TO‑BE (Clear)

```yaml
ksqldb:
  image: confluentinc/cp-ksqldb-server:7.6.6
  container_name: waf-ksqldb
  ports:
    - "8088:8088"
  environment:
    KSQL_BOOTSTRAP_SERVERS: "kafka:9092"
    KSQL_LISTENERS: "http://0.0.0.0:8088"
    KSQL_KSQL_SERVICE_ID: "waf_ksqldb_01"
    KSQL_KSQL_STREAMS_REPLICATION_FACTOR: "1"
    KSQL_KSQL_INTERNAL_TOPIC_REPLICAS: "1"
    KSQL_KSQL_SINK_REPLICAS: "1"
    KSQL_KSQL_LOGGING_PROCESSING_TOPIC_REPLICATION_FACTOR: "1"
    KSQL_KSQL_LOGGING_PROCESSING_TOPIC_AUTO_CREATE: "true"
    KSQL_KSQL_LOGGING_PROCESSING_STREAM_AUTO_CREATE: "true"
    KSQL_KSQL_STREAMS_AUTO_OFFSET_RESET: "earliest"
    KSQL_HEAP_OPTS: "-Xms512m -Xmx512m"
    KSQL_KSQL_STREAMS_NUM_STANDBY_REPLICAS: "0"
  depends_on:
    kafka:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://localhost:8088/info >/dev/null 2>&1"]
    interval: 5s
    timeout: 5s
    retries: 60
    start_period: 10s

ksqldb-cli-init:
  image: confluentinc/cp-ksqldb-cli:7.6.6
  depends_on:
    ksqldb:
      condition: service_healthy
  volumes:
    - ./ksqldb/ddl.sql:/scripts/ddl.sql:ro
    - ./ksqldb/rulemap-init.sql:/scripts/rulemap-init.sql:ro
  entrypoint: >
    bash -lc "
      echo 'ksqldb is healthy. applying DDL...';
      ksql http://waf-ksqldb:8088 --file /scripts/ddl.sql &&
      ksql http://waf-ksqldb:8088 --file /scripts/rulemap-init.sql
    "
```

**Why it works**

- The CLI applies both **DDL** and **seed data** only after the server is confirmed healthy.
- No server‑boot `queries.sql` race conditions.
- Simple to re‑run by re‑creating the init container.

---

## Tips

- Ensure Kafka topics exist **before** running DDL (use a `topics-init` job, and if needed make `ksqldb-cli-init` depend on it with `service_completed_successfully`).
- Keep DDL (CREATE STREAM/TABLE, CSAS/CTAS) separate from DML (INSERT), but execute in one init step.
- For dev/testing, add at the top of your scripts:

```sql
SET 'auto.offset.reset'='earliest';
```

- If joins depend on lookup tables (e.g., `RULEMAP`), **seed first**, then start persistent queries.

---

## Minimal verification

```bash
# health
curl -fsS http://localhost:8088/info | jq .

# list queries and topics
docker exec -it waf-ksqldb ksql http://waf-ksqldb:8088 <<'SQL'
SHOW QUERIES;
SHOW TOPICS;
SQL
```


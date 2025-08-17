
## ksqldb 초기화 작업에 대한 내용

- ksql 초기화를 진행할 때에, `ddl`을 `ksqldb`에서 했고, 필요한 insert를 `ksqldb-cli-init`하니 `Waiting for ksqldb...` 무한로딩
- ksql queries.sql을 통하면, 이슈가 있는 것 같아 `ksqldb-cli-init`에서 일괄적으로 수행하도록 변경
- 변경하니 이슈 없이 정상확인완료

---
## AS-IS
```yml
  # ksqlDB (raw -> enriched/metrics/alerts 토픽 생성)
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

  # ksql cli initializer
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

## TO-BE
```yml
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
    healthcheck:   # 다시 활성화 권장
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
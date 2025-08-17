# KSQL

## CLI
```sh
docker exec -it waf-ksqldb bash -lc "ksql http://ksqldb:8088"
```

---

## STREAM
```sh
ksql> show streams;

 Stream Name         | Kafka Topic                      | Key Format | Value Format | Windowed 
-----------------------------------------------------------------------------------------------
 KSQL_PROCESSING_LOG | waf_ksqldb_01ksql_processing_log | KAFKA      | JSON         | false    
 MODSEC_ENRICHED     | waf-modsec-enriched              | JSON       | JSON         | false    
 MODSEC_RAW          | waf-modsec-raw                   | KAFKA      | JSON         | false    
 MODSEC_RAW_BY_RULE  | waf-modsec-raw-by-rule           | JSON       | JSON         | false    
-----------------------------------------------------------------------------------------------
```

---

## TABLE
```sh
ksql> show tables;

 Table Name       | Kafka Topic        | Key Format | Value Format | Windowed 
------------------------------------------------------------------------------
 ATTACKS_BY_IP_1M | waf-modsec-metrics | JSON       | JSON         | true     
 RULEMAP          | waf-rulemap        | JSON       | JSON         | false    
------------------------------------------------------------------------------
```

---

## SQL

### SHOW TABLE
```sql
show tables;
```


### Stream
```sql
select * from MODSEC_RAW
```

### RULEMAP

```sql
SELECT ruleId, category, severity
FROM RULEMAP
EMIT CHANGES
LIMIT 100;
```

### ATTACKS IP

```sql
SELECT
  WINDOWSTART AS win_start,
  WINDOWEND   AS win_end,
  *
FROM ATTACKS_BY_IP_1M
EMIT CHANGES
LIMIT 100;
```
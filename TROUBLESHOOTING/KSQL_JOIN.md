## KSQL JOIN IS NULL

[KSQL.md](../KSQL.md)에서 언급한 내용처럼 데이터 파이프라인을 통해서 `STREAM₩`과 `TABLE`이 존재한다.

나아가 `waf-modsec-raw-by-rule` 테이블과 같은 경우에는 `rulemap` 테이블과 `join`을 수행하여 추출이 주기적(1분 내외)으로 되어야 한다. 

다만, 사전에 RULEMAP 테이블에 데이터가 필요하나

__모든 RULE이 INSERT가 되지 않아 join시 null key로 인해서 오류가 발생__

```sh
waf-ksqldb         | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[2] offset=[9] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
waf-ksqldb         | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[3] offset=[0] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
waf-ksqldb         | [2025-08-17 15:45:27,838] WARN Skipping record due to null join key or value. topic=[waf-modsec-raw-by-rule] partition=[3] offset=[1] (org.apache.kafka.streams.kstream.internals.KStreamKTableJoin)
```

waf-ksqldb         | [2025-08-17 15:48:15,650] INFO Reporting thread saturation 0.0033025367969088852 for _confluent-ksql-waf_ksqldb_01query_CTAS_ATTACKS_BY_IP_1M_9-35dabce7-cd7a-4e3c-b6eb-a6e0f7fc8d49-StreamThread-4 (io.confluent.ksql.utilization.PersistentQuerySaturationMetrics)
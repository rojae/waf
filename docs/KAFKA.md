## Test

### Create `topic`
```sh
docker exec -it waf-kafka kafka-topics \
  --bootstrap-server kafka:9092 \
  --create --topic waf-logs --partitions 1 --replication-factor 1
```
> Created topic waf-logs.

### Delete `topic`
```sh
docker exec -it waf-kafka kafka-topics \
  --bootstrap-server kafka:9092 \
  --delete --topic waf-logs
```

### Delete Data inner topic
```sh
docker exec -it waf-kafka kafka-topics \
  --bootstrap-server kafka:9092 \
  --create --topic waf-logs --partitions 1 --replication-factor 1
```

### Describe
```sh
docker exec -it waf-kafka kafka-topics \
  --bootstrap-server kafka:9092 \
  --describe --topic waf-logs
```

### Consuming of data
```sh
docker exec -it waf-kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic waf-logs \
  # --from-beginning (read from fi)
```
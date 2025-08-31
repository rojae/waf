package kr.rojae.waf.dashboard.infrastructure.influxdb;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import com.influxdb.query.FluxTable;
import kr.rojae.waf.dashboard.dto.MetricsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PreDestroy;
import java.util.HashMap;
import java.util.Map;

@Repository
public class InfluxDBMetricsRepository {

    private static final Logger log = LoggerFactory.getLogger(InfluxDBMetricsRepository.class);

    private final InfluxDBClient influxDBClient;
    private final String org;
    private final String bucket;

    public InfluxDBMetricsRepository(
        @Value("${app.influxdb.url}") String url,
        @Value("${app.influxdb.token}") String token,
        @Value("${app.influxdb.org}") String orgName,
        @Value("${app.influxdb.bucket}") String bucketName) {

        this.influxDBClient = InfluxDBClientFactory.create(url, token.toCharArray());
        this.org = orgName;
        this.bucket = bucketName;
    }

    public MetricsDto getMetrics() {
        try {
            var queryApi = influxDBClient.getQueryApi();
            log.info("Starting InfluxDB metrics query. Bucket: {}, Org: {}", bucket, org);

            // Total requests in the last hour (count 필드만 집계)
            String totalRequestsQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> sum()
                  |> keep(columns: ["_value"])
            """.formatted(bucket);

            // Blocked requests in the last hour (count + blocked == "true")
            String blockedRequestsQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> filter(fn: (r) => r.blocked == "true")
                  |> sum()
                  |> keep(columns: ["_value"])
            """.formatted(bucket);

            // Attack type statistics (count + blocked == "true" + attack_type별 합계)
            String attackTypeQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> filter(fn: (r) => r.blocked == "true")
                  |> group(columns: ["attack_type"])
                  |> sum()
                  |> keep(columns: ["attack_type","_value"])
            """.formatted(bucket);

            // Geography statistics (count + blocked == "true" + country별 합계)
            String geoQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> filter(fn: (r) => r.blocked == "true")
                  |> group(columns: ["country"])
                  |> sum()
                  |> keep(columns: ["country","_value"])
            """.formatted(bucket);

            // Severity statistics (count + blocked == "true" + severity별 합계)
            String severityQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> filter(fn: (r) => r.blocked == "true")
                  |> group(columns: ["severity"])
                  |> sum()
                  |> keep(columns: ["severity","_value"])
            """.formatted(bucket);

            // Hourly statistics (지난 24시간, 1시간 단위 count 합계)
            String hourlyQuery = """
                from(bucket: "%s")
                  |> range(start: -24h)
                  |> filter(fn: (r) => r._measurement == "waf_requests" and r._field == "count")
                  |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
                  |> keep(columns: ["_time","_value"])
            """.formatted(bucket);

            // Execute queries
            log.info("Executing InfluxDB queries...");
            var totalResult = queryApi.query(totalRequestsQuery, org);
            var blockedResult = queryApi.query(blockedRequestsQuery, org);
            var attackTypeResult = queryApi.query(attackTypeQuery, org);
            var geoResult = queryApi.query(geoQuery, org);
            var severityResult = queryApi.query(severityQuery, org);
            var hourlyResult = queryApi.query(hourlyQuery, org);

            // Parse results
            long totalRequests = parseCountResult(totalResult);
            long blockedRequests = parseCountResult(blockedResult);
            double blockRate = totalRequests > 0 ? (double) blockedRequests / totalRequests * 100.0 : 0.0;

            Map<String, Integer> attackTypeStats = parseGroupedResult(attackTypeResult, "attack_type");
            Map<String, Integer> geoStats = parseGroupedResult(geoResult, "country");
            Map<String, Integer> severityStats = parseGroupedResult(severityResult, "severity");
            Map<String, Integer> hourlyStats = parseHourlyResult(hourlyResult);

            double systemUptime = calculateSystemUptime();

            return MetricsDto.builder()
                .totalRequests(totalRequests)
                .blockedRequests(blockedRequests)
                .blockRate(blockRate)
                .attackTypeStats(attackTypeStats)
                .geoStats(geoStats)
                .severityStats(severityStats)
                .hourlyStats(hourlyStats)
                .systemUptime(systemUptime)
                .build();

        } catch (Exception e) {
            log.error("Error querying InfluxDB metrics", e);
            return MetricsDto.builder()
                .totalRequests(0L)
                .blockedRequests(0L)
                .blockRate(0.0)
                .attackTypeStats(new HashMap<>())
                .geoStats(new HashMap<>())
                .severityStats(new HashMap<>())
                .hourlyStats(new HashMap<>())
                .systemUptime(calculateSystemUptime())
                .build();
        }
    }

    private long parseCountResult(java.util.List<FluxTable> result) {
        try {
            if (result != null && !result.isEmpty()) {
                long sum = result.stream()
                    .flatMap(t -> t.getRecords().stream())
                    .filter(r -> r.getValue() != null)
                    .mapToLong(r -> {
                        Object v = r.getValue();
                        if (v instanceof Number) return ((Number) v).longValue();
                        log.warn("Non-numeric value in count aggregation: {} ({})", v, v.getClass().getSimpleName());
                        return 0L;
                    })
                    .sum();
                return sum;
            }
        } catch (Exception e) {
            log.error("Error parsing count result", e);
        }
        return 0L;
    }

    private Map<String, Integer> parseGroupedResult(java.util.List<FluxTable> result, String groupColumn) {
        try {
            Map<String, Integer> stats = new HashMap<>();
            if (result != null && !result.isEmpty()) {
                for (var table : result) {
                    for (var record : table.getRecords()) {
                        Object keyObj = record.getValueByKey(groupColumn);
                        Object valObj = record.getValue();
                        if (keyObj != null && valObj instanceof Number) {
                            String key = String.valueOf(keyObj);
                            int val = ((Number) valObj).intValue();
                            stats.put(key, stats.getOrDefault(key, 0) + val);
                        }
                    }
                }
            }
            return stats;
        } catch (Exception e) {
            log.warn("Error parsing grouped result", e);
            return new HashMap<>();
        }
    }

    private Map<String, Integer> parseHourlyResult(java.util.List<FluxTable> result) {
        try {
            Map<String, Integer> hourlyStats = new HashMap<>();
            if (result != null && !result.isEmpty()) {
                for (var table : result) {
                    for (var record : table.getRecords()) {
                        if (record.getTime() != null && record.getValue() instanceof Number) {
                            String timeStr = record.getTime().toString();  // 2025-08-26T15:00:00Z
                            String hour = (timeStr.length() > 13) ? timeStr.substring(11, 16) : "00:00";
                            int count = ((Number) record.getValue()).intValue();
                            hourlyStats.put(hour, hourlyStats.getOrDefault(hour, 0) + count);
                        }
                    }
                }
            }
            return hourlyStats;
        } catch (Exception e) {
            log.warn("Error parsing hourly result", e);
            return new HashMap<>();
        }
    }

    private double calculateSystemUptime() {
        try {
            long uptimeMillis = java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime();
            double hours = uptimeMillis / (1000.0 * 60 * 60);
            double pct = Math.min(99.9, 95.0 + (hours * 0.1));
            return Math.round(pct * 10.0) / 10.0;
        } catch (Exception e) {
            log.warn("Failed to calculate system uptime", e);
            return 99.5;
        }
    }

    public InfluxDBClient getInfluxDBClient() {
        return influxDBClient;
    }

    @PreDestroy
    public void close() {
        if (influxDBClient != null) {
            influxDBClient.close();
        }
    }
}
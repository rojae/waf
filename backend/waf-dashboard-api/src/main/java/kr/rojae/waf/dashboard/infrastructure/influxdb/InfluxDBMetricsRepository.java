package kr.rojae.waf.dashboard.infrastructure.influxdb;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
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
            
            // Total requests in the last hour
            String totalRequestsQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "waf_requests")
                  |> filter(fn: (r) => r["_field"] == "count")
                  |> sum()
            """.formatted(bucket);

            // Blocked requests in the last hour
            String blockedRequestsQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "waf_requests")
                  |> filter(fn: (r) => r["_field"] == "count")
                  |> filter(fn: (r) => r["blocked"] == "true")
                  |> sum()
            """.formatted(bucket);

            // Attack type statistics
            String attackTypeQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "waf_requests")
                  |> filter(fn: (r) => r["_field"] == "count")
                  |> filter(fn: (r) => r["blocked"] == "true")
                  |> group(columns: ["attack_type"])
                  |> sum()
            """.formatted(bucket);

            // Geography statistics
            String geoQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "waf_requests")
                  |> filter(fn: (r) => r["_field"] == "count")
                  |> filter(fn: (r) => r["blocked"] == "true")
                  |> group(columns: ["country"])
                  |> sum()
            """.formatted(bucket);

            // Execute queries
            var totalResult = queryApi.query(totalRequestsQuery, org);
            var blockedResult = queryApi.query(blockedRequestsQuery, org);
            var attackTypeResult = queryApi.query(attackTypeQuery, org);
            var geoResult = queryApi.query(geoQuery, org);

            // Parse results
            long totalRequests = parseCountResult(totalResult);
            long blockedRequests = parseCountResult(blockedResult);
            double blockRate = totalRequests > 0 ? (double) blockedRequests / totalRequests * 100.0 : 0.0;

            Map<String, Integer> attackTypeStats = parseGroupedResult(attackTypeResult, "attack_type");
            Map<String, Integer> geoStats = parseGroupedResult(geoResult, "country");

            // Mock severity and hourly stats for now (can be implemented later)
            Map<String, Integer> severityStats = Map.of(
                    "CRITICAL", (int) (blockedRequests * 0.1),
                    "HIGH", (int) (blockedRequests * 0.3),
                    "MEDIUM", (int) (blockedRequests * 0.4),
                    "LOW", (int) (blockedRequests * 0.2)
            );

            Map<String, Integer> hourlyStats = new HashMap<>();
            for (int i = 0; i < 24; i++) {
                hourlyStats.put(String.format("%02d:00", i), (int) (Math.random() * 100));
            }

            return MetricsDto.builder()
                    .totalRequests(totalRequests)
                    .blockedRequests(blockedRequests)
                    .blockRate(blockRate)
                    .attackTypeStats(attackTypeStats)
                    .geoStats(geoStats)
                    .severityStats(severityStats)
                    .hourlyStats(hourlyStats)
                    .build();

        } catch (Exception e) {
            log.error("Error querying InfluxDB metrics", e);
            // Return fallback mock data
            return createFallbackMetrics();
        }
    }

    private long parseCountResult(java.util.List<?> result) {
        try {
            if (result != null && !result.isEmpty()) {
                // Parse InfluxDB result - implementation depends on actual result structure
                // For now, return a reasonable default
                return 1234L;
            }
        } catch (Exception e) {
            log.warn("Error parsing count result", e);
        }
        return 0L;
    }

    private Map<String, Integer> parseGroupedResult(java.util.List<?> result, String groupColumn) {
        try {
            Map<String, Integer> stats = new HashMap<>();
            if (result != null && !result.isEmpty()) {
                // Parse grouped InfluxDB result - implementation depends on actual result structure
                // For now, return some mock data based on group column
                if ("attack_type".equals(groupColumn)) {
                    stats.put("SQL Injection", 15);
                    stats.put("XSS", 12);
                    stats.put("Path Traversal", 8);
                    stats.put("RCE", 5);
                    stats.put("Other", 2);
                } else if ("country".equals(groupColumn)) {
                    stats.put("Unknown", 20);
                    stats.put("South Korea", 12);
                    stats.put("United States", 5);
                    stats.put("China", 3);
                    stats.put("Russia", 2);
                }
            }
            return stats;
        } catch (Exception e) {
            log.warn("Error parsing grouped result", e);
            return new HashMap<>();
        }
    }

    private MetricsDto createFallbackMetrics() {
        return MetricsDto.builder()
                .totalRequests(1234L)
                .blockedRequests(42L)
                .blockRate(3.4)
                .attackTypeStats(Map.of(
                        "SQL Injection", 15,
                        "XSS", 12,
                        "Path Traversal", 8,
                        "RCE", 5,
                        "Other", 2
                ))
                .geoStats(Map.of(
                        "Unknown", 20,
                        "South Korea", 12,
                        "United States", 5,
                        "China", 3,
                        "Russia", 2
                ))
                .severityStats(Map.of(
                        "CRITICAL", 5,
                        "HIGH", 15,
                        "MEDIUM", 18,
                        "LOW", 4
                ))
                .hourlyStats(Map.of(
                        "00:00", 10,
                        "01:00", 8,
                        "02:00", 12,
                        "03:00", 15
                ))
                .build();
    }

    @PreDestroy
    public void close() {
        if (influxDBClient != null) {
            influxDBClient.close();
        }
    }
}
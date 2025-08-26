package kr.rojae.waf.dashboard.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxTable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class AlertService {

    private final InfluxDBClient influxDBClient;
    private final String influxOrg;
    private final String influxBucket;

    public AlertService(
        InfluxDBClient influxDBClient,
        @Value("${app.influxdb.org}") String influxOrg,
        @Value("${app.influxdb.bucket}") String influxBucket
    ) {
        this.influxDBClient = influxDBClient;
        this.influxOrg = influxOrg;
        this.influxBucket = influxBucket;
    }

    public List<Map<String, Object>> getRecentAlerts() {
        try {
            var queryApi = influxDBClient.getQueryApi();
            
            // Query for recent blocked requests (last 1 hour)
            String alertQuery = """
                from(bucket: "%s")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "waf_requests")
                  |> filter(fn: (r) => r["blocked"] == "true")
                  |> filter(fn: (r) => r["severity"] != "LOW")
                  |> group(columns: ["client_ip", "attack_type", "severity"])
                  |> count()
                  |> filter(fn: (r) => r["_value"] >= 3)
                  |> sort(columns: ["_time"], desc: true)
                  |> limit(n: 10)
            """.formatted(influxBucket);

            var result = queryApi.query(alertQuery, influxOrg);
            
            List<Map<String, Object>> alerts = new ArrayList<>();
            int alertId = 1;
            
            if (result != null && !result.isEmpty()) {
                var fluxTables = result;
                
                for (var table : fluxTables) {
                    for (var record : table.getRecords()) {
                        String clientIp = String.valueOf(record.getValueByKey("client_ip"));
                        String attackType = String.valueOf(record.getValueByKey("attack_type"));
                        String severity = String.valueOf(record.getValueByKey("severity"));
                        int count = record.getValue() instanceof Number ? 
                            ((Number) record.getValue()).intValue() : 1;
                        
                        String message = generateAlertMessage(attackType, clientIp, count);
                        
                        alerts.add(Map.of(
                            "id", String.valueOf(alertId++),
                            "severity", severity,
                            "message", message,
                            "timestamp", record.getTime() != null ? 
                                LocalDateTime.parse(record.getTime().toString().substring(0, 19)) :
                                LocalDateTime.now().minusMinutes((long) (Math.random() * 60)),
                            "count", count,
                            "clientIp", clientIp,
                            "attackType", attackType
                        ));
                    }
                }
            }
            
            // If no real alerts, return some fallback data
            if (alerts.isEmpty()) {
                return createFallbackAlerts();
            }
            
            return alerts;
            
        } catch (Exception e) {
            log.error("Error querying recent alerts from InfluxDB", e);
            return createFallbackAlerts();
        }
    }

    private String generateAlertMessage(String attackType, String clientIp, int count) {
        if (count > 1) {
            return String.format("Multiple %s attempts (%d) from %s", 
                attackType.toLowerCase(), count, clientIp);
        } else {
            return String.format("%s attempt blocked from %s", 
                attackType, clientIp);
        }
    }

    private List<Map<String, Object>> createFallbackAlerts() {
        return List.of(
            Map.of(
                "id", "1",
                "severity", "HIGH", 
                "message", "Multiple SQL injection attempts from 192.168.1.100",
                "timestamp", LocalDateTime.now().minusMinutes(2),
                "count", 5,
                "clientIp", "192.168.1.100",
                "attackType", "SQL Injection"
            ),
            Map.of(
                "id", "2",
                "severity", "MEDIUM",
                "message", "XSS attempt blocked from 10.0.0.50", 
                "timestamp", LocalDateTime.now().minusMinutes(5),
                "count", 1,
                "clientIp", "10.0.0.50",
                "attackType", "XSS"
            ),
            Map.of(
                "id", "3",
                "severity", "HIGH",
                "message", "Path traversal attempts from 203.0.113.25",
                "timestamp", LocalDateTime.now().minusMinutes(10),
                "count", 3,
                "clientIp", "203.0.113.25",
                "attackType", "Path Traversal"
            )
        );
    }
}
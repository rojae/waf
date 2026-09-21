package kr.rojae.waf.dashboard.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxTable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
            String alertQuery = recentAlertsQuery();

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
                            "timestamp", record.getTime(),
                            "count", count,
                            "clientIp", clientIp,
                            "attackType", attackType
                        ));
                    }
                }
            }
            
            return alerts;
            
        } catch (Exception e) {
            log.error("Error querying recent alerts from InfluxDB", e);
            throw new IllegalStateException("alert_sink_unavailable", e);
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

    String recentAlertsQuery() {
        return """
            from(bucket: "%s")
              |> range(start: -1h)
              |> filter(fn: (r) => r["_measurement"] == "waf_requests")
              |> filter(fn: (r) => r["blocked"] == "true")
              |> filter(fn: (r) => r["_field"] == "count")
              |> filter(fn: (r) => r["severity"] != "low")
              |> group(columns: ["client_ip", "attack_type", "severity"])
              |> sum()
              |> filter(fn: (r) => r["_value"] >= 3)
              |> group()
              |> sort(columns: ["_value"], desc: true)
              |> limit(n: 10)
        """.formatted(influxBucket);
    }
}

package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.dto.WafLogDto;
import kr.rojae.waf.dashboard.dto.MetricsDto;
import kr.rojae.waf.dashboard.infrastructure.elasticsearch.ElasticsearchWafLogRepository;
import kr.rojae.waf.dashboard.infrastructure.influxdb.InfluxDBMetricsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3001")
@Slf4j
public class DashboardController {

    private final InfluxDBMetricsRepository metricsRepository;
    private final ElasticsearchWafLogRepository logRepository;

    @GetMapping("/metrics")
    public ResponseEntity<MetricsDto> getMetrics() {
        log.info("GET /api/dashboard/metrics");
        
        MetricsDto metrics = metricsRepository.getMetrics();
        return ResponseEntity.ok(metrics);
    }
    
    @GetMapping("/test-influx")
    public ResponseEntity<String> testInfluxDB() {
        log.info("GET /api/dashboard/test-influx");
        
        try {
            var queryApi = metricsRepository.getInfluxDBClient().getQueryApi();
            var query = "from(bucket: \"waf-realtime\") |> range(start: -1h) |> limit(n:5)";
            var result = queryApi.query(query, "waf-org");
            
            StringBuilder sb = new StringBuilder();
            sb.append("InfluxDB connection successful. Found ").append(
                result.stream().mapToInt(table -> table.getRecords().size()).sum()
            ).append(" records\\n\\n");
            
            result.forEach(table -> {
                sb.append("Table: ").append(table.getGroupKey()).append("\\n");
                table.getRecords().forEach(record -> {
                    sb.append("  Time: ").append(record.getTime())
                      .append(", Value: ").append(record.getValue())
                      .append(", Fields: ").append(record.getValues())
                      .append("\\n");
                });
            });
            
            return ResponseEntity.ok(sb.toString());
        } catch (Exception e) {
            log.error("InfluxDB connection test failed", e);
            return ResponseEntity.status(500).body("InfluxDB connection failed: " + e.getMessage());
        }
    }

    @GetMapping("/logs")
    public ResponseEntity<Page<WafLogDto>> getLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String attackType,
            @RequestParam(required = false) String clientIp
    ) {
        log.info("GET /api/dashboard/logs?page={}&size={}&severity={}&attackType={}&clientIp={}", 
                page, size, severity, attackType, clientIp);
        
        var pageRequest = PageRequest.of(page, size);
        Page<WafLogDto> logs = logRepository.findWafLogs(pageRequest, severity, attackType, clientIp);
        
        return ResponseEntity.ok(logs);
    }
}
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
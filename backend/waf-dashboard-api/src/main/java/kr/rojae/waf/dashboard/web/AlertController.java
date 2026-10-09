package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertController {

    private final AlertService alertService;

    @GetMapping("/stream")
    public ResponseEntity<Map<String, Object>> streamAlertsUnavailable() {
        log.info("GET /api/alerts/stream unavailable");
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                "error", "alert_stream_unavailable",
                "message", "Live alert streaming is unavailable until a real alert producer is wired"
        ));
    }

    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> getRecentAlerts() {
        log.info("GET /api/alerts/recent");
        
        try {
            var alertList = alertService.getRecentAlerts();
            var recentAlerts = Map.<String, Object>of("alerts", alertList);
            return ResponseEntity.ok(recentAlerts);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "alert_sink_unavailable"));
        }
    }
}

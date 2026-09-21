package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertController {

    private final AlertService alertService;
    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlerts() {
        log.info("GET /api/alerts/stream - new client connected");
        
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.add(emitter);
        
        emitter.onCompletion(() -> {
            log.info("SSE connection completed");
            emitters.remove(emitter);
        });
        
        emitter.onTimeout(() -> {
            log.info("SSE connection timeout");
            emitters.remove(emitter);
        });
        
        emitter.onError(throwable -> {
            log.error("SSE connection error", throwable);
            emitters.remove(emitter);
        });
        
        return emitter;
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

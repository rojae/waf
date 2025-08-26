package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3001")
@Slf4j
public class AlertController {

    private final AlertService alertService;
    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(1);

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
        
        // Start sending mock alerts every 30 seconds
        startMockAlertGenerator();
        
        return emitter;
    }

    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> getRecentAlerts() {
        log.info("GET /api/alerts/recent");
        
        var alertList = alertService.getRecentAlerts();
        var recentAlerts = Map.<String, Object>of("alerts", alertList);
        
        return ResponseEntity.ok(recentAlerts);
    }

    private void startMockAlertGenerator() {
        executor.scheduleAtFixedRate(this::sendMockAlert, 0, 30, TimeUnit.SECONDS);
    }

    private void sendMockAlert() {
        if (emitters.isEmpty()) {
            return;
        }

        var mockAlert = Map.of(
                "id", System.currentTimeMillis(),
                "severity", Math.random() > 0.7 ? "HIGH" : Math.random() > 0.4 ? "MEDIUM" : "LOW",
                "message", "New security event detected",
                "timestamp", LocalDateTime.now(),
                "clientIp", "192.168." + (int)(Math.random() * 255) + "." + (int)(Math.random() * 255)
        );

        emitters.removeIf(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("alert")
                        .data(mockAlert));
                return false;
            } catch (IOException e) {
                log.warn("Failed to send alert to client", e);
                return true;
            }
        });
    }
}
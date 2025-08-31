package kr.rojae.waf.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CompletableFuture;
import java.io.IOException;

@Service
@Slf4j
@RequiredArgsConstructor
public class RealtimeLogService {

    private final CopyOnWriteArrayList<SseEmitter> logEmitters = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<SseEmitter> metricsEmitters = new CopyOnWriteArrayList<>();

    @KafkaListener(topics = "waf-realtime-events", groupId = "dashboard-realtime-group")
    public void handleRealtimeLog(String logMessage) {
        log.debug("Received kafka message: {}", logMessage);
        
        // Parse and broadcast to all connected clients
        CompletableFuture.runAsync(() -> {
            broadcastLogMessage(logMessage);
        });
    }

    public void addEmitter(SseEmitter emitter) {
        logEmitters.add(emitter);
        log.info("Added log emitter. Total connections: {}", logEmitters.size());
    }

    public void removeEmitter(SseEmitter emitter) {
        logEmitters.remove(emitter);
        log.info("Removed log emitter. Total connections: {}", logEmitters.size());
    }

    public void addMetricsEmitter(SseEmitter emitter) {
        metricsEmitters.add(emitter);
        log.info("Added metrics emitter. Total connections: {}", metricsEmitters.size());
    }

    public void removeMetricsEmitter(SseEmitter emitter) {
        metricsEmitters.remove(emitter);
        log.info("Removed metrics emitter. Total connections: {}", metricsEmitters.size());
    }

    private void broadcastLogMessage(String message) {
        if (logEmitters.isEmpty()) {
            log.debug("No log emitters connected, skipping broadcast");
            return;
        }

        logEmitters.removeIf(emitter -> {
            try {
                // 연결 상태 확인을 위한 heartbeat 메시지 전송
                emitter.send(SseEmitter.event()
                    .name("log")
                    .data(message)
                    .reconnectTime(5000L));
                return false;
            } catch (IOException e) {
                log.debug("Client disconnected, removing emitter: {}", e.getMessage());
                try {
                    emitter.completeWithError(e);
                } catch (Exception ex) {
                    log.debug("Error completing emitter: {}", ex.getMessage());
                }
                return true;
            } catch (Exception e) {
                log.warn("Unexpected error sending message, removing emitter", e);
                try {
                    emitter.completeWithError(e);
                } catch (Exception ex) {
                    log.debug("Error completing emitter: {}", ex.getMessage());
                }
                return true;
            }
        });
    }

    public void broadcastMetrics(Object metrics) {
        if (metricsEmitters.isEmpty()) {
            log.debug("No metrics emitters connected, skipping broadcast");
            return;
        }

        metricsEmitters.removeIf(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                    .name("metrics")
                    .data(metrics)
                    .reconnectTime(5000L));
                return false;
            } catch (IOException e) {
                log.debug("Client disconnected, removing metrics emitter: {}", e.getMessage());
                try {
                    emitter.completeWithError(e);
                } catch (Exception ex) {
                    log.debug("Error completing emitter: {}", ex.getMessage());
                }
                return true;
            } catch (Exception e) {
                log.warn("Unexpected error sending metrics, removing emitter", e);
                try {
                    emitter.completeWithError(e);
                } catch (Exception ex) {
                    log.debug("Error completing emitter: {}", ex.getMessage());
                }
                return true;
            }
        });
    }
}
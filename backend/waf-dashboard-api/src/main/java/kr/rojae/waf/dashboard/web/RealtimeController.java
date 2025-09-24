package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.RealtimeLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

@RestController
@RequestMapping("/api/realtime")
@RequiredArgsConstructor
@Slf4j
public class RealtimeController {

    private final RealtimeLogService realtimeLogService;

    @GetMapping(value = "/logs/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLogs() {
        log.info("New SSE connection established");
        
        // 타임아웃을 30분으로 설정 (30 * 60 * 1000ms)
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
        
        emitter.onCompletion(() -> {
            log.info("SSE connection completed gracefully");
            realtimeLogService.removeEmitter(emitter);
        });
        
        emitter.onTimeout(() -> {
            log.info("SSE connection timeout (30min)");
            realtimeLogService.removeEmitter(emitter);
        });
        
        emitter.onError((ex) -> {
            if (ex instanceof IOException && ex.getMessage().contains("Broken pipe")) {
                log.debug("Client disconnected (broken pipe): {}", ex.getMessage());
            } else {
                log.warn("SSE connection error: {}", ex.getMessage());
            }
            realtimeLogService.removeEmitter(emitter);
        });

        // Send initial connection message
        try {
            emitter.send(SseEmitter.event()
                .name("connection")
                .data("Connected to realtime log stream")
                .reconnectTime(5000L));
            
            // 연결이 성공한 후에만 emitter 추가
            realtimeLogService.addEmitter(emitter);
        } catch (IOException e) {
            log.error("Failed to send initial message", e);
            emitter.completeWithError(e);
            return emitter;
        }

        return emitter;
    }

    @GetMapping(value = "/metrics/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamMetrics() {
        log.info("New metrics SSE connection established");
        
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        realtimeLogService.addMetricsEmitter(emitter);
        
        emitter.onCompletion(() -> {
            log.info("Metrics SSE connection completed");
            realtimeLogService.removeMetricsEmitter(emitter);
        });
        
        emitter.onTimeout(() -> {
            log.info("Metrics SSE connection timeout");
            realtimeLogService.removeMetricsEmitter(emitter);
        });
        
        emitter.onError((ex) -> {
            log.error("Metrics SSE connection error", ex);
            realtimeLogService.removeMetricsEmitter(emitter);
        });

        return emitter;
    }
}
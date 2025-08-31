package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.RealtimeLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3001", "http://localhost:3000"}, allowCredentials = "false")
@Slf4j
public class TestController {

    private final RealtimeLogService realtimeLogService;

    @PostMapping("/send-log")
    public ResponseEntity<String> sendTestLog(@RequestParam(defaultValue = "INFO") String level,
                                              @RequestParam(defaultValue = "Test log message") String message) {
        
        String testLog = String.format("{\"timestamp\":\"%s\",\"severity\":\"%s\",\"message\":\"%s\",\"client_ip\":\"192.168.1.100\",\"attack_type\":\"Test Attack\"}", 
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                level,
                message
        );
        
        log.info("Sending test log: {}", testLog);
        
        // Simulate Kafka message processing
        CompletableFuture.runAsync(() -> {
            realtimeLogService.handleRealtimeLog(testLog);
        });
        
        return ResponseEntity.ok("Test log sent: " + testLog);
    }
    
    @PostMapping("/send-multiple-logs")
    public ResponseEntity<String> sendMultipleLogs(@RequestParam(defaultValue = "5") int count) {
        String[] levels = {"INFO", "WARNING", "ERROR", "CRITICAL"};
        String[] attackTypes = {"SQL Injection", "XSS", "Command Injection", "Path Traversal"};
        
        for (int i = 0; i < count; i++) {
            String level = levels[i % levels.length];
            String attackType = attackTypes[i % attackTypes.length];
            String message = String.format("Test attack detected: %s #%d", attackType, i + 1);
            
            String testLog = String.format("{\"timestamp\":\"%s\",\"severity\":\"%s\",\"message\":\"%s\",\"client_ip\":\"192.168.1.%d\",\"attack_type\":\"%s\"}", 
                    LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                    level,
                    message,
                    100 + i,
                    attackType
            );
            
            final int logIndex = i;
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(logIndex * 500); // Stagger the logs
                    realtimeLogService.handleRealtimeLog(testLog);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
        }
        
        return ResponseEntity.ok(String.format("Sending %d test logs over %d seconds", count, count * 500 / 1000));
    }
}
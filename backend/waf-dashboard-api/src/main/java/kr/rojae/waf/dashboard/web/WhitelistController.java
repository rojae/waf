package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.dto.WhitelistDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/whitelist")
@RequiredArgsConstructor
@Slf4j
public class WhitelistController {

    @GetMapping
    public ResponseEntity<List<WhitelistDto>> getWhitelist() {
        log.info("GET /api/whitelist");
        
        // Mock data for now
        var whitelist = List.of(
                WhitelistDto.builder()
                        .id("1")
                        .ip("192.168.1.0/24")
                        .description("Internal network")
                        .enabled(true)
                        .createdAt(LocalDateTime.now().minusDays(10))
                        .updatedAt(LocalDateTime.now().minusDays(5))
                        .build(),
                WhitelistDto.builder()
                        .id("2")
                        .ip("10.0.0.100")
                        .description("Admin workstation")
                        .enabled(true)
                        .createdAt(LocalDateTime.now().minusDays(7))
                        .updatedAt(LocalDateTime.now().minusDays(2))
                        .build(),
                WhitelistDto.builder()
                        .id("3")
                        .ip("203.0.113.50")
                        .description("External monitoring service")
                        .enabled(false)
                        .createdAt(LocalDateTime.now().minusDays(3))
                        .updatedAt(LocalDateTime.now().minusDays(1))
                        .build()
        );
        
        return ResponseEntity.ok(whitelist);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WhitelistDto> getWhitelistEntry(@PathVariable String id) {
        log.info("GET /api/whitelist/{}", id);
        
        var entry = WhitelistDto.builder()
                .id(id)
                .ip("192.168.1.0/24")
                .description("Internal network")
                .enabled(true)
                .createdAt(LocalDateTime.now().minusDays(10))
                .updatedAt(LocalDateTime.now().minusDays(5))
                .build();
        
        return ResponseEntity.ok(entry);
    }

    @PostMapping
    public ResponseEntity<WhitelistDto> createWhitelistEntry(@RequestBody WhitelistDto whitelistDto) {
        log.info("POST /api/whitelist: {}", whitelistDto);
        
        var createdEntry = WhitelistDto.builder()
                .id(UUID.randomUUID().toString())
                .ip(whitelistDto.ip())
                .description(whitelistDto.description())
                .enabled(whitelistDto.enabled())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        
        return ResponseEntity.ok(createdEntry);
    }

    @PutMapping("/{id}")
    public ResponseEntity<WhitelistDto> updateWhitelistEntry(@PathVariable String id, @RequestBody WhitelistDto whitelistDto) {
        log.info("PUT /api/whitelist/{}: {}", id, whitelistDto);
        
        var updatedEntry = WhitelistDto.builder()
                .id(id)
                .ip(whitelistDto.ip())
                .description(whitelistDto.description())
                .enabled(whitelistDto.enabled())
                .createdAt(whitelistDto.createdAt())
                .updatedAt(LocalDateTime.now())
                .build();
        
        return ResponseEntity.ok(updatedEntry);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWhitelistEntry(@PathVariable String id) {
        log.info("DELETE /api/whitelist/{}", id);
        
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<WhitelistDto> toggleWhitelistEntry(@PathVariable String id) {
        log.info("PUT /api/whitelist/{}/toggle", id);
        
        var toggledEntry = WhitelistDto.builder()
                .id(id)
                .ip("192.168.1.0/24")
                .description("Internal network")
                .enabled(false) // Toggled
                .createdAt(LocalDateTime.now().minusDays(10))
                .updatedAt(LocalDateTime.now())
                .build();
        
        return ResponseEntity.ok(toggledEntry);
    }
}
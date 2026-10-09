package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.dto.ToggleRequest;
import kr.rojae.waf.dashboard.dto.WhitelistDraftDto;
import kr.rojae.waf.dashboard.service.ManagementDraftStore;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/whitelist")
@RequiredArgsConstructor
public class WhitelistManagementController {
    private final ManagementDraftStore store;

    @GetMapping
    public List<WhitelistDraftDto> all() {
        return store.whitelist();
    }

    @GetMapping("/{id}")
    public ResponseEntity<WhitelistDraftDto> one(@PathVariable String id) {
        return store.whitelist(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<WhitelistDraftDto> create(@RequestBody WhitelistDraftDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(store.createWhitelist(request));
    }

    @PutMapping("/{id}")
    public WhitelistDraftDto update(@PathVariable String id, @RequestBody WhitelistDraftDto request) {
        return store.updateWhitelist(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        store.deleteWhitelist(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    public WhitelistDraftDto toggle(@PathVariable String id, @RequestBody ToggleRequest request) {
        if (request.enabled() == null) {
            throw new ManagementDraftStore.ValidationFailure(List.of("enabled is required"));
        }
        return store.toggleWhitelist(id, request.enabled());
    }

    @ExceptionHandler(ManagementDraftStore.ValidationFailure.class)
    ResponseEntity<Map<String, Object>> validation(ManagementDraftStore.ValidationFailure failure) {
        return ResponseEntity.badRequest().body(Map.of(
                "message", "validation_failed",
                "errors", failure.errors()
        ));
    }

    @ExceptionHandler(ManagementDraftStore.NotFound.class)
    ResponseEntity<Map<String, Object>> notFound(ManagementDraftStore.NotFound failure) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", failure.getMessage()));
    }
}

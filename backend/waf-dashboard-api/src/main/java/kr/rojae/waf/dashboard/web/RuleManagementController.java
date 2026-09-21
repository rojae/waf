package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.dto.RuleDraftDto;
import kr.rojae.waf.dashboard.dto.RuleValidationResponse;
import kr.rojae.waf.dashboard.dto.ToggleRequest;
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
@RequestMapping("/api/rules")
@RequiredArgsConstructor
public class RuleManagementController {
    private final ManagementDraftStore store;

    @GetMapping
    public List<RuleDraftDto> all() {
        return store.rules();
    }

    @GetMapping("/{id}")
    public ResponseEntity<RuleDraftDto> one(@PathVariable long id) {
        return store.rule(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<RuleDraftDto> create(@RequestBody RuleDraftDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(store.createRule(request));
    }

    @PutMapping("/{id}")
    public RuleDraftDto update(@PathVariable long id, @RequestBody RuleDraftDto request) {
        return store.updateRule(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        store.deleteRule(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    public RuleDraftDto toggle(@PathVariable long id, @RequestBody ToggleRequest request) {
        if (request.enabled() == null) {
            throw new ManagementDraftStore.ValidationFailure(List.of("enabled is required"));
        }
        return store.toggleRule(id, request.enabled());
    }

    @PostMapping("/validate")
    public RuleValidationResponse validate(@RequestBody RuleDraftDto request) {
        return store.validateRule(request);
    }

    @PostMapping("/deploy")
    public ResponseEntity<Map<String, Object>> deployUnavailable() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                "deploymentStatus", "FAILED",
                "errorMessage", "Rule deployment is unavailable in PR1; drafts are not applied to nginx"
        ));
    }

    @GetMapping("/deployment-status")
    public ResponseEntity<Map<String, Object>> deploymentStatus() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "no_real_deployment",
                "message", "No nginx validation or reload has occurred"
        ));
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

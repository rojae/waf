package kr.rojae.waf.dashboard.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.rojae.waf.common.entity.CustomRule;
import kr.rojae.waf.common.entity.RuleDeployment;
import kr.rojae.waf.dashboard.dto.CustomRuleDTO;
import kr.rojae.waf.dashboard.dto.RuleDeploymentRequest;
import kr.rojae.waf.dashboard.service.CustomRuleService;
import kr.rojae.waf.dashboard.service.CustomRuleValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Custom Rules Management REST Controller V2
 * Enhanced version with database persistence and Kubernetes deployment
 */
@RestController
@RequestMapping("/api/v2/custom-rules")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Custom Rules V2", description = "Enhanced custom WAF rules management with database and K8s deployment")
@CrossOrigin(origins = "*")
public class CustomRuleControllerV2 {

    private final CustomRuleService customRuleService;
    private final CustomRuleValidationService validationService;

    @GetMapping("/health")
    @Operation(summary = "Health check for custom rules service")
    public Map<String, Object> health() {
        return Map.of(
            "status", "OK",
            "service", "Custom Rules API V2",
            "timestamp", System.currentTimeMillis(),
            "features", List.of("database-persistence", "kubernetes-deployment", "rule-validation")
        );
    }

    /**
     * Get all custom rules with pagination and filtering
     */
    @GetMapping
    @Operation(summary = "Get all custom rules", description = "Retrieve custom rules with pagination and filtering options")
    public ResponseEntity<Page<CustomRuleDTO>> getAllRules(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "priority") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) CustomRule.RuleSeverity severity,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) Boolean isBlocking,
            @RequestParam(required = false) String search) {

        Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<CustomRuleDTO> rules = customRuleService.searchRules(
                categoryId, severity, isActive, isBlocking, search, pageable);

        return ResponseEntity.ok(rules);
    }

    /**
     * Get custom rule by ID
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get custom rule by ID")
    public ResponseEntity<CustomRuleDTO> getRuleById(@PathVariable Long id) {
        return customRuleService.getRuleById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get custom rule by ModSecurity rule ID
     */
    @GetMapping("/rule/{ruleId}")
    @Operation(summary = "Get custom rule by ModSecurity rule ID")
    public ResponseEntity<CustomRuleDTO> getRuleByRuleId(@PathVariable Integer ruleId) {
        return customRuleService.getRuleByRuleId(ruleId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create new custom rule
     */
    @PostMapping
    @Operation(summary = "Create new custom rule")
    public ResponseEntity<?> createRule(
            @Valid @RequestBody CustomRuleDTO ruleDTO,
            HttpServletRequest request) {

        String createdBy = getCurrentUser(request);

        try {
            CustomRuleDTO createdRule = customRuleService.createRule(ruleDTO, createdBy);
            return ResponseEntity.ok(createdRule);
        } catch (IllegalArgumentException e) {
            log.warn("Failed to create rule: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "error", "validation_failed",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Unexpected error creating rule", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred"
            ));
        }
    }

    /**
     * Update existing custom rule
     */
    @PutMapping("/{id}")
    @Operation(summary = "Update existing custom rule")
    public ResponseEntity<?> updateRule(
            @PathVariable Long id,
            @Valid @RequestBody CustomRuleDTO ruleDTO,
            HttpServletRequest request) {

        String updatedBy = getCurrentUser(request);

        try {
            CustomRuleDTO updatedRule = customRuleService.updateRule(id, ruleDTO, updatedBy);
            return ResponseEntity.ok(updatedRule);
        } catch (IllegalArgumentException e) {
            log.warn("Failed to update rule {}: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "error", "validation_failed",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Unexpected error updating rule {}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred"
            ));
        }
    }

    /**
     * Delete custom rule
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete custom rule")
    public ResponseEntity<?> deleteRule(@PathVariable Long id) {
        try {
            customRuleService.deleteRule(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            log.warn("Failed to delete rule {}: {}", id, e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Unexpected error deleting rule {}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred"
            ));
        }
    }

    /**
     * Toggle rule active status
     */
    @PostMapping("/{id}/toggle")
    @Operation(summary = "Toggle rule active status")
    public ResponseEntity<?> toggleRuleStatus(
            @PathVariable Long id,
            HttpServletRequest request) {

        String updatedBy = getCurrentUser(request);

        try {
            CustomRuleDTO updatedRule = customRuleService.toggleRuleStatus(id, updatedBy);
            return ResponseEntity.ok(Map.of(
                "rule", updatedRule,
                "message", "Rule status toggled successfully"
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Failed to toggle rule status {}: {}", id, e.getMessage());
            return ResponseEntity.notFound().body(Map.of(
                "error", "rule_not_found",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Unexpected error toggling rule status {}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "internal_error",
                "message", "An unexpected error occurred"
            ));
        }
    }

    /**
     * Get active rules for deployment preview
     */
    @GetMapping("/deployment/preview")
    @Operation(summary = "Preview rules for deployment")
    public ResponseEntity<Map<String, Object>> getDeploymentPreview() {
        List<CustomRuleDTO> activeRules = customRuleService.getActiveRulesForDeployment();

        Map<String, Object> preview = Map.of(
            "totalRules", activeRules.size(),
            "blockingRules", activeRules.stream().mapToInt(r -> r.getIsBlocking() ? 1 : 0).sum(),
            "monitoringRules", activeRules.stream().mapToInt(r -> !r.getIsBlocking() ? 1 : 0).sum(),
            "rules", activeRules,
            "estimatedDeploymentTime", "30-60 seconds"
        );

        return ResponseEntity.ok(preview);
    }

    /**
     * Deploy custom rules to Kubernetes
     */
    @PostMapping("/deploy")
    @Operation(summary = "Deploy custom rules to Kubernetes")
    public ResponseEntity<?> deployRules(
            @RequestBody(required = false) RuleDeploymentRequest request,
            HttpServletRequest httpRequest) {

        String triggeredBy = getCurrentUser(httpRequest);
        String notes = request != null ? request.getNotes() : null;

        try {
            log.info("Starting rule deployment triggered by: {}", triggeredBy);
            RuleDeployment deployment = customRuleService.deployRules(triggeredBy, notes);

            return ResponseEntity.ok(Map.of(
                "deployment", deployment,
                "message", "Deployment started successfully",
                "estimatedTime", "30-60 seconds"
            ));

        } catch (Exception e) {
            log.error("Failed to deploy rules", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "deployment_failed",
                "message", "Failed to deploy rules: " + e.getMessage()
            ));
        }
    }

    /**
     * Validate custom rule syntax
     */
    @PostMapping("/validate")
    @Operation(summary = "Validate custom rule syntax")
    public ResponseEntity<Map<String, Object>> validateRule(@RequestBody CustomRuleDTO ruleDTO) {
        try {
            // Convert DTO to entity for validation
            CustomRule rule = new CustomRule();
            rule.setName(ruleDTO.getName());
            rule.setRuleId(ruleDTO.getRuleId());
            rule.setRuleContent(ruleDTO.getRuleContent());
            rule.setDescription(ruleDTO.getDescription());
            rule.setPriority(ruleDTO.getPriority());
            rule.setPhase(ruleDTO.getPhase());
            rule.setSeverity(ruleDTO.getSeverity());

            // Use validation service
            CustomRuleValidationService.ValidationResult validation = validationService.validateRule(rule);

            Map<String, Object> result = Map.of(
                "valid", validation.isValid(),
                "errors", validation.getErrors(),
                "warnings", validation.getWarnings(),
                "estimatedType", ruleDTO.getEstimatedType(),
                "ruleId", ruleDTO.getRuleId() != null ? ruleDTO.getRuleId() : "AUTO_ASSIGN",
                "phase", ruleDTO.getPhase() != null ? ruleDTO.getPhase() : 2,
                "severity", ruleDTO.getSeverity() != null ? ruleDTO.getSeverity() : CustomRule.RuleSeverity.MEDIUM
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "error", e.getMessage(),
                "suggestions", List.of("Check rule syntax", "Ensure all required fields are present")
            ));
        }
    }

    /**
     * Get rule templates
     */
    @GetMapping("/templates")
    @Operation(summary = "Get rule templates for common attack patterns")
    public ResponseEntity<Map<String, Object>> getRuleTemplates() {
        try {
            List<CustomRuleValidationService.RuleTemplate> templates = validationService.getRuleTemplates();

            return ResponseEntity.ok(Map.of(
                "templates", templates,
                "count", templates.size(),
                "message", "Rule templates retrieved successfully"
            ));
        } catch (Exception e) {
            log.error("Failed to get rule templates", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "templates_unavailable",
                "message", "Unable to retrieve rule templates"
            ));
        }
    }

    /**
     * Get next available rule ID
     */
    @GetMapping("/next-rule-id")
    @Operation(summary = "Get next available rule ID")
    public ResponseEntity<Map<String, Object>> getNextRuleId() {
        try {
            // This would call the actual service method once implemented
            Map<String, Object> result = Map.of(
                "nextRuleId", 9001,
                "availableRange", "9001-9999",
                "message", "Next available rule ID"
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "Unable to determine next rule ID",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Get rule statistics
     */
    @GetMapping("/stats")
    @Operation(summary = "Get custom rules statistics")
    public ResponseEntity<Map<String, Object>> getRuleStats() {
        try {
            // This would call actual service methods once repositories are properly configured
            Map<String, Object> stats = Map.of(
                "totalRules", 0,
                "activeRules", 0,
                "blockingRules", 0,
                "monitoringRules", 0,
                "recentlyCreated", 0,
                "needingDeployment", 0,
                "categorizedRules", Map.of(
                    "SQL Injection", 0,
                    "XSS", 0,
                    "File Upload", 0,
                    "Rate Limiting", 0,
                    "Custom Block", 0
                ),
                "severityDistribution", Map.of(
                    "CRITICAL", 0,
                    "HIGH", 0,
                    "MEDIUM", 0,
                    "LOW", 0,
                    "INFO", 0
                )
            );

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Failed to get rule statistics", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", "statistics_unavailable",
                "message", "Unable to retrieve statistics"
            ));
        }
    }

    /**
     * Test rule against sample input
     */
    @PostMapping("/test")
    @Operation(summary = "Test rule against sample input")
    public ResponseEntity<Map<String, Object>> testRule(
            @RequestBody Map<String, Object> testRequest) {

        String ruleContent = (String) testRequest.get("ruleContent");
        Map<String, String> testInputs = (Map<String, String>) testRequest.getOrDefault("testInputs", Map.of());

        try {
            // Create a rule entity for testing
            CustomRule rule = new CustomRule();
            rule.setRuleContent(ruleContent);
            rule.setRuleId(90001); // Default test ID
            rule.setName("Test Rule");

            // Use validation service to test the rule
            CustomRuleValidationService.TestResult testResult = validationService.testRule(rule, testInputs);

            return ResponseEntity.ok(Map.of(
                "success", testResult.isSuccess(),
                "message", testResult.getMessage(),
                "details", testResult.getDetails(),
                "testInputsProcessed", testInputs.size()
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "test_failed",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Generate rule suggestions based on content
     */
    private List<String> generateRuleSuggestions(CustomRuleDTO ruleDTO) {
        List<String> suggestions = new java.util.ArrayList<>();

        if (ruleDTO.getRuleContent() == null || ruleDTO.getRuleContent().trim().isEmpty()) {
            suggestions.add("Rule content is required");
            return suggestions;
        }

        String content = ruleDTO.getRuleContent().toLowerCase();

        if (!content.contains("secrule")) {
            suggestions.add("Rule should start with 'SecRule'");
        }

        if (ruleDTO.getRuleId() == null) {
            suggestions.add("Consider setting a specific rule ID (9001-9999)");
        }

        if (!content.contains("id:")) {
            suggestions.add("Rule should include 'id:' parameter");
        }

        if (!content.contains("msg:")) {
            suggestions.add("Consider adding 'msg:' for better logging");
        }

        if (content.contains("@detectsqli") && !content.contains("t:")) {
            suggestions.add("SQL injection rules often benefit from transformations like 't:urlDecodeUni'");
        }

        if (suggestions.isEmpty()) {
            suggestions.add("Rule syntax appears valid");
        }

        return suggestions;
    }

    /**
     * Get current user from request
     * This is a placeholder - in real implementation, this would extract user from JWT/session
     */
    private String getCurrentUser(HttpServletRequest request) {
        // TODO: Extract from JWT token or session
        String userHeader = request.getHeader("X-User");
        String authHeader = request.getHeader("Authorization");

        if (userHeader != null) {
            return userHeader;
        }

        // In a real implementation, you would decode JWT here
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return "authenticated_user"; // Extract from JWT
        }

        return "system";
    }
}
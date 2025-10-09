package kr.rojae.waf.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import kr.rojae.waf.common.entity.CustomRule;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Custom Rule Data Transfer Object
 * Used for API requests and responses
 */
@Data
@Schema(description = "Custom ModSecurity Rule")
public class CustomRuleDTO {

    @Schema(description = "Rule database ID", example = "1", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @NotNull
    @Min(value = 9001, message = "Rule ID must be between 9001 and 9999")
    @Max(value = 9999, message = "Rule ID must be between 9001 and 9999")
    @Schema(description = "ModSecurity rule ID (9001-9999)", example = "9001", required = true)
    private Integer ruleId;

    @NotBlank
    @Size(max = 255, message = "Rule name must not exceed 255 characters")
    @Schema(description = "Rule display name", example = "Block SQL Injection", required = true)
    private String name;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    @Schema(description = "Rule description", example = "Detects and blocks SQL injection attempts")
    private String description;

    @Schema(description = "Rule category ID", example = "1")
    private Long categoryId;

    @Schema(description = "Rule category name", example = "SQL Injection", accessMode = Schema.AccessMode.READ_ONLY)
    private String categoryName;

    @NotBlank
    @Size(max = 10000, message = "Rule content must not exceed 10000 characters")
    @Schema(description = "ModSecurity rule content", required = true,
            example = "SecRule ARGS \"@detectSQLi\" \"id:9001,phase:2,block,msg:'SQL Injection Attack'\"")
    private String ruleContent;

    @NotNull
    @Min(value = 1, message = "Phase must be between 1 and 5")
    @Max(value = 5, message = "Phase must be between 1 and 5")
    @Schema(description = "ModSecurity processing phase (1-5)", example = "2", required = true)
    private Integer phase = 2;

    @NotNull
    @Schema(description = "Rule severity level", example = "MEDIUM", required = true)
    private CustomRule.RuleSeverity severity = CustomRule.RuleSeverity.MEDIUM;

    @Schema(description = "Whether the rule is active", example = "true")
    private Boolean isActive = true;

    @Schema(description = "Whether the rule blocks requests (true) or just logs (false)", example = "true")
    private Boolean isBlocking = true;

    @Min(value = 1, message = "Priority must be at least 1")
    @Max(value = 1000, message = "Priority must not exceed 1000")
    @Schema(description = "Rule execution priority (higher = more priority)", example = "100")
    private Integer priority = 100;

    // Audit fields (read-only)
    @Schema(description = "User who created the rule", example = "admin", accessMode = Schema.AccessMode.READ_ONLY)
    private String createdBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "Rule creation timestamp", accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime createdAt;

    @Schema(description = "User who last updated the rule", example = "admin", accessMode = Schema.AccessMode.READ_ONLY)
    private String updatedBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "Rule last update timestamp", accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime updatedAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "Last deployment timestamp", accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime lastDeployedAt;

    @Schema(description = "Deployment version ID", accessMode = Schema.AccessMode.READ_ONLY)
    private String deploymentVersion;

    /**
     * Check if rule needs redeployment
     */
    public boolean needsRedeployment() {
        return lastDeployedAt == null ||
               (updatedAt != null && updatedAt.isAfter(lastDeployedAt));
    }

    /**
     * Get rule status display string
     */
    public String getStatusDisplay() {
        if (!isActive) return "Inactive";
        if (isBlocking) return "Blocking";
        return "Monitoring";
    }

    /**
     * Get severity color for UI
     */
    public String getSeverityColor() {
        if (severity == null) return "#6c757d";

        return switch (severity) {
            case CRITICAL -> "#dc3545"; // Red
            case HIGH -> "#fd7e14";     // Orange
            case MEDIUM -> "#ffc107";   // Yellow
            case LOW -> "#28a745";      // Green
            case INFO -> "#17a2b8";     // Cyan
        };
    }

    /**
     * Validate rule content basic syntax
     */
    public boolean hasValidSyntax() {
        if (ruleContent == null || ruleContent.trim().isEmpty()) {
            return false;
        }

        String content = ruleContent.toLowerCase();
        return content.contains("secrule") &&
               content.contains("id:" + ruleId) &&
               content.contains("phase:" + phase);
    }

    /**
     * Get estimated rule type based on content
     */
    public String getEstimatedType() {
        if (ruleContent == null) return "UNKNOWN";

        String content = ruleContent.toLowerCase();
        if (content.contains("@detectsqli") || content.contains("sql")) return "SQL_INJECTION";
        if (content.contains("@detectxss") || content.contains("xss")) return "XSS";
        if (content.contains("@rbl") || content.contains("rate")) return "RATE_LIMIT";
        if (content.contains("@ipmatch") || content.contains("remote_addr")) return "IP_FILTER";
        if (content.contains("@streq") || content.contains("@contains")) return "CONTENT_FILTER";

        return "CUSTOM";
    }

    /**
     * Create minimal DTO for list views
     */
    public static CustomRuleDTO createSummary(CustomRule rule) {
        CustomRuleDTO dto = new CustomRuleDTO();
        dto.setId(rule.getId());
        dto.setRuleId(rule.getRuleId());
        dto.setName(rule.getName());
        dto.setCategoryName(rule.getCategory() != null ? rule.getCategory().getName() : null);
        dto.setSeverity(rule.getSeverity());
        dto.setIsActive(rule.getIsActive());
        dto.setIsBlocking(rule.getIsBlocking());
        dto.setPriority(rule.getPriority());
        dto.setCreatedAt(rule.getCreatedAt());
        dto.setLastDeployedAt(rule.getLastDeployedAt());
        return dto;
    }
}
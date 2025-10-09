package kr.rojae.waf.common.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * ModSecurity Custom Rule Entity
 * Represents user-defined security rules for the WAF
 */
@Entity
@Table(name = "custom_rules")
@Data
@EqualsAndHashCode(callSuper = false)
@ToString(exclude = {"category"})
public class CustomRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * ModSecurity rule ID (9001-9999 range for custom rules)
     * This ID is used in the actual SecRule directive
     */
    @Column(name = "rule_id", nullable = false, unique = true)
    private Integer ruleId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Rule category for organization
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private RuleCategory category;

    /**
     * The actual ModSecurity rule content (SecRule directive)
     */
    @Column(name = "rule_content", nullable = false, columnDefinition = "TEXT")
    private String ruleContent;

    /**
     * ModSecurity processing phase (1-5)
     * 1: Request Headers, 2: Request Body, 3: Response Headers, 4: Response Body, 5: Logging
     */
    @Column(name = "phase", nullable = false)
    private Integer phase = 2;

    /**
     * Rule severity level
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "severity")
    private RuleSeverity severity = RuleSeverity.MEDIUM;

    /**
     * Whether the rule is currently active
     */
    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * Whether the rule should block requests (true) or just log (false)
     */
    @Column(name = "is_blocking")
    private Boolean isBlocking = true;

    /**
     * Rule execution priority (higher number = higher priority)
     */
    @Column(name = "priority")
    private Integer priority = 100;

    // Audit fields
    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Deployment tracking
    @Column(name = "last_deployed_at")
    private LocalDateTime lastDeployedAt;

    @Column(name = "deployment_version")
    private String deploymentVersion;

    /**
     * Rule severity levels
     */
    public enum RuleSeverity {
        CRITICAL,
        HIGH,
        MEDIUM,
        LOW,
        INFO
    }

    /**
     * Generate ModSecurity rule directive
     * @return Complete SecRule directive ready for ModSecurity
     */
    public String generateModSecurityRule() {
        if (ruleContent == null || ruleContent.trim().isEmpty()) {
            return "";
        }

        // Ensure rule content includes the rule ID and basic structure
        String rule = ruleContent;

        // Add rule ID if not present
        if (!rule.contains("id:" + ruleId)) {
            rule = rule.replace("id:{{RULE_ID}}", "id:" + ruleId);
        }

        // Add phase if not present
        if (!rule.contains("phase:" + phase)) {
            rule = rule.replace("phase:{{PHASE}}", "phase:" + phase);
        }

        // Add action based on blocking setting
        String action = isBlocking ? "block" : "pass";
        rule = rule.replace("{{ACTION}}", action);

        return rule;
    }

    /**
     * Validate rule content for basic syntax
     * @return true if rule appears valid
     */
    public boolean isValidRule() {
        if (ruleContent == null || ruleContent.trim().isEmpty()) {
            return false;
        }

        String rule = ruleContent.toLowerCase();
        return rule.contains("secrule") || rule.startsWith("secrule");
    }

    /**
     * Get rule type based on content analysis
     * @return Estimated rule type
     */
    public String estimateRuleType() {
        if (ruleContent == null) return "UNKNOWN";

        String content = ruleContent.toLowerCase();
        if (content.contains("@detectsqli") || content.contains("sql")) return "SQL_INJECTION";
        if (content.contains("@detectxss") || content.contains("xss")) return "XSS";
        if (content.contains("@rbl") || content.contains("rate")) return "RATE_LIMIT";
        if (content.contains("@ipMatch") || content.contains("remote_addr")) return "IP_FILTER";
        if (content.contains("@streq") || content.contains("@contains")) return "CONTENT_FILTER";

        return "CUSTOM";
    }
}
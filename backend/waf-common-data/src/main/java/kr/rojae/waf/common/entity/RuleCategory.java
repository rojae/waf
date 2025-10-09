package kr.rojae.waf.common.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Rule Category Entity
 * Used to organize custom rules into categories
 */
@Entity
@Table(name = "rule_categories")
@Data
@EqualsAndHashCode(callSuper = false)
@ToString(exclude = {"customRules"})
public class RuleCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Hex color code for UI display (#RRGGBB format)
     */
    @Column(name = "color")
    private String color = "#007bff";

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * Rules belonging to this category
     */
    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<CustomRule> customRules = new ArrayList<>();

    /**
     * Get count of active rules in this category
     */
    public long getActiveRuleCount() {
        return customRules.stream()
                .filter(rule -> rule.getIsActive() != null && rule.getIsActive())
                .count();
    }

    /**
     * Get count of blocking rules in this category
     */
    public long getBlockingRuleCount() {
        return customRules.stream()
                .filter(rule -> rule.getIsActive() != null && rule.getIsActive())
                .filter(rule -> rule.getIsBlocking() != null && rule.getIsBlocking())
                .count();
    }

    /**
     * Validate hex color format
     */
    public boolean isValidColor() {
        if (color == null) return false;
        return color.matches("^#[0-9A-Fa-f]{6}$");
    }

    /**
     * Set color with validation
     */
    public void setColorSafe(String color) {
        if (color != null && color.matches("^#[0-9A-Fa-f]{6}$")) {
            this.color = color;
        }
    }
}
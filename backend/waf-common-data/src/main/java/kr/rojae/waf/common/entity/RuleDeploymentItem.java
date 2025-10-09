package kr.rojae.waf.common.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * Rule Deployment Item Entity
 * Links specific rules to deployments with snapshots
 */
@Entity
@Table(name = "rule_deployment_items")
@Data
@EqualsAndHashCode(callSuper = false)
@ToString(exclude = {"deployment", "rule"})
public class RuleDeploymentItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The deployment this item belongs to
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deployment_id", nullable = false)
    private RuleDeployment deployment;

    /**
     * The rule that was deployed
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id", nullable = false)
    private CustomRule rule;

    /**
     * Snapshot of the rule content at deployment time
     * This preserves the exact rule that was deployed
     */
    @Column(name = "rule_content_snapshot", nullable = false, columnDefinition = "TEXT")
    private String ruleContentSnapshot;

    /**
     * Rule priority at deployment time
     */
    @Column(name = "rule_priority")
    private Integer rulePriority;

    /**
     * Create deployment item from current rule state
     */
    public static RuleDeploymentItem fromRule(RuleDeployment deployment, CustomRule rule) {
        RuleDeploymentItem item = new RuleDeploymentItem();
        item.setDeployment(deployment);
        item.setRule(rule);
        item.setRuleContentSnapshot(rule.generateModSecurityRule());
        item.setRulePriority(rule.getPriority());
        return item;
    }
}
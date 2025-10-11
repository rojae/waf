package kr.rojae.waf.common.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Rule Deployment Entity
 * Tracks deployment history and status of custom rules
 */
@Entity
@Table(name = "rule_deployments")
@Data
@EqualsAndHashCode(callSuper = false)
public class RuleDeployment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Unique deployment identifier (UUID)
     */
    @Column(name = "deployment_id", nullable = false, unique = true)
    private String deploymentId;

    // Deployment statistics
    @Column(name = "total_rules", nullable = false)
    private Integer totalRules;

    @Column(name = "active_rules", nullable = false)
    private Integer activeRules;

    @Enumerated(EnumType.STRING)
    @Column(name = "deployment_status")
    private DeploymentStatus deploymentStatus = DeploymentStatus.PENDING;

    // Kubernetes deployment details
    @Column(name = "configmap_version")
    private String configmapVersion;

    @Column(name = "nginx_deployment_revision")
    private Integer nginxDeploymentRevision;

    @Column(name = "rollout_status")
    private String rolloutStatus;

    // Timing information
    // @CreationTimestamp
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "deployment_duration_seconds")
    private Integer deploymentDurationSeconds;

    // Metadata
    @Column(name = "triggered_by")
    private String triggeredBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /**
     * Rules included in this deployment
     */
    @OneToMany(mappedBy = "deployment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<RuleDeploymentItem> deploymentItems = new ArrayList<>();

    /**
     * Deployment status enumeration
     */
    public enum DeploymentStatus {
        PENDING,     // Deployment initiated but not started
        DEPLOYING,   // Currently deploying
        SUCCESS,     // Successfully deployed
        FAILED,      // Deployment failed
        ROLLBACK     // Rolled back to previous version
    }

    /**
     * Calculate deployment duration when completed
     */
    public void markCompleted(DeploymentStatus finalStatus) {
        this.completedAt = LocalDateTime.now();
        this.deploymentStatus = finalStatus;

        if (this.startedAt != null && this.completedAt != null) {
            this.deploymentDurationSeconds = (int) java.time.Duration.between(
                    this.startedAt, this.completedAt).getSeconds();
        }
    }

    /**
     * Check if deployment is in progress
     */
    public boolean isInProgress() {
        return deploymentStatus == DeploymentStatus.PENDING ||
               deploymentStatus == DeploymentStatus.DEPLOYING;
    }

    /**
     * Check if deployment was successful
     */
    public boolean isSuccessful() {
        return deploymentStatus == DeploymentStatus.SUCCESS;
    }

    /**
     * Check if deployment failed
     */
    public boolean isFailed() {
        return deploymentStatus == DeploymentStatus.FAILED;
    }

    /**
     * Get deployment duration in human readable format
     */
    public String getFormattedDuration() {
        if (deploymentDurationSeconds == null) return "N/A";

        int seconds = deploymentDurationSeconds;
        int minutes = seconds / 60;
        int remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return String.format("%dm %ds", minutes, remainingSeconds);
        } else {
            return String.format("%ds", remainingSeconds);
        }
    }
}
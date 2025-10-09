package kr.rojae.waf.dashboard.repository;

import kr.rojae.waf.common.entity.CustomRule;
import kr.rojae.waf.common.entity.RuleCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Custom Rules
 */
@Repository
public interface CustomRuleRepository extends JpaRepository<CustomRule, Long> {

    /**
     * Find rule by ModSecurity rule ID
     */
    Optional<CustomRule> findByRuleId(Integer ruleId);

    /**
     * Find all active rules
     */
    List<CustomRule> findByIsActiveTrueOrderByPriorityDescCreatedAtAsc();

    /**
     * Find active rules for deployment
     */
    @Query("SELECT r FROM CustomRule r WHERE r.isActive = true ORDER BY r.priority DESC, r.ruleId ASC")
    List<CustomRule> findActiveRulesForDeployment();

    /**
     * Find rules by category
     */
    Page<CustomRule> findByCategory(RuleCategory category, Pageable pageable);

    /**
     * Find active rules by category
     */
    List<CustomRule> findByCategoryAndIsActiveTrue(RuleCategory category);

    /**
     * Find rules by severity
     */
    List<CustomRule> findBySeverityAndIsActiveTrue(CustomRule.RuleSeverity severity);

    /**
     * Search rules by name or description
     */
    @Query("SELECT r FROM CustomRule r WHERE " +
           "(:searchTerm IS NULL OR " +
           "LOWER(r.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.description) LIKE LOWER(CONCAT('%', :searchTerm, '%'))) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    Page<CustomRule> searchRules(@Param("searchTerm") String searchTerm, Pageable pageable);

    /**
     * Find rules that need redeployment (modified after last deployment)
     */
    @Query("SELECT r FROM CustomRule r WHERE " +
           "r.isActive = true AND " +
           "(r.lastDeployedAt IS NULL OR r.updatedAt > r.lastDeployedAt)")
    List<CustomRule> findRulesNeedingRedeployment();

    /**
     * Check if rule ID is available
     */
    boolean existsByRuleId(Integer ruleId);

    /**
     * Find next available rule ID in custom range (9001-9999)
     */
    @Query(value = "SELECT MIN(t.id) FROM " +
                   "(SELECT 9001 as id UNION ALL " +
                   "SELECT r.rule_id + 1 FROM custom_rules r WHERE r.rule_id < 9999) t " +
                   "WHERE t.id <= 9999 AND NOT EXISTS " +
                   "(SELECT 1 FROM custom_rules r2 WHERE r2.rule_id = t.id)",
           nativeQuery = true)
    Optional<Integer> findNextAvailableRuleId();

    /**
     * Count active rules
     */
    long countByIsActiveTrue();

    /**
     * Count blocking rules
     */
    long countByIsActiveTrueAndIsBlockingTrue();

    /**
     * Find recently created rules
     */
    List<CustomRule> findTop10ByOrderByCreatedAtDesc();

    /**
     * Find rules by phase
     */
    List<CustomRule> findByPhaseAndIsActiveTrueOrderByPriorityDesc(Integer phase);

    /**
     * Find rules created by user
     */
    Page<CustomRule> findByCreatedBy(String createdBy, Pageable pageable);

    /**
     * Find rules modified after date
     */
    List<CustomRule> findByUpdatedAtAfterAndIsActiveTrue(LocalDateTime since);

    /**
     * Get rule statistics by category
     */
    @Query("SELECT r.category.name, COUNT(r) FROM CustomRule r " +
           "WHERE r.isActive = true GROUP BY r.category.name")
    List<Object[]> getRuleCountByCategory();

    /**
     * Get rule statistics by severity
     */
    @Query("SELECT r.severity, COUNT(r) FROM CustomRule r " +
           "WHERE r.isActive = true GROUP BY r.severity")
    List<Object[]> getRuleCountBySeverity();

    /**
     * Find rules with validation issues
     */
    @Query("SELECT r FROM CustomRule r WHERE " +
           "r.isActive = true AND " +
           "(r.ruleContent IS NULL OR r.ruleContent = '' OR " +
           "r.ruleId IS NULL OR r.phase IS NULL)")
    List<CustomRule> findRulesWithValidationIssues();

    /**
     * Advanced search with multiple filters
     */
    @Query("SELECT r FROM CustomRule r WHERE " +
           "(:categoryId IS NULL OR r.category.id = :categoryId) AND " +
           "(:severity IS NULL OR r.severity = :severity) AND " +
           "(:isActive IS NULL OR r.isActive = :isActive) AND " +
           "(:isBlocking IS NULL OR r.isBlocking = :isBlocking) AND " +
           "(:searchTerm IS NULL OR " +
           "LOWER(r.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR " +
           "LOWER(r.description) LIKE LOWER(CONCAT('%', :searchTerm, '%'))) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    Page<CustomRule> findWithFilters(
        @Param("categoryId") Long categoryId,
        @Param("severity") CustomRule.RuleSeverity severity,
        @Param("isActive") Boolean isActive,
        @Param("isBlocking") Boolean isBlocking,
        @Param("searchTerm") String searchTerm,
        Pageable pageable
    );
}
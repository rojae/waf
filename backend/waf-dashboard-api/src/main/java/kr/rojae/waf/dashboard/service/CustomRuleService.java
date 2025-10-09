package kr.rojae.waf.dashboard.service;

import kr.rojae.waf.common.entity.CustomRule;
import kr.rojae.waf.common.entity.RuleCategory;
import kr.rojae.waf.common.entity.RuleDeployment;
import kr.rojae.waf.dashboard.dto.CustomRuleDTO;
import kr.rojae.waf.dashboard.dto.RuleValidationResult;
import kr.rojae.waf.dashboard.repository.CustomRuleRepository;
import kr.rojae.waf.dashboard.repository.RuleCategoryRepository;
import kr.rojae.waf.dashboard.repository.RuleDeploymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Custom Rule Management Service
 * Handles CRUD operations and business logic for ModSecurity custom rules
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CustomRuleService {

    private final CustomRuleRepository customRuleRepository;
    private final RuleCategoryRepository categoryRepository;
    private final RuleDeploymentRepository deploymentRepository;
    private final KubernetesService kubernetesService;
    private final RuleValidationService ruleValidationService;

    // ModSecurity rule syntax patterns
    private static final Pattern SECRULE_PATTERN = Pattern.compile(
        "SecRule\\s+[A-Z_|&!]+\\s+\"[^\"]+\"\\s+\"[^\"]+\"",
        Pattern.CASE_INSENSITIVE | Pattern.MULTILINE
    );

    private static final int CUSTOM_RULE_ID_MIN = 9001;
    private static final int CUSTOM_RULE_ID_MAX = 9999;

    /**
     * Get all custom rules with pagination
     */
    @Transactional(readOnly = true)
    public Page<CustomRuleDTO> getAllRules(Pageable pageable) {
        return customRuleRepository.findAll(pageable)
                .map(this::convertToDTO);
    }

    /**
     * Get rule by ID
     */
    @Transactional(readOnly = true)
    public Optional<CustomRuleDTO> getRuleById(Long id) {
        return customRuleRepository.findById(id)
                .map(this::convertToDTO);
    }

    /**
     * Get rule by ModSecurity rule ID
     */
    @Transactional(readOnly = true)
    public Optional<CustomRuleDTO> getRuleByRuleId(Integer ruleId) {
        return customRuleRepository.findByRuleId(ruleId)
                .map(this::convertToDTO);
    }

    /**
     * Create new custom rule
     */
    public CustomRuleDTO createRule(CustomRuleDTO ruleDTO, String createdBy) {
        log.info("Creating new custom rule: {}", ruleDTO.getName());

        // Validate rule
        RuleValidationResult validation = ruleValidationService.validateRule(ruleDTO);
        if (!validation.isValid()) {
            throw new IllegalArgumentException("Rule validation failed: " +
                String.join(", ", validation.getErrors()));
        }

        // Assign rule ID if not provided
        if (ruleDTO.getRuleId() == null) {
            Integer nextRuleId = getNextAvailableRuleId();
            ruleDTO.setRuleId(nextRuleId);
        } else {
            // Check if rule ID is available
            if (customRuleRepository.existsByRuleId(ruleDTO.getRuleId())) {
                throw new IllegalArgumentException("Rule ID " + ruleDTO.getRuleId() + " is already in use");
            }
        }

        CustomRule rule = convertToEntity(ruleDTO);
        rule.setCreatedBy(createdBy);
        rule.setCreatedAt(LocalDateTime.now());

        CustomRule savedRule = customRuleRepository.save(rule);
        log.info("Created custom rule with ID: {} and rule ID: {}",
                savedRule.getId(), savedRule.getRuleId());

        return convertToDTO(savedRule);
    }

    /**
     * Update existing custom rule
     */
    public CustomRuleDTO updateRule(Long id, CustomRuleDTO ruleDTO, String updatedBy) {
        log.info("Updating custom rule with ID: {}", id);

        CustomRule existingRule = customRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rule not found with ID: " + id));

        // Validate rule
        RuleValidationResult validation = ruleValidationService.validateRule(ruleDTO);
        if (!validation.isValid()) {
            throw new IllegalArgumentException("Rule validation failed: " +
                String.join(", ", validation.getErrors()));
        }

        // Check if rule ID is changing and if new ID is available
        if (!existingRule.getRuleId().equals(ruleDTO.getRuleId())) {
            if (customRuleRepository.existsByRuleId(ruleDTO.getRuleId())) {
                throw new IllegalArgumentException("Rule ID " + ruleDTO.getRuleId() + " is already in use");
            }
        }

        // Update fields
        existingRule.setName(ruleDTO.getName());
        existingRule.setDescription(ruleDTO.getDescription());
        existingRule.setRuleId(ruleDTO.getRuleId());
        existingRule.setRuleContent(ruleDTO.getRuleContent());
        existingRule.setPhase(ruleDTO.getPhase());
        existingRule.setSeverity(ruleDTO.getSeverity());
        existingRule.setIsActive(ruleDTO.getIsActive());
        existingRule.setIsBlocking(ruleDTO.getIsBlocking());
        existingRule.setPriority(ruleDTO.getPriority());
        existingRule.setUpdatedBy(updatedBy);

        // Set category if provided
        if (ruleDTO.getCategoryId() != null) {
            RuleCategory category = categoryRepository.findById(ruleDTO.getCategoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found"));
            existingRule.setCategory(category);
        }

        CustomRule savedRule = customRuleRepository.save(existingRule);
        log.info("Updated custom rule with ID: {}", savedRule.getId());

        return convertToDTO(savedRule);
    }

    /**
     * Delete custom rule
     */
    public void deleteRule(Long id) {
        log.info("Deleting custom rule with ID: {}", id);

        if (!customRuleRepository.existsById(id)) {
            throw new IllegalArgumentException("Rule not found with ID: " + id);
        }

        customRuleRepository.deleteById(id);
        log.info("Deleted custom rule with ID: {}", id);
    }

    /**
     * Toggle rule active status
     */
    public CustomRuleDTO toggleRuleStatus(Long id, String updatedBy) {
        log.info("Toggling status for custom rule with ID: {}", id);

        CustomRule rule = customRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rule not found with ID: " + id));

        rule.setIsActive(!rule.getIsActive());
        rule.setUpdatedBy(updatedBy);

        CustomRule savedRule = customRuleRepository.save(rule);
        log.info("Toggled rule status - ID: {}, Active: {}", savedRule.getId(), savedRule.getIsActive());

        return convertToDTO(savedRule);
    }

    /**
     * Get all active rules for deployment
     */
    @Transactional(readOnly = true)
    public List<CustomRuleDTO> getActiveRulesForDeployment() {
        return customRuleRepository.findActiveRulesForDeployment()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Deploy custom rules to Kubernetes
     */
    public RuleDeployment deployRules(String triggeredBy, String notes) {
        log.info("Starting custom rules deployment triggered by: {}", triggeredBy);

        List<CustomRule> activeRules = customRuleRepository.findActiveRulesForDeployment();

        // Create deployment record
        RuleDeployment deployment = new RuleDeployment();
        deployment.setDeploymentId(UUID.randomUUID().toString());
        deployment.setTotalRules(activeRules.size());
        deployment.setActiveRules(activeRules.size());
        deployment.setTriggeredBy(triggeredBy);
        deployment.setNotes(notes);
        deployment.setDeploymentStatus(RuleDeployment.DeploymentStatus.PENDING);

        deployment = deploymentRepository.save(deployment);

        try {
            // Generate ModSecurity rules configuration
            String rulesConfig = generateModSecurityConfig(activeRules);

            // Deploy to Kubernetes
            deployment.setDeploymentStatus(RuleDeployment.DeploymentStatus.DEPLOYING);
            deploymentRepository.save(deployment);

            kubernetesService.updateCustomRulesConfigMap(rulesConfig, deployment.getDeploymentId());
            kubernetesService.rolloutNginxDeployment();

            // Update deployment status
            deployment.markCompleted(RuleDeployment.DeploymentStatus.SUCCESS);

            // Update last deployed timestamp for rules
            LocalDateTime deployedAt = LocalDateTime.now();
            activeRules.forEach(rule -> {
                rule.setLastDeployedAt(deployedAt);
                rule.setDeploymentVersion(deployment.getDeploymentId());
            });
            customRuleRepository.saveAll(activeRules);

            log.info("Successfully deployed {} custom rules", activeRules.size());

        } catch (Exception e) {
            log.error("Failed to deploy custom rules", e);
            deployment.markCompleted(RuleDeployment.DeploymentStatus.FAILED);
            deployment.setNotes((deployment.getNotes() != null ? deployment.getNotes() + "; " : "") +
                               "Error: " + e.getMessage());
        }

        return deploymentRepository.save(deployment);
    }

    /**
     * Search rules with filters
     */
    @Transactional(readOnly = true)
    public Page<CustomRuleDTO> searchRules(
            Long categoryId,
            CustomRule.RuleSeverity severity,
            Boolean isActive,
            Boolean isBlocking,
            String searchTerm,
            Pageable pageable) {

        return customRuleRepository.findWithFilters(
                categoryId, severity, isActive, isBlocking, searchTerm, pageable)
                .map(this::convertToDTO);
    }

    /**
     * Get next available rule ID in custom range
     */
    private Integer getNextAvailableRuleId() {
        Optional<Integer> nextId = customRuleRepository.findNextAvailableRuleId();
        if (nextId.isPresent() && nextId.get() <= CUSTOM_RULE_ID_MAX) {
            return nextId.get();
        }
        throw new IllegalStateException("No available rule IDs in custom range (9001-9999)");
    }

    /**
     * Generate ModSecurity configuration from active rules
     */
    private String generateModSecurityConfig(List<CustomRule> rules) {
        StringBuilder config = new StringBuilder();
        config.append("# WAF Custom Rules - Generated at ").append(LocalDateTime.now()).append("\n");
        config.append("# Total rules: ").append(rules.size()).append("\n\n");

        // Sort by priority (highest first) then by rule ID
        rules.stream()
                .sorted((r1, r2) -> {
                    int priorityCompare = Integer.compare(r2.getPriority(), r1.getPriority());
                    return priorityCompare != 0 ? priorityCompare :
                           Integer.compare(r1.getRuleId(), r2.getRuleId());
                })
                .forEach(rule -> {
                    config.append("# Rule: ").append(rule.getName()).append("\n");
                    config.append("# Description: ").append(rule.getDescription()).append("\n");
                    config.append("# Severity: ").append(rule.getSeverity()).append("\n");
                    config.append("# Priority: ").append(rule.getPriority()).append("\n");
                    config.append(rule.generateModSecurityRule()).append("\n\n");
                });

        return config.toString();
    }

    /**
     * Convert entity to DTO
     */
    private CustomRuleDTO convertToDTO(CustomRule rule) {
        CustomRuleDTO dto = new CustomRuleDTO();
        dto.setId(rule.getId());
        dto.setRuleId(rule.getRuleId());
        dto.setName(rule.getName());
        dto.setDescription(rule.getDescription());
        dto.setCategoryId(rule.getCategory() != null ? rule.getCategory().getId() : null);
        dto.setCategoryName(rule.getCategory() != null ? rule.getCategory().getName() : null);
        dto.setRuleContent(rule.getRuleContent());
        dto.setPhase(rule.getPhase());
        dto.setSeverity(rule.getSeverity());
        dto.setIsActive(rule.getIsActive());
        dto.setIsBlocking(rule.getIsBlocking());
        dto.setPriority(rule.getPriority());
        dto.setCreatedBy(rule.getCreatedBy());
        dto.setCreatedAt(rule.getCreatedAt());
        dto.setUpdatedBy(rule.getUpdatedBy());
        dto.setUpdatedAt(rule.getUpdatedAt());
        dto.setLastDeployedAt(rule.getLastDeployedAt());
        dto.setDeploymentVersion(rule.getDeploymentVersion());
        return dto;
    }

    /**
     * Convert DTO to entity
     */
    private CustomRule convertToEntity(CustomRuleDTO dto) {
        CustomRule rule = new CustomRule();
        rule.setId(dto.getId());
        rule.setRuleId(dto.getRuleId());
        rule.setName(dto.getName());
        rule.setDescription(dto.getDescription());
        rule.setRuleContent(dto.getRuleContent());
        rule.setPhase(dto.getPhase());
        rule.setSeverity(dto.getSeverity());
        rule.setIsActive(dto.getIsActive());
        rule.setIsBlocking(dto.getIsBlocking());
        rule.setPriority(dto.getPriority());

        // Set category if provided
        if (dto.getCategoryId() != null) {
            RuleCategory category = categoryRepository.findById(dto.getCategoryId())
                    .orElse(null);
            rule.setCategory(category);
        }

        return rule;
    }
}
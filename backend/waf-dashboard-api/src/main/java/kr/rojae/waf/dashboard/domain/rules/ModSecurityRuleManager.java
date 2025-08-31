package kr.rojae.waf.dashboard.domain.rules;

import kr.rojae.waf.dashboard.dto.CustomRuleDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
public class ModSecurityRuleManager {

    private static final String CUSTOM_RULES_FILE = "/app/custom-rules/custom-rules.conf";
    private static final String MODSEC_RULES_DIR = "/app/modsecurity-rules";
    
    private final ConcurrentHashMap<String, CustomRuleDto> rulesCache = new ConcurrentHashMap<>();
    private final AtomicBoolean syncInProgress = new AtomicBoolean(false);

    /**
     * 메모리 캐시에서 모든 커스텀 룰 조회
     */
    public List<CustomRuleDto> getAllRules() {
        try {
            return new ArrayList<>(rulesCache.values());
        } catch (Exception e) {
            log.error("Error retrieving rules from cache", e);
            return List.of();
        }
    }

    /**
     * 메모리 캐시에서 특정 룰 조회
     */
    public CustomRuleDto getRule(String id) {
        try {
            return rulesCache.get(id);
        } catch (Exception e) {
            log.error("Error retrieving rule {} from cache", id, e);
            return null;
        }
    }

    /**
     * 새 룰 생성 (메모리 캐시에 즉시 저장, 파일 동기화는 비동기)
     */
    public CustomRuleDto createRule(CustomRuleDto ruleDto) {
        try {
            String ruleId = UUID.randomUUID().toString();
            LocalDateTime now = LocalDateTime.now();
            
            CustomRuleDto newRule = CustomRuleDto.builder()
                    .id(ruleId)
                    .name(ruleDto.name())
                    .pattern(ruleDto.pattern())
                    .action(ruleDto.action())
                    .enabled(ruleDto.enabled())
                    .description(ruleDto.description())
                    .priority(ruleDto.priority())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            // 메모리 캐시에 저장
            rulesCache.put(ruleId, newRule);
            
            log.info("Created custom rule: {} (ID: {})", newRule.name(), ruleId);
            triggerFileSync();
            
            return newRule;
        } catch (Exception e) {
            log.error("Error creating rule", e);
            throw new RuntimeException("Failed to create rule", e);
        }
    }

    /**
     * 룰 수정
     */
    public CustomRuleDto updateRule(String id, CustomRuleDto ruleDto) {
        try {
            CustomRuleDto existingRule = getRule(id);
            if (existingRule == null) {
                throw new RuntimeException("Rule not found: " + id);
            }

            CustomRuleDto updatedRule = CustomRuleDto.builder()
                    .id(id)
                    .name(ruleDto.name())
                    .pattern(ruleDto.pattern())
                    .action(ruleDto.action())
                    .enabled(ruleDto.enabled())
                    .description(ruleDto.description())
                    .priority(ruleDto.priority())
                    .createdAt(existingRule.createdAt())
                    .updatedAt(LocalDateTime.now())
                    .build();

            rulesCache.put(id, updatedRule);
            
            log.info("Updated custom rule: {} (ID: {})", updatedRule.name(), id);
            triggerFileSync();
            
            return updatedRule;
        } catch (Exception e) {
            log.error("Error updating rule {}", id, e);
            throw new RuntimeException("Failed to update rule", e);
        }
    }

    /**
     * 룰 삭제
     */
    public void deleteRule(String id) {
        try {
            rulesCache.remove(id);
            
            log.info("Deleted custom rule: {}", id);
            triggerFileSync();
        } catch (Exception e) {
            log.error("Error deleting rule {}", id, e);
            throw new RuntimeException("Failed to delete rule", e);
        }
    }

    /**
     * 룰 활성화/비활성화 토글
     */
    public CustomRuleDto toggleRule(String id) {
        try {
            CustomRuleDto existingRule = getRule(id);
            if (existingRule == null) {
                throw new RuntimeException("Rule not found: " + id);
            }

            CustomRuleDto toggledRule = CustomRuleDto.builder()
                    .id(existingRule.id())
                    .name(existingRule.name())
                    .pattern(existingRule.pattern())
                    .action(existingRule.action())
                    .enabled(!existingRule.enabled()) // Toggle
                    .description(existingRule.description())
                    .priority(existingRule.priority())
                    .createdAt(existingRule.createdAt())
                    .updatedAt(LocalDateTime.now())
                    .build();

            rulesCache.put(id, toggledRule);
            
            log.info("Toggled rule {} to {}", id, toggledRule.enabled() ? "enabled" : "disabled");
            triggerFileSync();
            
            return toggledRule;
        } catch (Exception e) {
            log.error("Error toggling rule {}", id, e);
            throw new RuntimeException("Failed to toggle rule", e);
        }
    }

    /**
     * 파일 동기화 트리거 (비동기)
     */
    private void triggerFileSync() {
        if (!syncInProgress.compareAndSet(false, true)) {
            log.debug("File sync already in progress, skipping");
            return;
        }

        // 비동기로 파일 동기화 실행
        new Thread(() -> {
            try {
                syncRulesToFile();
            } finally {
                syncInProgress.set(false);
            }
        }).start();
    }

    /**
     * 주기적 파일 동기화 (5분마다)
     */
    @Scheduled(fixedRate = 300000) // 5분
    public void scheduledFileSync() {
        if (syncInProgress.get()) {
            log.debug("Sync already in progress, skipping scheduled sync");
            return;
        }
        
        log.debug("Starting scheduled file sync");
        triggerFileSync();
    }

    /**
     * 메모리 캐시의 룰을 ModSecurity 파일로 동기화
     */
    private void syncRulesToFile() {
        try {
            List<CustomRuleDto> rules = getAllRules();
            
            // 커스텀 룰 파일 생성
            File customRulesFile = new File(CUSTOM_RULES_FILE);
            customRulesFile.getParentFile().mkdirs();
            
            try (FileWriter writer = new FileWriter(customRulesFile)) {
                writer.write("# WAF Custom Rules - Auto-generated from memory cache\n");
                writer.write("# Last updated: " + LocalDateTime.now() + "\n\n");
                
                for (CustomRuleDto rule : rules) {
                    if (rule.enabled()) {
                        writer.write(generateModSecurityRule(rule));
                        writer.write("\n\n");
                    }
                }
            }
            
            log.info("Synced {} rules to file: {}", rules.size(), CUSTOM_RULES_FILE);
            
            // ModSecurity 설정 파일에 include 추가 (한 번만)
            ensureCustomRulesIncluded();
            
            // 신호 파일 생성 (Nginx가 이를 감지하여 룰 리로드)
            createReloadSignal();
            
        } catch (Exception e) {
            log.error("Error syncing rules to file", e);
        }
    }

    /**
     * ModSecurity 룰 문법으로 변환
     */
    private String generateModSecurityRule(CustomRuleDto rule) {
        int ruleId = 900000 + Math.abs(rule.id().hashCode() % 99999); // 900000~999999 범위
        
        String action = switch (rule.action()) {
            case "BLOCK" -> "deny,status:403";
            case "ALLOW" -> "allow";
            case "LOG" -> "log";
            default -> "log";
        };
        
        return String.format("""
                # Rule: %s
                # Description: %s
                # Priority: %d
                SecRule REQUEST_URI "@rx %s" \\
                    "id:%d,\\
                    phase:2,\\
                    %s,\\
                    msg:'Custom Rule: %s',\\
                    tag:'custom',\\
                    tag:'%s'"
                """, 
                rule.name(),
                rule.description(),
                rule.priority(),
                rule.pattern(),
                ruleId,
                action,
                rule.name(),
                rule.action().toLowerCase()
        );
    }

    /**
     * ModSecurity 메인 설정에 커스텀 룰 파일 include 추가
     */
    private void ensureCustomRulesIncluded() {
        // 이 부분은 ModSecurity 설정 파일 구조에 따라 구현
        // 일반적으로 modsecurity.conf 또는 nginx 설정에서 include 처리
        log.debug("Custom rules file should be included in ModSecurity configuration");
    }

    /**
     * 리로드 신호 파일 생성
     */
    private void createReloadSignal() {
        try {
            File signalFile = new File("/tmp/modsec_reload_signal");
            signalFile.createNewFile();
            log.debug("Created reload signal file");
        } catch (IOException e) {
            log.warn("Failed to create reload signal file", e);
        }
    }
}
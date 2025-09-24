package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.domain.rules.ModSecurityRuleManager;
import kr.rojae.waf.dashboard.dto.CustomRuleDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rules")
@RequiredArgsConstructor
@Slf4j
public class CustomRuleController {

    private final ModSecurityRuleManager ruleManager;

    @GetMapping
    public ResponseEntity<List<CustomRuleDto>> getRules() {
        log.info("GET /api/rules");
        
        List<CustomRuleDto> rules = ruleManager.getAllRules();
        return ResponseEntity.ok(rules);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomRuleDto> getRule(@PathVariable String id) {
        log.info("GET /api/rules/{}", id);
        
        CustomRuleDto rule = ruleManager.getRule(id);
        if (rule == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(rule);
    }

    @PostMapping
    public ResponseEntity<CustomRuleDto> createRule(@RequestBody CustomRuleDto ruleDto) {
        log.info("POST /api/rules: {}", ruleDto);
        
        try {
            CustomRuleDto createdRule = ruleManager.createRule(ruleDto);
            return ResponseEntity.ok(createdRule);
        } catch (Exception e) {
            log.error("Error creating rule", e);
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomRuleDto> updateRule(@PathVariable String id, @RequestBody CustomRuleDto ruleDto) {
        log.info("PUT /api/rules/{}: {}", id, ruleDto);
        
        try {
            CustomRuleDto updatedRule = ruleManager.updateRule(id, ruleDto);
            return ResponseEntity.ok(updatedRule);
        } catch (Exception e) {
            log.error("Error updating rule {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRule(@PathVariable String id) {
        log.info("DELETE /api/rules/{}", id);
        
        try {
            ruleManager.deleteRule(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting rule {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<CustomRuleDto> toggleRule(@PathVariable String id) {
        log.info("PUT /api/rules/{}/toggle", id);
        
        try {
            CustomRuleDto toggledRule = ruleManager.toggleRule(id);
            return ResponseEntity.ok(toggledRule);
        } catch (Exception e) {
            log.error("Error toggling rule {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }
}
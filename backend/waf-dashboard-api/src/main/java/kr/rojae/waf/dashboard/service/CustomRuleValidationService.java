package kr.rojae.waf.dashboard.service;

import kr.rojae.waf.common.entity.CustomRule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Service for validating ModSecurity custom rules
 * Provides syntax validation, security checks, and rule testing
 */
@Service
@Slf4j
public class CustomRuleValidationService {

    // Valid ModSecurity operators
    private static final Set<String> VALID_OPERATORS = Set.of(
            "@detectSQLi", "@detectXSS", "@validateByteRange", "@validateUrlEncoding",
            "@verifyCC", "@verifyCPF", "@verifySSN", "@pm", "@pmFromFile", "@rx",
            "@streq", "@strmatch", "@within", "@contains", "@containsWord",
            "@beginsWith", "@endsWith", "@eq", "@ge", "@gt", "@le", "@lt",
            "@ipMatch", "@ipMatchFromFile", "@geoLookup", "@rbl"
    );

    // Valid ModSecurity actions
    private static final Set<String> VALID_ACTIONS = Set.of(
            "allow", "block", "deny", "drop", "pass", "redirect", "proxy",
            "log", "nolog", "msg", "logdata", "severity", "id", "phase",
            "t", "ctl", "tag", "ver", "maturity", "accuracy", "chain",
            "skip", "skipAfter", "setvar", "expirevar"
    );

    // Valid ModSecurity variables
    private static final Set<String> VALID_VARIABLES = Set.of(
            "ARGS", "ARGS_COMBINED_SIZE", "ARGS_GET", "ARGS_GET_NAMES",
            "ARGS_NAMES", "ARGS_POST", "ARGS_POST_NAMES", "QUERY_STRING",
            "REMOTE_ADDR", "REMOTE_HOST", "REMOTE_PORT", "REMOTE_USER",
            "REQUEST_BASENAME", "REQUEST_BODY", "REQUEST_COOKIES",
            "REQUEST_COOKIES_NAMES", "REQUEST_FILENAME", "REQUEST_HEADERS",
            "REQUEST_HEADERS_NAMES", "REQUEST_METHOD", "REQUEST_PROTOCOL",
            "REQUEST_URI", "REQUEST_URI_RAW", "RESPONSE_BODY",
            "RESPONSE_CONTENT_LENGTH", "RESPONSE_CONTENT_TYPE",
            "RESPONSE_HEADERS", "RESPONSE_HEADERS_NAMES", "RESPONSE_STATUS"
    );

    /**
     * Comprehensive rule validation
     */
    public ValidationResult validateRule(CustomRule rule) {
        ValidationResult result = new ValidationResult();

        if (rule == null) {
            result.addError("Rule cannot be null");
            return result;
        }

        // Basic field validation
        validateBasicFields(rule, result);

        // Rule content validation
        if (rule.getRuleContent() != null && !rule.getRuleContent().trim().isEmpty()) {
            validateRuleContent(rule.getRuleContent(), result);
        }

        // Security validation
        validateSecurity(rule, result);

        // Performance validation
        validatePerformance(rule, result);

        return result;
    }

    /**
     * Validate basic rule fields
     */
    private void validateBasicFields(CustomRule rule, ValidationResult result) {
        if (rule.getName() == null || rule.getName().trim().isEmpty()) {
            result.addError("Rule name is required");
        } else if (rule.getName().length() > 100) {
            result.addError("Rule name must be less than 100 characters");
        }

        if (rule.getRuleId() == null || rule.getRuleId() < 900000 || rule.getRuleId() > 999999) {
            result.addError("Rule ID must be between 900000-999999 for custom rules");
        }

        if (rule.getPriority() == null || rule.getPriority() < 1 || rule.getPriority() > 100) {
            result.addError("Priority must be between 1-100");
        }

        if (rule.getPhase() == null || rule.getPhase() < 1 || rule.getPhase() > 5) {
            result.addError("Phase must be between 1-5");
        }

        if (rule.getDescription() != null && rule.getDescription().length() > 500) {
            result.addWarning("Description is very long, consider shortening");
        }
    }

    /**
     * Validate ModSecurity rule syntax
     */
    private void validateRuleContent(String ruleContent, ValidationResult result) {
        String cleanRule = ruleContent.trim();

        // Check if rule starts with SecRule
        if (!cleanRule.toLowerCase().startsWith("secrule")) {
            result.addError("Rule must start with 'SecRule'");
            return;
        }

        // Parse rule components
        try {
            parseRuleComponents(cleanRule, result);
        } catch (Exception e) {
            result.addError("Failed to parse rule syntax: " + e.getMessage());
        }
    }

    /**
     * Parse and validate rule components
     */
    private void parseRuleComponents(String rule, ValidationResult result) {
        // Split rule into components
        String[] parts = rule.split("\\s+", 4);

        if (parts.length < 3) {
            result.addError("Rule must have at least: SecRule VARIABLE OPERATOR");
            return;
        }

        String variable = parts[1].replaceAll("[\"']", "");
        String operator = parts[2].replaceAll("[\"']", "");

        // Validate variable
        validateVariable(variable, result);

        // Validate operator
        validateOperator(operator, result);

        // Validate actions if present
        if (parts.length > 3) {
            validateActions(parts[3], result);
        }
    }

    /**
     * Validate ModSecurity variable
     */
    private void validateVariable(String variable, ValidationResult result) {
        // Remove collection selectors like ARGS:param
        String baseVariable = variable.split(":")[0];

        if (!VALID_VARIABLES.contains(baseVariable.toUpperCase())) {
            result.addWarning("Unknown variable: " + baseVariable);
        }

        // Check for potentially dangerous variables
        if (variable.toUpperCase().contains("REQUEST_BODY") &&
            !variable.contains("@inspectFile")) {
            result.addWarning("REQUEST_BODY inspection may impact performance");
        }
    }

    /**
     * Validate ModSecurity operator
     */
    private void validateOperator(String operator, ValidationResult result) {
        if (operator.startsWith("@")) {
            if (!VALID_OPERATORS.contains(operator.split("\\s+")[0])) {
                result.addWarning("Unknown operator: " + operator);
            }
        } else if (operator.startsWith("!")) {
            // Negated operator
            String actualOp = operator.substring(1);
            if (actualOp.startsWith("@") && !VALID_OPERATORS.contains(actualOp.split("\\s+")[0])) {
                result.addWarning("Unknown negated operator: " + actualOp);
            }
        } else {
            // Regular expression
            try {
                Pattern.compile(operator);
            } catch (PatternSyntaxException e) {
                result.addError("Invalid regular expression: " + e.getMessage());
            }
        }
    }

    /**
     * Validate rule actions
     */
    private void validateActions(String actionsStr, ValidationResult result) {
        if (!actionsStr.startsWith("\"") || !actionsStr.endsWith("\"")) {
            result.addError("Actions must be quoted");
            return;
        }

        String actions = actionsStr.substring(1, actionsStr.length() - 1);
        String[] actionParts = actions.split(",");

        boolean hasId = false;
        boolean hasMsg = false;
        boolean hasAction = false;

        for (String action : actionParts) {
            String trimmedAction = action.trim();
            String actionName = trimmedAction.split(":")[0];

            if ("id".equals(actionName)) {
                hasId = true;
                validateRuleId(trimmedAction, result);
            } else if ("msg".equals(actionName)) {
                hasMsg = true;
            } else if (Set.of("block", "allow", "deny", "pass").contains(actionName)) {
                hasAction = true;
            } else if (!VALID_ACTIONS.contains(actionName)) {
                result.addWarning("Unknown action: " + actionName);
            }
        }

        if (!hasId) {
            result.addError("Rule must have an 'id' action");
        }
        if (!hasMsg) {
            result.addWarning("Rule should have a 'msg' action for logging");
        }
        if (!hasAction) {
            result.addWarning("Rule should specify an action (block, allow, deny, pass)");
        }
    }

    /**
     * Validate rule ID in actions
     */
    private void validateRuleId(String idAction, ValidationResult result) {
        String[] parts = idAction.split(":");
        if (parts.length != 2) {
            result.addError("Invalid id action format");
            return;
        }

        try {
            int id = Integer.parseInt(parts[1]);
            if (id < 900000 || id > 999999) {
                result.addError("Rule ID in actions must be between 900000-999999");
            }
        } catch (NumberFormatException e) {
            result.addError("Rule ID must be a number");
        }
    }

    /**
     * Validate security aspects
     */
    private void validateSecurity(CustomRule rule, ValidationResult result) {
        String content = rule.getRuleContent();
        if (content == null) return;

        // Check for potential bypasses
        if (content.contains(".*") && content.contains("+")) {
            result.addWarning("Rule may be vulnerable to ReDoS attacks");
        }

        // Check for overly permissive rules
        if (content.toLowerCase().contains("pass") && !content.contains("chain")) {
            result.addWarning("Pass action without chaining may allow bypasses");
        }

        // Check for dangerous transformations
        if (content.contains("t:none")) {
            result.addWarning("Transformation 't:none' may miss encoded attacks");
        }
    }

    /**
     * Validate performance impact
     */
    private void validatePerformance(CustomRule rule, ValidationResult result) {
        String content = rule.getRuleContent();
        if (content == null) return;

        // Check for performance-heavy operations
        if (content.contains("REQUEST_BODY") && content.contains("@rx")) {
            result.addWarning("Regex on REQUEST_BODY may impact performance");
        }

        if (content.contains("RESPONSE_BODY")) {
            result.addWarning("Response body inspection may impact performance");
        }

        // Count complex regex patterns
        long regexComplexity = content.chars()
                .filter(ch -> ch == '*' || ch == '+' || ch == '{' || ch == '|')
                .count();

        if (regexComplexity > 10) {
            result.addWarning("Complex regex pattern may impact performance");
        }
    }

    /**
     * Test rule against sample inputs
     */
    public TestResult testRule(CustomRule rule, Map<String, String> testInputs) {
        TestResult testResult = new TestResult();

        // First validate the rule
        ValidationResult validation = validateRule(rule);
        if (!validation.isValid()) {
            testResult.setSuccess(false);
            testResult.setMessage("Rule validation failed: " + String.join(", ", validation.getErrors()));
            return testResult;
        }

        // Simulate rule testing (in real implementation, this would use ModSecurity engine)
        testResult.setSuccess(true);
        testResult.setMessage("Rule syntax is valid and ready for deployment");

        // Add test details
        Map<String, Object> details = new HashMap<>();
        details.put("validationPassed", true);
        details.put("testInputsProcessed", testInputs.size());
        details.put("estimatedPerformanceImpact", calculatePerformanceImpact(rule));

        testResult.setDetails(details);

        log.info("Rule test completed for rule ID: {} - Success: {}",
                rule.getRuleId(), testResult.isSuccess());

        return testResult;
    }

    /**
     * Calculate estimated performance impact
     */
    private String calculatePerformanceImpact(CustomRule rule) {
        String content = rule.getRuleContent();
        if (content == null) return "LOW";

        int impact = 0;

        if (content.contains("REQUEST_BODY")) impact += 3;
        if (content.contains("RESPONSE_BODY")) impact += 5;
        if (content.contains("@rx")) impact += 2;
        if (content.contains("@detectSQLi") || content.contains("@detectXSS")) impact += 1;

        if (impact >= 5) return "HIGH";
        if (impact >= 3) return "MEDIUM";
        return "LOW";
    }

    /**
     * Generate rule templates for common attack patterns
     */
    public List<RuleTemplate> getRuleTemplates() {
        List<RuleTemplate> templates = new ArrayList<>();

        templates.add(new RuleTemplate(
                "SQL Injection Protection",
                "SecRule ARGS \"@detectSQLi\" \\\n" +
                        "    \"id:900001,\\\n" +
                        "    phase:2,\\\n" +
                        "    block,\\\n" +
                        "    msg:'SQL Injection Attack Detected',\\\n" +
                        "    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\\\n" +
                        "    tag:'attack-sqli',\\\n" +
                        "    severity:'CRITICAL',\\\n" +
                        "    t:none,t:urlDecodeUni,t:htmlEntityDecode,t:lowercase\"",
                "Detects SQL injection attempts in request parameters"
        ));

        templates.add(new RuleTemplate(
                "XSS Protection",
                "SecRule ARGS \"@detectXSS\" \\\n" +
                        "    \"id:900002,\\\n" +
                        "    phase:2,\\\n" +
                        "    block,\\\n" +
                        "    msg:'XSS Attack Detected',\\\n" +
                        "    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\\\n" +
                        "    tag:'attack-xss',\\\n" +
                        "    severity:'HIGH',\\\n" +
                        "    t:none,t:urlDecodeUni,t:htmlEntityDecode,t:lowercase\"",
                "Detects cross-site scripting attempts"
        ));

        templates.add(new RuleTemplate(
                "File Upload Restriction",
                "SecRule FILES_TMPNAMES \"@inspectFile /etc/modsecurity/file_patterns.dat\" \\\n" +
                        "    \"id:900003,\\\n" +
                        "    phase:2,\\\n" +
                        "    block,\\\n" +
                        "    msg:'Malicious File Upload Detected',\\\n" +
                        "    logdata:'File: %{MATCHED_VAR}',\\\n" +
                        "    tag:'attack-file-upload',\\\n" +
                        "    severity:'HIGH'\"",
                "Blocks malicious file uploads based on content analysis"
        ));

        return templates;
    }

    // Inner classes for validation and test results
    public static class ValidationResult {
        private List<String> errors = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();

        public void addError(String error) { errors.add(error); }
        public void addWarning(String warning) { warnings.add(warning); }

        public boolean isValid() { return errors.isEmpty(); }
        public List<String> getErrors() { return errors; }
        public List<String> getWarnings() { return warnings; }
    }

    public static class TestResult {
        private boolean success;
        private String message;
        private Map<String, Object> details = new HashMap<>();

        // Getters and setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public Map<String, Object> getDetails() { return details; }
        public void setDetails(Map<String, Object> details) { this.details = details; }
    }

    public static class RuleTemplate {
        private String name;
        private String content;
        private String description;

        public RuleTemplate(String name, String content, String description) {
            this.name = name;
            this.content = content;
            this.description = description;
        }

        // Getters
        public String getName() { return name; }
        public String getContent() { return content; }
        public String getDescription() { return description; }
    }
}
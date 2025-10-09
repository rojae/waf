-- Custom Rules Management Tables
-- Migration for ModSecurity custom rule management system

-- Custom Rule Categories
CREATE TABLE rule_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#007bff', -- Hex color for UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default categories
INSERT INTO rule_categories (name, description, color) VALUES
('SQL Injection', 'Rules to detect SQL injection attacks', '#dc3545'),
('XSS', 'Cross-Site Scripting protection rules', '#fd7e14'),
('File Upload', 'File upload security rules', '#6f42c1'),
('Rate Limiting', 'Request rate limiting rules', '#20c997'),
('Custom Block', 'Custom blocking rules', '#6c757d'),
('Whitelist', 'Request whitelist rules', '#28a745');

-- Custom Rules Table
CREATE TABLE custom_rules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL UNIQUE, -- ModSecurity rule ID (9001-9999 range for custom)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id BIGINT,

    -- ModSecurity Rule Content
    rule_content TEXT NOT NULL, -- The actual SecRule directive
    phase INT NOT NULL DEFAULT 2, -- ModSecurity phase (1-5)
    severity VARCHAR(20) DEFAULT 'MEDIUM', -- CRITICAL, HIGH, MEDIUM, LOW, INFO

    -- Rule Configuration
    is_active BOOLEAN DEFAULT TRUE,
    is_blocking BOOLEAN DEFAULT TRUE, -- true: block, false: log only
    priority INT DEFAULT 100, -- Higher number = higher priority

    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Deployment tracking
    last_deployed_at TIMESTAMP NULL,
    deployment_version VARCHAR(50),

    FOREIGN KEY (category_id) REFERENCES rule_categories(id) ON DELETE SET NULL,
    INDEX idx_rule_id (rule_id),
    INDEX idx_category (category_id),
    INDEX idx_active (is_active),
    INDEX idx_priority (priority)
);

-- Rule Deployment History
CREATE TABLE rule_deployments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deployment_id VARCHAR(100) NOT NULL UNIQUE, -- UUID for tracking

    -- Deployment info
    total_rules INT NOT NULL,
    active_rules INT NOT NULL,
    deployment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, DEPLOYING, SUCCESS, FAILED, ROLLBACK

    -- Kubernetes deployment details
    configmap_version VARCHAR(50),
    nginx_deployment_revision INT,
    rollout_status VARCHAR(50),

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    deployment_duration_seconds INT,

    -- Metadata
    triggered_by VARCHAR(100),
    notes TEXT,

    INDEX idx_deployment_id (deployment_id),
    INDEX idx_status (deployment_status),
    INDEX idx_started_at (started_at)
);

-- Rule Deployment Items (which rules were included in each deployment)
CREATE TABLE rule_deployment_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deployment_id BIGINT NOT NULL,
    rule_id BIGINT NOT NULL,
    rule_content_snapshot TEXT NOT NULL, -- Snapshot of rule at deployment time
    rule_priority INT,

    FOREIGN KEY (deployment_id) REFERENCES rule_deployments(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES custom_rules(id) ON DELETE CASCADE,
    INDEX idx_deployment (deployment_id),
    INDEX idx_rule (rule_id)
);

-- Rule Test Results
CREATE TABLE rule_test_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_id BIGINT NOT NULL,

    -- Test details
    test_type VARCHAR(50) NOT NULL, -- SYNTAX, LOGIC, PERFORMANCE
    test_input TEXT,
    expected_result VARCHAR(20), -- BLOCK, ALLOW, LOG
    actual_result VARCHAR(20),
    test_passed BOOLEAN,

    -- Performance metrics
    execution_time_ms DECIMAL(10,3),
    memory_usage_kb INT,

    -- Test metadata
    tested_by VARCHAR(100),
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_notes TEXT,

    FOREIGN KEY (rule_id) REFERENCES custom_rules(id) ON DELETE CASCADE,
    INDEX idx_rule_test (rule_id),
    INDEX idx_test_type (test_type),
    INDEX idx_tested_at (tested_at)
);

-- Rule Performance Metrics (from production)
CREATE TABLE rule_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_id BIGINT NOT NULL,

    -- Time period
    metric_date DATE NOT NULL,
    metric_hour TINYINT NOT NULL, -- 0-23 for hourly metrics

    -- Hit statistics
    total_hits BIGINT DEFAULT 0,
    blocked_requests BIGINT DEFAULT 0,
    allowed_requests BIGINT DEFAULT 0,

    -- Performance metrics
    avg_execution_time_ms DECIMAL(10,3),
    max_execution_time_ms DECIMAL(10,3),
    false_positive_count INT DEFAULT 0,

    -- Top IPs/patterns
    top_client_ips JSON, -- Store top client IPs as JSON array
    common_patterns JSON, -- Store common attack patterns

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rule_id) REFERENCES custom_rules(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rule_time (rule_id, metric_date, metric_hour),
    INDEX idx_rule_metrics (rule_id),
    INDEX idx_metric_time (metric_date, metric_hour)
);

-- Rule Templates (for easy rule creation)
CREATE TABLE rule_templates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id BIGINT,

    -- Template content with placeholders
    template_content TEXT NOT NULL, -- SecRule template with {{variables}}
    template_variables JSON, -- Variable definitions and defaults

    -- Template metadata
    is_system_template BOOLEAN DEFAULT FALSE, -- System vs user-created
    usage_count INT DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES rule_categories(id) ON DELETE SET NULL,
    INDEX idx_category_template (category_id),
    INDEX idx_system_template (is_system_template)
);

-- Insert default rule templates
INSERT INTO rule_templates (name, description, category_id, template_content, template_variables, is_system_template) VALUES
('Basic SQL Injection Block', 'Template for blocking SQL injection attempts', 1,
'SecRule {{TARGET}} "@detectSQLi" \\
    "id:{{RULE_ID}},\\
    phase:{{PHASE}},\\
    {{ACTION}},\\
    msg:''{{MESSAGE}}'',\\
    logdata:''Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}''\\
    t:none,t:urlDecodeUni,t:htmlEntityDecode,t:normalisePathWin"',
'{"TARGET": {"default": "ARGS", "options": ["ARGS", "ARGS_NAMES", "REQUEST_BODY", "REQUEST_URI"]}, "RULE_ID": {"type": "number", "min": 9001, "max": 9999}, "PHASE": {"default": 2, "options": [1,2,3,4,5]}, "ACTION": {"default": "block", "options": ["block", "pass", "deny"]}, "MESSAGE": {"default": "SQL Injection Attack Detected", "type": "string"}}',
TRUE),

('XSS Protection', 'Template for XSS attack detection', 2,
'SecRule {{TARGET}} "@detectXSS" \\
    "id:{{RULE_ID}},\\
    phase:{{PHASE}},\\
    {{ACTION}},\\
    msg:''{{MESSAGE}}'',\\
    logdata:''XSS Attack: %{MATCHED_VAR}''\\
    t:none,t:urlDecodeUni,t:htmlEntityDecode"',
'{"TARGET": {"default": "ARGS", "options": ["ARGS", "REQUEST_BODY", "REQUEST_URI"]}, "RULE_ID": {"type": "number", "min": 9001, "max": 9999}, "PHASE": {"default": 2, "options": [2,3,4]}, "ACTION": {"default": "block", "options": ["block", "pass", "deny"]}, "MESSAGE": {"default": "XSS Attack Detected", "type": "string"}}',
TRUE);
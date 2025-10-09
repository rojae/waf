# WAF Custom Rules Management System

This document provides comprehensive information about the WAF Custom Rules Management System, which allows administrators to create, manage, and deploy custom ModSecurity rules through a web interface.

## Overview

The Custom Rules Management System provides:

- **Web-based rule management**: Create and edit ModSecurity rules through an intuitive interface
- **Automatic deployment**: Rules are deployed to Nginx WAF instances via Kubernetes rolling updates
- **Rule validation**: Comprehensive syntax and security validation before deployment
- **Zero-downtime updates**: Rolling deployment ensures continuous protection
- **Rule templates**: Pre-built templates for common attack patterns
- **Deployment tracking**: Monitor rule deployments and rollback capabilities

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  Dashboard API  │────│   Database      │
│   (React)       │    │  (Spring Boot)  │    │   (MySQL)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Kubernetes     │
                       │  ConfigMap      │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Nginx WAF      │
                       │  (ModSecurity)  │
                       └─────────────────┘
```

## Components

### 1. Database Schema
- **custom_rules**: Main rules table with metadata and content
- **rule_categories**: Rule categorization system
- **rule_deployments**: Deployment tracking and history
- **rule_test_results**: Rule validation and testing results

### 2. Backend Services
- **CustomRuleService**: Core business logic for rule management
- **CustomRuleValidationService**: Rule syntax and security validation
- **KubernetesService**: ConfigMap management and deployment orchestration

### 3. Frontend Components
- **CustomRulesList**: Rule browsing, filtering, and management
- **CustomRuleEditor**: Advanced rule editor with validation and templates
- **Deployment Dashboard**: Monitor deployments and system status

### 4. Kubernetes Resources
- **ConfigMaps**: Store custom rules and ModSecurity configuration
- **Deployments**: Nginx WAF instances with custom rules support
- **RBAC**: Security controls for configuration management
- **Monitoring**: Health checks and metrics collection

## Getting Started

### Prerequisites

- Kubernetes cluster with kubectl access
- WAF system already deployed
- Database (MySQL) configured and accessible
- Docker for building container images

### Installation

1. **Setup the custom rules system**:
   ```bash
   ./scripts/setup-custom-rules.sh
   ```

2. **Verify installation**:
   ```bash
   kubectl get configmap modsecurity-custom-rules -n waf-system
   kubectl get deployment nginx-waf-with-custom-rules -n waf-system
   ```

3. **Access the web interface**:
   Navigate to your WAF dashboard at `/custom-rules`

## Usage

### Creating Custom Rules

1. **Access the Custom Rules page** in your WAF dashboard
2. **Click "Add New Rule"** to open the rule editor
3. **Choose a template** or write your rule from scratch
4. **Validate the rule** using the built-in validator
5. **Test the rule** against sample inputs
6. **Save and deploy** the rule

### Rule Templates

The system includes templates for common scenarios:

- **SQL Injection Protection**
- **Cross-Site Scripting (XSS) Prevention**
- **File Upload Restrictions**
- **Rate Limiting**
- **Custom Block Rules**

### Rule Syntax

ModSecurity rules follow this format:
```
SecRule VARIABLE "OPERATOR" \
    "id:900001,\
    phase:2,\
    block,\
    msg:'Custom Rule Description',\
    logdata:'Matched Data: %{MATCHED_VAR}',\
    severity:'HIGH',\
    t:none,t:urlDecodeUni"
```

#### Key Components:
- **VARIABLE**: What to inspect (ARGS, REQUEST_URI, etc.)
- **OPERATOR**: How to match (@detectSQLi, @rx, etc.)
- **Actions**: What to do when matched (block, log, etc.)

### Deployment Process

1. **Rule Creation**: Rules are created and stored in the database
2. **Validation**: Comprehensive syntax and security validation
3. **ConfigMap Update**: Rules are compiled into ModSecurity format
4. **Rolling Update**: Nginx pods are updated with new rules
5. **Verification**: System validates successful deployment

## Management Scripts

### Setup Script
```bash
./scripts/setup-custom-rules.sh
```
- Installs all required Kubernetes resources
- Configures RBAC and monitoring
- Validates system requirements

### Deployment Script
```bash
# Deploy rules from file
./scripts/deploy-custom-rules.sh -f rules/my-rules.conf

# Preview deployment
./scripts/deploy-custom-rules.sh --dry-run -f rules/my-rules.conf

# Rollback to backup
./scripts/deploy-custom-rules.sh --rollback backup-20240124-120000

# List available backups
./scripts/deploy-custom-rules.sh --list-backups
```

## API Endpoints

### Rule Management
- `GET /api/v2/custom-rules` - List rules with pagination
- `POST /api/v2/custom-rules` - Create new rule
- `PUT /api/v2/custom-rules/{id}` - Update existing rule
- `DELETE /api/v2/custom-rules/{id}` - Delete rule

### Validation and Testing
- `POST /api/v2/custom-rules/validate` - Validate rule syntax
- `POST /api/v2/custom-rules/test` - Test rule against inputs
- `GET /api/v2/custom-rules/templates` - Get rule templates

### Deployment
- `POST /api/v2/custom-rules/deploy` - Deploy active rules
- `GET /api/v2/custom-rules/deployment/preview` - Preview deployment
- `GET /api/v2/custom-rules/stats` - Get system statistics

## Monitoring and Health Checks

### Health Check Job
Runs every 5 minutes to verify:
- ConfigMap existence and content
- Nginx deployment health
- Rule syntax validation
- System connectivity

### Metrics Collection
- Total number of custom rules
- Deployment success rate
- Rule validation statistics
- System performance metrics

### Alerts
- ConfigMap missing or corrupted
- Deployment failures
- Rule validation errors
- System component unavailability

## Security Considerations

### Rule Validation
- **Syntax validation**: Ensures proper ModSecurity syntax
- **Security analysis**: Checks for potential bypasses
- **Performance impact**: Estimates rule performance cost
- **Regex validation**: Prevents ReDoS vulnerabilities

### RBAC Configuration
- Service accounts with minimal required permissions
- Namespace-scoped access controls
- Audit logging for configuration changes

### Best Practices
1. **Test rules thoroughly** before production deployment
2. **Use rule templates** for common scenarios
3. **Monitor performance impact** of complex rules
4. **Maintain backups** before major changes
5. **Regular security review** of custom rules

## Troubleshooting

### Common Issues

#### Rule Deployment Fails
- Check rule syntax validation
- Verify Kubernetes connectivity
- Review RBAC permissions
- Check ConfigMap size limits

#### Rules Not Taking Effect
- Verify deployment completed successfully
- Check pod restart status
- Review ModSecurity logs
- Validate ConfigMap mounting

#### Performance Issues
- Review rule complexity
- Check regex patterns for efficiency
- Monitor resource usage
- Consider rule optimization

### Diagnostic Commands
```bash
# Check system health
kubectl get pods -n waf-system
kubectl get configmap modsecurity-custom-rules -n waf-system -o yaml

# View logs
kubectl logs -l app=nginx-waf -n waf-system
kubectl logs -l component=health-check-job -n waf-system

# Test connectivity
kubectl exec -it <nginx-pod> -n waf-system -- nginx -t
```

## Advanced Configuration

### Custom Rule Categories
Extend the system with additional rule categories by modifying the database schema and updating the frontend categories list.

### Integration with External Systems
The API can be integrated with:
- Security Information and Event Management (SIEM)
- Threat intelligence feeds
- Automated security tools
- CI/CD pipelines

### Performance Tuning
- Optimize rule ordering by priority
- Use rule chaining for complex conditions
- Implement rule caching strategies
- Monitor and adjust resource limits

## Development

### Building from Source
```bash
# Backend
cd backend
mvn clean install

# Frontend
cd frontend
npm install
npm run build
```

### Running Tests
```bash
# Backend tests
mvn test

# Frontend tests
npm test

# Integration tests
./scripts/run-integration-tests.sh
```

### Contributing
1. Follow existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Validate security implications

## Support

For issues and questions:
- Check the troubleshooting section
- Review system logs and metrics
- Consult ModSecurity documentation
- Contact the WAF administration team

## License

This custom rules management system is part of the WAF project and follows the same licensing terms.
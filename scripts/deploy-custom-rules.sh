#!/bin/bash

# WAF Custom Rules Draft Script
# PR1 stores draft ModSecurity rules only. It does not apply them to nginx.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="waf-system"
CONFIGMAP_NAME="modsecurity-custom-rules"
TIMEOUT="300s"

# Default rules file
RULES_FILE=""
DRY_RUN=false
BACKUP=true
ROLLBACK=false
BACKUP_NAME=""

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Store or manage draft WAF custom rules.

This PR1 script updates the draft ConfigMap only. It does not validate with the
runtime nginx/modsecurity image, reload nginx, or claim active WAF deployment.

OPTIONS:
    -f, --file FILE         Rules file to deploy
    -n, --namespace NS      Kubernetes namespace (default: waf-system)
    -d, --dry-run          Show what would be deployed without applying
    -b, --no-backup        Skip creating backup before deployment
    -r, --rollback NAME    Rollback to specified backup
    -l, --list-backups     List available backups
    -h, --help             Show this help message

EXAMPLES:
    $0 -f rules/custom-rules.conf              # Store draft rules from file
    $0 --dry-run -f rules/custom-rules.conf    # Preview draft update
    $0 --rollback backup-20240124-120000       # Rollback to backup
    $0 --list-backups                          # List available backups

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            RULES_FILE="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--no-backup)
            BACKUP=false
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            BACKUP_NAME="$2"
            shift 2
            ;;
        -l|--list-backups)
            echo -e "${YELLOW}Available backups:${NC}"
            kubectl get configmaps -n "$NAMESPACE" -l backup=waf-custom-rules --sort-by=.metadata.creationTimestamp
            exit 0
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}WAF Custom Rules Draft Update${NC}"
echo -e "${BLUE}===========================================${NC}"

# Validate prerequisites
echo -e "${YELLOW}Validating prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}✗ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${RED}✗ Namespace $NAMESPACE does not exist${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites validated${NC}"

# Handle rollback
if [ "$ROLLBACK" = true ]; then
    echo -e "${YELLOW}Rolling back to backup: $BACKUP_NAME${NC}"

    if ! kubectl get configmap "$BACKUP_NAME" -n "$NAMESPACE" &> /dev/null; then
        echo -e "${RED}✗ Backup $BACKUP_NAME not found${NC}"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] Would restore draft from backup: $BACKUP_NAME${NC}"
        kubectl get configmap "$BACKUP_NAME" -n "$NAMESPACE" -o yaml
        exit 0
    fi

    # Restore from backup
    BACKUP_DATA=$(kubectl get configmap "$BACKUP_NAME" -n "$NAMESPACE" -o jsonpath='{.data.custom-rules\.conf}')

    # Create temporary file with backup data
    TEMP_FILE=$(mktemp)
    echo "$BACKUP_DATA" > "$TEMP_FILE"
    RULES_FILE="$TEMP_FILE"

    echo -e "${GREEN}✓ Restored rules from backup${NC}"
fi

# Validate rules file
if [ -z "$RULES_FILE" ]; then
    echo -e "${RED}✗ No rules file specified. Use -f option or --rollback${NC}"
    usage
    exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
    echo -e "${RED}✗ Rules file not found: $RULES_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Rules file found: $RULES_FILE${NC}"

# Validate rules syntax
echo -e "${YELLOW}Validating rules syntax...${NC}"
RULE_COUNT=$(grep -c "SecRule" "$RULES_FILE" || echo 0)
echo -e "${GREEN}✓ Found $RULE_COUNT ModSecurity rules${NC}"

# Basic syntax validation
if [ "$RULE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No SecRule directives found in rules file${NC}"
fi

# Check for common syntax issues
if grep -q "SecRule.*\".*\".*\"" "$RULES_FILE"; then
    echo -e "${GREEN}✓ Rules appear to have proper quoting${NC}"
elif [ "$RULE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some rules may have quoting issues${NC}"
fi

# Create backup if requested
if [ "$BACKUP" = true ] && [ "$ROLLBACK" = false ]; then
    BACKUP_TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
    BACKUP_CONFIGMAP="waf-custom-rules-backup-$BACKUP_TIMESTAMP"

    echo -e "${YELLOW}Creating backup: $BACKUP_CONFIGMAP${NC}"

    if kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" &> /dev/null; then
        # Get current rules
        CURRENT_RULES=$(kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" -o jsonpath='{.data.custom-rules\.conf}')

        # Create backup ConfigMap
        kubectl create configmap "$BACKUP_CONFIGMAP" -n "$NAMESPACE" \
            --from-literal="custom-rules.conf=$CURRENT_RULES" \
            --dry-run=client -o yaml | \
        kubectl label --local -f - backup=waf-custom-rules backup-timestamp="$BACKUP_TIMESTAMP" -o yaml | \
        kubectl apply -f -

        echo -e "${GREEN}✓ Backup created: $BACKUP_CONFIGMAP${NC}"
    else
        echo -e "${YELLOW}⚠ No existing ConfigMap to backup${NC}"
    fi
fi

# Show deployment preview
echo -e "${YELLOW}Draft update preview:${NC}"
echo "  Namespace: $NAMESPACE"
echo "  ConfigMap: $CONFIGMAP_NAME"
echo "  Rules file: $RULES_FILE"
echo "  Rule count: $RULE_COUNT"

# If dry run, show what would be deployed
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] ConfigMap content that would be deployed:${NC}"
    echo "---"
    cat "$RULES_FILE"
    echo "---"
    echo -e "${YELLOW}[DRY RUN] No changes applied${NC}"
    exit 0
fi

# Store draft rules
echo -e "${YELLOW}Storing draft custom rules...${NC}"

# Read rules content
RULES_CONTENT=$(<"$RULES_FILE")

# Create or update ConfigMap
kubectl create configmap "$CONFIGMAP_NAME" \
    --from-literal="custom-rules.conf=$RULES_CONTENT" \
    --dry-run=client -o yaml | \
kubectl label --local -f - \
    app=waf \
    component=custom-rules \
    managed-by=waf-dashboard \
    -o yaml | \
kubectl annotate --local -f - \
    "waf.rojae.kr/draft-id=manual-$(date +%s)" \
    "waf.rojae.kr/updated-at=$(date -Iseconds)" \
    "waf.rojae.kr/rules-count=$RULE_COUNT" \
    "waf.rojae.kr/applied=false" \
    -o yaml | \
kubectl apply -f -

echo -e "${GREEN}✓ Draft ConfigMap updated${NC}"
echo -e "${YELLOW}⚠ Draft was not applied to nginx; runtime validation/reload is not implemented in PR1.${NC}"

# Verify draft storage
echo -e "${YELLOW}Verifying draft storage...${NC}"

# Check ConfigMap content
DEPLOYED_RULE_COUNT=$(kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" -o jsonpath='{.data.custom-rules\.conf}' | grep -c "SecRule" || echo 0)
if [ "$DEPLOYED_RULE_COUNT" -eq "$RULE_COUNT" ]; then
    echo -e "${GREEN}✓ Draft rule count matches: $DEPLOYED_RULE_COUNT${NC}"
else
    echo -e "${YELLOW}⚠ Draft rule count mismatch: stored=$DEPLOYED_RULE_COUNT, expected=$RULE_COUNT${NC}"
fi

# Cleanup temporary file if created during rollback
if [ "$ROLLBACK" = true ] && [ -f "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

# Display deployment summary
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Draft Update Summary${NC}"
echo -e "${BLUE}===========================================${NC}"

echo -e "${GREEN}✓ Custom rules draft stored${NC}"
echo
echo -e "${YELLOW}Draft details:${NC}"
echo "  • Rules stored: $RULE_COUNT"
echo "  • ConfigMap: $CONFIGMAP_NAME"
echo "  • Namespace: $NAMESPACE"
echo "  • Applied to nginx: no"
if [ "$BACKUP" = true ] && [ "$ROLLBACK" = false ]; then
    echo "  • Backup created: $BACKUP_CONFIGMAP"
fi
echo
echo -e "${YELLOW}Useful commands:${NC}"
echo "  • View rules: kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml"
echo "  • List backups: $0 --list-backups"

echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}Draft update completed successfully!${NC}"
echo -e "${BLUE}===========================================${NC}"

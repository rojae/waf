#!/bin/bash

# WAF Custom Rules Deployment Script
# This script deploys or updates custom ModSecurity rules

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
DEPLOYMENT_NAME="nginx-waf-with-custom-rules"
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

Deploy or manage WAF custom rules

OPTIONS:
    -f, --file FILE         Rules file to deploy
    -n, --namespace NS      Kubernetes namespace (default: waf-system)
    -d, --dry-run          Show what would be deployed without applying
    -b, --no-backup        Skip creating backup before deployment
    -r, --rollback NAME    Rollback to specified backup
    -l, --list-backups     List available backups
    -h, --help             Show this help message

EXAMPLES:
    $0 -f rules/custom-rules.conf              # Deploy rules from file
    $0 --dry-run -f rules/custom-rules.conf    # Preview deployment
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
echo -e "${BLUE}WAF Custom Rules Deployment${NC}"
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
        echo -e "${YELLOW}[DRY RUN] Would rollback to backup: $BACKUP_NAME${NC}"
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
echo -e "${YELLOW}Deployment preview:${NC}"
echo "  Namespace: $NAMESPACE"
echo "  ConfigMap: $CONFIGMAP_NAME"
echo "  Deployment: $DEPLOYMENT_NAME"
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

# Deploy rules
echo -e "${YELLOW}Deploying custom rules...${NC}"

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
    "waf.rojae.kr/deployment-id=manual-$(date +%s)" \
    "waf.rojae.kr/updated-at=$(date -Iseconds)" \
    "waf.rojae.kr/rules-count=$RULE_COUNT" \
    -o yaml | \
kubectl apply -f -

echo -e "${GREEN}✓ ConfigMap updated${NC}"

# Trigger rolling update if deployment exists
if kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo -e "${YELLOW}Triggering rolling update...${NC}"

    # Add annotation to trigger rollout
    kubectl annotate deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" \
        "waf.rojae.kr/rules-updated=$(date -Iseconds)" \
        "waf.rojae.kr/last-rollout=$(date +%s)" --overwrite

    echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
    kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout="$TIMEOUT"

    echo -e "${GREEN}✓ Rolling update completed${NC}"
else
    echo -e "${YELLOW}⚠ Deployment $DEPLOYMENT_NAME not found, rules updated in ConfigMap only${NC}"
fi

# Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"

# Check ConfigMap content
DEPLOYED_RULE_COUNT=$(kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" -o jsonpath='{.data.custom-rules\.conf}' | grep -c "SecRule" || echo 0)
if [ "$DEPLOYED_RULE_COUNT" -eq "$RULE_COUNT" ]; then
    echo -e "${GREEN}✓ Rule count matches: $DEPLOYED_RULE_COUNT${NC}"
else
    echo -e "${YELLOW}⚠ Rule count mismatch: deployed=$DEPLOYED_RULE_COUNT, expected=$RULE_COUNT${NC}"
fi

# Check deployment status
if kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" &> /dev/null; then
    READY_REPLICAS=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
    DESIRED_REPLICAS=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')

    if [ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ]; then
        echo -e "${GREEN}✓ All $READY_REPLICAS replicas are ready${NC}"
    else
        echo -e "${YELLOW}⚠ Only $READY_REPLICAS out of $DESIRED_REPLICAS replicas are ready${NC}"
    fi
fi

# Cleanup temporary file if created during rollback
if [ "$ROLLBACK" = true ] && [ -f "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

# Display deployment summary
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}===========================================${NC}"

echo -e "${GREEN}✓ Custom rules deployment completed${NC}"
echo
echo -e "${YELLOW}Deployment details:${NC}"
echo "  • Rules deployed: $RULE_COUNT"
echo "  • ConfigMap: $CONFIGMAP_NAME"
echo "  • Namespace: $NAMESPACE"
if [ "$BACKUP" = true ] && [ "$ROLLBACK" = false ]; then
    echo "  • Backup created: $BACKUP_CONFIGMAP"
fi
echo
echo -e "${YELLOW}Useful commands:${NC}"
echo "  • View rules: kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml"
echo "  • Check deployment: kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE"
echo "  • View logs: kubectl logs -l app=nginx-waf -n $NAMESPACE"
echo "  • List backups: $0 --list-backups"

echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${BLUE}===========================================${NC}"
#!/bin/bash
# =============================================
# Kubernetes WAF Restart Script
# =============================================
# Restarts WAF services with updated environment variables
# Useful when you change environment file and want to apply changes
#
# Usage:
#   ./k8s-restart.sh [env_file]
#
# Examples:
#   ./k8s-restart.sh              # Uses .env (default)
#   ./k8s-restart.sh .env.dev     # Uses .env.dev
#   ./k8s-restart.sh .env.staging # Uses .env.staging
#   ./k8s-restart.sh .env.prod    # Uses .env.prod
# =============================================

set -e

# =============================================
# Parse command line arguments
# =============================================
ENV_FILE="${1:-.env}"  # Default to .env if no argument provided

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# =============================================
# Step 0: Check prerequisites
# =============================================
print_step "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl first."
    exit 1
fi

if ! command -v envsubst &> /dev/null; then
    print_error "envsubst not found. Please install gettext package."
    exit 1
fi

print_success "Prerequisites met"

# =============================================
# Step 1: Load environment variables
# =============================================
print_step "Loading environment variables from: ${GREEN}${ENV_FILE}${NC}"

if [ ! -f "$ENV_FILE" ]; then
    print_error "Environment file not found: $ENV_FILE"
    echo ""
    echo "Available environment files:"
    ls -1 .env* 2>/dev/null || echo "  (none found)"
    echo ""
    echo "Please create an environment file first:"
    echo "  cp .env.example $ENV_FILE"
    echo "  vim $ENV_FILE  # Edit with your values"
    echo ""
    echo "Or specify a different file:"
    echo "  ./k8s-restart.sh .env.dev"
    exit 1
fi

# Load environment file (safe way - handles comments, empty lines, and special characters)
set -a  # automatically export all variables
source "$ENV_FILE"
set +a  # stop automatically exporting

COOKIE_SECURE=${COOKIE_SECURE:-false}
CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE:-${CLICKHOUSE_DB:-waf_analytics}}
CLICKHOUSE_PORT=${CLICKHOUSE_PORT:-9000}
KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS:-kafka.waf-processing.svc.cluster.local:9092}
export COOKIE_SECURE CLICKHOUSE_DATABASE CLICKHOUSE_PORT KAFKA_BOOTSTRAP_SERVERS

print_success "Environment variables loaded from: $ENV_FILE"

# =============================================
# Step 2: Update Secrets
# =============================================
print_step "Updating Kubernetes Secrets..."

# Delete and recreate secret
kubectl delete secret waf-auth-secrets -n waf-system --ignore-not-found=true

kubectl create secret generic waf-auth-secrets \
  --from-literal=google-client-id="$GOOGLE_CLIENT_ID" \
  --from-literal=google-client-secret="$GOOGLE_CLIENT_SECRET" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
  -n waf-system

print_success "Secrets updated"

# =============================================
# Step 3: Update ConfigMaps
# =============================================
print_step "Updating ConfigMaps..."

# Create temporary file with substituted values
TEMP_CONFIG="/tmp/k8s-configmaps-secrets-applied.yaml"
CONFIG_ENVSUBST_VARS='${DOMAIN} ${COOKIE_DOMAIN} ${COOKIE_SECURE} ${GOOGLE_OAUTH_REDIRECT_URI} ${OAUTH_CALLBACK_BASE_URL} ${OAUTH_DEFAULT_REDIRECT_URL} ${INFLUXDB_TOKEN} ${INFLUXDB_ORG} ${INFLUXDB_BUCKET} ${INFLUXDB_ADMIN_PASSWORD} ${GOOGLE_CLIENT_ID} ${GOOGLE_CLIENT_SECRET} ${JWT_SECRET} ${NEXTAUTH_SECRET} ${CLICKHOUSE_PASSWORD}'

./scripts/generate-k8s-configmaps.sh
envsubst "$CONFIG_ENVSUBST_VARS" < k8s/02-configmaps-only.yaml > "$TEMP_CONFIG"

# Apply generated ConfigMaps and Secrets
kubectl apply -f "$TEMP_CONFIG"

# Clean up
rm -f "$TEMP_CONFIG"

print_success "ConfigMaps updated"

# =============================================
# Step 4: Restart Deployments
# =============================================
print_step "Restarting deployments to apply new configurations..."

echo ""
print_warning "This will cause a brief downtime for each service"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Restart cancelled. ConfigMaps and Secrets are updated but Pods are not restarted."
    echo "To manually restart later, run:"
    echo "  kubectl rollout restart deployment -n waf-system"
    echo "  kubectl rollout restart deployment -n waf-data"
    echo "  kubectl rollout restart deployment -n waf-processing"
    exit 0
fi

# Restart all deployments in waf-system namespace
echo ""
print_step "Restarting waf-system deployments..."
kubectl rollout restart deployment -n waf-system
kubectl rollout status deployment/waf-frontend -n waf-system --timeout=300s
kubectl rollout status deployment/waf-social-api -n waf-system --timeout=300s
kubectl rollout status deployment/waf-dashboard-api -n waf-system --timeout=300s
kubectl rollout status deployment/nginx-waf -n waf-system --timeout=300s
print_success "waf-system deployments restarted"

# Restart data stores (optional - usually don't need environment variable changes)
echo ""
read -p "Restart data stores (InfluxDB, Elasticsearch, ClickHouse)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Restarting waf-data deployments..."
    kubectl rollout restart deployment -n waf-data
    print_success "waf-data deployments restarted"
fi

# Restart processing services (optional)
echo ""
read -p "Restart processing services (Kafka, ksqlDB, Logstash)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Restarting waf-processing deployments..."
    kubectl rollout restart deployment -n waf-processing
    kubectl rollout restart statefulset -n waf-processing
    print_success "waf-processing services restarted"
fi

# =============================================
# Step 5: Display status
# =============================================
echo ""
print_step "Deployment Status:"
echo ""

echo "Pods in waf-system:"
kubectl get pods -n waf-system

echo ""
echo "Pods in waf-data:"
kubectl get pods -n waf-data

echo ""
echo "Pods in waf-processing:"
kubectl get pods -n waf-processing

echo ""
print_success "Restart completed successfully!"
echo ""
echo "Services should now be using updated environment variables."

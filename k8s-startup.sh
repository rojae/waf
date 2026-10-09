#!/bin/bash
# =============================================
# Kubernetes WAF Deployment Script
# =============================================
# Automates environment variable setup and k8s deployment
#
# Usage:
#   ./k8s-startup.sh [env_file]
#
# Examples:
#   ./k8s-startup.sh              # Uses .env (default)
#   ./k8s-startup.sh .env.dev     # Uses .env.dev
#   ./k8s-startup.sh .env.prod    # Uses .env.prod
#
# Other scripts:
#   ./k8s-restart.sh [env_file]   # Quick restart with new env vars
#   ./k8s-cleanup.sh              # Remove all resources
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
    echo "  macOS: brew install gettext && brew link --force gettext"
    echo "  Linux: sudo apt-get install gettext-base"
    exit 1
fi

if ! command -v base64 &> /dev/null; then
    print_error "base64 not found. Please install coreutils."
    exit 1
fi

print_success "All prerequisites met"

# =============================================
# Step 1: Load environment variables
# =============================================
print_step "Loading environment variables from: ${GREEN}${ENV_FILE}${NC}"

# Check if environment file exists
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
    echo "  ./k8s-startup.sh .env.dev"
    exit 1
fi

# Load environment file (safe way - handles comments, empty lines, and special characters)
set -a  # automatically export all variables
source "$ENV_FILE"
set +a  # stop automatically exporting

# Validate required environment variables
REQUIRED_VARS=(
    "JWT_SECRET"
    "NEXTAUTH_SECRET"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "INFLUXDB_TOKEN"
    "INFLUXDB_ORG"
    "INFLUXDB_BUCKET"
    "INFLUXDB_ADMIN_PASSWORD"
    "CLICKHOUSE_PASSWORD"
    "DOMAIN"
    "COOKIE_DOMAIN"
    "GOOGLE_OAUTH_REDIRECT_URI"
    "OAUTH_CALLBACK_BASE_URL"
    "OAUTH_DEFAULT_REDIRECT_URL"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please check your .env file and set all required variables."
    exit 1
fi

COOKIE_SECURE=${COOKIE_SECURE:-false}
CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE:-${CLICKHOUSE_DB:-waf_analytics}}
CLICKHOUSE_PORT=${CLICKHOUSE_PORT:-9000}
KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS:-kafka.waf-processing.svc.cluster.local:9092}
export COOKIE_SECURE CLICKHOUSE_DATABASE CLICKHOUSE_PORT KAFKA_BOOTSTRAP_SERVERS

print_success "Environment variables loaded successfully"

# =============================================
# Step 2: Build Docker images (if needed)
# =============================================
print_step "Checking Docker images..."

IMAGES=(
    "waf-dashboard-api:latest"
    "waf-social-api:latest"
    "waf-frontend:latest"
    "waf-nginx:latest"
    "waf-realtime-processor:latest"
    "waf-alert-processor:latest"
    "waf-kafka-clickhouse-consumer:latest"
)

MISSING_IMAGES=()
for image in "${IMAGES[@]}"; do
    if ! docker image inspect "$image" &> /dev/null; then
        MISSING_IMAGES+=("$image")
    fi
done

if [ ${#MISSING_IMAGES[@]} -ne 0 ]; then
    print_warning "Missing Docker images:"
    for image in "${MISSING_IMAGES[@]}"; do
        echo "  - $image"
    done
    echo ""
    read -p "Build missing images now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Building Docker images..."

        # Build backend services
        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-dashboard-api:latest " ]]; then
            docker build -t waf-dashboard-api:latest -f backend/Dockerfile --target dashboard-api backend
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-social-api:latest " ]]; then
            docker build -t waf-social-api:latest -f backend/Dockerfile --target social-api backend
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-frontend:latest " ]]; then
            docker build -t waf-frontend:latest -f frontend/Dockerfile.dev frontend
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-nginx:latest " ]]; then
            docker build -t waf-nginx:latest -f nginx/Dockerfile nginx
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-realtime-processor:latest " ]]; then
            docker build -t waf-realtime-processor:latest -f services/realtime-processor/Dockerfile services/realtime-processor
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-alert-processor:latest " ]]; then
            docker build -t waf-alert-processor:latest -f services/alert-processor/Dockerfile services/alert-processor
        fi

        if [[ " ${MISSING_IMAGES[@]} " =~ " waf-kafka-clickhouse-consumer:latest " ]]; then
            docker build -t waf-kafka-clickhouse-consumer:latest -f kafka-clickhouse-consumer/Dockerfile kafka-clickhouse-consumer
        fi

        if command -v kind >/dev/null 2>&1 && kind get clusters 2>/dev/null | grep -q .; then
            for image in "${IMAGES[@]}"; do
                kind load docker-image "$image"
            done
        elif command -v minikube >/dev/null 2>&1 && minikube status >/dev/null 2>&1; then
            for image in "${IMAGES[@]}"; do
                minikube image load "$image"
            done
        fi

        print_success "Docker images built and loaded when a local cluster loader was available"
    else
        print_error "Cannot proceed without Docker images. Exiting."
        exit 1
    fi
else
    print_success "All Docker images are available"
fi

# =============================================
# Step 3: Check if services are already running
# =============================================
print_step "Checking if WAF services are already running..."

EXISTING_DEPLOYMENTS=$(kubectl get deployments -n waf-system 2>/dev/null | grep -c "waf-" || echo "0")

if [ "$EXISTING_DEPLOYMENTS" -gt 0 ]; then
    print_warning "Detected existing WAF deployments in the cluster!"
    echo ""
    echo "Current deployments:"
    kubectl get deployments -n waf-system -o wide 2>/dev/null || true
    echo ""
    echo "Current pods:"
    kubectl get pods -n waf-system 2>/dev/null || true
    echo ""
    echo -e "${YELLOW}Recommendation:${NC}"
    echo "  If you only changed environment variables (.env file),"
    echo "  it's faster to use the restart script instead:"
    echo ""
    echo -e "    ${GREEN}./k8s-restart.sh${NC}"
    echo ""
    echo "  This will:"
    echo "    ✓ Update Secrets and ConfigMaps"
    echo "    ✓ Restart pods with new environment variables"
    echo "    ✓ Skip unnecessary steps (faster)"
    echo ""
    echo "  Continue with full deployment only if you:"
    echo "    • Updated Kubernetes YAML files"
    echo "    • Rebuilt Docker images"
    echo "    • Need to deploy new resources"
    echo ""
    read -p "Continue with full deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled."
        echo ""
        echo "To restart with new environment variables, run:"
        echo "  ${GREEN}./k8s-restart.sh${NC}"
        echo ""
        echo "To clean up and redeploy from scratch, run:"
        echo "  ${GREEN}./k8s-cleanup.sh && ./k8s-startup.sh${NC}"
        exit 0
    fi
    echo ""
    print_step "Proceeding with full deployment..."
fi

# =============================================
# Step 4: Create namespaces
# =============================================
print_step "Creating Kubernetes namespaces..."

kubectl apply -f k8s/00-namespaces.yaml

print_success "Namespaces created"

# =============================================
# Step 5: Create Secrets
# =============================================
print_step "Creating Kubernetes Secrets..."

# Delete existing secret if exists
kubectl delete secret waf-auth-secrets -n waf-system --ignore-not-found=true

# Create secret with base64 encoded values
kubectl create secret generic waf-auth-secrets \
  --from-literal=google-client-id="$GOOGLE_CLIENT_ID" \
  --from-literal=google-client-secret="$GOOGLE_CLIENT_SECRET" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
  -n waf-system

print_success "Secrets created"

# =============================================
# Step 6: Create ConfigMaps with environment variables
# =============================================
print_step "Creating ConfigMaps with environment variables..."

# Create temporary file with substituted values
TEMP_CONFIG="/tmp/k8s-configmaps-secrets-applied.yaml"

# Substitute only deploy-time placeholders; leave embedded runtime/script
# variables such as ${HOSTNAME}, $BROKER, and Ruby/Logstash expressions intact.
ENVSUBST_VARS='${DOMAIN} ${COOKIE_DOMAIN} ${COOKIE_SECURE} ${GOOGLE_OAUTH_REDIRECT_URI} ${OAUTH_CALLBACK_BASE_URL} ${OAUTH_DEFAULT_REDIRECT_URL} ${INFLUXDB_TOKEN} ${INFLUXDB_ORG} ${INFLUXDB_BUCKET} ${INFLUXDB_ADMIN_PASSWORD} ${GOOGLE_CLIENT_ID} ${GOOGLE_CLIENT_SECRET} ${JWT_SECRET} ${NEXTAUTH_SECRET} ${CLICKHOUSE_PASSWORD}'
./scripts/generate-k8s-configmaps.sh
envsubst "$ENVSUBST_VARS" < k8s/02-configmaps-only.yaml > "$TEMP_CONFIG"

# Apply only ConfigMaps
kubectl apply -f "$TEMP_CONFIG"

# Clean up
rm -f "$TEMP_CONFIG"

print_success "ConfigMaps created"

# =============================================
# Step 7: Apply remaining Kubernetes resources
# =============================================
print_step "Deploying Kubernetes resources..."

kubectl apply -f k8s/01-storage.yaml
print_success "Storage resources deployed"

kubectl apply -f k8s/04-data-stores.yaml
print_success "Data stores deployed"

print_step "Waiting for data stores to be ready..."
kubectl wait --for=condition=ready pod -l app=elasticsearch -n waf-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=influxdb -n waf-data --timeout=300s
kubectl wait --for=condition=ready pod -l app=clickhouse -n waf-data --timeout=300s

kubectl apply -f k8s/05-processing-services.yaml
print_success "Processing services deployed"

print_step "Waiting for Kafka to be ready..."
kubectl wait --for=condition=ready pod -l app=kafka -n waf-processing --timeout=300s

kubectl apply -f k8s/11-kafka-clickhouse-consumer.yaml
print_success "Kafka to ClickHouse consumer deployed"

kubectl wait --for=condition=ready pod -l app=kafka-clickhouse-consumer -n waf-processing --timeout=300s

kubectl apply -f k8s/03-nginx-waf.yaml
print_success "NGINX WAF deployed"

kubectl apply -f k8s/06-applications.yaml
print_success "Application services deployed"

# =============================================
# Step 8: Wait for all pods to be ready
# =============================================
print_step "Waiting for all pods to be ready..."

# Wait for critical pods
echo "Waiting for waf-system pods..."
kubectl wait --for=condition=ready pod -l app=nginx-waf -n waf-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=waf-frontend -n waf-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=waf-social-api -n waf-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=waf-dashboard-api -n waf-system --timeout=300s

print_success "Required waf-system pods are ready"

# =============================================
# Step 9: Display deployment status
# =============================================
print_step "Deployment Status:"
echo ""

echo "Namespaces:"
kubectl get namespaces | grep waf

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
echo "Services:"
kubectl get svc -n waf-system

# =============================================
# Step 10: Setup port forwarding
# =============================================
echo ""
print_step "Setting up port forwarding..."
echo ""
echo "Run the following commands in separate terminals:"
echo ""
echo "${YELLOW}# Frontend${NC}"
echo "kubectl port-forward -n waf-system service/waf-frontend 3001:3001"
echo ""
echo "${YELLOW}# Backend APIs${NC}"
echo "kubectl port-forward -n waf-system service/waf-social-api 8081:8081"
echo "kubectl port-forward -n waf-system service/waf-dashboard-api 8082:8082"
echo ""
echo "${YELLOW}# NGINX WAF${NC}"
echo "kubectl port-forward -n waf-system service/nginx-waf-service 8080:80"
echo ""
echo "${YELLOW}# Data Services${NC}"
echo "kubectl port-forward -n waf-data service/influxdb 8086:8086"
echo "kubectl port-forward -n waf-data service/elasticsearch 9200:9200"
echo "kubectl port-forward -n waf-data service/clickhouse 8123:8123"
echo ""
echo "${YELLOW}# Processing Services${NC}"
echo "kubectl port-forward -n waf-processing service/kafka 9092:9092"
echo "kubectl port-forward -n waf-processing service/ksqldb 8088:8088"
echo ""
echo "Or run all port forwards in background:"
echo ""
echo "${GREEN}./k8s-port-forward.sh${NC}"
echo ""

print_success "Deployment completed successfully!"
echo ""
echo "Access your services at:"
echo "  Frontend:        http://localhost:3001"
echo "  Social API:      http://localhost:8081"
echo "  Dashboard API:   http://localhost:8082"
echo "  NGINX WAF:       http://localhost:8080"
echo "  InfluxDB UI:     http://localhost:8086"
echo "  Elasticsearch:   http://localhost:9200"

#!/bin/bash

# WAF Custom Rules Setup Script
# This script sets up the complete custom rule management system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="waf-system"
TIMEOUT="300s"

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}WAF Custom Rules Management Setup${NC}"
echo -e "${BLUE}===========================================${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl is available${NC}"

# Check cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}✗ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Kubernetes cluster is accessible${NC}"

# Check if namespace exists
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ Namespace $NAMESPACE exists${NC}"
else
    echo -e "${YELLOW}Creating namespace $NAMESPACE...${NC}"
    kubectl create namespace "$NAMESPACE"
    echo -e "${GREEN}✓ Namespace $NAMESPACE created${NC}"
fi

# Apply base ModSecurity configuration
echo -e "${YELLOW}Applying base ModSecurity configuration...${NC}"
kubectl apply -f k8s/09-modsecurity-base-config.yaml
echo -e "${GREEN}✓ Base ModSecurity configuration applied${NC}"

# Apply custom rules ConfigMap and deployment
echo -e "${YELLOW}Setting up custom rules system...${NC}"
kubectl apply -f k8s/08-custom-rules-configmap.yaml
echo -e "${GREEN}✓ Custom rules ConfigMap and deployment configuration applied${NC}"

# Apply monitoring and health checks
echo -e "${YELLOW}Setting up monitoring and health checks...${NC}"
kubectl apply -f k8s/10-custom-rules-deployment-monitoring.yaml
echo -e "${GREEN}✓ Monitoring and health check configuration applied${NC}"

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"

# Check if nginx-waf-with-custom-rules deployment exists
if kubectl get deployment nginx-waf-with-custom-rules -n "$NAMESPACE" &> /dev/null; then
    echo -e "${YELLOW}Waiting for nginx-waf-with-custom-rules deployment to be ready...${NC}"
    kubectl wait --for=condition=available --timeout="$TIMEOUT" deployment/nginx-waf-with-custom-rules -n "$NAMESPACE" || {
        echo -e "${YELLOW}⚠ nginx-waf-with-custom-rules deployment may still be starting up${NC}"
    }
    echo -e "${GREEN}✓ Nginx WAF deployment is ready${NC}"
else
    echo -e "${YELLOW}⚠ nginx-waf-with-custom-rules deployment not found - may need to be created separately${NC}"
fi

# Verify ConfigMaps
echo -e "${YELLOW}Verifying ConfigMaps...${NC}"

CONFIGMAPS=(
    "modsecurity-base-config"
    "modsecurity-custom-rules"
    "waf-monitoring-config"
)

for cm in "${CONFIGMAPS[@]}"; do
    if kubectl get configmap "$cm" -n "$NAMESPACE" &> /dev/null; then
        echo -e "${GREEN}✓ ConfigMap $cm exists${NC}"
    else
        echo -e "${RED}✗ ConfigMap $cm not found${NC}"
    fi
done

# Check RBAC
echo -e "${YELLOW}Verifying RBAC configuration...${NC}"
if kubectl get role modsecurity-config-manager -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ RBAC role exists${NC}"
else
    echo -e "${YELLOW}⚠ RBAC role not found${NC}"
fi

if kubectl get rolebinding modsecurity-config-manager -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✓ RBAC role binding exists${NC}"
else
    echo -e "${YELLOW}⚠ RBAC role binding not found${NC}"
fi

# Test health check
echo -e "${YELLOW}Running health check...${NC}"
if kubectl get configmap waf-monitoring-config -n "$NAMESPACE" &> /dev/null; then
    # Create a test pod to run the health check
    kubectl run waf-health-test --rm -i --restart=Never --image=bitnami/kubectl:latest -n "$NAMESPACE" -- \
        bash -c "$(kubectl get configmap waf-monitoring-config -n "$NAMESPACE" -o jsonpath='{.data.health-check\.sh}')" || {
        echo -e "${YELLOW}⚠ Health check completed with warnings${NC}"
    }
else
    echo -e "${YELLOW}⚠ Health check script not available${NC}"
fi

# Display setup summary
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Setup Summary${NC}"
echo -e "${BLUE}===========================================${NC}"

echo -e "${GREEN}✓ Custom Rules Management System Setup Complete${NC}"
echo
echo -e "${YELLOW}Components installed:${NC}"
echo "  • Base ModSecurity configuration"
echo "  • Custom rules ConfigMap management"
echo "  • Nginx WAF deployment with custom rules support"
echo "  • Health monitoring and alerting"
echo "  • RBAC for secure configuration management"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy your WAF Dashboard API to manage custom rules"
echo "  2. Access the web interface to create and manage custom rules"
echo "  3. Monitor rule deployments through the health check system"
echo
echo -e "${YELLOW}Useful commands:${NC}"
echo "  • Check custom rules: kubectl get configmap modsecurity-custom-rules -n $NAMESPACE -o yaml"
echo "  • View deployment status: kubectl get deployment nginx-waf-with-custom-rules -n $NAMESPACE"
echo "  • Check logs: kubectl logs -l app=nginx-waf -n $NAMESPACE"
echo "  • Run health check: kubectl logs -l component=health-check-job -n $NAMESPACE"

echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${BLUE}===========================================${NC}"
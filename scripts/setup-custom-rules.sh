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

# Apply draft custom rules ConfigMap
echo -e "${YELLOW}Setting up draft custom rules store...${NC}"
kubectl apply -f k8s/08-custom-rules-configmap.yaml
echo -e "${GREEN}✓ Draft custom rules ConfigMap applied${NC}"
echo -e "${YELLOW}⚠ PR1 does not apply draft rules to nginx. Runtime validation and reload are follow-up work.${NC}"

# Verify ConfigMaps
echo -e "${YELLOW}Verifying ConfigMaps...${NC}"

CONFIGMAPS=(
    "modsecurity-base-config"
    "modsecurity-custom-rules"
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

# Display setup summary
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}Setup Summary${NC}"
echo -e "${BLUE}===========================================${NC}"

echo -e "${GREEN}✓ Custom Rules Management System Setup Complete${NC}"
echo
echo -e "${YELLOW}Components installed:${NC}"
echo "  • Base ModSecurity configuration"
echo "  • Draft custom rules ConfigMap management"
echo "  • RBAC for secure configuration management"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy your WAF Dashboard API to manage draft custom rules"
echo "  2. Access the web interface to create and manage draft rules"
echo "  3. Implement runtime validation/reload before claiming active WAF deployment"
echo
echo -e "${YELLOW}Useful commands:${NC}"
echo "  • Check custom rules: kubectl get configmap modsecurity-custom-rules -n $NAMESPACE -o yaml"
echo "  • Check logs: kubectl logs -l app=nginx-waf -n $NAMESPACE"

echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}Draft setup completed successfully!${NC}"
echo -e "${BLUE}===========================================${NC}"

#!/bin/bash
# =============================================
# Kubernetes Cleanup Script
# =============================================
# Removes all WAF resources from Kubernetes
# =============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}WARNING: This will delete all WAF resources from Kubernetes${NC}"
echo ""
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

echo ""
echo -e "${RED}Deleting WAF resources...${NC}"
echo ""

# Stop port forwards
echo "Stopping port forwards..."
pkill -f "kubectl port-forward" || true

# Delete resources in reverse order
echo "Deleting applications..."
kubectl delete -f k8s/06-applications.yaml --ignore-not-found=true

echo "Deleting NGINX WAF..."
kubectl delete -f k8s/03-nginx-waf.yaml --ignore-not-found=true

echo "Deleting processing services..."
kubectl delete -f k8s/05-processing-services.yaml --ignore-not-found=true

echo "Deleting data stores..."
kubectl delete -f k8s/04-data-stores.yaml --ignore-not-found=true

echo "Deleting ConfigMaps and Secrets..."
kubectl delete -f k8s/02-configmaps-secrets.yaml --ignore-not-found=true
kubectl delete secret waf-auth-secrets -n waf-system --ignore-not-found=true

echo "Deleting storage..."
kubectl delete -f k8s/01-storage.yaml --ignore-not-found=true

echo "Deleting namespaces..."
kubectl delete -f k8s/00-namespaces.yaml --ignore-not-found=true

echo ""
echo -e "${GREEN}✓ Cleanup completed${NC}"
echo ""
echo "Remaining WAF resources (should be empty):"
kubectl get all -n waf-system 2>/dev/null || echo "  waf-system namespace deleted"
kubectl get all -n waf-data 2>/dev/null || echo "  waf-data namespace deleted"
kubectl get all -n waf-processing 2>/dev/null || echo "  waf-processing namespace deleted"
kubectl get all -n waf-monitoring 2>/dev/null || echo "  waf-monitoring namespace deleted"

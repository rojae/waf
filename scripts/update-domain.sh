#!/bin/bash

# WAF Domain Update Script
# This script updates all domain-related configurations across the project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if domain is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Usage: $0 <new-domain>${NC}"
    echo -e "${YELLOW}Example: $0 https://your-new-domain.ngrok-free.app${NC}"
    exit 1
fi

NEW_DOMAIN="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🔄 Updating WAF domain configuration to: ${GREEN}$NEW_DOMAIN${NC}"
echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"

# Function to check if kubectl is available and cluster is accessible
check_kubernetes() {
    if command -v kubectl >/dev/null 2>&1; then
        if kubectl cluster-info >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Update .env file
echo -e "${YELLOW}📝 Updating .env file...${NC}"
if [ -f "$PROJECT_ROOT/.env" ]; then
    sed -i.bak "s|DOMAIN=.*|DOMAIN=$NEW_DOMAIN|g" "$PROJECT_ROOT/.env"
    sed -i.bak "s|OAUTH_CALLBACK_BASE_URL=.*|OAUTH_CALLBACK_BASE_URL=$NEW_DOMAIN|g" "$PROJECT_ROOT/.env"
    echo -e "${GREEN}   ✓ .env updated${NC}"
else
    echo -e "${RED}   ✗ .env file not found${NC}"
fi

echo -e "${YELLOW}📝 Backend defaults are not rewritten by this runtime helper${NC}"
echo -e "${YELLOW}   Runtime reads OAuth values from .env, compose, or Kubernetes ConfigMaps.${NC}"

# Update Kubernetes deployment if available
if check_kubernetes; then
    echo -e "${YELLOW}🔧 Updating Kubernetes deployments...${NC}"

    # Check if waf-social-api deployment exists
    if kubectl get deployment waf-social-api -n waf-system >/dev/null 2>&1; then
        echo -e "${YELLOW}   Updating waf-social-api deployment...${NC}"

        # Update the deployment with new environment variables
        kubectl patch deployment waf-social-api -n waf-system -p "{
            \"spec\": {
                \"template\": {
                    \"spec\": {
                        \"containers\": [{
                            \"name\": \"waf-social-api\",
                            \"env\": [
                                {\"name\": \"COOKIE_DOMAIN\", \"value\": \"$NEW_DOMAIN\"},
                                {\"name\": \"GOOGLE_OAUTH_REDIRECT_URI\", \"value\": \"$NEW_DOMAIN/login/oauth2/code/google\"},
                                {\"name\": \"OAUTH_CALLBACK_BASE_URL\", \"value\": \"$NEW_DOMAIN\"},
                                {\"name\": \"OAUTH_DEFAULT_REDIRECT_URL\", \"value\": \"$NEW_DOMAIN\"},
                                {\"name\": \"SPRING_PROFILES_ACTIVE\", \"value\": \"docker\"},
                                {\"name\": \"GOOGLE_CLIENT_ID\", \"valueFrom\": {\"secretKeyRef\": {\"name\": \"waf-auth-secrets\", \"key\": \"google-client-id\", \"optional\": true}}},
                                {\"name\": \"GOOGLE_CLIENT_SECRET\", \"valueFrom\": {\"secretKeyRef\": {\"name\": \"waf-auth-secrets\", \"key\": \"google-client-secret\", \"optional\": true}}},
                                {\"name\": \"JWT_SECRET\", \"valueFrom\": {\"secretKeyRef\": {\"name\": \"waf-auth-secrets\", \"key\": \"jwt-secret\", \"optional\": false}}}
                            ]
                        }]
                    }
                }
            }
        }"

        # Wait for rollout to complete
        echo -e "${YELLOW}   Waiting for deployment rollout...${NC}"
        kubectl rollout status deployment/waf-social-api -n waf-system --timeout=60s
        echo -e "${GREEN}   ✓ Kubernetes deployment updated${NC}"
    else
        echo -e "${YELLOW}   ⚠ waf-social-api deployment not found in waf-system namespace${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Kubernetes not available or not configured${NC}"
    echo -e "${YELLOW}  Manual Kubernetes update required if using K8s deployment${NC}"
fi

# Clean up backup files
find "$PROJECT_ROOT" -name "*.bak" -delete 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Domain configuration updated successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Updated components:${NC}"
echo -e "   ${GREEN}•${NC} .env file"
if check_kubernetes; then
    echo -e "   ${GREEN}•${NC} Kubernetes waf-social-api deployment"
fi
echo ""
echo -e "${BLUE}🔧 Important next steps:${NC}"
echo -e "   ${YELLOW}1.${NC} Update Google OAuth Console redirect URIs:"
echo -e "      ${GREEN}$NEW_DOMAIN/login/oauth2/code/google${NC}"
echo -e "   ${YELLOW}2.${NC} Verify backend configuration:"
echo -e "      ${GREEN}curl http://localhost:8081/auth/debug/callback-base-url${NC}"
echo -e "   ${YELLOW}3.${NC} Test the Google login flow through frontend"
echo ""
echo -e "${BLUE}🌐 Google OAuth Console:${NC}"
echo -e "   ${GREEN}https://console.cloud.google.com/apis/credentials${NC}"

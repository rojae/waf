#!/bin/bash
# Quick deployment script for production environment
echo "⚠️  WARNING: Deploying to PRODUCTION environment!"
echo ""
read -p "Are you sure you want to deploy to production? (yes/no) " -r
echo
if [[ $REPLY == "yes" ]]; then
    ./k8s-startup.sh .env.prod
else
    echo "Production deployment cancelled."
    exit 1
fi

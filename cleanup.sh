#!/bin/bash

# WAF 시스템 전체 정리 스크립트
echo "🧹 WAF 시스템 전체 정리를 시작합니다..."

# 포트포워딩 종료
echo "🛑 포트포워딩 종료 중..."
pkill -f "kubectl port-forward" || true
sleep 2

# K8s 리소스 삭제 (역순)
echo "🗑️  Kubernetes 리소스 삭제 중..."
kubectl delete -f k8s/07-monitoring.yaml --ignore-not-found=true
kubectl delete -f k8s/06-applications.yaml --ignore-not-found=true
kubectl delete -f k8s/05-processing-services.yaml --ignore-not-found=true
kubectl delete -f k8s/04-data-stores.yaml --ignore-not-found=true
kubectl delete -f k8s/03-nginx-waf.yaml --ignore-not-found=true
kubectl delete -f k8s/02-configmaps-secrets.yaml --ignore-not-found=true
kubectl delete -f k8s/01-storage.yaml --ignore-not-found=true

# 네임스페이스는 마지막에 삭제 (강제 종료 옵션 포함)
echo "📁 네임스페이스 삭제 중..."
kubectl delete namespace waf-monitoring waf-processing waf-data waf-system --ignore-not-found=true --timeout=60s || true

# 남은 리소스 강제 정리
echo "🔧 남은 리소스 강제 정리 중..."
kubectl get pv | grep waf- | awk '{print $1}' | xargs -r kubectl delete pv --ignore-not-found=true || true

echo "✅ WAF 시스템 정리 완료!"
echo ""
echo "💡 다시 배포하려면: ./deploy-all.sh"
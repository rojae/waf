# WAF Platform - Kubernetes Deployment Guide

이 가이드는 WAF 플랫폼을 쿠버네티스 환경에서 배포하는 방법을 설명합니다.

## 🚀 빠른 시작

### 전제조건

- Kubernetes 클러스터 (v1.24+)
- kubectl CLI 도구
- Helm v3 (옵션)
- Docker (이미지 빌드용)
- 최소 리소스: 16GB RAM, 8 CPU 코어

### 1. 자동 배포 (추천)

```bash
cd k8s/
./deploy.sh
```

### 2. Helm을 사용한 배포

```bash
cd k8s/
./deploy.sh helm
```

### 3. 수동 배포

```bash
kubectl apply -f k8s/00-namespaces.yaml
kubectl apply -f k8s/01-storage.yaml
kubectl apply -f k8s/02-configmaps-secrets.yaml
kubectl apply -f k8s/04-data-stores.yaml
kubectl apply -f k8s/05-processing-services.yaml
kubectl apply -f k8s/03-nginx-waf.yaml
kubectl apply -f k8s/06-applications.yaml

# Port forwarding (run each in separate terminal or use & for background)
kubectl port-forward -n waf-system service/waf-frontend 3001:3001 &
kubectl port-forward -n waf-system service/waf-social-api 8081:8081 &
kubectl port-forward -n waf-system service/waf-dashboard-api 8082:8082 &
kubectl port-forward -n waf-system service/nginx-waf-service 8080:80 &
kubectl port-forward -n waf-data service/influxdb 8086:8086 &
kubectl port-forward -n waf-data service/elasticsearch 9200:9200 &
kubectl port-forward -n waf-data service/elasticsearch 9300:9300 &
kubectl port-forward -n waf-data service/clickhouse 8123:8123 &
kubectl port-forward -n waf-data service/clickhouse 9000:9000 &
kubectl port-forward -n waf-processing service/kafka 9092:9092 &
kubectl port-forward -n waf-processing service/ksqldb 8088:8088 &
kubectl port-forward -n waf-system service/fluent-bit 2020:2020 &

# Wait for all port forwards to be ready
echo "All port forwards started. Check 'ps aux | grep kubectl' to see running processes."
```

## 📋 아키텍처 개요

### 네임스페이스 구조

```
waf-system     - WAF 핵심 컴포넌트 (Nginx, Frontend, Backend)
waf-data       - 데이터 저장소 (InfluxDB, Elasticsearch, ClickHouse, PostgreSQL, Redis)
waf-processing - 데이터 처리 (Kafka, ksqlDB, Logstash, Fluent Bit, Processors)
waf-monitoring - 모니터링 (Grafana, Kibana)
```

### 주요 컴포넌트

| 컴포넌트 | 역할 | 네임스페이스 |
|---------|------|-------------|
| Nginx WAF | ModSecurity 기반 웹 방화벽 | waf-system |
| Dashboard Frontend | React 기반 관리 인터페이스 | waf-system |
| Dashboard Backend | FastAPI 기반 API 서버 | waf-system |
| Kafka | 실시간 이벤트 스트리밍 | waf-processing |
| ksqlDB | 스트림 처리 | waf-processing |
| InfluxDB | 실시간 메트릭 저장 | waf-data |
| Elasticsearch | 로그 검색 및 분석 | waf-data |
| ClickHouse | 대용량 분석 데이터 저장 | waf-data |
| Grafana | 대시보드 및 모니터링 | waf-monitoring |
| Kibana | 로그 분석 인터페이스 | waf-monitoring |

## 🔧 설정 및 커스터마이징

### 도메인 설정

`k8s/08-ingress.yaml` 파일에서 도메인을 수정하세요:

```yaml
hosts:
  - waf.yourdomain.com        # WAF 엔드포인트
  - dashboard.yourdomain.com  # 대시보드
  - grafana.yourdomain.com    # Grafana
  - kibana.yourdomain.com     # Kibana
```

### 리소스 요구사항 조정

각 매니페스트 파일에서 `resources` 섹션을 수정하여 클러스터 환경에 맞게 조정하세요:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### 스토리지 클래스 설정

`k8s/01-storage.yaml`에서 클라우드 프로바이더에 맞는 스토리지 클래스를 설정하세요:

```yaml
# AWS EBS
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3

# GCP Persistent Disk
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd

# Azure Disk
provisioner: kubernetes.io/azure-disk
parameters:
  storageaccounttype: Premium_LRS
```

## 🔐 보안 설정

### 시크릿 업데이트

배포 전에 `k8s/02-configmaps-secrets.yaml`의 시크릿 값들을 업데이트하세요:

```bash
# Base64 인코딩된 값으로 교체
echo -n "your-new-password" | base64
```

### 네트워크 정책

네트워크 정책은 기본으로 활성화되어 있으며, 네임스페이스 간 통신을 제한합니다. 필요에 따라 `k8s/08-ingress.yaml`의 NetworkPolicy 설정을 수정하세요.

## 📊 모니터링 및 관리

### 서비스 접근 URL

포트 포워딩 후 다음 URL로 접근 가능합니다:

| 서비스 | URL | 설명 |
|--------|-----|------|
| WAF 프론트엔드 | http://localhost:3001 | 메인 대시보드 |
| Social API | http://localhost:8081 | OAuth 인증 API |
| Dashboard API | http://localhost:8082 | 백엔드 API |
| Nginx WAF | http://localhost:8080 | WAF 프록시 |
| InfluxDB | http://localhost:8086 | 메트릭 DB |
| Elasticsearch REST | http://localhost:9200 | 로그 검색 API |
| Elasticsearch Transport | localhost:9300 | 클러스터 통신 |
| ClickHouse HTTP | http://localhost:8123 | 분석 DB (HTTP) |
| ClickHouse Native | localhost:9000 | 분석 DB (Native) |
| Kafka | localhost:9092 | 메시지 브로커 |
| ksqlDB | http://localhost:8088 | 스트림 처리 |
| Fluent Bit | http://localhost:2020 | 로그 수집기 |

### 대시보드 접근

```bash
# 포트 포워딩을 통한 로컬 접근
kubectl port-forward svc/grafana 3000:3000 -n waf-monitoring
kubectl port-forward svc/kibana 5601:5601 -n waf-monitoring
```

### 상태 확인

```bash
# 모든 파드 상태 확인
kubectl get pods --all-namespaces

# 서비스 상태 확인
kubectl get services --all-namespaces

# 로그 확인
kubectl logs -f deployment/nginx-waf -n waf-system
kubectl logs -f deployment/waf-dashboard-api -n waf-system
```

### 스케일링

```bash
# 수동 스케일링
kubectl scale deployment nginx-waf --replicas=5 -n waf-system

# HPA 확인
kubectl get hpa -n waf-system
```

## 🎯 성능 최적화

### 자동 스케일링

HPA(Horizontal Pod Autoscaler)가 기본으로 설정되어 있습니다:

- Nginx WAF: 3-10 replica
- Real-time Processor: 3-10 replica
- CPU 사용률 70% 기준

### 리소스 모니터링

```bash
# 리소스 사용량 확인
kubectl top nodes
kubectl top pods --all-namespaces
```

## 🔄 업데이트 및 롤백

### 롤링 업데이트

```bash
# 이미지 업데이트
kubectl set image deployment/nginx-waf nginx-waf=waf-nginx:v2.0 -n waf-system

# 롤아웃 상태 확인
kubectl rollout status deployment/nginx-waf -n waf-system
```

### 롤백

```bash
# 롤백
kubectl rollout undo deployment/nginx-waf -n waf-system

# 롤아웃 히스토리 확인
kubectl rollout history deployment/nginx-waf -n waf-system
```

## 🧹 정리

### 전체 삭제

```bash
./deploy.sh cleanup
```

### 부분 삭제

```bash
# 특정 네임스페이스 삭제
kubectl delete namespace waf-system

# 특정 리소스 삭제
kubectl delete -f k8s/03-nginx-waf.yaml
```

## 🚨 문제 해결

### 일반적인 문제들

1. **파드가 시작되지 않음**
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   kubectl logs <pod-name> -n <namespace>
   ```

2. **스토리지 문제**
   ```bash
   kubectl get pvc --all-namespaces
   kubectl get storageclass
   ```

3. **네트워킹 문제**
   ```bash
   kubectl get ingress --all-namespaces
   kubectl describe ingress waf-ingress -n waf-system
   ```

4. **서비스 연결 문제**
   ```bash
   kubectl get endpoints --all-namespaces
   kubectl port-forward svc/<service-name> <local-port>:<service-port> -n <namespace>
   ```

### 디버그 모드

```bash
# 디버그 파드 실행
kubectl run debug --image=busybox --rm -it --restart=Never -- sh

# 네트워크 연결 테스트
kubectl run netshoot --image=nicolaka/netshoot --rm -it --restart=Never -- bash
```

## 📚 추가 자료

- [Docker Compose 설정](./README-DOCKER_SETUP.md)
- [대시보드 가이드](./README-DASHBOARD.md)
- [성능 튜닝 가이드](./docs/performance-tuning.md)
- [보안 가이드](./docs/security-guide.md)

## 🤝 기여하기

이슈나 기능 제안은 GitHub Issues를 통해 제출해 주세요.

## 📄 라이선스

MIT License
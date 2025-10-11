# 🚀 WAF Platform - Kubernetes Deployment Guide

WAF 플랫폼을 Kubernetes 클러스터에 배포하는 방법을 설명합니다.

---

## 📋 목차

1. [빠른 시작](#-빠른-시작)
2. [사전 요구사항](#-사전-요구사항)
3. [배포 방법](#-배포-방법)
4. [아키텍처 개요](#-아키텍처-개요)
5. [서비스 접근](#-서비스-접근)
6. [관리 및 운영](#-관리-및-운영)
7. [문제 해결](#-문제-해결)
8. [추가 문서](#-추가-문서)

---

## ⚡ 빠른 시작

### 1단계: 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# 필수 값 입력 (JWT_SECRET, Google OAuth, InfluxDB 등)
vim .env
```

자세한 환경 변수 설정은 [환경 변수 설정 가이드](docs/ENVIRONMENT_SETUP.md)를 참고하세요.

### 2단계: Docker 이미지 빌드

```bash
# Backend APIs
docker build -t waf-dashboard-api:latest -f backend/waf-dashboard-api/Dockerfile backend/waf-dashboard-api
docker build -t waf-social-api:latest -f backend/waf-social-api/Dockerfile backend/waf-social-api

# Frontend
docker build -t waf-frontend:latest -f frontend/Dockerfile.dev frontend

# NGINX WAF
docker build -t nginx-waf:latest -f nginx/Dockerfile nginx
```

### 3단계: Kubernetes 배포

```bash
# 자동 배포 (추천)
./k8s-startup.sh

# 또는 환경별 배포
./k8s-startup.sh .env.dev      # 개발 환경
./k8s-startup.sh .env.staging  # 스테이징 환경
./k8s-startup.sh .env.prod     # 프로덕션 환경
```

### 4단계: 포트 포워딩

```bash
# 모든 서비스 포트 포워딩 (백그라운드)
./k8s-port-forward.sh
```

### 5단계: 서비스 접근

- **Frontend**: http://localhost:3001
- **Social API**: http://localhost:8081
- **Dashboard API**: http://localhost:8082
- **NGINX WAF**: http://localhost:8080
- **InfluxDB UI**: http://localhost:8086

---

## 🔧 사전 요구사항

### 필수 도구

```bash
# kubectl 설치 확인
kubectl version --client

# Docker 설치 확인
docker version

# envsubst 설치 확인 (환경 변수 치환용)
envsubst --version

# envsubst가 없는 경우:
# macOS
brew install gettext && brew link --force gettext

# Linux
sudo apt-get install gettext-base
```

### Kubernetes 클러스터

- **로컬 개발**: Docker Desktop, Minikube, Kind
- **클라우드**: GKE, EKS, AKS
- **최소 리소스**: 16GB RAM, 8 CPU 코어

```bash
# 클러스터 연결 확인
kubectl cluster-info
kubectl get nodes
```

---

## 📦 배포 방법

### 방법 1: 자동 배포 스크립트 (권장) ⭐

최신 자동화 스크립트를 사용하는 가장 쉬운 방법입니다.

```bash
# 기본 환경 (.env) 배포
./k8s-startup.sh

# 특정 환경 배포
./k8s-startup.sh .env.dev      # 개발
./k8s-startup.sh .env.staging  # 스테이징
./k8s-startup.sh .env.prod     # 프로덕션
```

**스크립트가 자동으로 수행하는 작업:**
1. ✅ 환경 변수 검증
2. ✅ Docker 이미지 확인/빌드
3. ✅ Kubernetes Secret 생성
4. ✅ ConfigMap 생성 (환경 변수 치환)
5. ✅ 모든 리소스 순차 배포
6. ✅ Pod 준비 상태 대기
7. ✅ 배포 상태 표시

**실행 시간**: 약 5-10분

---

### 방법 2: 빠른 재시작 (환경 변수 변경 시)

이미 배포된 상태에서 환경 변수만 변경한 경우:

```bash
# .env 파일 수정
vim .env

# 빠른 재시작 (2-3분 소요)
./k8s-restart.sh

# 또는 특정 환경
./k8s-restart.sh .env.staging
```

**언제 사용하나요?**
- JWT_SECRET 변경
- OAuth 설정 변경
- 도메인 설정 변경
- 데이터베이스 자격 증명 변경

---

### 방법 3: 환경별 헬퍼 스크립트

더 간편한 배포를 위한 바로가기 스크립트:

```bash
# 개발 환경
./k8s-deploy-dev.sh

# 스테이징 환경
./k8s-deploy-staging.sh

# 프로덕션 환경 (확인 프롬프트 포함)
./k8s-deploy-prod.sh
```

---

### 방법 4: 수동 배포 (고급 사용자)

세밀한 제어가 필요한 경우:

```bash
# 1. 환경 변수 로드
export $(grep -v '^#' .env | sed 's/\r$//' | xargs)

# 2. Namespace 생성
kubectl apply -f k8s/00-namespaces.yaml

# 3. Storage 설정
kubectl apply -f k8s/01-storage.yaml

# 4. Secret 생성
kubectl create secret generic waf-auth-secrets \
  --from-literal=google-client-id="$GOOGLE_CLIENT_ID" \
  --from-literal=google-client-secret="$GOOGLE_CLIENT_SECRET" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
  -n waf-system

# 5. ConfigMap 생성 (환경 변수 치환)
envsubst < k8s/02-configmaps-only.yaml | kubectl apply -f -

# 6. Data Stores 배포
kubectl apply -f k8s/04-data-stores.yaml

# 7. Processing Services 배포
kubectl apply -f k8s/05-processing-services.yaml

# 8. NGINX WAF 배포
kubectl apply -f k8s/03-nginx-waf.yaml

# 9. Applications 배포
kubectl apply -f k8s/06-applications.yaml

# 10. 포트 포워딩
./k8s-port-forward.sh
```

---

## 🏗️ 아키텍처 개요

### 네임스페이스 구조

```
waf-system     - WAF 핵심 컴포넌트 (Nginx, Frontend, Backend APIs)
waf-data       - 데이터 저장소 (InfluxDB, Elasticsearch, ClickHouse)
waf-processing - 데이터 처리 (Kafka, ksqlDB, Logstash, Fluent Bit)
waf-monitoring - 모니터링 (Grafana, Kibana)
```

### 주요 컴포넌트

| 컴포넌트 | 역할 | 네임스페이스 | 포트 |
|---------|------|-------------|------|
| **NGINX WAF** | ModSecurity 기반 웹 방화벽 | waf-system | 8080 |
| **Frontend** | Next.js 기반 대시보드 UI | waf-system | 3001 |
| **Social API** | OAuth 인증 서비스 | waf-system | 8081 |
| **Dashboard API** | Spring Boot 백엔드 API | waf-system | 8082 |
| **Kafka** | 실시간 이벤트 스트리밍 | waf-processing | 9092 |
| **ksqlDB** | 스트림 처리 엔진 | waf-processing | 8088 |
| **Fluent Bit** | 로그 수집기 | waf-system | 2020 |
| **Logstash** | 로그 변환 및 전송 | waf-processing | 5044 |
| **InfluxDB** | 실시간 메트릭 저장 | waf-data | 8086 |
| **Elasticsearch** | 로그 검색 및 분석 | waf-data | 9200 |
| **ClickHouse** | 대용량 분석 데이터 | waf-data | 8123 |
| **Grafana** | 대시보드 및 모니터링 | waf-monitoring | 3000 |
| **Kibana** | 로그 분석 인터페이스 | waf-monitoring | 5601 |

### 데이터 플로우

```
User Request
    ↓
NGINX WAF (ModSecurity)
    ↓
├─→ Application (Protected)
└─→ Fluent Bit → Kafka
                    ↓
                ksqlDB (Stream Processing)
                    ↓
            ┌───────┴────────┐
            ↓                ↓
    Real-time Track    Analytics Track
    (InfluxDB)        (Logstash → Elasticsearch)
            ↓                ↓
        Grafana          Kibana
```

---

## 🌐 서비스 접근

### 포트 포워딩으로 접근

```bash
# 모든 서비스 포트 포워딩 (백그라운드)
./k8s-port-forward.sh

# 개별 포트 포워딩 (별도 터미널)
kubectl port-forward -n waf-system service/waf-frontend 3001:3001
kubectl port-forward -n waf-system service/waf-social-api 8081:8081
kubectl port-forward -n waf-system service/waf-dashboard-api 8082:8082
kubectl port-forward -n waf-system service/nginx-waf-service 8080:80
kubectl port-forward -n waf-data service/influxdb 8086:8086
kubectl port-forward -n waf-data service/elasticsearch 9200:9200
kubectl port-forward -n waf-data service/clickhouse 8123:8123
kubectl port-forward -n waf-processing service/kafka 9092:9092
kubectl port-forward -n waf-processing service/ksqldb 8088:8088
```

### 접근 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **WAF Frontend** | http://localhost:3001 | 메인 대시보드 UI |
| **Social API** | http://localhost:8081 | OAuth 인증 API |
| **Dashboard API** | http://localhost:8082 | 백엔드 REST API |
| **NGINX WAF** | http://localhost:8080 | WAF 프록시 엔드포인트 |
| **InfluxDB UI** | http://localhost:8086 | 메트릭 데이터베이스 |
| **Elasticsearch** | http://localhost:9200 | 로그 검색 API |
| **ClickHouse HTTP** | http://localhost:8123 | 분석 데이터베이스 |
| **Kafka** | localhost:9092 | 메시지 브로커 |
| **ksqlDB** | http://localhost:8088 | 스트림 처리 |
| **Grafana** | http://localhost:3000 | 모니터링 대시보드 |
| **Kibana** | http://localhost:5601 | 로그 분석 UI |

### NodePort를 통한 접근

클러스터 외부에서 직접 접근하려면:

```bash
# NodePort 서비스 확인
kubectl get svc -n waf-system | grep NodePort

# 접근 예시 (Minikube)
minikube service waf-frontend-nodeport -n waf-system
```

---

## 🛠️ 관리 및 운영

### 상태 확인

```bash
# 모든 Pod 상태 확인
kubectl get pods -A | grep waf

# 특정 네임스페이스
kubectl get pods -n waf-system
kubectl get pods -n waf-data
kubectl get pods -n waf-processing

# 서비스 상태 확인
kubectl get svc -n waf-system

# 배포 상태 확인
kubectl get deployments -n waf-system
```

### 로그 확인

```bash
# 실시간 로그 확인
kubectl logs -f -n waf-system deployment/waf-frontend
kubectl logs -f -n waf-system deployment/waf-social-api
kubectl logs -f -n waf-system deployment/nginx-waf

# 특정 Pod 로그
kubectl logs -f -n waf-system <pod-name>

# 여러 Pod의 로그 (label selector)
kubectl logs -f -l app=waf-frontend -n waf-system
```

### 리소스 사용량 모니터링

```bash
# 노드 리소스 확인
kubectl top nodes

# Pod 리소스 확인
kubectl top pods -n waf-system
kubectl top pods -n waf-data
kubectl top pods -n waf-processing
```

### 스케일링

```bash
# 수동 스케일링
kubectl scale deployment nginx-waf --replicas=5 -n waf-system
kubectl scale deployment waf-frontend --replicas=3 -n waf-system

# 현재 replica 수 확인
kubectl get deployment -n waf-system

# HPA 확인 (있는 경우)
kubectl get hpa -n waf-system
```

### 업데이트 및 롤백

```bash
# 롤링 업데이트
kubectl rollout restart deployment/waf-social-api -n waf-system

# 이미지 업데이트
kubectl set image deployment/waf-social-api \
  waf-social-api=waf-social-api:v2.0 -n waf-system

# 롤아웃 상태 확인
kubectl rollout status deployment/waf-social-api -n waf-system

# 롤백
kubectl rollout undo deployment/waf-social-api -n waf-system

# 롤아웃 히스토리
kubectl rollout history deployment/waf-social-api -n waf-system
```

---

## 🔐 보안 설정

### Secret 관리

```bash
# Secret 확인
kubectl get secrets -n waf-system

# Secret 내용 확인 (base64 디코딩)
kubectl get secret waf-auth-secrets -n waf-system -o jsonpath='{.data.jwt-secret}' | base64 -d

# Secret 업데이트
kubectl delete secret waf-auth-secrets -n waf-system
kubectl create secret generic waf-auth-secrets \
  --from-literal=jwt-secret="new-secret" \
  -n waf-system

# 또는 k8s-restart.sh 사용
./k8s-restart.sh
```

### ConfigMap 관리

```bash
# ConfigMap 확인
kubectl get configmap -n waf-system

# ConfigMap 내용 확인
kubectl get configmap waf-config -n waf-system -o yaml

# ConfigMap 업데이트
# .env 파일 수정 후
./k8s-restart.sh
```

---

## 🧹 정리 및 삭제

### 전체 삭제

```bash
# 자동 정리 스크립트
./k8s-cleanup.sh

# 확인 프롬프트가 나타나고 'y' 입력 시 모든 리소스 삭제
```

### 부분 삭제

```bash
# 특정 애플리케이션만 삭제
kubectl delete -f k8s/06-applications.yaml

# 특정 네임스페이스 삭제
kubectl delete namespace waf-system

# 특정 Deployment 삭제
kubectl delete deployment nginx-waf -n waf-system
```

### 포트 포워딩 중지

```bash
# 모든 kubectl port-forward 프로세스 종료
pkill -f 'kubectl port-forward'

# 실행 중인 포트 포워딩 확인
ps aux | grep 'kubectl port-forward'
```

---

## 🚨 문제 해결

### Pod가 시작되지 않음

```bash
# Pod 상세 정보 확인
kubectl describe pod <pod-name> -n <namespace>

# Pod 로그 확인
kubectl logs <pod-name> -n <namespace>

# 이전 컨테이너 로그 확인 (재시작된 경우)
kubectl logs <pod-name> -n <namespace> --previous
```

**일반적인 원인:**
1. Docker 이미지가 없음 → 이미지 빌드 확인
2. Secret/ConfigMap이 없음 → `./k8s-startup.sh` 재실행
3. 리소스 부족 → `kubectl top nodes` 확인

### ImagePullBackOff 오류

```bash
# 이미지가 로컬에 있는지 확인
docker images | grep waf

# Minikube 사용 시
eval $(minikube docker-env)
docker build -t waf-social-api:latest ...
```

### CrashLoopBackOff 오류

```bash
# Pod 로그 확인
kubectl logs <pod-name> -n <namespace>

# Pod 이벤트 확인
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

**일반적인 원인:**
1. 환경 변수 누락 → `.env` 파일 확인
2. 데이터베이스 연결 실패 → 데이터 스토어 Pod 상태 확인
3. 포트 충돌 → Service 설정 확인

### ConfigMap/Secret 변경이 적용 안됨

```bash
# ConfigMap/Secret 변경 후 Pod 재시작 필요
./k8s-restart.sh

# 또는 수동으로
kubectl rollout restart deployment -n waf-system
```

### 서비스에 접근할 수 없음

```bash
# Service 확인
kubectl get svc -n <namespace>

# Endpoints 확인
kubectl get endpoints -n <namespace>

# 포트 포워딩 재시작
pkill -f 'kubectl port-forward'
./k8s-port-forward.sh
```

### 디버그 모드

```bash
# 디버그 Pod 실행
kubectl run debug --image=busybox --rm -it --restart=Never -- sh

# 네트워크 연결 테스트
kubectl run netshoot --image=nicolaka/netshoot --rm -it --restart=Never -- bash

# Pod 내부 접속
kubectl exec -it <pod-name> -n <namespace> -- /bin/bash
```

---

## 📚 추가 문서

상세한 가이드는 다음 문서를 참고하세요:

- **[Kubernetes 배포 가이드](docs/K8S_DEPLOYMENT_GUIDE.md)** - 상세한 배포 방법 및 시나리오
- **[다중 환경 배포 가이드](docs/K8S_MULTI_ENV_GUIDE.md)** - Dev/Staging/Prod 환경 관리
- **[환경 변수 설정 가이드](docs/ENVIRONMENT_SETUP.md)** - 환경 변수 상세 설명
- **[Docker Compose 설정](README-DOCKER_SETUP.md)** - Docker Compose로 로컬 개발
- **[대시보드 가이드](README-DASHBOARD.md)** - 대시보드 사용법

---

## 💡 베스트 프랙티스

### 1. 환경별 배포

```bash
# 개발: 로컬에서 테스트
./k8s-startup.sh .env.dev

# 스테이징: 통합 테스트
./k8s-startup.sh .env.staging

# 프로덕션: 실제 서비스
./k8s-deploy-prod.sh  # 확인 프롬프트 포함
```

### 2. 환경 변수 관리

- ✅ 환경별로 별도 파일 사용 (`.env.dev`, `.env.prod`)
- ✅ 비밀번호는 환경마다 다르게 설정
- ✅ `.env` 파일은 절대 Git에 커밋하지 않기
- ✅ `.env.example`은 템플릿으로 관리

### 3. 모니터링

```bash
# 정기적으로 리소스 확인
kubectl top nodes
kubectl top pods -A

# 로그 모니터링
kubectl logs -f -l app=nginx-waf -n waf-system
```

### 4. 백업

```bash
# ConfigMap/Secret 백업
kubectl get configmap -n waf-system -o yaml > backup/configmaps.yaml
kubectl get secret -n waf-system -o yaml > backup/secrets.yaml

# PV 데이터 백업 (중요!)
# - InfluxDB, Elasticsearch, ClickHouse 데이터
```

---

## 🤝 기여하기

이슈나 기능 제안은 GitHub Issues를 통해 제출해 주세요.

---

## 📄 라이선스

MIT License

---

**마지막 업데이트:** 2025-01-11

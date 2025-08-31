# 🐳 WAF Docker 설치 및 설정 가이드

## 🎯 개요

통합 Docker Compose 환경으로 전체 WAF 시스템을 쉽게 배포하고 관리하는 방법을 설명합니다.

## 📋 시스템 요구사항

### **하드웨어 최소 요구사항**
- **CPU**: 4코어 이상 권장
- **메모리**: 8GB RAM 최소, 16GB 권장
- **디스크**: 20GB 이상 (로그 및 데이터 저장)
- **네트워크**: 인터넷 연결 (Docker 이미지 다운로드 및 OAuth)

### **소프트웨어 요구사항**
- **Docker Engine**: 20.10 이상
- **Docker Compose**: v2.0 이상
- **운영체제**: Linux, macOS, Windows (Docker Desktop)

## 🚀 빠른 시작

### **1. 통합 실행 (권장 방법)**

```bash
# 저장소 클론
git clone https://github.com/rojae/waf
cd waf

# 통합 스타트업 스크립트 실행
./startup.sh
```

### **2. startup.sh 옵션**

#### **기본 실행**
```bash
./startup.sh
```
- 기존 이미지로 빠른 시작
- 개발 완료된 서비스 실행시 사용

#### **전체 빌드 후 실행**
```bash
./startup.sh --build
# 또는
./startup.sh -b
```
- 모든 서비스를 빌드 후 실행
- 코드 변경사항 반영 필요시 사용

#### **백엔드만 빌드**
```bash
./startup.sh --build-backend
```
- `waf-dashboard-api`, `waf-social-api`만 빌드
- Java 코드 수정 후 사용

#### **프론트엔드만 빌드**
```bash
./startup.sh --build-frontend
```
- `waf-frontend`만 빌드
- React/Next.js 코드 수정 후 사용

### **3. 수동 실행 (고급 사용자)**

```bash
# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 후

# 전체 시스템 실행
docker-compose up -d

# 특정 서비스만 실행
docker-compose up -d nginx kafka influxdb
```

## 🏗️ Docker 서비스 아키텍처

### **핵심 인프라 서비스**

| 서비스명 | 컨테이너명 | 포트 | 역할 | 상태 |
|---------|-----------|------|------|------|
| **nginx** | `waf-nginx` | 8080 | WAF + 웹서버 | ✅ |
| **kafka** | `waf-kafka` | 9092 | 메시지 스트리밍 | ✅ |
| **influxdb** | `waf-influxdb` | 8086 | 시계열 데이터베이스 | ✅ |
| **elasticsearch** | `waf-elasticsearch` | 9200 | 로그 검색 엔진 | ✅ |
| **logstash** | `waf-logstash` | 5044 | ETL 파이프라인 | ✅ |
| **kibana** | `waf-kibana` | 5601 | 로그 분석 대시보드 | ✅ |
| **grafana** | `waf-grafana` | 3000 | 메트릭 대시보드 | ✅ |
| **redis** | `waf-redis` | 6379 | 세션 저장소 | ✅ |

### **처리 서비스**

| 서비스명 | 컨테이너명 | 포트 | 역할 | 상태 |
|---------|-----------|------|------|------|
| **fluent-bit** | `waf-fluent-bit` | 2020 | 로그 라우터 | ✅ |
| **realtime-processor** | `waf-realtime-processor` | - | 실시간 처리기 | ✅ |
| **ksqldb** | `waf-ksqldb` | 8088 | 스트림 처리기 | ✅ |

### **애플리케이션 서비스**

| 서비스명 | 컨테이너명 | 포트 | 역할 | 상태 |
|---------|-----------|------|------|------|
| **waf-frontend** | `waf-frontend` | 3001 | 관리 대시보드 | ✅ |
| **waf-dashboard-api** | `waf-dashboard-api` | 8082 | 대시보드 API | ✅ |
| **waf-social-api** | `waf-social-api` | 8081 | OAuth API | ✅ |

## ⚙️ 환경 설정

### **필수 환경 변수 (.env 파일)**

```bash
# Google OAuth 설정 (대시보드 로그인용)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 인증 시크릿
NEXTAUTH_SECRET=change-me-in-production-secret-key
JWT_SECRET=change-me-to-32-bytes-secret-key

# InfluxDB 토큰 (실시간 메트릭)
INFLUXDB_TOKEN=your-secure-influxdb-token
```

### **Google OAuth 설정**

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보" 이동
4. OAuth 2.0 클라이언트 ID 생성
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI: `http://localhost:3001/api/auth/callback/google`
5. 클라이언트 ID와 클라이언트 시크릿을 `.env` 파일에 설정

## 🔧 개발 환경 설정

### **로컬 개발 워크플로우**

```bash
# 1. Java 백엔드 개발시
./startup.sh --build-backend

# 2. 프론트엔드 개발시
./startup.sh --build-frontend

# 3. 인프라 변경시
./startup.sh --build

# 4. 특정 서비스 재시작
docker-compose restart waf-dashboard-api

# 5. 로그 확인
docker logs -f waf-dashboard-api
```

### **개발자 도구**

```bash
# 전체 시스템 상태 확인
docker-compose ps

# 특정 서비스 로그 실시간 확인
docker logs -f waf-realtime-processor

# 컨테이너 리소스 사용량
docker stats

# Kafka 토픽 확인
docker exec waf-kafka kafka-topics --bootstrap-server localhost:9092 --list

# InfluxDB 데이터 확인
docker exec waf-influxdb influx query 'SHOW MEASUREMENTS'
```

## 📊 서비스 접속 URL

### **사용자 인터페이스**
- **WAF 관리 대시보드**: http://localhost:3001 (Google 로그인 필요)
- **Grafana 모니터링**: http://localhost:3000 (admin/admin)
- **Kibana 로그 분석**: http://localhost:5601

### **개발자 API**
- **대시보드 API**: http://localhost:8082
- **OAuth API**: http://localhost:8081
- **Elasticsearch**: http://localhost:9200
- **InfluxDB**: http://localhost:8086
- **ksqlDB**: http://localhost:8088

### **실시간 데이터 확인**
- **Fluent Bit Health**: http://localhost:2020/api/v1/health
- **Kafka Bootstrap**: localhost:9092

## 🐛 문제 해결

### **일반적인 문제**

#### **1. 포트 충돌**
```bash
# 사용 중인 포트 확인
lsof -i :3001  # 대시보드 포트
lsof -i :8080  # WAF 포트

# 서비스 종료
docker-compose down
```

#### **2. 메모리 부족**
```bash
# 메모리 사용량 확인
docker stats

# 불필요한 컨테이너 정리
docker system prune

# Java 힙 사이즈 조정 (docker-compose.yml)
environment:
  - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
```

#### **3. Google OAuth 오류**
```bash
# 리디렉션 URI 확인
# Google Console에서 정확한 URI 설정:
http://localhost:3001/api/auth/callback/google

# 환경 변수 확인
docker exec waf-frontend env | grep GOOGLE
```

#### **4. 서비스 시작 순서 문제**
```bash
# 의존성 순서로 재시작
docker-compose down
docker-compose up -d kafka
sleep 10
docker-compose up -d
```

### **로그 디버깅**

```bash
# 전체 서비스 로그
docker-compose logs -f

# 특정 서비스 오류 로그
docker logs waf-dashboard-api --tail 100

# 실시간 처리 파이프라인 디버깅
docker logs waf-fluent-bit | grep ERROR
docker logs waf-realtime-processor | grep "level=error"
```

## 🔒 보안 고려사항

### **프로덕션 배포시**
- `.env` 파일을 Git에 커밋하지 않음
- 강력한 JWT 시크릿 사용 (최소 32바이트)
- InfluxDB 토큰 정기 변경
- 방화벽 규칙으로 불필요한 포트 차단

### **네트워크 보안**
```bash
# Docker 네트워크 격리
docker network create --driver bridge waf-network

# 외부 접근 제한 (프로덕션)
ports:
  - "127.0.0.1:9200:9200"  # Elasticsearch 로컬만 접근
```

## 📈 모니터링 및 유지보수

### **일일 점검 항목**
```bash
# 시스템 상태 확인
./scripts/health-check.sh

# 디스크 사용량 확인
du -sh /var/lib/docker/

# 로그 파일 크기 확인
docker system df
```

### **주기적 유지보수**
```bash
# 로그 파일 정리 (주간)
docker system prune

# 이미지 업데이트 (월간)
docker-compose pull
docker-compose up -d

# 데이터 백업 (일간)
./scripts/backup.sh
```

## 🚀 확장 및 최적화

### **고트래픽 환경 최적화**
```yaml
# docker-compose.override.yml
services:
  nginx:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
  
  kafka:
    environment:
      KAFKA_NUM_NETWORK_THREADS: 8
      KAFKA_NUM_IO_THREADS: 16
```

### **수평 확장**
```bash
# 처리 서비스 스케일 아웃
docker-compose up -d --scale realtime-processor=3
docker-compose up -d --scale logstash=2
```

---

**💡 도움말**: Docker 관련 문제 발생시 `./startup.sh --build` 로 전체 재빌드를 먼저 시도해보세요.
# 🚀 WAF Dashboard - Docker Compose 실행 가이드

## 📋 사전 준비

### 1. **환경 변수 설정**
```bash
# .env 파일 생성
cp .env.example .env

# Google OAuth 설정 (필수)
vim .env
```

**.env 파일 예시:**
```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NEXTAUTH_SECRET=your-32-character-secret-key-here
INFLUXDB_TOKEN=admin-token-change-me
```

### 2. **Google OAuth 설정**

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services > Credentials** 이동
4. **Create Credentials > OAuth 2.0 Client IDs** 선택
5. **Application type**: Web application
6. **Authorized redirect URIs** 추가:
   - `http://localhost:3001/api/auth/callback/google`
7. **Client ID**와 **Client Secret**을 `.env` 파일에 추가

## 🐋 Docker Compose 실행

### **전체 스택 실행**
```bash
# 모든 서비스 실행 (백그라운드)
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그만 확인
docker-compose logs -f waf-frontend waf-dashboard-api
```

### **서비스별 접속 URL**

| 서비스 | URL | 설명 |
|--------|-----|------|
| **WAF 대시보드** | http://localhost:3001 | 관리자용 웹 대시보드 |
| **Grafana** | http://localhost:3000 | 실시간 모니터링 (admin/admin) |
| **Kibana** | http://localhost:5601 | 로그 분석 |
| **WAF Nginx** | http://localhost:8080 | 실제 WAF (테스트용) |

### **개발 환경 실행 (선택사항)**
```bash
# 백엔드만 실행
docker-compose up -d redis elasticsearch influxdb
cd backend && ./gradlew :waf-dashboard-api:bootRun

# 프론트엔드만 실행  
cd frontend && npm run dev
```

## 🔧 문제 해결

### **일반적인 문제들**

#### 1. **포트 충돌**
```bash
# 사용 중인 포트 확인
lsof -i :3001 -i :8082 -i :3000

# 충돌하는 프로세스 종료
kill -9 <PID>
```

#### 2. **Docker 메모리 부족**
```bash
# Docker Desktop에서 메모리 8GB 이상으로 설정
# 또는 불필요한 서비스 제거
docker-compose up -d waf-frontend waf-dashboard-api waf-social-api redis elasticsearch
```

#### 3. **Google OAuth 오류**
- `.env` 파일의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 확인
- Google Cloud Console에서 Redirect URI 정확성 확인
- `http://localhost:3001/api/auth/callback/google` 등록 필수

#### 4. **서비스 의존성 문제**
```bash
# 의존성 순서로 재시작
docker-compose down
docker-compose up -d redis elasticsearch influxdb
# 30초 대기 후
docker-compose up -d waf-dashboard-api waf-social-api
docker-compose up -d waf-frontend
```

### **로그 확인**
```bash
# 전체 서비스 상태 확인
docker-compose ps

# 특정 서비스 로그 확인
docker-compose logs waf-frontend
docker-compose logs waf-dashboard-api
docker-compose logs redis

# 실시간 로그 추적
docker-compose logs -f --tail=100 waf-frontend
```

### **데이터 초기화**
```bash
# 모든 데이터 삭제 (주의!)
docker-compose down -v

# 특정 볼륨만 삭제
docker volume rm waf_redis-data
docker volume rm waf_es-data
```

## 🎯 테스트 방법

### **1. 기본 접속 테스트**
1. http://localhost:3001 접속
2. Google 로그인 진행
3. 대시보드 정상 로딩 확인

### **2. WAF 룰 테스트**
1. **Rules** 메뉴에서 새 룰 생성
2. Pattern: `(?i)(test|admin)`
3. Action: `BLOCK`
4. 룰 저장 후 활성화

### **3. 실시간 알림 테스트**
1. **Alerts** 메뉴 접속
2. 브라우저 개발자 도구 > Network 탭에서 SSE 연결 확인
3. 30초마다 모의 알림 수신 확인

## 📊 성능 최적화

### **메모리 사용량 최적화**
```yaml
# docker-compose.yml에서 불필요한 서비스 주석 처리
# - nikto (보안 스캔 도구)
# - clickhouse (대용량 분석 불필요시)
# - alert-processor (알림 불필요시)
```

### **개발환경 최적화**
```bash
# 개발용 최소 구성
docker-compose up -d redis elasticsearch waf-dashboard-api waf-frontend
```

## 🔒 보안 고려사항

1. **프로덕션 환경에서 반드시 변경:**
   - `NEXTAUTH_SECRET`: 32자 이상 랜덤 문자열
   - `INFLUXDB_TOKEN`: 강력한 토큰으로 변경
   - Grafana 기본 비밀번호 (admin/admin) 변경

2. **방화벽 설정:**
   - 외부 접근이 필요한 포트만 오픈 (3001)
   - 내부 서비스 포트들은 localhost만 바인딩

3. **HTTPS 설정:**
   - 프로덕션에서는 SSL/TLS 인증서 적용
   - Google OAuth Redirect URI를 HTTPS로 변경

---

**개발 완료**: Docker Compose 기반 완전 통합 WAF 대시보드 🚀
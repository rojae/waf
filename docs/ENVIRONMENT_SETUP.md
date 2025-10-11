# 🔐 환경 변수 설정 가이드

## 📋 개요

WAF 프로젝트는 보안을 위해 모든 중요한 설정을 환경 변수로 관리합니다.
이 문서는 프로젝트를 처음 시작하는 사용자를 위한 환경 변수 설정 가이드입니다.

---

## 🚀 빠른 시작

### 1단계: 환경 파일 생성

```bash
# 프로젝트 루트 디렉토리에서
cp .env.example .env
```

### 2단계: 필수 시크릿 생성

```bash
# JWT 시크릿 생성 (32+ 바이트 권장)
openssl rand -base64 32
# 출력 예: Kd3351zCj8IkFPiLMiEXEgf6I5br5_zIuTUfbnEI8nRl...

# NextAuth 시크릿 생성
openssl rand -base64 32
# 출력 예: HdxgWLvNa4c9zqWCy2kDAlIVaWo3e-8VuN1WtHtVhg==
```

### 3단계: `.env` 파일 편집

생성된 시크릿을 `.env` 파일에 입력합니다:

```bash
vim .env
# 또는
nano .env
# 또는
code .env  # VS Code 사용시
```

---

## 📝 환경 변수 상세 설명

### 🔑 인증 & 보안 (필수)

| 환경 변수 | 설명 | 생성 방법 | 예시 |
|----------|------|----------|------|
| `JWT_SECRET` | JWT 토큰 서명용 시크릿 | `openssl rand -base64 32` | 32+ 바이트 랜덤 문자열 |
| `NEXTAUTH_SECRET` | NextAuth.js 세션 암호화 | `openssl rand -base64 32` | 32+ 바이트 랜덤 문자열 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | Google Cloud Console | `GOCSPX-xxx` |

### 🗄️ 데이터베이스 (필수)

| 환경 변수 | 기본값 | 설명 |
|----------|--------|------|
| `INFLUXDB_ADMIN_USERNAME` | `admin` | InfluxDB 관리자 계정 |
| `INFLUXDB_ADMIN_PASSWORD` | `changeme_influxdb_password` | ⚠️ 반드시 변경 |
| `INFLUXDB_TOKEN` | (생성 필요) | InfluxDB API 토큰 (아래 참조) |
| `INFLUXDB_ORG` | `waf-org` | InfluxDB 조직명 |
| `INFLUXDB_BUCKET` | `waf-realtime` | InfluxDB 버킷명 |
| `CLICKHOUSE_USER` | `admin` | ClickHouse 사용자명 |
| `CLICKHOUSE_PASSWORD` | `changeme_clickhouse_password` | ⚠️ 반드시 변경 |
| `CLICKHOUSE_DB` | `waf_analytics` | ClickHouse 데이터베이스명 |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana 관리자 계정 |
| `GRAFANA_ADMIN_PASSWORD` | `changeme_grafana_password` | ⚠️ 반드시 변경 |

### 🌐 도메인 설정 (선택)

| 환경 변수 | 로컬 개발 기본값 | 프로덕션 예시 |
|----------|---------------|-------------|
| `DOMAIN` | `http://localhost:3001` | `https://waf.company.com` |
| `OAUTH_CALLBACK_BASE_URL` | `http://localhost:8081` | `https://api.waf.company.com` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `http://localhost:8081/login/oauth2/code/google` | `https://api.waf.company.com/login/oauth2/code/google` |
| `OAUTH_DEFAULT_REDIRECT_URL` | `http://localhost:3001` | `https://waf.company.com` |
| `COOKIE_DOMAIN` | `localhost` | `waf.company.com` |

---

## 🔧 특별 설정: InfluxDB 토큰 생성

InfluxDB 토큰은 서비스를 시작한 후 웹 UI를 통해 생성해야 합니다:

### 방법 1: 자동 설정 (권장)

처음 시작 시 InfluxDB가 자동으로 토큰을 생성합니다. `.env` 파일의 기본 토큰을 그대로 사용하면 됩니다.

### 방법 2: 수동 생성

1. **InfluxDB 서비스 시작**
   ```bash
   docker-compose up -d influxdb
   ```

2. **InfluxDB UI 접속**
   - URL: http://localhost:8086
   - 초기 설정 화면에서 계정 생성

3. **토큰 생성**
   - 좌측 메뉴: **Load Data** → **API Tokens**
   - **Generate API Token** → **All Access Token**
   - 생성된 토큰 복사

4. **`.env` 파일에 입력**
   ```bash
   INFLUXDB_TOKEN=생성된_토큰_값
   ```

---

## 📦 Docker Compose에서 사용되는 환경 변수

`docker-compose.yml` 파일은 다음 환경 변수를 참조합니다:

### InfluxDB
```yaml
environment:
  - DOCKER_INFLUXDB_INIT_USERNAME=${INFLUXDB_ADMIN_USERNAME}
  - DOCKER_INFLUXDB_INIT_PASSWORD=${INFLUXDB_ADMIN_PASSWORD}
  - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
  - INFLUXDB_ORG=${INFLUXDB_ORG}
  - INFLUXDB_BUCKET=${INFLUXDB_BUCKET}
```

### ClickHouse
```yaml
environment:
  - CLICKHOUSE_USER=${CLICKHOUSE_USER}
  - CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
  - CLICKHOUSE_DB=${CLICKHOUSE_DB}
```

### Grafana
```yaml
environment:
  - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER}
  - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
```

---

## ☸️ Kubernetes ConfigMap 설정

Kubernetes 배포 시 환경 변수는 ConfigMap으로 관리됩니다:

### ConfigMap 생성

```bash
# 환경 변수를 ConfigMap으로 변환
export DOMAIN=http://localhost:3001
export INFLUXDB_TOKEN=your-token-here

# ConfigMap 생성
envsubst < k8s/02-configmaps-secrets.yaml | kubectl apply -f -
```

### Secret 생성

```bash
# JWT 시크릿을 base64로 인코딩
echo -n "your-jwt-secret" | base64

# Kubernetes Secret에 추가
kubectl create secret generic waf-auth-secrets \
  --from-literal=jwt-secret=your-jwt-secret \
  --from-literal=google-client-id=your-client-id \
  --from-literal=google-client-secret=your-client-secret \
  -n waf-system
```

---

## ✅ 보안 체크리스트

프로덕션 배포 전 반드시 확인하세요:

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 모든 기본 비밀번호를 변경했는지 확인
- [ ] JWT_SECRET이 32바이트 이상인지 확인
- [ ] Google OAuth 설정이 프로덕션 도메인에 맞게 설정되었는지 확인
- [ ] InfluxDB 토큰이 생성되었는지 확인
- [ ] 프로덕션 환경에서는 `COOKIE_DOMAIN`을 실제 도메인으로 변경
- [ ] 프로덕션 환경에서는 `NODE_ENV=production` 설정

---

## 🐛 문제 해결

### 문제 1: "JWT_SECRET이 설정되지 않았습니다"

**원인:** 환경 변수가 로드되지 않음

**해결:**
```bash
# .env 파일이 존재하는지 확인
ls -la .env

# .env 파일 내용 확인 (시크릿 제외)
grep JWT_SECRET .env

# Docker Compose 재시작
docker-compose down
docker-compose up -d
```

### 문제 2: "InfluxDB 연결 실패"

**원인:** InfluxDB 토큰이 잘못됨

**해결:**
1. InfluxDB 로그 확인: `docker logs waf-influxdb`
2. InfluxDB UI에서 토큰 재생성: http://localhost:8086
3. `.env` 파일의 `INFLUXDB_TOKEN` 업데이트
4. 서비스 재시작: `docker-compose restart realtime-processor`

### 문제 3: "Google OAuth 로그인 실패"

**원인:** OAuth 리다이렉트 URI가 일치하지 않음

**해결:**
1. Google Cloud Console에서 OAuth 설정 확인
2. 승인된 리다이렉트 URI에 다음 추가:
   - `http://localhost:8081/login/oauth2/code/google` (로컬)
   - `https://your-domain.com/login/oauth2/code/google` (프로덕션)

---

## 📚 참고 문서

- [Google OAuth 설정 가이드](https://developers.google.com/identity/protocols/oauth2)
- [InfluxDB 토큰 관리](https://docs.influxdata.com/influxdb/v2.7/security/tokens/)
- [Kubernetes Secrets 관리](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Docker Compose 환경 변수](https://docs.docker.com/compose/environment-variables/)

---

## 💡 추가 팁

### 환경별 설정 파일 관리

여러 환경을 관리하는 경우:

```bash
# 개발 환경
cp .env.example .env.dev
vim .env.dev

# 스테이징 환경
cp .env.example .env.staging
vim .env.staging

# 프로덕션 환경
cp .env.example .env.prod
vim .env.prod

# 사용 시
docker-compose --env-file .env.dev up -d
docker-compose --env-file .env.prod up -d
```

### 시크릿 로테이션

정기적으로 시크릿을 변경하세요:

```bash
# 새 JWT 시크릿 생성
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "NEW_JWT_SECRET=$NEW_JWT_SECRET"

# .env 파일 업데이트 후 서비스 재시작
docker-compose restart waf-social-api waf-dashboard-api
```

---

**⚠️ 중요:** `.env` 파일은 절대 Git에 커밋하지 마세요!

# 🛡️ WAF Dashboard - SaaS 웹 관리 대시보드

## 🎯 프로젝트 개요

기존 WAF 인프라에 **차별화된 웹 관리 대시보드**를 추가한 완전한 SaaS 솔루션입니다.

### **역할 분담**
- **Grafana (포트 3000)**: 실시간 모니터링 & 기술적 메트릭 (개발자/엔지니어용)
- **Next.js Dashboard (포트 3001)**: 비즈니스 관리 & 설정 관리 (관리자/경영진용)

## 🚀 주요 기능

### **1. Google OAuth 소셜 로그인**
- NextAuth.js 기반 구글 소셜 로그인
- 멀티 테넌트 지원 준비
- 세션 기반 인증 관리

### **2. 커스텀 WAF 룰 관리**
- 보안 룰 생성/수정/삭제/활성화
- 정규식 패턴 기반 룰 정의
- 우선순위 및 액션 설정 (BLOCK/ALLOW/LOG)

### **3. IP 화이트리스트 관리** 
- 신뢰 IP 주소/서브넷 관리
- CIDR 표기법 지원
- 개별 IP 및 서브넷 화이트리스트

### **4. 실시간 알림 시스템**
- Server-Sent Events (SSE) 기반 실시간 알림
- 심각도별 알림 분류 (CRITICAL/HIGH/MEDIUM/LOW)
- 브라우저 알림 및 토스트 메시지

### **5. WAF 로그 조회 및 분석**
- Elasticsearch 기반 로그 검색
- 필터링 (심각도, 공격 유형, IP)
- 페이지네이션 및 실시간 검색

### **6. Grafana 대시보드 통합**
- iframe 임베드로 실시간 차트 표시
- 기술적 메트릭 시각화
- 풀스크린 Grafana 대시보드 링크

## 🏗️ 기술 스택

### **백엔드**
- **Spring Boot 3.2.2** (Java 21)
- **멀티 모듈 구조**: `waf-dashboard-api`, `waf-social-api`, `waf-common-data`
- **데이터 소스**: Elasticsearch, InfluxDB, Redis
- **실시간 통신**: Server-Sent Events (SSE)

### **프론트엔드**
- **Next.js 15** (React 19, TypeScript)
- **인증**: NextAuth.js + Google OAuth
- **UI**: Tailwind CSS + shadcn/ui
- **상태 관리**: React Hooks
- **알림**: Sonner (토스트)

### **인프라 통합**
- **Grafana**: 실시간 모니터링 대시보드
- **Docker Compose**: 완전한 멀티 서비스 오케스트레이션
- **Redis**: 세션 관리
- **CORS**: 프론트엔드-백엔드 통신

## 📁 프로젝트 구조

```
waf/
├── frontend/                    # Next.js 대시보드
│   ├── src/app/
│   │   ├── dashboard/          # 메인 대시보드
│   │   │   ├── rules/          # 커스텀 룰 관리
│   │   │   ├── whitelist/      # IP 화이트리스트
│   │   │   ├── logs/           # WAF 로그 조회
│   │   │   └── alerts/         # 실시간 알림
│   │   ├── auth/signin/        # Google OAuth 로그인
│   │   └── api/auth/           # NextAuth API
│   ├── src/components/ui/      # shadcn/ui 컴포넌트
│   ├── src/lib/               # 유틸리티 (API 클라이언트, 인증)
│   └── src/types/             # TypeScript 타입 정의
│
├── backend/
│   ├── waf-dashboard-api/      # 새로운 대시보드 API
│   │   ├── src/main/java/kr/rojae/waf/dashboard/
│   │   │   ├── web/           # REST 컨트롤러들
│   │   │   └── config/        # CORS 설정
│   │   └── src/main/resources/application.yml
│   ├── waf-social-api/        # 기존 Google OAuth API
│   └── waf-common-data/       # 공유 DTO 클래스들
│
├── docker-compose.yml          # 기존 WAF 인프라
├── docker-compose.override.yml # 대시보드 서비스 추가
└── README-DASHBOARD.md         # 이 파일
```

## 🔧 설치 및 실행

### **1. 환경 설정**

```bash
# Google OAuth 설정
cp frontend/.env.local.example frontend/.env.local
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 설정 필요
```

### **2. 개발 환경 실행**

```bash
# 백엔드 실행 (포트 8082)
cd backend
./gradlew :waf-dashboard-api:bootRun

# 프론트엔드 실행 (포트 3001) 
cd frontend
npm install
npm run dev
```

### **3. 전체 인프라 실행**

```bash
# 전체 WAF + 대시보드 실행
docker-compose up -d

# 서비스 확인
- WAF Dashboard: http://localhost:3001
- Grafana: http://localhost:3000
- Dashboard API: http://localhost:8082
- Elasticsearch: http://localhost:9200
```

## 🔗 서비스 포트

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Next.js Dashboard | 3001 | 관리자용 웹 대시보드 |
| Grafana | 3000 | 실시간 모니터링 (기술자용) |
| Dashboard API | 8082 | 대시보드 백엔드 API |
| Social API | 8081 | Google OAuth API |
| Elasticsearch | 9200 | 로그 검색 엔진 |
| InfluxDB | 8086 | 실시간 메트릭 DB |

## 🎨 UI/UX 특징

### **차별화된 웹 대시보드**
- **관리자 친화적**: Grafana와 달리 비즈니스 사용자를 위한 직관적 UI
- **설정 중심**: WAF 설정을 웹에서 직접 관리
- **실시간 알림**: 중요한 보안 이벤트 즉시 알림
- **모바일 반응형**: Tailwind CSS 기반 반응형 디자인

### **Grafana 통합**
- 실시간 차트를 iframe으로 임베드
- 기술적 상세 분석은 풀스크린 Grafana로 이동
- 역할 분담으로 사용자 경험 최적화

## 🚀 확장 계획

### **단기 개발**
- [ ] 실제 Elasticsearch/InfluxDB 연동 (현재 Mock 데이터)
- [ ] 이메일/Slack 알림 통합
- [ ] 멀티 테넌트 사용자 관리
- [ ] 커스텀 룰의 ModSecurity 연동

### **장기 로드맵**
- [ ] AI 기반 위협 분석
- [ ] 자동 룰 생성 및 최적화
- [ ] 컴플라이언스 보고서 자동 생성
- [ ] 클라우드 배포 및 확장성 개선

## 🔐 보안 고려사항

- Google OAuth 2.0 표준 준수
- JWT 토큰 기반 인증
- CORS 정책 적용
- 입력 검증 및 SQL 인젝션 방어
- 세션 관리 및 자동 로그아웃

---

**개발 완료**: Next.js + Spring Boot 기반 차별화된 WAF 관리 대시보드 ✅
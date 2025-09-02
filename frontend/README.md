# WAF Frontend Dashboard

Next.js 기반의 WAF 관리 대시보드 프론트엔드 애플리케이션입니다.

## 🛠️ 기술 스택

- **Next.js 15.5** + React 19.1
- **TypeScript** + Tailwind CSS v4  
- **Material-UI** + Radix UI Components
- **NextAuth.js** for authentication

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (프록시)
│   │   ├── session/       # 세션 관리
│   │   ├── dashboard/     # 대시보드 API
│   │   ├── alerts/        # 알림 API  
│   │   └── realtime/      # 실시간 스트림
│   ├── auth/              # 인증 페이지
│   ├── dashboard/         # 대시보드 페이지
│   └── layout.tsx         # 루트 레이아웃
├── components/            # UI 컴포넌트
├── hooks/                 # 커스텀 훅
├── lib/                   # 유틸리티 함수
│   ├── constants.ts       # 상수 정의
│   ├── auth.ts           # 인증 로직
│   ├── api.ts            # API 클라이언트
│   └── utils/            # 유틸리티
└── types/                 # TypeScript 타입 정의
```

## 🔧 주요 기능

### API 프록시
- **Next.js API Routes**를 통한 백엔드 프록시
- 클라이언트에서 컨테이너 내부 URL에 직접 접근하지 않음
- 쿠키 기반 인증 관리

### 실시간 스트림
- **Server-Sent Events (SSE)** 지원
- 실시간 로그 스트림 (`/api/realtime/logs/stream`)
- 실시간 알림 스트림 (`/api/alerts/stream`)

### 에러 핸들링
- 통합된 에러 처리 시스템
- 서비스 연결 실패 시 503 반환
- 사용자 친화적 에러 메시지

### 상수 관리
- 공통 상수 중앙 관리 (`constants.ts`)
- 쿠키 설정, API 엔드포인트, HTTP 상태 코드 등

## 🔒 인증 시스템

- **OAuth2** 기반 소셜 로그인 (Google)
- **WAF_AT** 쿠키를 통한 세션 관리
- 로그아웃 시 자동 쿠키 삭제

## 🌍 환경 변수

```bash
# 인증
NEXTAUTH_SECRET=change-me-in-production-secret-key
GOOGLE_CLIENT_ID=your-google-client-id  
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 백엔드 API (서버 사이드용)
SOCIAL_API_URL=http://waf-social-api:8081
DASHBOARD_API_URL=http://waf-dashboard-api:8082
```

## 🚀 개발 실행

```bash
# 개발 서버 시작
npm run dev

# 빌드
npm run build

# 프로덕션 시작  
npm run start
```

## 📡 API 프록시 구조

```
브라우저 → Next.js API (/api/*) → Docker 컨테이너 (waf-*-api:port)
```

이 구조를 통해 CORS 문제를 해결하고 보안을 강화합니다.
# WAF Frontend Dashboard

Next.js-based frontend application for WAF management dashboard.

## 🛠️ Tech Stack

- **Next.js 15.5** + React 19.1
- **TypeScript** + Tailwind CSS v4  
- **Material-UI** + Radix UI Components
- **NextAuth.js** for authentication

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (Proxy)
│   │   ├── session/       # Session management
│   │   ├── dashboard/     # Dashboard API
│   │   ├── alerts/        # Alerts API  
│   │   └── realtime/      # Real-time streams
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   └── layout.tsx         # Root layout
├── components/            # UI components
├── hooks/                 # Custom hooks
├── lib/                   # Utility functions
│   ├── constants.ts       # Constants definition
│   ├── auth.ts           # Authentication logic
│   ├── api.ts            # API client
│   └── utils/            # Utilities
└── types/                 # TypeScript type definitions
```

## 🔧 Key Features

### API Proxy
- Backend proxy through **Next.js API Routes**
- No direct access to container internal URLs from client
- Cookie-based authentication management

### Real-time Streaming
- **Server-Sent Events (SSE)** support
- Real-time log stream (`/api/realtime/logs/stream`)
- Real-time alert stream (`/api/alerts/stream`)

### Error Handling
- Unified error handling system
- Returns 503 on service connection failures
- User-friendly error messages

### Constants Management
- Centralized common constants (`constants.ts`)
- Cookie settings, API endpoints, HTTP status codes, etc.

## 🔒 Authentication System

- **OAuth2** based social login (Google)
- Session management via **WAF_AT** cookie
- Automatic cookie deletion on logout

## 🌍 Environment Variables

```bash
# Authentication
NEXTAUTH_SECRET=change-me-in-production-secret-key
GOOGLE_CLIENT_ID=your-google-client-id  
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Backend API (Server-side)
SOCIAL_API_URL=http://waf-social-api:8081
DASHBOARD_API_URL=http://waf-dashboard-api:8082
```

## 🚀 Development

```bash
# Start development server
npm run dev

# Build
npm run build

# Start production  
npm run start
```

## 📡 API Proxy Architecture

```
Browser → Next.js API (/api/*) → Docker Container (waf-*-api:port)
```

This architecture solves CORS issues and enhances security.

## 🔧 Key Implementation Details

### Cookie Management
- `WAF_AT` cookie automatically configured with secure settings
- Production: secure=true, HttpOnly, SameSite=lax
- Development: secure=false for local testing

### Error Handling Strategy
- **ECONNREFUSED** errors → 503 Service Unavailable
- **Other errors** → 500 Internal Server Error
- Consistent error response format across all endpoints

### Type Safety
- Comprehensive TypeScript types for API responses
- Strict type checking for User, Alert, Metrics interfaces
- Enhanced developer experience with IntelliSense

### Performance Optimizations
- Server-Side Rendering (SSR) for authentication pages
- Client-Side Rendering (CSR) for dashboard components
- Efficient proxy routing to minimize latency

## 🛡️ Security Features

- **CSRF Protection** via SameSite cookie settings
- **XSS Prevention** through HttpOnly cookies
- **Secure Headers** in production environment
- **Input Validation** on all API routes

## 📊 Monitoring & Debugging

- Comprehensive error logging in API routes
- Client-side error boundaries for crash protection
- Real-time connection status monitoring
- Graceful fallbacks for service unavailability
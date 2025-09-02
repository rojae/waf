/**
 * Application Constants
 */

// Cookie Names
export const COOKIE_NAMES = {
  WAF_AT: 'WAF_AT',
} as const

// API Endpoints
export const API_ENDPOINTS = {
  SOCIAL_API: {
    SESSION_ME: '/session/me',
    SESSION_LOGOUT: '/session/logout',
  },
  DASHBOARD_API: {
    METRICS: '/api/dashboard/metrics',
    ALERTS_RECENT: '/api/alerts/recent',
    ALERTS_STREAM: '/api/alerts/stream',
    REALTIME_LOGS_STREAM: '/api/realtime/logs/stream',
  },
} as const

// Cookie Configuration
export const COOKIE_CONFIG = {
  WAF_AT: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
} as const

// Environment Variables
export const ENV = {
  SOCIAL_API_URL: process.env.SOCIAL_API_URL || 'http://waf-social-api:8081',
  DASHBOARD_API_URL: process.env.DASHBOARD_API_URL || 'http://waf-dashboard-api:8082',
} as const

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const
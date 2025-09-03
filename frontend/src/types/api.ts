/**
 * API Response Types
 */

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  provider: string
}

export interface SessionResponse {
  user: User | null
  authenticated: boolean
}

export interface MetricsResponse {
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  avgResponseTime: number
  timestamp: string
}

export interface Alert {
  id: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  message: string
  clientIp: string
  userAgent?: string
  uri: string
  ruleId?: string
}

export interface AlertsResponse {
  alerts: Alert[]
  total: number
}

export interface ApiErrorResponse {
  error: string
  message?: string
  details?: any
}
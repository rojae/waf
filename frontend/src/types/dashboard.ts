export interface WafLogEntry {
  timestamp: string
  clientIp: string
  method: string
  uri: string
  statusCode: number
  attackType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  country: string
  message: string
  blocked: boolean
}

export interface AttackMetrics {
  totalRequests: number
  blockedRequests: number
  blockRate: number
  attackTypeStats: Record<string, number>
  geoStats: Record<string, number>
  severityStats: Record<string, number>
}

export interface CustomRule {
  id: string
  name: string
  pattern: string
  action: 'BLOCK' | 'ALLOW' | 'LOG'
  enabled: boolean
  description: string
  createdAt: string
  updatedAt: string
}

export interface WhitelistEntry {
  id: string
  ip: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AlertConfig {
  id: string
  name: string
  condition: string
  threshold: number
  enabled: boolean
  slackWebhook?: string
  emailNotify?: string
}
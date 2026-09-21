'use client'

import { useState, useEffect, useRef } from 'react'

export interface RealtimeLog {
  id: string
  timestamp: string
  level: string
  message: string
  clientIp?: string
  attackType?: string
  method?: string
  uri?: string
  httpCode?: number
  ruleIds?: string[]
  severity?: number
  userAgent?: string
  country?: string
  isBlocked?: boolean
  action?: 'blocked' | 'allowed' | 'logged'
  rawData?: any
  [key: string]: any
}

// 차단 여부 판단
const isRequestBlocked = (response: any, messages: any[]): boolean => {
  const httpCode = response.http_code || 0
  
  // HTTP 상태 코드로 판단
  if (httpCode === 403 || httpCode === 406) return true
  
  // ModSecurity 메시지에서 차단 관련 키워드 검색
  const hasBlockingRule = messages.some(msg => {
    const ruleId = msg.details?.ruleId
    // 949xxx 시리즈는 보통 차단 평가 규칙
    return ruleId && ruleId.startsWith('949')
  })
  
  return hasBlockingRule
}

// 공격 유형별 멋진 메시지 생성
const generateSecurityMessage = (
  attackTypes: string[], 
  messages: any[], 
  request: any, 
  response: any, 
  clientIp: string,
  isBlocked: boolean
): string => {
  const method = request.method || 'REQUEST'
  const uri = request.uri || '/'
  const httpCode = response.http_code || 0
  
  // 공격 유형에 따른 맞춤 메시지
  const attackType = attackTypes[0]?.toLowerCase()
  const primaryMessage = messages[0]?.message || ''
  
  const actionText = isBlocked ? 'Blocked' : 'Detected'
  const actionEmoji = isBlocked ? '🛡️' : '👁️'
  
  if (attackType?.includes('xss')) {
    const scriptDetected = primaryMessage.toLowerCase().includes('script')
    const threatType = scriptDetected ? 'Script injection' : 'Cross-site scripting'
    return `🔥 XSS Attack ${actionText}! ${threatType} attempt from ${clientIp} on ${method} ${uri} ${actionEmoji}`
  }
  
  if (attackType?.includes('sqli') || attackType?.includes('sql')) {
    return `💀 SQL Injection ${actionText}! Database attack attempt from ${clientIp} targeting ${uri} ${actionEmoji}`
  }
  
  if (attackType?.includes('lfi') || attackType?.includes('rfi')) {
    return `📁 File Inclusion Attack ${actionText}! Unauthorized file access attempt from ${clientIp} on ${uri} ${actionEmoji}`
  }
  
  if (attackType?.includes('rce') || attackType?.includes('command')) {
    return `⚡ Command Injection ${actionText}! Remote code execution attempt from ${clientIp} ${actionEmoji}`
  }
  
  if (attackType?.includes('scanner') || primaryMessage.toLowerCase().includes('scanner')) {
    return `🔍 Security Scanner ${actionText}! Reconnaissance attempt from ${clientIp} - automated scanning ${isBlocked ? 'blocked' : 'detected'} ${actionEmoji}`
  }
  
  if (attackType?.includes('protocol')) {
    return `🌐 Protocol Violation ${actionText}! Invalid HTTP request structure from ${clientIp} ${actionEmoji}`
  }
  
  if (attackType?.includes('dos') || attackType?.includes('ddos')) {
    return `🚫 DoS Attack ${actionText}! High volume requests from ${clientIp} ${actionEmoji}`
  }
  
  if (httpCode === 403) {
    return `🛡️ Access ${actionText}! Suspicious request from ${clientIp} ${isBlocked ? 'blocked by' : 'detected by'} WAF (${method} ${uri})`
  }
  
  if (httpCode >= 400) {
    return `⚠️ Malicious Request ${actionText}! ${method} ${uri} from ${clientIp} triggered security rules ${actionEmoji}`
  }
  
  // 심각도에 따른 기본 메시지
  const severity = Math.max(...messages.map(m => parseInt(m.details?.severity) || 0))
  
  if (severity >= 4) {
    return `🚨 CRITICAL THREAT ${actionText}! High-risk security event ${isBlocked ? 'blocked' : 'detected'} from ${clientIp} - immediate attention required ${actionEmoji}`
  }
  
  if (severity >= 3) {
    return `🔴 SECURITY ALERT! Malicious activity ${actionText.toLowerCase()} from ${clientIp} on ${uri} ${actionEmoji}`
  }
  
  if (severity >= 2) {
    return `🟡 Security Warning! Suspicious activity ${actionText.toLowerCase()} from ${clientIp} - ${primaryMessage.substring(0, 60)}... ${actionEmoji}`
  }
  
  // Rule ID 기반 메시지
  const ruleId = messages[0]?.details?.ruleId
  if (ruleId) {
    if (ruleId.startsWith('941')) return `🔥 XSS Protection! Cross-site scripting ${actionText.toLowerCase()} from ${clientIp} ${actionEmoji}`
    if (ruleId.startsWith('942')) return `💀 SQL Injection Shield! Database attack ${actionText.toLowerCase()} from ${clientIp} ${actionEmoji}`
    if (ruleId.startsWith('930')) return `📁 File Attack ${actionText}! Directory traversal attempt from ${clientIp} ${actionEmoji}`
    if (ruleId.startsWith('931')) return `⚡ RCE Protection! Command injection ${actionText.toLowerCase()} from ${clientIp} ${actionEmoji}`
    if (ruleId.startsWith('913')) return `🔍 Scanner Detection! Automated tool ${actionText.toLowerCase()} from ${clientIp} ${actionEmoji}`
  }
  
  // 기본값
  return `🛡️ WAF Protection Active! Security rule triggered by ${clientIp} on ${method} ${uri} ${actionEmoji}`
}

// 로그 정제 함수
const parseWafLog = (rawData: any): RealtimeLog => {
  const now = new Date()
  const id = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // ModSecurity 로그 구조 파싱
    if (rawData.transaction) {
      const transaction = rawData.transaction
      const request = transaction.request || {}
      const response = transaction.response || {}
      const messages = rawData.messages || []
      
      // 공격 유형 분석
      const attackTypes: string[] = []
      const ruleIds: string[] = []
      let maxSeverity = 0
      
      messages.forEach((msg: any) => {
        if (msg.details) {
          const tags = msg.details.tags || []
          const severity = parseInt(msg.details.severity) || 0
          const ruleId = msg.details.ruleId
          
          if (ruleId) ruleIds.push(ruleId)
          if (severity > maxSeverity) maxSeverity = severity
          
          // 태그에서 공격 유형 추출
          tags.forEach((tag: string) => {
            if (tag.startsWith('attack-')) {
              attackTypes.push(tag.replace('attack-', '').toUpperCase())
            }
          })
        }
      })
      
      // 심각도에 따른 레벨 결정
      let level = 'INFO'
      if (maxSeverity >= 4) level = 'CRITICAL'
      else if (maxSeverity >= 3) level = 'ERROR' 
      else if (maxSeverity >= 2) level = 'WARNING'
      
      // 차단 여부 판단
      const isBlocked = isRequestBlocked(response, messages)
      
      // 보안 메시지 생성
      const securityMessage = generateSecurityMessage(attackTypes, messages, request, response, transaction.client_ip || 'unknown', isBlocked)
      
      return {
        id,
        timestamp: now.toISOString(),
        level,
        message: securityMessage,
        clientIp: transaction.client_ip,
        attackType: attackTypes.join(', ') || 'Unknown',
        method: request.method,
        uri: request.uri,
        httpCode: response.http_code,
        ruleIds,
        severity: maxSeverity,
        userAgent: request.headers?.['User-Agent'] ? 
          (request.headers['User-Agent'].length > 60 ? 
            request.headers['User-Agent'].substring(0, 60) + '...' : 
            request.headers['User-Agent']) : undefined,
        country: rawData.geoip?.country_name,
        isBlocked,
        action: isBlocked ? 'blocked' : 'allowed',
        rawData
      }
    }
    
    // 일반 로그 형식
    return {
      id,
      timestamp: now.toISOString(),
      level: rawData.severity || rawData.level || 'INFO',
      message: rawData.message || JSON.stringify(rawData).substring(0, 100) + '...',
      clientIp: rawData.client_ip,
      attackType: rawData.attack_type,
      rawData
    }
  } catch (error) {
    console.warn('Failed to parse log:', error)
    return {
      id,
      timestamp: now.toISOString(),
      level: 'ERROR',
      message: 'Failed to parse log data',
      rawData
    }
  }
}

type EventSourceLike = EventSource & {
  addEventListener(type: 'log' | 'connection', listener: (event: MessageEvent<string>) => void): void
}

type RealtimeConnectionOptions = {
  createEventSource?: (url: string, init: EventSourceInit) => EventSourceLike
  onOpen: () => void
  onLog: (event: MessageEvent<string>) => void
  onConnection: (event: MessageEvent<string>) => void
  onError: (readyState: number) => void
}

export function createRealtimeLogConnection({
  createEventSource = (url, init) => new EventSource(url, init) as EventSourceLike,
  onOpen,
  onLog,
  onConnection,
  onError,
}: RealtimeConnectionOptions) {
  const eventSource = createEventSource('/api/realtime/logs/stream', { withCredentials: true })
  eventSource.onopen = onOpen
  eventSource.addEventListener('log', onLog)
  eventSource.addEventListener('connection', onConnection)
  eventSource.onerror = () => onError(eventSource.readyState)
  return eventSource
}

export const useRealtimeLogs = (maxLogs: number = 100) => {
  const [logs, setLogs] = useState<RealtimeLog[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeartbeatRef = useRef<Date>(new Date())

  useEffect(() => {
    let mounted = true

    const clearHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const closeCurrent = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }

    const connectToStream = () => {
      if (!mounted) return
      try {
        clearReconnectTimer()
        clearHeartbeat()
        closeCurrent()

        eventSourceRef.current = createRealtimeLogConnection({
          onOpen: () => {
            if (!mounted) return
            setConnected(true)
            setError(null)
            lastHeartbeatRef.current = new Date()

            clearHeartbeat()
            heartbeatRef.current = setInterval(() => {
              const timeDiff = Date.now() - lastHeartbeatRef.current.getTime()
              if (timeDiff > 60000) {
                connectToStream()
              }
            }, 30000)
          },
          onLog: (event) => {
            lastHeartbeatRef.current = new Date()

            try {
              const rawLogData = JSON.parse(event.data)
              const realtimeLog = parseWafLog(rawLogData)

              setLogs(prevLogs => [realtimeLog, ...prevLogs].slice(0, maxLogs))
            } catch {
              const fallbackLog: RealtimeLog = {
                id: `${Date.now()}-fallback`,
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message: event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''),
                rawData: event.data
              }
              setLogs(prevLogs => [fallbackLog, ...prevLogs.slice(0, maxLogs - 1)])
            }
          },
          onConnection: () => {
            lastHeartbeatRef.current = new Date()
          },
          onError: (readyState) => {
            if (!mounted) return
            setConnected(false)

            if (readyState === EventSource.CLOSED) {
              setError('Connection closed, attempting to reconnect...')
              clearReconnectTimer()
              reconnectTimerRef.current = setTimeout(connectToStream, 5000)
            } else if (readyState === EventSource.CONNECTING) {
              setError('Connecting to realtime logs...')
            } else {
              setError('Connection error occurred')
            }
          },
        })
      } catch {
        if (mounted) {
          setConnected(false)
          setError('Failed to connect to realtime stream')
        }
      }
    }

    connectToStream()

    // Cleanup on unmount
    return () => {
      mounted = false
      clearReconnectTimer()
      clearHeartbeat()
      closeCurrent()
      setConnected(false)
    }
  }, [maxLogs])

  const clearLogs = () => {
    setLogs([])
  }

  const disconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnected(false)
  }

  const reconnect = () => {
    disconnect()
    reconnectTimerRef.current = setTimeout(() => {
      try {
        eventSourceRef.current = createRealtimeLogConnection({
          onOpen: () => {
            setConnected(true)
            setError(null)
            lastHeartbeatRef.current = new Date()
          },
          onLog: (event) => {
            const rawLogData = JSON.parse(event.data)
            const realtimeLog = parseWafLog(rawLogData)
            setLogs(prevLogs => [realtimeLog, ...prevLogs].slice(0, maxLogs))
          },
          onConnection: () => {
            lastHeartbeatRef.current = new Date()
          },
          onError: () => {
            setConnected(false)
            setError('Connection error occurred')
          },
        })
      } catch {
        setError('Reconnection failed')
      }
    }, 100)
  }

  return {
    logs,
    connected,
    error,
    clearLogs,
    disconnect,
    reconnect
  }
}

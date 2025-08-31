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
      const attackTypes = []
      const ruleIds = []
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

export const useRealtimeLogs = (maxLogs: number = 100) => {
  const [logs, setLogs] = useState<RealtimeLog[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeartbeatRef = useRef<Date>(new Date())

  useEffect(() => {
    const connectToStream = () => {
      try {
        // Close existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
        }

        const apiUrl = process.env.DASHBOARD_API_URL || 'http://localhost:8082'
        const eventSource = new EventSource(`${apiUrl}/api/realtime/logs/stream`, {
          withCredentials: false
        })
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log('Realtime log stream connected')
          setConnected(true)
          setError(null)
          lastHeartbeatRef.current = new Date()
          
          // Heartbeat 체크 시작 (30초마다)
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
          }
          heartbeatRef.current = setInterval(() => {
            const now = new Date()
            const timeDiff = now.getTime() - lastHeartbeatRef.current.getTime()
            
            // 1분 이상 메시지가 없으면 재연결 시도
            if (timeDiff > 60000) {
              console.log('No heartbeat for 60s, attempting reconnect...')
              connectToStream()
            }
          }, 30000)
        }

        eventSource.addEventListener('log', (event) => {
          lastHeartbeatRef.current = new Date() // 메시지 수신시 heartbeat 업데이트
          
          try {
            const rawLogData = JSON.parse(event.data)
            const realtimeLog = parseWafLog(rawLogData)

            setLogs(prevLogs => {
              const newLogs = [realtimeLog, ...prevLogs]
              return newLogs.slice(0, maxLogs) // Keep only recent logs
            })
          } catch (parseError) {
            console.warn('Failed to parse log event:', parseError)
            // Fallback for non-JSON messages
            const fallbackLog: RealtimeLog = {
              id: `${Date.now()}-fallback`,
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''),
              rawData: event.data
            }
            setLogs(prevLogs => [fallbackLog, ...prevLogs.slice(0, maxLogs - 1)])
          }
        })

        eventSource.addEventListener('connection', (event) => {
          console.log('Connection event:', event.data)
          lastHeartbeatRef.current = new Date() // 연결 메시지도 heartbeat 업데이트
        })

        eventSource.onerror = (event) => {
          console.error('Realtime log stream error:', event)
          setConnected(false)
          
          // EventSource 상태에 따른 처리
          if (eventSourceRef.current) {
            const readyState = eventSourceRef.current.readyState
            console.log('EventSource readyState:', readyState)
            
            if (readyState === EventSource.CLOSED) {
              setError('Connection closed, attempting to reconnect...')
              // 5초 후 재연결 시도
              setTimeout(() => {
                console.log('Attempting to reconnect...')
                connectToStream()
              }, 5000)
            } else if (readyState === EventSource.CONNECTING) {
              setError('Connecting to realtime logs...')
            } else {
              setError('Connection error occurred')
            }
          }
        }
      } catch (err) {
        console.error('Failed to connect to realtime stream:', err)
        setError('Failed to connect to realtime stream')
      }
    }

    connectToStream()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [maxLogs])

  const clearLogs = () => {
    setLogs([])
  }

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }

  const reconnect = () => {
    disconnect()
    // Give a small delay before reconnecting
    setTimeout(() => {
      const connectToStream = () => {
        try {
          const apiUrl = process.env.DASHBOARD_API_URL || 'http://localhost:8082'
          const eventSource = new EventSource(`${apiUrl}/api/realtime/logs/stream`, {
            withCredentials: false
          })
          eventSourceRef.current = eventSource
          setConnected(true)
          setError(null)
        } catch (err) {
          setError('Reconnection failed')
        }
      }
      connectToStream()
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
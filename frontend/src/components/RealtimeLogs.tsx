'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Button,
  List,
  ListItem,
  Divider,
  Paper
} from '@mui/material'
import {
  Refresh,
  Clear,
  FiberManualRecord,
  Error,
  Warning,
  Info,
  CheckCircle,
  Security
} from '@mui/icons-material'
import { useRealtimeLogs } from '@/hooks/useRealtimeLogs'

const RealtimeLogs: React.FC = () => {
  const { logs, connected, error, clearLogs, disconnect, reconnect } = useRealtimeLogs(50)
  const [isLive, setIsLive] = useState(true)

  const handleToggleLive = () => {
    if (isLive) {
      disconnect()
    } else {
      reconnect()
    }
    setIsLive(!isLive)
  }

  const getLogIcon = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
        return <Error color="error" fontSize="small" />
      case 'WARN':
      case 'WARNING':
        return <Warning color="warning" fontSize="small" />
      case 'INFO':
        return <Info color="info" fontSize="small" />
      case 'DEBUG':
        return <CheckCircle color="success" fontSize="small" />
      default:
        return <FiberManualRecord color="disabled" fontSize="small" />
    }
  }

  const getLogColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
        return 'error'
      case 'WARN':
      case 'WARNING':
        return 'warning'
      case 'INFO':
        return 'info'
      case 'DEBUG':
        return 'success'
      default:
        return 'default'
    }
  }

  const filteredLogs = logs

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              실시간 보안 로그
            </Typography>
            <Chip 
              icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
              label={connected ? 'Connected' : 'Disconnected'}
              color={connected ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={isLive} 
                  onChange={handleToggleLive}
                  size="small"
                />
              }
              label="실시간"
              sx={{ mr: 1 }}
            />
            <IconButton size="small" onClick={clearLogs} title="erase log">
              <Clear />
            </IconButton>
            <IconButton size="small" onClick={reconnect} title="reconnect">
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Status Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            connection error: {error}
            <Button onClick={reconnect} size="small" sx={{ ml: 1 }}>
              retry
            </Button>
          </Alert>
        )}

        {!connected && !error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            실시간 로그 스트림에 연결 중...
            <CircularProgress size={16} sx={{ ml: 1 }} />
          </Alert>
        )}

        {/* Log Stats */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${logs.length}`} size="small" />
          <Chip label={`Shown: ${filteredLogs.length}`} size="small" />
          
          {/* Attack Stats */}
          {(() => {
            const attackCount = logs.filter(log => 
              log.attackType && log.attackType !== 'Unknown' && log.level !== 'INFO'
            ).length
            const criticalCount = logs.filter(log => log.level === 'CRITICAL').length
            const errorCount = logs.filter(log => log.level === 'ERROR').length
            
            return (
              <>
                {attackCount > 0 && (
                  <Chip 
                    label={`🚨 Attacks: ${attackCount}`} 
                    size="small" 
                    color="error"
                    variant="outlined"
                  />
                )}
                {criticalCount > 0 && (
                  <Chip 
                    label={`Critical: ${criticalCount}`} 
                    size="small" 
                    color="error"
                  />
                )}
                {errorCount > 0 && (
                  <Chip 
                    label={`Errors: ${errorCount}`} 
                    size="small" 
                    color="warning"
                  />
                )}
              </>
            )
          })()}
          
          {logs.length > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center', ml: 1 }}>
              Latest: {new Date(logs[0].timestamp).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </CardContent>

      {/* Logs List */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        maxHeight: 400,
        px: 2,
        pb: 2
      }}>
        {filteredLogs.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography color="textSecondary">
              {logs.length === 0 ? 'Waiting log...' : 'No logs meet filter conditions.'}
            </Typography>
          </Paper>
        ) : (
          <List dense>
            {filteredLogs.map((log, index) => (
              <React.Fragment key={`${log.timestamp}-${index}`}>
                <ListItem 
                  sx={{ 
                    px: 0,
                    alignItems: 'flex-start',
                    bgcolor: index === 0 && isLive ? 'action.selected' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                    {getLogIcon(log.level)}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      {/* Header Row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip 
                          label={log.level}
                          color={getLogColor(log.level) as any}
                          size="small"
                          variant="filled"
                        />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                        {log.clientIp && (
                          <Chip 
                            label={`IP: ${log.clientIp}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                        {log.method && log.uri && (
                          <Chip 
                            label={`${log.method} ${log.uri.length > 30 ? log.uri.substring(0, 30) + '...' : log.uri}`}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                        {log.httpCode && (
                          <Chip 
                            label={`${log.httpCode}`}
                            size="small"
                            color={log.httpCode >= 400 ? 'error' : 'success'}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>

                      {/* Attack Info */}
                      {log.attackType && log.attackType !== 'Unknown' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip 
                            label={`${log.isBlocked ? '🛡️' : '👁️'} ${log.attackType.toUpperCase()} ${log.isBlocked ? 'BLOCKED' : 'DETECTED'}`}
                            size="small"
                            color={log.isBlocked ? "error" : "warning"}
                            variant={log.isBlocked ? "filled" : "outlined"}
                            sx={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 'bold',
                              animation: log.level === 'CRITICAL' ? 'pulse 2s infinite' : 'none',
                              '@keyframes pulse': {
                                '0%': { opacity: 1 },
                                '50%': { opacity: 0.7 },
                                '100%': { opacity: 1 }
                              },
                              backgroundColor: log.isBlocked && log.level === 'CRITICAL' 
                                ? 'error.main' 
                                : log.isBlocked ? 'error.light' : 'warning.light'
                            }}
                          />
                          {log.severity && log.severity >= 3 && (
                            <Chip 
                              label={`⚡ SEVERITY ${log.severity}`}
                              size="small"
                              color={log.severity >= 4 ? 'error' : 'warning'}
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                            />
                          )}
                          {log.ruleIds && log.ruleIds.length > 0 && (
                            <Typography variant="caption" color="textSecondary">
                              Rules: {log.ruleIds.slice(0, 2).join(', ')}
                              {log.ruleIds.length > 2 && ` +${log.ruleIds.length - 2}`}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Main Message */}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          wordBreak: 'break-word',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          color: log.level === 'CRITICAL' ? 'error.main' : 
                                 log.level === 'ERROR' ? 'warning.main' : 
                                 log.isBlocked ? 'error.dark' : 'text.primary',
                          fontWeight: log.level === 'CRITICAL' || log.level === 'ERROR' || log.isBlocked ? 600 : 400,
                          background: log.level === 'CRITICAL' ? 
                            'linear-gradient(90deg, rgba(244,67,54,0.1) 0%, transparent 100%)' : 
                            log.isBlocked && log.level === 'ERROR' ?
                            'linear-gradient(90deg, rgba(255,152,0,0.1) 0%, transparent 100%)' : 'none',
                          px: log.level === 'CRITICAL' || (log.isBlocked && log.level === 'ERROR') ? 1 : 0,
                          py: log.level === 'CRITICAL' || (log.isBlocked && log.level === 'ERROR') ? 0.5 : 0,
                          borderRadius: log.level === 'CRITICAL' || (log.isBlocked && log.level === 'ERROR') ? 1 : 0,
                          borderLeft: log.isBlocked ? '3px solid' : 'none',
                          borderLeftColor: log.isBlocked ? 
                            (log.level === 'CRITICAL' ? 'error.main' : 'warning.main') : 'none',
                          pl: log.isBlocked ? 2 : 0
                        }}
                      >
                        {log.message}
                      </Typography>

                      {/* Additional Details */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                        {log.country && (
                          <Typography variant="caption" color="textSecondary">
                            📍 {log.country}
                          </Typography>
                        )}
                        {log.userAgent && (
                          <Typography 
                            variant="caption" 
                            color="textSecondary" 
                            sx={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '300px'
                            }}
                            title={log.userAgent}
                          >
                            🖥️ {log.userAgent}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Expand Button for Raw Data */}
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        console.log('Raw log data:', log.rawData)
                        // TODO: Show modal with full raw data
                      }}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                    >
                      <Info fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
                {index < filteredLogs.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Card>
  )
}

export default RealtimeLogs
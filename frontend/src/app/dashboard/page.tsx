'use client'

import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Container,
  Card,
  CardContent,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Box,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Divider,
  LinearProgress,
  Alert,
  Stack
} from '@mui/material'
import {
  Security,
  Block,
  Assignment,
  List,
  ExitToApp,
  TrendingUp,
  Assessment,
  Notifications,
  Warning,
  CheckCircle,
  Error,
  Shield,
  Speed,
  Public,
  Timeline,
  Refresh
} from '@mui/icons-material'
import dynamic from 'next/dynamic'
import ChartWrapper from '@/components/Charts/ChartWrapper'
import RealtimeLogs from '@/components/RealtimeLogs'

const PieChart = dynamic(() => import('@mui/x-charts').then(mod => ({ default: mod.PieChart })), {
  ssr: false
})

const BarChart = dynamic(() => import('@mui/x-charts').then(mod => ({ default: mod.BarChart })), {
  ssr: false
})

const LineChart = dynamic(() => import('@mui/x-charts').then(mod => ({ default: mod.LineChart })), {
  ssr: false
})

interface MetricsData {
  totalRequests: number
  blockedRequests: number
  blockRate: number
  attackTypeStats: Record<string, number>
  geoStats: Record<string, number>
  severityStats: Record<string, number>
  hourlyStats?: Record<string, number>
}

interface ChartData {
  id: string
  label: string
  value: number
  color?: string
}

export default function Dashboard() {
  const { logout } = useAuth()
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user) {
      fetchMetrics()
    }
  }, [user])

  const fetchMetrics = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true)
      const response = await fetch('/api/dashboard/metrics', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setMetricsLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchMetrics(true)
  }

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (user && !metricsLoading) {
      const interval = setInterval(() => {
        fetchMetrics(false)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [user, metricsLoading])

  // Convert stats to chart data
  const attackTypeChartData: ChartData[] = metrics?.attackTypeStats ? 
    Object.entries(metrics.attackTypeStats).map(([key, value], index) => ({
      id: key,
      label: key,
      value,
      color: [
        '#f44336',
        '#ff9800',
        '#2196f3',
        '#4caf50',
        '#9c27b0'
      ][index % 5]
    })) : []

  const severityChartData: ChartData[] = metrics?.severityStats ? 
    Object.entries(metrics.severityStats).map(([key, value]) => ({
      id: key,
      label: key,
      value,
      color: {
        'CRITICAL': '#f44336',
        'HIGH': '#ff5722',
        'MEDIUM': '#ff9800',
        'LOW': '#2196f3'
      }[key] || '#9e9e9e'
    })) : []

  const geoChartData: ChartData[] = metrics?.geoStats ? 
    Object.entries(metrics.geoStats).slice(0, 5).map(([key, value]) => ({
      id: key,
      label: key,
      value,
      color: '#2196f3'
    })) : []

  const hourlyData = metrics?.hourlyStats ? 
    Object.entries(metrics.hourlyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 12)
      .map(([hour, requests]) => ({
        hour,
        requests
      })) : []

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, boxShadow: 6 }}>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h4" gutterBottom>Loading WAF Dashboard</Typography>
          <Typography color="textSecondary">Initializing security monitoring...</Typography>
        </Paper>
      </Box>
    )
  }

  if (!user) return null

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      {/* Enhanced Header */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)'
              }}
            >
              <Shield />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" sx={{ color: 'text.primary', fontWeight: 700 }}>
                WAF Security Center
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Real-time Protection Dashboard
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              icon={<CheckCircle />} 
              label="System Online" 
              color="success" 
              size="small"
              variant="outlined"
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.name?.charAt(0)}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                {user?.name}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<ExitToApp />}
              onClick={logout}
              size="small"
              sx={{ 
                borderColor: 'grey.300',
                color: 'text.primary',
                '&:hover': { borderColor: 'error.main', color: 'error.main' }
              }}
            >
              Sign Out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {refreshing && (
          <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
        )}
        
        {/* Responsive 2-Column Layout */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' }, 
          gap: 3,
          alignItems: 'flex-start'
        }}>
          
          {/* Column 1: Overview Section */}
          <Box sx={{ 
            flex: 1, 
            minWidth: { xs: '100%', lg: '48%' },
            width: { xs: '100%', lg: '48%' }
          }}>
            
            {/* Enhanced KPI Cards */}
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: 'text.primary' }}>
              🛡️ Security Overview
            </Typography>
            
            {/* KPI Cards Grid */}
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
              gap: 2, 
              mb: 4 
            }}>
              {/* Total Requests Card */}
              <Card sx={{ 
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Box sx={{ position: 'relative', zIndex: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Assessment sx={{ fontSize: 40, opacity: 0.9 }} />
                      <Chip label="Live" color="success" size="small" sx={{ color: 'white' }} />
                    </Box>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                      {metricsLoading ? <CircularProgress size={32} sx={{ color: 'white' }} /> : (metrics?.totalRequests || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Total Requests
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Last hour
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    position: 'absolute', 
                    right: -20, 
                    bottom: -20, 
                    opacity: 0.1,
                    fontSize: 100
                  }}>
                    <Assessment />
                  </Box>
                </CardContent>
              </Card>

              {/* Blocked Attacks Card */}
              <Card sx={{ 
                height: '100%',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Box sx={{ position: 'relative', zIndex: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Block sx={{ fontSize: 40, opacity: 0.9 }} />
                      <Chip 
                        label={metrics?.blockedRequests ? 'Alert' : 'Normal'} 
                        color={metrics?.blockedRequests && metrics.blockedRequests > 0 ? 'error' : 'success'} 
                        size="small" 
                        sx={{ color: 'white' }} 
                      />
                    </Box>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                      {metricsLoading ? <CircularProgress size={32} sx={{ color: 'white' }} /> : (metrics?.blockedRequests || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Blocked Attacks
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Security events
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    position: 'absolute', 
                    right: -20, 
                    bottom: -20, 
                    opacity: 0.1,
                    fontSize: 100
                  }}>
                    <Block />
                  </Box>
                </CardContent>
              </Card>

              {/* Block Rate Card */}
              <Card sx={{ 
                height: '100%',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Box sx={{ position: 'relative', zIndex: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <TrendingUp sx={{ fontSize: 40, opacity: 0.9 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={metrics?.blockRate || 0} 
                          sx={{ 
                            width: 40, 
                            mr: 1,
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            '& .MuiLinearProgress-bar': { backgroundColor: 'white' }
                          }} 
                        />
                        <Typography variant="caption">{(metrics?.blockRate || 0).toFixed(1)}%</Typography>
                      </Box>
                    </Box>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                      {metricsLoading ? <CircularProgress size={32} sx={{ color: 'white' }} /> : `${(metrics?.blockRate || 0).toFixed(1)}%`}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Block Rate
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Current performance
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    position: 'absolute', 
                    right: -20, 
                    bottom: -20, 
                    opacity: 0.1,
                    fontSize: 100
                  }}>
                    <TrendingUp />
                  </Box>
                </CardContent>
              </Card>

              {/* System Uptime Card */}
              <Card sx={{ 
                height: '100%',
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Box sx={{ position: 'relative', zIndex: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Speed sx={{ fontSize: 40, opacity: 0.9 }} />
                      <Chip label="Healthy" color="success" size="small" sx={{ color: 'white' }} />
                    </Box>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                      99.9%
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      System Uptime
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Service availability
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    position: 'absolute', 
                    right: -20, 
                    bottom: -20, 
                    opacity: 0.1,
                    fontSize: 100
                  }}>
                    <Speed />
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* System Status */}
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
              ⚡ System Status
            </Typography>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Alert severity="success">
                    <Typography variant="subtitle2">WAF Engine Status</Typography>
                    <Typography variant="body2">All systems operational</Typography>
                  </Alert>
                  <Alert severity="info">
                    <Typography variant="subtitle2">Data Pipeline</Typography>
                    <Typography variant="body2">Processing {(metrics?.totalRequests || 0).toLocaleString()} req/hr</Typography>
                  </Alert>
                  <Alert severity={metrics?.blockedRequests && metrics.blockedRequests > 0 ? "warning" : "success"}>
                    <Typography variant="subtitle2">Threat Level</Typography>
                    <Typography variant="body2">{metrics?.blockedRequests && metrics.blockedRequests > 0 ? 'Moderate' : 'Low'}</Typography>
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Column 2: Threat Analysis Section */}
          <Box sx={{ 
            flex: 1, 
            minWidth: { xs: '100%', lg: '48%' },
            width: { xs: '100%', lg: '48%' }
          }}>
            
            {/* Charts Section */}
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: 'text.primary' }}>
              📊 Threat Analysis
            </Typography>

            <Stack spacing={3}>
              {/* Attack Types Chart */}
              <Card sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="error" />
                    Attack Types Distribution
                  </Typography>
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {metricsLoading ? (
                      <CircularProgress />
                    ) : attackTypeChartData.length > 0 ? (
                      <ChartWrapper loading={metricsLoading}>
                        <PieChart
                          series={[{
                            data: attackTypeChartData
                          }]}
                          width={300}
                          height={250}
                        />
                      </ChartWrapper>
                    ) : (
                      <Typography color="textSecondary">No attack data available</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Severity Distribution */}
              <Card sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Error color="error" />
                    Threat Severity Levels
                  </Typography>
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {metricsLoading ? (
                      <CircularProgress />
                    ) : severityChartData.length > 0 ? (
                      <ChartWrapper loading={metricsLoading}>
                        <BarChart
                          xAxis={[{ scaleType: 'band', data: severityChartData.map(d => d.label) }]}
                          series={[{ data: severityChartData.map(d => d.value) }]}
                          width={300}
                          height={250}
                          colors={severityChartData.map(d => d.color).filter((c): c is string => c !== undefined)}
                        />
                      </ChartWrapper>
                    ) : (
                      <Typography color="textSecondary">No severity data available</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Geographic and Trend Charts in a row */}
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 2 
              }}>
                {/* Geographic Distribution */}
                <Card sx={{ height: 300, display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Public color="primary" />
                      Geographic Distribution
                    </Typography>
                    <Box sx={{ height: 200 }}>
                      {metricsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <CircularProgress />
                        </Box>
                      ) : geoChartData.length > 0 ? (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          {geoChartData.map((item) => (
                            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  backgroundColor: '#2196f3'
                                }} />
                                <Typography variant="body2">{item.label}</Typography>
                              </Box>
                              <Typography variant="h6" color="primary">{item.value}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="textSecondary" sx={{ textAlign: 'center', mt: 5 }}>No geographic data available</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Hourly Trend */}
                <Card sx={{ height: 300, display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Timeline color="info" />
                      Request Trends
                    </Typography>
                    <Box sx={{ height: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {metricsLoading ? (
                        <CircularProgress />
                      ) : hourlyData.length > 0 ? (
                        <ChartWrapper loading={metricsLoading}>
                          <LineChart
                            xAxis={[{ scaleType: 'point', data: hourlyData.map(d => d.hour) }]}
                            series={[{ 
                              data: hourlyData.map(d => d.requests),
                              curve: 'monotoneX',
                              color: '#2196f3'
                            }]}
                            width={250}
                            height={150}
                          />
                        </ChartWrapper>
                      ) : (
                        <Typography color="textSecondary">No trend data available</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Realtime Logs Section */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: 'text.primary' }}>
            ⚡ Realtime Security Logger
          </Typography>
          <RealtimeLogs />
        </Box>

        {/* Enhanced Grafana Section */}
        <Card sx={{ 
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          border: '1px solid rgba(0,0,0,0.1)',
          mt: 6
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Assessment />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Real-time Monitoring Dashboard
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Live metrics from Grafana - Updated every 5 seconds
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<TrendingUp />}
                onClick={() => window.open('http://localhost:3000/d/waf-overview/waf-overview', '_blank')}
                sx={{ 
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                }}
              >
                Open Full Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
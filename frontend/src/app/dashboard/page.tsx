'use client'

import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Container,
  Grid,
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
        
        <Grid container spacing={3}>
          
          {/* Enhanced KPI Cards */}
          <Grid item xs={12}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, color: 'text.primary' }}>
              🛡️ Security Overview
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6} lg={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
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
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
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
          </Grid>

          {/* Charts Section */}
          <Grid item xs={12}>
            <Typography variant="h4" sx={{ mb: 3, mt: 4, fontWeight: 600, color: 'text.primary' }}>
              📊 Threat Analysis
            </Typography>
          </Grid>

          {/* Attack Types Chart */}
          <Grid item xs={12} md={6}>
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
          </Grid>

          {/* Severity Distribution */}
          <Grid item xs={12} md={6}>
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
          </Grid>

          {/* Geographic Distribution */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Public color="primary" />
                  Geographic Distribution
                </Typography>
                <Box sx={{ height: 300 }}>
                  {metricsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress />
                    </Box>
                  ) : geoChartData.length > 0 ? (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      {geoChartData.map((item) => (
                        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ 
                              width: 12, 
                              height: 12, 
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
                    <Typography color="textSecondary" sx={{ textAlign: 'center', mt: 10 }}>No geographic data available</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Hourly Trend */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: 400, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timeline color="info" />
                  Request Trends (Last 12 Hours)
                </Typography>
                <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                        width={350}
                        height={250}
                      />
                    </ChartWrapper>
                  ) : (
                    <Typography color="textSecondary">No trend data available</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Management Tools */}
          <Grid item xs={12}>
            <Typography variant="h4" sx={{ mb: 3, mt: 4, fontWeight: 600, color: 'text.primary' }}>
              🔧 Management Tools
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0,0,0,0.1)',
                '&:hover': { 
                  transform: 'translateY(-8px) scale(1.02)', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  border: '1px solid',
                  borderColor: 'primary.main'
                }
              }}
              onClick={() => router.push('/dashboard/logs')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <List sx={{ fontSize: 36, color: 'white' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  WAF Logs
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                  View and analyze security logs with advanced filtering
                </Typography>
                <Chip label="Active" color="primary" size="small" sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0,0,0,0.1)',
                '&:hover': { 
                  transform: 'translateY(-8px) scale(1.02)', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  border: '1px solid',
                  borderColor: 'warning.main'
                }
              }}
              onClick={() => router.push('/dashboard/rules')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <Assignment sx={{ fontSize: 36, color: 'white' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Custom Rules
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                  Create and manage security rules for enhanced protection
                </Typography>
                <Chip label="Configure" color="warning" size="small" sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0,0,0,0.1)',
                '&:hover': { 
                  transform: 'translateY(-8px) scale(1.02)', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  border: '1px solid',
                  borderColor: 'success.main'
                }
              }}
              onClick={() => router.push('/dashboard/whitelist')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <Security sx={{ fontSize: 36, color: 'white' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  IP Whitelist
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                  Manage trusted IP addresses and allow legitimate traffic
                </Typography>
                <Chip label="Secure" color="success" size="small" sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0,0,0,0.1)',
                '&:hover': { 
                  transform: 'translateY(-8px) scale(1.02)', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  border: '1px solid',
                  borderColor: 'info.main'
                }
              }}
              onClick={() => router.push('/dashboard/alerts')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(45deg, #2196F3 30%, #42A5F5 90%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <Notifications sx={{ fontSize: 36, color: 'white' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Alert Settings
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                  Configure notifications and alert thresholds
                </Typography>
                <Chip label="Monitor" color="info" size="small" sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>

          {/* System Status */}
          <Grid item xs={12}>
            <Typography variant="h4" sx={{ mb: 3, mt: 4, fontWeight: 600, color: 'text.primary' }}>
              ⚡ System Status & Monitoring
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">WAF Engine Status</Typography>
                      <Typography variant="body2">All systems operational</Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Data Pipeline</Typography>
                      <Typography variant="body2">Processing {(metrics?.totalRequests || 0).toLocaleString()} req/hr</Typography>
                    </Alert>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Alert severity={metrics?.blockedRequests && metrics.blockedRequests > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Threat Level</Typography>
                      <Typography variant="body2">{metrics?.blockedRequests && metrics.blockedRequests > 0 ? 'Moderate' : 'Low'}</Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Enhanced Grafana Section */}
          <Grid item xs={12}>
            <Card sx={{ 
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
              border: '1px solid rgba(0,0,0,0.1)'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
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
                
                <Grid container spacing={3}>
                  <Grid item xs={12} lg={6}>
                    <Paper sx={{ 
                      height: 350, 
                      borderRadius: 3, 
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 40,
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        zIndex: 1
                      }}>
                        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                          WAF Overview
                        </Typography>
                      </Box>
                      <iframe
                        src="http://localhost:3000/d-solo/waf-overview/waf-overview?orgId=1&panelId=1&theme=light"
                        width="100%"
                        height="100%"
                        style={{ border: 0, marginTop: 40 }}
                        title="WAF Overview"
                      />
                    </Paper>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <Paper sx={{ 
                      height: 350, 
                      borderRadius: 3, 
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 40,
                        background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        zIndex: 1
                      }}>
                        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                          Attack Analysis
                        </Typography>
                      </Box>
                      <iframe
                        src="http://localhost:3000/d-solo/waf-overview/waf-overview?orgId=1&panelId=2&theme=light"
                        width="100%"
                        height="100%"
                        style={{ border: 0, marginTop: 40 }}
                        title="Attack Analysis"
                      />
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

        </Grid>
      </Container>
    </Box>
  )
}
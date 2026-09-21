'use client';

import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useRouter } from 'next/navigation';

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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  Notifications,
  NotificationsOff,
  Warning,
  Error,
  Info
} from '@mui/icons-material';

import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Alert {
  id: string;
  severity: string;
  message: string;
  timestamp: string;
  clientIp?: string;
  count?: number;
}

export default function AlertsPage() {
  const { loading, isAuthenticated } = useAuthGuard();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [streamUnavailable, setStreamUnavailable] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return; // useAuthGuard가 비로그인 시 /auth/signin 으로 푸시

    void loadRecentAlerts();
    void checkAlertStreamAvailability();
  }, [loading, isAuthenticated]);

  const loadRecentAlerts = async () => {
    try {
      const data = (await apiClient.getRecentAlerts()) as { alerts?: Alert[] };
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast.error('Failed to load recent alerts');
    }
  };

  const checkAlertStreamAvailability = async () => {
    try {
      const response = await fetch('/api/alerts/stream', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 501) {
        setStreamUnavailable(true);
        return;
      }

      setStreamUnavailable(!response.ok);
    } catch (error) {
      console.error('Error checking alert stream availability:', error);
      setStreamUnavailable(true);
    }
  };

  const getSeverityColor = (severity: string): "error" | "warning" | "info" | "success" => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
      default:
        return 'success';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Error color="error" />;
      case 'HIGH':
        return <Warning color="warning" />;
      case 'MEDIUM':
        return <Info color="info" />;
      case 'LOW':
      default:
        return <Info color="success" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">Loading Alerts...</Typography>
        </Paper>
      </Box>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
      {/* Header */}
      <AppBar position="static" sx={{ backgroundColor: 'white', color: 'text.primary', boxShadow: 1 }}>
        <Toolbar>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.back()}
            sx={{ mr: 2, color: 'text.primary' }}
          >
            Back
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary' }}>
            Security Alerts
          </Typography>
          <Chip
            icon={<NotificationsOff />}
            label={streamUnavailable ? 'Live alerts unavailable' : 'Recent alerts only'}
            color="default"
            variant="outlined"
          />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Recent Security Events
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Latest persisted security alerts and notifications
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
              <Typography variant="subtitle2" color="text.primary">
                Live alert stream unavailable
              </Typography>
              <Typography variant="body2" color="textSecondary">
                The backend does not currently publish live alert events. This page shows the recent alert query only.
              </Typography>
            </Paper>
            
            {alerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Notifications sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No alerts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  No security alerts have been triggered recently.
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {alerts.map((alert, index) => (
                  <Box key={`${alert.id}-${index}`}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemIcon sx={{ mt: 1 }}>
                        {getSeverityIcon(alert.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                              label={alert.severity}
                              color={getSeverityColor(alert.severity)}
                              size="small"
                            />
                            <Typography variant="body2" color="textSecondary">
                              {formatTimestamp(alert.timestamp)}
                            </Typography>
                            {alert.count && alert.count > 1 && (
                              <Chip
                                label={`${alert.count} events`}
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body1" sx={{ mb: 1 }}>
                              {alert.message}
                            </Typography>
                            {alert.clientIp && (
                              <Typography variant="body2" color="textSecondary">
                                Source IP:{' '}
                                <Box
                                  component="code"
                                  sx={{
                                    backgroundColor: 'grey.100',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  {alert.clientIp}
                                </Box>
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < alerts.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

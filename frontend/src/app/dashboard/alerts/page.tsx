'use client';

import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface Alert {
  id: string;
  severity: string;
  message: string;
  timestamp: string;
  clientIp?: string;
  count?: number;
}

export default function AlertsPage() {
  const { user, loading, isAuthenticated } = useAuthGuard();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return; // useAuthGuard가 비로그인 시 /auth/signin 으로 푸시

    void loadRecentAlerts();
    const cleanup = connectToAlertStream();
    return cleanup;
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

  const connectToAlertStream = () => {
    try {
      const eventSource = apiClient.createAlertStream();

      eventSource.onopen = () => {
        setStreamConnected(true);
        toast.success('Connected to real-time alerts');
      };

      eventSource.onmessage = (event) => {
        try {
          const newAlert: Alert = JSON.parse(event.data);
          setAlerts((prev) => [newAlert, ...prev.slice(0, 9)]); // 최근 10개 유지

          if (newAlert.severity === 'HIGH' || newAlert.severity === 'CRITICAL') {
            toast.error(`${newAlert.severity} Alert: ${newAlert.message}`);
          }
        } catch (error) {
          console.error('Error parsing alert data:', error);
        }
      };

      eventSource.onerror = () => {
        setStreamConnected(false);
        toast.error('Lost connection to alert stream');
      };

      return () => eventSource.close();
    } catch (error) {
      console.error('Error connecting to alert stream:', error);
      toast.error('Failed to connect to alert stream');
      return () => {};
    }
  };

  const getSeverityColor = (severity: string): BadgeVariant => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'secondary';
      case 'LOW':
      default:
        return 'outline';
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.back()}>
                ← Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Security Alerts</h1>
            </div>
            <div className="flex items-center space-x-2">
              {streamConnected ? (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Bell className="h-3 w-3" />
                  <span>Live</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center space-x-1">
                  <BellOff className="h-3 w-3" />
                  <span>Disconnected</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Latest security alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No security alerts have been triggered recently.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <div
                      key={`${alert.id}-${index}`}
                      className={`p-4 rounded-lg border ${
                        alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
                          ? 'border-red-200 bg-red-50'
                          : alert.severity === 'MEDIUM'
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(alert.timestamp)}
                            </span>
                            {alert.count && alert.count > 1 && (
                              <Badge variant="outline">{alert.count} events</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mb-1">{alert.message}</p>
                          {alert.clientIp && (
                            <p className="text-xs text-muted-foreground">
                              Source IP:{' '}
                              <code className="bg-white px-1 py-0.5 rounded">{alert.clientIp}</code>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

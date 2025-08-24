'use client'

import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  const { logout } = useAuth()
  const { user, loading } = useAuthGuard()
  const router = useRouter()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">WAF Dashboard</CardTitle>
            <CardDescription className="text-center">Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">WAF Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user.name}
              </span>
              <Button variant="outline" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% from last hour
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Blocked Attacks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">42</div>
                <p className="text-xs text-muted-foreground">
                  +5 from last hour
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Block Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3.4%</div>
                <p className="text-xs text-muted-foreground">
                  -0.2% from last hour
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Navigation Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <Card className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => router.push('/dashboard/logs')}>
              <CardHeader>
                <CardTitle className="text-lg">WAF Logs</CardTitle>
                <CardDescription>
                  View and analyze security logs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push('/dashboard/rules')}>
              <CardHeader>
                <CardTitle className="text-lg">Custom Rules</CardTitle>
                <CardDescription>
                  Manage security rules
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push('/dashboard/whitelist')}>
              <CardHeader>
                <CardTitle className="text-lg">IP Whitelist</CardTitle>
                <CardDescription>
                  Manage trusted IP addresses
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push('/dashboard/alerts')}>
              <CardHeader>
                <CardTitle className="text-lg">Alert Settings</CardTitle>
                <CardDescription>
                  Configure notifications
                </CardDescription>
              </CardHeader>
            </Card>

          </div>

          {/* Grafana Embed */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Monitoring</CardTitle>
                <CardDescription>
                  Live metrics from Grafana dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-64 rounded-md overflow-hidden border">
                    <iframe
                      src="http://localhost:3000/d-solo/waf-overview/waf-overview?orgId=1&panelId=1&theme=light"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      title="WAF Overview"
                      className="border-0"
                    ></iframe>
                  </div>
                  <div className="h-64 rounded-md overflow-hidden border">
                    <iframe
                      src="http://localhost:3000/d-solo/waf-overview/waf-overview?orgId=1&panelId=2&theme=light"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      title="Attack Analysis"
                      className="border-0"
                    ></iframe>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => window.open('http://localhost:3000/d/waf-overview/waf-overview', '_blank')}
                  >
                    View Full Grafana Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
'use client'

import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Filter, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"

interface WafLogEntry {
  id: string
  timestamp: string
  clientIp: string
  method: string
  uri: string
  statusCode: number
  attackType: string
  severity: string
  country: string
  message: string
  blocked: boolean
  userAgent: string
  responseTime: number
}

export default function LogsPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [logs, setLogs] = useState<WafLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(20)
  
  const [filters, setFilters] = useState({
    severity: '',
    attackType: '',
    clientIp: ''
  })

  useEffect(() => {
    if (loading) return
    if (!user) return
  }, [user, loading])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const params = {
        page: currentPage,
        size: pageSize,
        ...filters
      }
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] === '') {
          delete params[key as keyof typeof params]
        }
      })

      const data = await apiClient.getLogs(params) as { content?: WafLogEntry[], totalElements?: number }
      setLogs(data.content || [])
      setTotalCount(data.totalElements || 0)
    } catch (error) {
      toast.error('Failed to load logs')
      console.error('Error loading logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [currentPage, pageSize, filters])

  // Load logs when page or filters change
  useEffect(() => {
    if (user) {
      loadLogs()
    }
  }, [currentPage, filters, user, loadLogs])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(0) // Reset to first page when filtering
  }

  const applyFilters = () => {
    loadLogs()
  }

  const clearFilters = () => {
    setFilters({ severity: '', attackType: '', clientIp: '' })
    setCurrentPage(0)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'secondary'
      case 'LOW': return 'outline'
      default: return 'outline'
    }
  }

  if (loading || logsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Loading...</CardTitle>
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
              <Button variant="ghost" onClick={() => router.back()}>
                ← Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">WAF Logs</h1>
            </div>
            <Button onClick={loadLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <select
                    id="severity"
                    value={filters.severity}
                    onChange={(e) => handleFilterChange('severity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="attackType">Attack Type</Label>
                  <select
                    id="attackType"
                    value={filters.attackType}
                    onChange={(e) => handleFilterChange('attackType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Attack Types</option>
                    <option value="SQL Injection">SQL Injection</option>
                    <option value="XSS">XSS</option>
                    <option value="Path Traversal">Path Traversal</option>
                    <option value="RCE">RCE</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="clientIp">Client IP</Label>
                  <Input
                    id="clientIp"
                    value={filters.clientIp}
                    onChange={(e) => handleFilterChange('clientIp', e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
              </div>
              
              <div className="flex space-x-2 mt-4">
                <Button onClick={applyFilters}>
                  <Search className="mr-2 h-4 w-4" />
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Security Events ({totalCount} total)</CardTitle>
              <CardDescription>
                Recent WAF log entries and security events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Client IP</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Attack Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Country</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {log.clientIp}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-mono text-sm">
                            {log.method} {log.uri.length > 50 ? `${log.uri.slice(0, 50)}...` : log.uri}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.statusCode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.attackType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(log.severity) as "default" | "secondary" | "destructive" | "outline"}>
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.blocked ? 'destructive' : 'secondary'}>
                          {log.blocked ? 'Blocked' : 'Allowed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{log.country}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.responseTime}ms
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} entries
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline"
                    disabled={(currentPage + 1) * pageSize >= totalCount}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
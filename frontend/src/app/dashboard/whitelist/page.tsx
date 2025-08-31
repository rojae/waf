'use client'

import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"

interface WhitelistEntry {
  id: string
  ip: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export default function WhitelistPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<WhitelistEntry | null>(null)
  
  const [formData, setFormData] = useState({
    ip: '',
    description: '',
    enabled: true
  })

  useEffect(() => {
    if (loading) return
    if (!user) return
    
    loadEntries()
  }, [user, loading])

  const loadEntries = async () => {
    try {
      const data = await apiClient.getWhitelist()
      setEntries(data)
    } catch (error) {
      toast.error('Failed to load whitelist')
      console.error('Error loading whitelist:', error)
    } finally {
      setEntriesLoading(false)
    }
  }

  const handleToggleEntry = async (entry: WhitelistEntry) => {
    try {
      const updatedEntry = await apiClient.toggleWhitelistEntry(entry.id)
      setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e))
      toast.success(`Entry ${updatedEntry.enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toast.error('Failed to toggle entry')
      console.error('Error toggling entry:', error)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await apiClient.deleteWhitelistEntry(entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      toast.success('Entry deleted successfully')
    } catch (error) {
      toast.error('Failed to delete entry')
      console.error('Error deleting entry:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingEntry) {
        const updatedEntry = await apiClient.updateWhitelistEntry(editingEntry.id, {
          ...editingEntry,
          ...formData
        })
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? updatedEntry : e))
        toast.success('Entry updated successfully')
      } else {
        const newEntry = await apiClient.createWhitelistEntry(formData)
        setEntries(prev => [...prev, newEntry])
        toast.success('Entry created successfully')
      }
      
      setShowCreateForm(false)
      setEditingEntry(null)
      setFormData({
        ip: '',
        description: '',
        enabled: true
      })
    } catch (error) {
      toast.error('Failed to save entry')
      console.error('Error saving entry:', error)
    }
  }

  const startEdit = (entry: WhitelistEntry) => {
    setEditingEntry(entry)
    setFormData({
      ip: entry.ip,
      description: entry.description,
      enabled: entry.enabled
    })
    setShowCreateForm(true)
  }

  if (loading || entriesLoading) {
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
              <h1 className="text-xl font-semibold text-gray-900">IP Whitelist</h1>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add IP
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{editingEntry ? 'Edit Whitelist Entry' : 'Add IP to Whitelist'}</CardTitle>
                <CardDescription>
                  {editingEntry ? 'Update the whitelist entry' : 'Add a trusted IP address or subnet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="ip">IP Address or Subnet</Label>
                    <Input
                      id="ip"
                      value={formData.ip}
                      onChange={(e) => setFormData(prev => ({...prev, ip: e.target.value}))}
                      placeholder="e.g., 192.168.1.100 or 192.168.1.0/24"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Use CIDR notation for subnets (e.g., 192.168.1.0/24)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                      placeholder="e.g., Office network, Admin workstation"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(enabled) => setFormData(prev => ({...prev, enabled}))}
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit">{editingEntry ? 'Update' : 'Add'}</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowCreateForm(false)
                      setEditingEntry(null)
                      setFormData({
                        ip: '',
                        description: '',
                        enabled: true
                      })
                    }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Whitelist Table */}
          <Card>
            <CardHeader>
              <CardTitle>Whitelisted IPs ({entries.length})</CardTitle>
              <CardDescription>
                Trusted IP addresses that bypass WAF filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address/Subnet</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {entry.ip}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {entry.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={entry.enabled}
                            onCheckedChange={() => handleToggleEntry(entry)}
                          />
                          <Badge variant={entry.enabled ? 'secondary' : 'outline'}>
                            {entry.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove from Whitelist</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove &quot;{entry.ip}&quot; from the whitelist? 
                                  This IP will be subject to WAF filtering again.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
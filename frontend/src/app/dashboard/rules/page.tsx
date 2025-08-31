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

interface CustomRule {
  id: string
  name: string
  pattern: string
  action: string
  enabled: boolean
  description: string
  priority: number
  createdAt: string
  updatedAt: string
}

export default function RulesPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [rules, setRules] = useState<CustomRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    pattern: '',
    action: 'BLOCK',
    enabled: true,
    description: '',
    priority: 100
  })

  useEffect(() => {
    if (loading) return
    if (!user) return
    
    loadRules()
  }, [user, loading])

  const loadRules = async () => {
    try {
      const data = await apiClient.getRules() as CustomRule[]
      setRules(data)
    } catch (error) {
      toast.error('Failed to load rules')
      console.error('Error loading rules:', error)
    } finally {
      setRulesLoading(false)
    }
  }

  const handleToggleRule = async (rule: CustomRule) => {
    try {
      const updatedRule = await apiClient.toggleRule(rule.id) as CustomRule
      setRules(prev => prev.map(r => r.id === rule.id ? updatedRule : r))
      toast.success(`Rule ${updatedRule.enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toast.error('Failed to toggle rule')
      console.error('Error toggling rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await apiClient.deleteRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      toast.success('Rule deleted successfully')
    } catch (error) {
      toast.error('Failed to delete rule')
      console.error('Error deleting rule:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingRule) {
        const updatedRule = await apiClient.updateRule(editingRule.id, {
          ...editingRule,
          ...formData
        })
        setRules(prev => prev.map(r => r.id === editingRule.id ? updatedRule : r))
        toast.success('Rule updated successfully')
      } else {
        const newRule = await apiClient.createRule(formData)
        setRules(prev => [...prev, newRule])
        toast.success('Rule created successfully')
      }
      
      setShowCreateForm(false)
      setEditingRule(null)
      setFormData({
        name: '',
        pattern: '',
        action: 'BLOCK',
        enabled: true,
        description: '',
        priority: 100
      })
    } catch (error) {
      toast.error('Failed to save rule')
      console.error('Error saving rule:', error)
    }
  }

  const startEdit = (rule: CustomRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      pattern: rule.pattern,
      action: rule.action,
      enabled: rule.enabled,
      description: rule.description,
      priority: rule.priority
    })
    setShowCreateForm(true)
  }

  if (loading || rulesLoading) {
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
              <h1 className="text-xl font-semibold text-gray-900">Custom Rules</h1>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
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
                <CardTitle>{editingRule ? 'Edit Rule' : 'Create New Rule'}</CardTitle>
                <CardDescription>
                  {editingRule ? 'Update the rule configuration' : 'Define a new custom security rule'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Rule Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., Block SQL Injection"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="action">Action</Label>
                      <select
                        id="action"
                        value={formData.action}
                        onChange={(e) => setFormData(prev => ({...prev, action: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="BLOCK">Block</option>
                        <option value="ALLOW">Allow</option>
                        <option value="LOG">Log Only</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="pattern">Pattern (Regex)</Label>
                    <Input
                      id="pattern"
                      value={formData.pattern}
                      onChange={(e) => setFormData(prev => ({...prev, pattern: e.target.value}))}
                      placeholder="e.g., (?i)(union|select|insert|update|delete)"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                      placeholder="Brief description of what this rule does"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({...prev, priority: parseInt(e.target.value)}))}
                        placeholder="100"
                        min="1"
                        max="999"
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
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit">{editingRule ? 'Update' : 'Create'}</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowCreateForm(false)
                      setEditingRule(null)
                      setFormData({
                        name: '',
                        pattern: '',
                        action: 'BLOCK',
                        enabled: true,
                        description: '',
                        priority: 100
                      })
                    }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Rules Table */}
          <Card>
            <CardHeader>
              <CardTitle>Security Rules ({rules.length})</CardTitle>
              <CardDescription>
                Manage custom security rules for your WAF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {rule.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {rule.pattern.length > 50 
                            ? `${rule.pattern.slice(0, 50)}...` 
                            : rule.pattern
                          }
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          rule.action === 'BLOCK' ? 'destructive' : 
                          rule.action === 'ALLOW' ? 'secondary' : 'outline'
                        }>
                          {rule.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleRule(rule)}
                          />
                          <Badge variant={rule.enabled ? 'secondary' : 'outline'}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(rule)}
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
                                <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{rule.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
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
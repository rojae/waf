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
import { CustomRule, CreateRuleRequest } from "@/lib/api/customRules"
import { toast } from "sonner"

export default function RulesPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [rules, setRules] = useState<CustomRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  
  const [formData, setFormData] = useState<CreateRuleRequest>({
    name: '',
    description: '',
    severity: 'MEDIUM',
    category: '',
    variables: 'ARGS',
    operator: '@rx',
    operatorData: '',
    actions: 'id:900001,phase:2,block,msg:"Stored Draft Rule"',
    priority: 100,
    enabled: true,
  })

  useEffect(() => {
    if (loading) return
    if (!user) return
    
    loadRules()
  }, [user, loading])

  const loadRules = async () => {
    try {
      const data = await apiClient.getRules<CustomRule[]>()
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
      const updatedRule = await apiClient.toggleRule<CustomRule>(String(rule.id), !rule.enabled)
      setRules(prev => prev.map(r => r.id === rule.id ? updatedRule : r))
      toast.success(`Stored draft ${updatedRule.enabled ? 'enabled' : 'disabled'}. Not yet applied to nginx.`)
    } catch (error) {
      toast.error('Failed to toggle rule')
      console.error('Error toggling rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await apiClient.deleteRule(ruleId)
      setRules(prev => prev.filter(r => String(r.id) !== ruleId))
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
        const updatedRule = await apiClient.updateRule<CustomRule>(String(editingRule.id), formData)
        setRules(prev => prev.map(r => r.id === editingRule.id ? updatedRule : r))
        toast.success('Rule draft updated. Changes are stored but not yet applied.')
      } else {
        const newRule = await apiClient.createRule<CustomRule>(formData)
        setRules(prev => [...prev, newRule])
        toast.success('Rule draft created. It is not yet applied to nginx.')
      }
      
      setShowCreateForm(false)
      setEditingRule(null)
      setFormData({
        name: '',
        description: '',
        severity: 'MEDIUM',
        category: '',
        variables: 'ARGS',
        operator: '@rx',
        operatorData: '',
        actions: 'id:900001,phase:2,block,msg:"Stored Draft Rule"',
        priority: 100,
        enabled: true,
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
      severity: rule.severity,
      category: rule.category,
      variables: rule.variables || 'ARGS',
      operator: rule.operator || '@rx',
      operatorData: rule.operatorData || '',
      actions: rule.actions || 'id:900001,phase:2,block,msg:"Stored Draft Rule"',
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
                  {editingRule ? 'Update the stored draft rule' : 'Define a stored draft security rule. Drafts are not applied to nginx yet.'}
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
                      <Label htmlFor="severity">Severity</Label>
                      <select
                        id="severity"
                        value={formData.severity}
                        onChange={(e) => setFormData(prev => ({...prev, severity: e.target.value as CreateRuleRequest['severity']}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="INFO">Info</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}
                      placeholder="e.g., SQL Injection"
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
                      <Label htmlFor="variables">Variables</Label>
                      <Input
                        id="variables"
                        value={formData.variables}
                        onChange={(e) => setFormData(prev => ({...prev, variables: e.target.value}))}
                        placeholder="ARGS"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="operator">Operator</Label>
                      <Input
                        id="operator"
                        value={formData.operator}
                        onChange={(e) => setFormData(prev => ({...prev, operator: e.target.value}))}
                        placeholder="@rx"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="operatorData">Operator Data / Pattern</Label>
                    <Input
                      id="operatorData"
                      value={formData.operatorData}
                      onChange={(e) => setFormData(prev => ({...prev, operatorData: e.target.value}))}
                      placeholder="e.g., (?i)(union|select|insert|update|delete)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="actions">Actions</Label>
                    <Input
                      id="actions"
                      value={formData.actions}
                      onChange={(e) => setFormData(prev => ({...prev, actions: e.target.value}))}
                      placeholder={'id:900001,phase:2,block,msg:"Stored Draft Rule"'}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({...prev, priority: parseInt(e.target.value, 10) || 100}))}
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
                      <span className="text-xs text-muted-foreground">Stored draft only</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button type="submit">{editingRule ? 'Update' : 'Create'}</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowCreateForm(false)
                      setEditingRule(null)
                      setFormData({
                        name: '',
                        description: '',
                        severity: 'MEDIUM',
                        category: '',
                        variables: 'ARGS',
                        operator: '@rx',
                        operatorData: '',
                        actions: 'id:900001,phase:2,block,msg:"Stored Draft Rule"',
                        priority: 100,
                        enabled: true,
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
                Stored custom rule drafts. These records are persistent, but deploy is unavailable until nginx validation and reload are wired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Severity</TableHead>
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
                          {(rule.operatorData || rule.operator || '').length > 50
                            ? `${(rule.operatorData || rule.operator || '').slice(0, 50)}...`
                            : (rule.operatorData || rule.operator || 'No pattern')
                          }
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          rule.severity === 'CRITICAL' || rule.severity === 'HIGH' ? 'destructive' :
                          rule.severity === 'MEDIUM' ? 'secondary' : 'outline'
                        }>
                          {rule.severity}
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
                            {rule.enabled ? 'Draft enabled' : 'Draft disabled'}
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
                                  onClick={() => handleDeleteRule(String(rule.id))}
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

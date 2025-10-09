'use client'

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CustomRulesPage() {
  const [rules, setRules] = useState([
    {
      id: 1,
      name: 'SQL Injection Protection',
      description: 'Blocks SQL injection attempts in request parameters',
      enabled: true,
      severity: 'HIGH',
      category: 'SQL Injection'
    },
    {
      id: 2,
      name: 'XSS Protection',
      description: 'Detects cross-site scripting attempts',
      enabled: true,
      severity: 'MEDIUM',
      category: 'XSS'
    }
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Custom Rules Management</h1>
          <p className="text-gray-600 mt-2">Create and manage custom ModSecurity rules</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Add New Rule
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {rules.filter(r => r.enabled).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">High Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {rules.filter(r => r.severity === 'HIGH').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(rules.map(r => r.category)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <Badge
                      variant={rule.enabled ? 'default' : 'secondary'}
                      className={rule.enabled ? 'bg-green-100 text-green-800' : ''}
                    >
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        rule.severity === 'HIGH' ? 'border-red-500 text-red-700' :
                        rule.severity === 'MEDIUM' ? 'border-yellow-500 text-yellow-700' :
                        'border-blue-500 text-blue-700'
                      }
                    >
                      {rule.severity}
                    </Badge>
                    <Badge variant="secondary">
                      {rule.category}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-sm">{rule.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button
                    variant={rule.enabled ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => {
                      setRules(prev => prev.map(r =>
                        r.id === rule.id ? {...r, enabled: !r.enabled} : r
                      ))
                    }}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deploy Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Deploy {rules.filter(r => r.enabled).length} active rules to WAF instances
              </p>
              <p className="text-xs text-gray-500">
                Last deployment: Never
              </p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700">
              Deploy Rules
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
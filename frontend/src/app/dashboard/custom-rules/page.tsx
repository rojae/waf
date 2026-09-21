'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CreateRuleModal from '@/components/custom-rules/CreateRuleModal';
import EditRuleModal from '@/components/custom-rules/EditRuleModal';
import { customRuleAPI, CustomRule, RuleDeployment } from '@/lib/api/customRules';
import { toast } from 'sonner';

export default function DashboardCustomRulesPage() {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [deployment, setDeployment] = useState<RuleDeployment | null>(null);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    loadRules();
    loadDeploymentStatus();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await customRuleAPI.getAllRules();
      setRules(data);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error('Failed to load custom rules');
    } finally {
      setLoading(false);
    }
  };

  const loadDeploymentStatus = async () => {
    try {
      const status = await customRuleAPI.getDeploymentStatus();
      setDeployment(status);
    } catch (error) {
      console.error('Error loading deployment status:', error);
    }
  };

  const handleToggleRule = async (ruleId: number, enabled: boolean) => {
    try {
      const updatedRule = await customRuleAPI.toggleRule(ruleId, enabled);
      setRules(prev => prev.map(rule =>
        rule.id === ruleId ? updatedRule : rule
      ));
      toast.success(`Stored draft ${enabled ? 'enabled' : 'disabled'}. Not yet applied to nginx.`);
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to toggle stored draft. Existing state was kept.');
    }
  };

  const handleDeploy = async () => {
    try {
      setDeploying(true);
      await customRuleAPI.deployRules();
    } catch (error) {
      console.error('Error deploying rules:', error);
      toast.error(error instanceof Error ? error.message : 'Rule deployment is intentionally unavailable');
    } finally {
      setDeploying(false);
    }
  };

  const handleEditRule = (rule: CustomRule) => {
    setEditingRule(rule);
    setShowEditModal(true);
  };

  const handleRuleUpdated = () => {
    // Update the rule in local state
    if (editingRule) {
      setRules(prev => prev.map(rule =>
        rule.id === editingRule.id ? editingRule : rule
      ));
    }
    loadRules(); // Reload rules to get fresh data
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Custom Rules Management</h1>
          <p className="text-gray-600 mt-2">
            {loading ? 'Loading stored drafts...' : 'Create and manage stored ModSecurity rule drafts. Drafts are not applied to nginx yet.'}
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowCreateModal(true)}
        >
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
                  <p className="text-xs text-gray-500 mt-1">Persistent draft only. Enable/disable is stored, not deployed.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRule(rule)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={rule.enabled ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleToggleRule(rule.id, !rule.enabled)}
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
                Deployment is unavailable until real nginx validation and reload are wired.
              </p>
              <p className="text-xs text-gray-500">
                {deployment ? (
                  <>
                    Last deployment: {deployment.deployedAt
                      ? new Date(deployment.deployedAt).toLocaleString()
                      : 'In progress'}
                    {deployment.deploymentStatus && (
                      <span className={`ml-2 px-2 py-1 text-xs rounded ${
                        deployment.deploymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        deployment.deploymentStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {deployment.deploymentStatus}
                      </span>
                    )}
                  </>
                ) : (
                  'No deployments yet'
                )}
              </p>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleDeploy}
              disabled={deploying || rules.filter(r => r.enabled).length === 0}
            >
              {deploying ? 'Deploying...' : 'Deploy Rules'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Rule Modal */}
      <CreateRuleModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRuleCreated={loadRules}
      />

      {/* Edit Rule Modal */}
      <EditRuleModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRule(null);
        }}
        onRuleUpdated={handleRuleUpdated}
        rule={editingRule}
      />
    </div>
  );
}

'use client'

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { customRuleAPI, CreateRuleRequest } from '@/lib/api/customRules';
import { toast } from 'sonner';

interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  onRuleCreated: () => void;
}

export default function CreateRuleModal({ open, onClose, onRuleCreated }: CreateRuleModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateRuleRequest>({
    name: '',
    description: '',
    severity: 'MEDIUM',
    category: '',
    variables: 'ARGS',
    operator: '@detectSQLi',
    operatorData: '',
    actions: 'id:900001,phase:2,block,msg:"SQL Injection Attack Detected",logdata:"Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}: %{MATCHED_VAR}",tag:"sql-injection"',
    priority: 100,
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = await customRuleAPI.validateRule(formData);
      if (!validation.valid) {
        toast.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      await customRuleAPI.createRule(formData);
      toast.success('Custom rule draft created. It is stored but not yet applied to nginx.');

      onRuleCreated();
      onClose();

      // Reset form
      setFormData({
        name: '',
        description: '',
        severity: 'MEDIUM',
        category: '',
        variables: 'ARGS',
        operator: '@detectSQLi',
        operatorData: '',
        actions: 'id:900001,phase:2,block,msg:"Custom Rule",logdata:"Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}: %{MATCHED_VAR}"',
        priority: 100,
        enabled: true,
      });
    } catch (error) {
      console.error('Error creating rule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create rule draft');
    } finally {
      setLoading(false);
    }
  };

  const predefinedTemplates = [
    {
      name: 'SQL Injection Protection',
      description: 'Detects SQL injection attempts in request parameters',
      category: 'SQL Injection',
      variables: 'ARGS',
      operator: '@detectSQLi',
      actions: 'id:900001,phase:2,block,msg:"SQL Injection Attack Detected",logdata:"Matched Data: %{MATCHED_VAR}",tag:"sql-injection"'
    },
    {
      name: 'XSS Protection',
      description: 'Detects cross-site scripting attempts',
      category: 'XSS',
      variables: 'ARGS',
      operator: '@detectXSS',
      actions: 'id:900002,phase:2,block,msg:"XSS Attack Detected",logdata:"Matched Data: %{MATCHED_VAR}",tag:"xss"'
    },
    {
      name: 'File Upload Filter',
      description: 'Restricts malicious file uploads',
      category: 'File Upload',
      variables: 'FILES_NAMES',
      operator: '@rx',
      operatorData: '\\.(php|jsp|asp|aspx|sh|pl|py)$',
      actions: 'id:900003,phase:2,block,msg:"Malicious File Upload Detected",logdata:"File: %{MATCHED_VAR}",tag:"file-upload"'
    }
  ];

  const applyTemplate = (template: typeof predefinedTemplates[0]) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      category: template.category,
      variables: template.variables,
      operator: template.operator,
      operatorData: template.operatorData || '',
      actions: template.actions,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Rule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Templates */}
          <div>
            <Label className="text-sm font-medium">Quick Templates</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              {predefinedTemplates.map((template, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                  className="text-left h-auto p-3"
                >
                  <div>
                    <div className="font-medium text-xs">{template.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{template.category}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., SQL Injection, XSS"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this rule does"
              rows={2}
            />
          </div>

          {/* Rule Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={formData.severity} onValueChange={(value: any) => setFormData(prev => ({ ...prev, severity: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority (1-999)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="999"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
              />
            </div>
          </div>

          {/* ModSecurity Rule Configuration */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium">ModSecurity Rule Configuration</h3>

            <div>
              <Label htmlFor="variables">Variables *</Label>
              <Input
                id="variables"
                value={formData.variables}
                onChange={(e) => setFormData(prev => ({ ...prev, variables: e.target.value }))}
                placeholder="e.g., ARGS, ARGS_NAMES, REQUEST_BODY"
                required
              />
              <p className="text-xs text-gray-500 mt-1">ModSecurity variables to inspect (e.g., ARGS, REQUEST_BODY, ARGS_NAMES)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="operator">Operator *</Label>
                <Input
                  id="operator"
                  value={formData.operator}
                  onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value }))}
                  placeholder="e.g., @detectSQLi, @rx, @eq"
                  required
                />
              </div>
              <div>
                <Label htmlFor="operatorData">Operator Data</Label>
                <Input
                  id="operatorData"
                  value={formData.operatorData}
                  onChange={(e) => setFormData(prev => ({ ...prev, operatorData: e.target.value }))}
                  placeholder="Pattern or value (if needed)"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="actions">Actions *</Label>
              <Textarea
                id="actions"
                value={formData.actions}
                onChange={(e) => setFormData(prev => ({ ...prev, actions: e.target.value }))}
                placeholder={'id:900001,phase:2,block,msg:"Attack Detected"'}
                rows={3}
                required
              />
              <p className="text-xs text-gray-500 mt-1">ModSecurity actions (comma-separated)</p>
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
            <Label htmlFor="enabled">Enable this rule immediately</Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

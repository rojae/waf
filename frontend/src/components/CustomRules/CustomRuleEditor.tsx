'use client'

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import {
  Save,
  TestTube,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lightbulb,
  Code,
  Play,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Types
interface CustomRule {
  id?: number;
  ruleId?: number;
  name: string;
  description?: string;
  categoryId?: number;
  ruleContent: string;
  phase: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  isActive: boolean;
  isBlocking: boolean;
  priority: number;
}

interface RuleCategory {
  id: number;
  name: string;
  description?: string;
  color: string;
}

interface ValidationResult {
  valid: boolean;
  estimatedType: string;
  ruleId: string;
  phase: number;
  severity: string;
  suggestions?: string[];
  error?: string;
}

interface TestResult {
  matched: boolean;
  action: string;
  message: string;
  executionTime: number;
  confidence: string;
  details: any;
}

interface CustomRuleEditorProps {
  rule?: CustomRule;
  onSave: (rule: CustomRule) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const CustomRuleEditor: React.FC<CustomRuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  isEdit = false
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CustomRule>({
    name: '',
    description: '',
    categoryId: undefined,
    ruleContent: '',
    phase: 2,
    severity: 'MEDIUM',
    isActive: true,
    isBlocking: true,
    priority: 100,
    ...rule
  });

  const [categories, setCategories] = useState<RuleCategory[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testInput, setTestInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Rule templates for quick start
  const ruleTemplates = [
    {
      name: 'SQL Injection Detection',
      content: `SecRule ARGS "@detectSQLi" \\
    "id:{{RULE_ID}},\\
    phase:2,\\
    block,\\
    msg:'SQL Injection Attack Detected',\\
    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\\
    t:none,t:urlDecodeUni,t:htmlEntityDecode,t:normalisePathWin"`
    },
    {
      name: 'XSS Protection',
      content: `SecRule ARGS "@detectXSS" \\
    "id:{{RULE_ID}},\\
    phase:2,\\
    block,\\
    msg:'XSS Attack Detected',\\
    logdata:'XSS Attack: %{MATCHED_VAR}',\\
    t:none,t:urlDecodeUni,t:htmlEntityDecode"`
    },
    {
      name: 'File Upload Restriction',
      content: `SecRule FILES_TMPNAMES "@detectExecutables" \\
    "id:{{RULE_ID}},\\
    phase:2,\\
    block,\\
    msg:'Executable File Upload Blocked',\\
    logdata:'File: %{MATCHED_VAR}'"`
    }
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  // Load rule categories
  const loadCategories = async () => {
    try {
      // Mock categories for now
      setCategories([
        { id: 1, name: 'SQL Injection', description: 'SQL injection protection', color: '#dc3545' },
        { id: 2, name: 'XSS', description: 'Cross-site scripting protection', color: '#fd7e14' },
        { id: 3, name: 'File Upload', description: 'File upload security', color: '#6f42c1' },
        { id: 4, name: 'Rate Limiting', description: 'Request rate limiting', color: '#20c997' },
        { id: 5, name: 'Custom Block', description: 'Custom blocking rules', color: '#6c757d' },
        { id: 6, name: 'Whitelist', description: 'Request whitelist rules', color: '#28a745' }
      ]);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Validate rule
  const validateRule = async () => {
    if (!formData.ruleContent.trim()) {
      setValidation({
        valid: false,
        error: 'Rule content is required',
        estimatedType: 'UNKNOWN',
        ruleId: 'AUTO',
        phase: formData.phase,
        severity: formData.severity
      });
      return;
    }

    try {
      setIsValidating(true);
      const response = await fetch('/api/v2/custom-rules/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        setValidation(result);

        if (result.valid) {
          toast({
            title: "Validation Passed",
            description: "Rule syntax appears to be valid",
          });
        } else {
          toast({
            title: "Validation Issues",
            description: result.error || "Rule has validation issues",
            variant: "destructive",
          });
        }
      } else {
        throw new Error('Validation failed');
      }
    } catch (error) {
      console.error('Error validating rule:', error);
      toast({
        title: "Validation Error",
        description: "Failed to validate rule",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Test rule against sample input
  const testRule = async () => {
    if (!formData.ruleContent.trim() || !testInput.trim()) {
      toast({
        title: "Test Requirements",
        description: "Both rule content and test input are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTesting(true);
      const response = await fetch('/api/v2/custom-rules/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ruleContent: formData.ruleContent,
          testInput: testInput,
          httpMethod: 'GET'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);

        toast({
          title: "Test Completed",
          description: result.matched
            ? `Rule would ${result.action} this input`
            : "Rule would not trigger on this input",
        });
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      console.error('Error testing rule:', error);
      toast({
        title: "Test Error",
        description: "Failed to test rule",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save rule
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.ruleContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule content is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/v2/custom-rules/${rule?.id}` : '/api/v2/custom-rules';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User': 'admin' // TODO: Get from auth context
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedRule = await response.json();
        toast({
          title: "Success",
          description: `Rule ${isEdit ? 'updated' : 'created'} successfully`,
        });
        onSave(savedRule);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save rule');
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: "Save Error",
        description: error instanceof Error ? error.message : "Failed to save rule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load template
  const loadTemplate = (template: any) => {
    setFormData({
      ...formData,
      ruleContent: template.content,
      name: formData.name || template.name
    });
    setValidation(null);
    setTestResult(null);
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'INFO': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rules
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? 'Edit Custom Rule' : 'New Custom Rule'}
            </h1>
            <p className="text-muted-foreground">
              Create or modify ModSecurity custom rules
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={validateRule}
            disabled={isValidating}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter rule name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ruleId">Rule ID</Label>
                  <Input
                    id="ruleId"
                    type="number"
                    min="9001"
                    max="9999"
                    value={formData.ruleId || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      ruleId: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    placeholder="Auto-assign (9001-9999)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this rule does"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.categoryId?.toString()}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      categoryId: value ? parseInt(value) : undefined
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
                  >
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

                <div className="space-y-2">
                  <Label htmlFor="phase">Phase</Label>
                  <Select
                    value={formData.phase.toString()}
                    onValueChange={(value) => setFormData({ ...formData, phase: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Request Headers</SelectItem>
                      <SelectItem value="2">2 - Request Body</SelectItem>
                      <SelectItem value="3">3 - Response Headers</SelectItem>
                      <SelectItem value="4">4 - Response Body</SelectItem>
                      <SelectItem value="5">5 - Logging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.priority}
                    onChange={(e) => setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 100
                    })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isBlocking"
                    checked={formData.isBlocking}
                    onCheckedChange={(checked) => setFormData({ ...formData, isBlocking: checked })}
                  />
                  <Label htmlFor="isBlocking">Blocking Mode</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rule Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rule Content</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={validateRule}
                    disabled={isValidating}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Validate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  value={formData.ruleContent}
                  onChange={(e) => setFormData({ ...formData, ruleContent: e.target.value })}
                  placeholder="Enter ModSecurity rule content..."
                  rows={8}
                  className="font-mono text-sm"
                />

                {validation && (
                  <div className={`p-4 rounded-lg border ${
                    validation.valid
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center mb-2">
                      {validation.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mr-2" />
                      )}
                      <span className="font-medium">
                        {validation.valid ? 'Validation Passed' : 'Validation Failed'}
                      </span>
                    </div>

                    {validation.error && (
                      <p className="text-red-700 mb-2">{validation.error}</p>
                    )}

                    {validation.suggestions && validation.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium text-sm">Suggestions:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {validation.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Badge className={getSeverityColor(validation.severity)}>
                        {validation.severity}
                      </Badge>
                      <Badge variant="secondary">
                        {validation.estimatedType}
                      </Badge>
                      <Badge variant="outline">
                        Phase {validation.phase}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rule Testing */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Testing</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="test" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="test">Test Rule</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="test" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="testInput">Test Input</Label>
                    <Textarea
                      id="testInput"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test input (e.g., malicious payload)"
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={testRule}
                    disabled={isTesting}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isTesting ? 'Testing...' : 'Test Rule'}
                  </Button>

                  {testResult && (
                    <div className={`p-4 rounded-lg border ${
                      testResult.matched
                        ? 'bg-red-50 border-red-200'
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center mb-2">
                        {testResult.matched ? (
                          <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        )}
                        <span className="font-medium">
                          {testResult.matched ? 'Rule Triggered' : 'Rule Not Triggered'}
                        </span>
                      </div>

                      <p className="mb-2">{testResult.message}</p>

                      <div className="flex gap-2">
                        <Badge variant={testResult.matched ? 'destructive' : 'secondary'}>
                          {testResult.action}
                        </Badge>
                        <Badge variant="outline">
                          {testResult.confidence} Confidence
                        </Badge>
                        <Badge variant="outline">
                          {testResult.executionTime.toFixed(2)}ms
                        </Badge>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="templates" className="space-y-4">
                  <div className="grid gap-3">
                    {ruleTemplates.map((template, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                        onClick={() => loadTemplate(template)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Click to load this template
                            </p>
                          </div>
                          <Code className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rule ID:</span>
                  <span className="font-mono text-sm">
                    {formData.ruleId || 'Auto-assign'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Phase:</span>
                  <span className="text-sm">{formData.phase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Priority:</span>
                  <span className="text-sm">{formData.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <div className="flex items-center">
                    {formData.isActive ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400 mr-1" />
                    )}
                    <span className="text-sm">
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mode:</span>
                  <div className="flex items-center">
                    {formData.isBlocking ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 mr-1" />
                    ) : (
                      <Eye className="w-4 h-4 text-blue-600 mr-1" />
                    )}
                    <span className="text-sm">
                      {formData.isBlocking ? 'Blocking' : 'Monitor'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Badge className={getSeverityColor(formData.severity)}>
                  {formData.severity}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="w-4 h-4 mr-2" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Rule ID Range</p>
                <p className="text-muted-foreground">
                  Custom rules should use IDs 9001-9999
                </p>
              </div>
              <div>
                <p className="font-medium">Phase Selection</p>
                <p className="text-muted-foreground">
                  Phase 2 (Request Body) is most common for attack detection
                </p>
              </div>
              <div>
                <p className="font-medium">Testing</p>
                <p className="text-muted-foreground">
                  Always test rules before deploying to production
                </p>
              </div>
              <div>
                <p className="font-medium">Priority</p>
                <p className="text-muted-foreground">
                  Higher numbers execute first (1-1000)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomRuleEditor;
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Shield,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Rocket,
  Filter
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Types
interface CustomRule {
  id: number;
  ruleId: number;
  name: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  ruleContent: string;
  phase: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  isActive: boolean;
  isBlocking: boolean;
  priority: number;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  lastDeployedAt?: string;
  deploymentVersion?: string;
}

interface RuleStats {
  totalRules: number;
  activeRules: number;
  blockingRules: number;
  monitoringRules: number;
  recentlyCreated: number;
  needingDeployment: number;
}

const CustomRulesList: React.FC = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [stats, setStats] = useState<RuleStats>({
    totalRules: 0,
    activeRules: 0,
    blockingRules: 0,
    monitoringRules: 0,
    recentlyCreated: 0,
    needingDeployment: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);

  // Load rules and stats
  const loadRules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        size: '20',
        sortBy: 'priority',
        sortDir: 'desc'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (selectedStatus === 'active') params.append('isActive', 'true');
      if (selectedStatus === 'inactive') params.append('isActive', 'false');

      const response = await fetch(`/api/v2/custom-rules?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data.content || []);
        setTotalPages(data.totalPages || 0);
      } else {
        throw new Error('Failed to load rules');
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: "Error",
        description: "Failed to load custom rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/v2/custom-rules/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadRules();
    loadStats();
  }, [currentPage, searchTerm, selectedSeverity, selectedStatus]);

  // Toggle rule status
  const toggleRuleStatus = async (ruleId: number) => {
    try {
      const response = await fetch(`/api/v2/custom-rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: {
          'X-User': 'admin' // TODO: Get from auth context
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Rule status updated successfully",
        });
        loadRules();
        loadStats();
      } else {
        throw new Error('Failed to toggle rule status');
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: "Error",
        description: "Failed to toggle rule status",
        variant: "destructive",
      });
    }
  };

  // Delete rule
  const deleteRule = async (ruleId: number) => {
    try {
      const response = await fetch(`/api/v2/custom-rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Rule deleted successfully",
        });
        loadRules();
        loadStats();
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    }
  };

  // Deploy rules
  const deployRules = async () => {
    try {
      setIsDeploying(true);
      const response = await fetch('/api/v2/custom-rules/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': 'admin' // TODO: Get from auth context
        },
        body: JSON.stringify({
          notes: `Manual deployment triggered at ${new Date().toISOString()}`
        })
      });

      if (response.ok) {
        toast({
          title: "Deployment Started",
          description: "Custom rules are being deployed to WAF instances",
        });

        // Refresh data after a delay
        setTimeout(() => {
          loadRules();
          loadStats();
        }, 2000);
      } else {
        throw new Error('Failed to deploy rules');
      }
    } catch (error) {
      console.error('Error deploying rules:', error);
      toast({
        title: "Deployment Failed",
        description: "Failed to deploy custom rules",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Get severity badge color
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

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Rules</h1>
          <p className="text-muted-foreground">
            Manage ModSecurity custom rules and deploy them to WAF instances
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={deployRules}
            disabled={isDeploying}
            variant="secondary"
          >
            <Rocket className="w-4 h-4 mr-2" />
            {isDeploying ? 'Deploying...' : 'Deploy Rules'}
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{stats.totalRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.activeRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Blocking</p>
                <p className="text-2xl font-bold">{stats.blockingRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Eye className="h-4 w-4 text-blue-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Monitoring</p>
                <p className="text-2xl font-bold">{stats.monitoringRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Plus className="h-4 w-4 text-purple-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Recent</p>
                <p className="text-2xl font-bold">{stats.recentlyCreated}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Pending Deploy</p>
                <p className="text-2xl font-bold">{stats.needingDeployment}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Filter className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Last Deployed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono">{rule.ruleId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {rule.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.categoryName && (
                          <Badge variant="secondary">{rule.categoryName}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(rule.severity)}>
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {rule.isActive ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          ) : (
                            <PowerOff className="w-4 h-4 text-gray-400 mr-2" />
                          )}
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {rule.isBlocking ? (
                            <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                          ) : (
                            <Eye className="w-4 h-4 text-blue-600 mr-2" />
                          )}
                          {rule.isBlocking ? 'Blocking' : 'Monitor'}
                        </div>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>{formatDate(rule.lastDeployedAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleRuleStatus(rule.id)}>
                              {rule.isActive ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Disable Rule
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Enable Rule
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                                  Delete Rule
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Custom Rule</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the rule "{rule.name}"?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteRule(rule.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {rules.length === 0 && !loading && (
                <div className="text-center py-8">
                  <Shield className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No custom rules</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating your first custom rule.
                  </p>
                  <div className="mt-6">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Rule
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomRulesList;
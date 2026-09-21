interface CustomRule {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  variables?: string;
  operator?: string;
  operatorData?: string;
  actions?: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RuleDeployment {
  id: number;
  deploymentStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  deployedAt?: string;
  errorMessage?: string;
}

interface CreateRuleRequest {
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  variables: string;
  operator: string;
  operatorData: string;
  actions: string;
  priority: number;
  enabled: boolean;
}

class CustomRuleAPI {
  private baseUrl = '';

  async getAllRules(): Promise<CustomRule[]> {
    const response = await fetch(`${this.baseUrl}/api/rules`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch rules: ${response.statusText}`);
    }

    return response.json();
  }

  async getRuleById(id: number): Promise<CustomRule> {
    const response = await fetch(`${this.baseUrl}/api/rules/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch rule: ${response.statusText}`);
    }

    return response.json();
  }

  async createRule(rule: CreateRuleRequest): Promise<CustomRule> {
    const response = await fetch(`${this.baseUrl}/api/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create rule: ${response.statusText}`);
    }

    return response.json();
  }

  async updateRule(id: number, rule: Partial<CreateRuleRequest>): Promise<CustomRule> {
    const response = await fetch(`${this.baseUrl}/api/rules/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update rule: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteRule(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/rules/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete rule: ${response.statusText}`);
    }
  }

  async toggleRule(id: number, enabled: boolean): Promise<CustomRule> {
    const response = await fetch(`${this.baseUrl}/api/rules/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to toggle rule: ${response.statusText}`);
    }

    return response.json();
  }

  async validateRule(rule: CreateRuleRequest): Promise<{valid: boolean, errors: string[]}> {
    const response = await fetch(`${this.baseUrl}/api/rules/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      throw new Error(`Failed to validate rule: ${response.statusText}`);
    }

    return response.json();
  }

  async deployRules(): Promise<RuleDeployment> {
    const response = await fetch(`${this.baseUrl}/api/rules/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to deploy rules: ${response.statusText}`);
    }

    return response.json();
  }

  async getDeploymentStatus(): Promise<RuleDeployment | null> {
    const response = await fetch(`${this.baseUrl}/api/rules/deployment-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${response.statusText}`);
    }

    return response.json();
  }
}

export const customRuleAPI = new CustomRuleAPI();
export type { CustomRule, CreateRuleRequest, RuleDeployment };

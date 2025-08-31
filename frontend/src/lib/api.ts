const API_BASE_URL = '' // Use relative paths for frontend API routes

export class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Dashboard APIs (now proxied through frontend API routes)
  async getMetrics() {
    return this.request('/api/dashboard/metrics')
  }

  async getLogs(params?: {
    page?: number
    size?: number
    severity?: string
    attackType?: string
    clientIp?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.page !== undefined) searchParams.set('page', params.page.toString())
    if (params?.size !== undefined) searchParams.set('size', params.size.toString())
    if (params?.severity) searchParams.set('severity', params.severity)
    if (params?.attackType) searchParams.set('attackType', params.attackType)
    if (params?.clientIp) searchParams.set('clientIp', params.clientIp)

    const query = searchParams.toString()
    return this.request(`/api/dashboard/logs${query ? `?${query}` : ''}`)
  }

  // Custom Rules APIs
  async getRules() {
    return this.request('/api/rules')
  }

  async getRule(id: string) {
    return this.request(`/api/rules/${id}`)
  }

  async createRule(rule: Record<string, unknown>) {
    return this.request('/api/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    })
  }

  async updateRule(id: string, rule: Record<string, unknown>) {
    return this.request(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    })
  }

  async deleteRule(id: string) {
    return this.request(`/api/rules/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleRule(id: string) {
    return this.request(`/api/rules/${id}/toggle`, {
      method: 'PUT',
    })
  }

  // Whitelist APIs
  async getWhitelist() {
    return this.request('/api/whitelist')
  }

  async getWhitelistEntry(id: string) {
    return this.request(`/api/whitelist/${id}`)
  }

  async createWhitelistEntry(entry: Record<string, unknown>) {
    return this.request('/api/whitelist', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
  }

  async updateWhitelistEntry(id: string, entry: Record<string, unknown>) {
    return this.request(`/api/whitelist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    })
  }

  async deleteWhitelistEntry(id: string) {
    return this.request(`/api/whitelist/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleWhitelistEntry(id: string) {
    return this.request(`/api/whitelist/${id}/toggle`, {
      method: 'PUT',
    })
  }

  // Alerts APIs (proxied through frontend)
  async getRecentAlerts() {
    return this.request('/api/alerts/recent')
  }

  createAlertStream() {
    // For SSE streams, we need to go directly to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'
    return new EventSource(`${backendUrl}/api/alerts/stream`)
  }
}

export const apiClient = new ApiClient()
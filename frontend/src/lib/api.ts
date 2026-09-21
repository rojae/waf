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

    if (response.status === 204 || response.status === 205) {
      return undefined as T
    }

    const body = await response.text()
    if (!body) {
      return undefined as T
    }

    return JSON.parse(body) as T
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
  async getRules<T = unknown>() {
    return this.request<T>('/api/rules')
  }

  async getRule<T = unknown>(id: string) {
    return this.request<T>(`/api/rules/${id}`)
  }

  async createRule<T = unknown>(rule: object) {
    return this.request<T>('/api/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    })
  }

  async updateRule<T = unknown>(id: string, rule: object) {
    return this.request<T>(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    })
  }

  async deleteRule(id: string) {
    return this.request(`/api/rules/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleRule<T = unknown>(id: string, enabled: boolean) {
    return this.request<T>(`/api/rules/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  }

  // Whitelist APIs
  async getWhitelist<T = unknown>() {
    return this.request<T>('/api/whitelist')
  }

  async getWhitelistEntry<T = unknown>(id: string) {
    return this.request<T>(`/api/whitelist/${id}`)
  }

  async createWhitelistEntry<T = unknown>(entry: object) {
    return this.request<T>('/api/whitelist', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
  }

  async updateWhitelistEntry<T = unknown>(id: string, entry: object) {
    return this.request<T>(`/api/whitelist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    })
  }

  async deleteWhitelistEntry(id: string) {
    return this.request(`/api/whitelist/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleWhitelistEntry<T = unknown>(id: string, enabled: boolean) {
    return this.request<T>(`/api/whitelist/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  }

  // Alerts APIs (proxied through frontend)
  async getRecentAlerts() {
    return this.request('/api/alerts/recent')
  }

  createAlertStream() {
    // Use Next.js API route proxy for SSE streams
    return new EventSource(`/api/alerts/stream`)
  }
}

export const apiClient = new ApiClient()

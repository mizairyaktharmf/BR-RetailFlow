/**
 * API Service for Admin Dashboard
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

class ApiService {
  constructor() {
    this.baseUrl = API_URL
    this.token = null
  }

  // Get auth token from localStorage
  getToken() {
    if (this.token) return this.token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('br_admin_token')
    }
    return this.token
  }

  // Set auth token
  setToken(token) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('br_admin_token', token)
    }
  }

  // Remove auth token
  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('br_admin_token')
      localStorage.removeItem('br_admin_user')
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
    }
  }

  // Get headers with auth
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    }
    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const config = {
      headers: this.getHeaders(),
      ...options,
    }

    try {
      const response = await fetch(url, config)

      if (response.status === 401) {
        this.clearToken()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Unauthorized')
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || `HTTP error! status: ${response.status}`)
      }

      const text = await response.text()
      return text ? JSON.parse(text) : {}
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }

  // ============ AUTH ============
  async login(username, password) {
    const url = `${this.baseUrl}/auth/login`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(data.detail || 'Login failed')
      error.status = response.status
      throw error
    }

    if (data.access_token) {
      this.setToken(data.access_token)
      localStorage.setItem('br_admin_user', JSON.stringify(data.user))
      localStorage.setItem('admin_user', JSON.stringify(data.user))
    }
    return data
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Ignore logout errors
    }
    this.clearToken()
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  }

  async updateProfile(data) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ============ FLAVORS ============
  async getFlavors() {
    return this.request('/flavors')
  }

  async getFlavor(id) {
    return this.request(`/flavors/${id}`)
  }

  async createFlavor(data) {
    return this.request('/flavors', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateFlavor(id, data) {
    return this.request(`/flavors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteFlavor(id) {
    return this.request(`/flavors/${id}`, {
      method: 'DELETE',
    })
  }

  // ============ TERRITORIES ============
  async getTerritories() {
    return this.request('/territories')
  }

  async getTerritory(id) {
    return this.request(`/territories/${id}`)
  }

  async createTerritory(data) {
    return this.request('/territories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTerritory(id, data) {
    return this.request(`/territories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTerritory(id) {
    return this.request(`/territories/${id}`, {
      method: 'DELETE',
    })
  }

  // ============ AREAS ============
  async getAreas(territoryId = null) {
    const endpoint = territoryId ? `/areas?territory_id=${territoryId}` : '/areas'
    return this.request(endpoint)
  }

  async getArea(id) {
    return this.request(`/areas/${id}`)
  }

  async createArea(data) {
    return this.request('/areas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateArea(id, data) {
    return this.request(`/areas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteArea(id) {
    return this.request(`/areas/${id}`, {
      method: 'DELETE',
    })
  }

  // ============ BRANCHES ============
  async getBranches(filters = {}) {
    const params = new URLSearchParams()
    if (filters.territory_id) params.append('territory_id', filters.territory_id)
    if (filters.area_id) params.append('area_id', filters.area_id)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/branches${query}`)
  }

  async getBranch(id) {
    return this.request(`/branches/${id}`)
  }

  async createBranch(data) {
    return this.request('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateBranch(id, data) {
    return this.request(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteBranch(id) {
    return this.request(`/branches/${id}`, {
      method: 'DELETE',
    })
  }

  async assignBranch(branchId, data) {
    return this.request(`/branches/${branchId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============ USERS ============
  async getUsers(filters = {}) {
    const params = new URLSearchParams()
    if (filters.role) params.append('role', filters.role)
    if (filters.branch_id) params.append('branch_id', filters.branch_id)
    if (filters.territory_id) params.append('territory_id', filters.territory_id)
    if (filters.area_id) params.append('area_id', filters.area_id)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/users${query}`)
  }

  async getUser(id) {
    return this.request(`/users/${id}`)
  }

  async createUser(data) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async resetUserPassword(id) {
    return this.request(`/users/${id}/reset-password`, {
      method: 'POST',
    })
  }

  async getPendingApprovals() {
    return this.request('/users/pending-approvals')
  }

  async approveUser(id) {
    return this.request(`/users/${id}/approve`, {
      method: 'POST',
    })
  }

  async rejectUser(id) {
    return this.request(`/users/${id}/reject`, {
      method: 'POST',
    })
  }

  async assignUser(id, data) {
    return this.request(`/users/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============ INVENTORY ============
  async getInventory(filters = {}) {
    const params = new URLSearchParams()
    if (filters.branch_id) params.append('branch_id', filters.branch_id)
    if (filters.date) params.append('date', filters.date)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/inventory${query}`)
  }

  async submitClosingInventory(data) {
    return this.request('/inventory/daily/bulk', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        entry_type: 'closing',
      }),
    })
  }

  // ============ REPORTS ============
  async getDashboardStats(filters = {}) {
    const params = new URLSearchParams()
    if (filters.territory_id) params.append('territory_id', filters.territory_id)
    if (filters.area_id) params.append('area_id', filters.area_id)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/reports/dashboard${query}`)
  }

  async getConsumptionReport(filters = {}) {
    const params = new URLSearchParams()
    if (filters.branch_id) params.append('branch_id', filters.branch_id)
    if (filters.territory_id) params.append('territory_id', filters.territory_id)
    if (filters.area_id) params.append('area_id', filters.area_id)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/reports/consumption${query}`)
  }

  async getBranchReport(branchId, filters = {}) {
    const params = new URLSearchParams()
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request(`/reports/branch/${branchId}${query}`)
  }

  // ============ CAKE INVENTORY ============
  async getCakeProducts() {
    return this.request('/cake/cake-products')
  }

  async createCakeProduct(data) {
    return this.request('/cake/cake-products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCakeProduct(id, data) {
    return this.request(`/cake/cake-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getCakeStock(branchId) {
    return this.request(`/cake/cake-stock/${branchId}`)
  }

  async getCakeStockLogs(branchId, dateFrom, dateTo) {
    return this.request(`/cake/cake-stock/logs/${branchId}?date_from=${dateFrom}&date_to=${dateTo}`)
  }

  async getCakeLowStockAlerts() {
    return this.request('/cake/cake-stock/alerts')
  }

  async getCakeAlertConfigs(branchId) {
    return this.request(`/cake/cake-stock/alerts/config/${branchId}`)
  }
}

const api = new ApiService()
export default api

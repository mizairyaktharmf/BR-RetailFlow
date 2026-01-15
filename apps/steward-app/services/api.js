/**
 * API Service
 * Handles all HTTP requests to the backend
 */

const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1'

class ApiService {
  constructor() {
    this.baseUrl = API_URL
    this.token = null
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('br_token', token)
    }
  }

  /**
   * Get stored token
   */
  getToken() {
    if (this.token) return this.token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('br_token')
    }
    return this.token
  }

  /**
   * Clear authentication
   */
  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('br_token')
      localStorage.removeItem('br_user')
    }
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const token = this.getToken()

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (response.status === 401) {
        this.clearToken()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Unauthorized')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong')
      }

      return data
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }

  // ============== AUTH ==============

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    this.setToken(data.access_token)
    if (typeof window !== 'undefined') {
      localStorage.setItem('br_user', JSON.stringify(data.user))
    }
    return data
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' })
    } finally {
      this.clearToken()
    }
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  // ============== FLAVORS ==============

  async getFlavors() {
    return this.request('/flavors')
  }

  // ============== INVENTORY ==============

  async getOpeningInventory(branchId, date) {
    return this.request(`/inventory/daily/opening?branch_id=${branchId}&date=${date}`)
  }

  async getDailyInventory(branchId, dateFrom, dateTo) {
    return this.request(`/inventory/daily?branch_id=${branchId}&date_from=${dateFrom}&date_to=${dateTo}`)
  }

  async submitOpeningInventory(data) {
    return this.request('/inventory/daily/bulk', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        entry_type: 'opening',
      }),
    })
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

  async getDailySummary(branchId, date) {
    return this.request(`/inventory/summary/${branchId}/${date}`)
  }

  // ============== TUB RECEIPTS ==============

  async getTubReceipts(branchId, dateFrom, dateTo) {
    return this.request(`/inventory/receipts?branch_id=${branchId}&date_from=${dateFrom}&date_to=${dateTo}`)
  }

  async submitTubReceipt(data) {
    return this.request('/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async submitBulkTubReceipts(data) {
    return this.request('/inventory/receipts/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============== SALES ==============

  async submitSales(data) {
    return this.request('/sales/daily', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getDailySales(branchId, date) {
    return this.request(`/sales/daily?branch_id=${branchId}&date=${date}`)
  }

  async uploadSalesPhoto(file) {
    const formData = new FormData()
    formData.append('file', file)

    const token = this.getToken()
    const response = await fetch(`${this.baseUrl}/sales/upload-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload photo')
    }

    return response.json()
  }

  // ============== CUP USAGE ==============

  async submitCupUsage(data) {
    return this.request('/cups/usage', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCupUsage(branchId, date) {
    return this.request(`/cups/usage?branch_id=${branchId}&date=${date}`)
  }

  // ============== PROMOTIONS ==============

  async getActivePromotions() {
    return this.request('/promotions/active')
  }

  async submitPromotionUsage(data) {
    return this.request('/promotions/usage', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiService()
export default api

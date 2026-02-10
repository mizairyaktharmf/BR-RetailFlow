/**
 * Tests for API service
 * Run: cd apps/admin-dashboard && npm test
 */

// Mock fetch globally
global.fetch = jest.fn()

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: jest.fn(key => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => { localStorageMock.store[key] = value }),
  removeItem: jest.fn(key => { delete localStorageMock.store[key] }),
  clear: jest.fn(() => { localStorageMock.store = {} })
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Import after mocks
const ApiService = require('../services/api').default

beforeEach(() => {
  jest.clearAllMocks()
  localStorageMock.store = {}
})

// ============ API SERVICE BASICS ============

describe('ApiService', () => {
  test('exists and has required methods', () => {
    expect(ApiService).toBeDefined()
    expect(typeof ApiService.login).toBe('function')
    expect(typeof ApiService.request).toBe('function')
    expect(typeof ApiService.getToken).toBe('function')
    expect(typeof ApiService.setToken).toBe('function')
    expect(typeof ApiService.clearToken).toBe('function')
  })

  test('baseUrl uses environment variable or default', () => {
    expect(ApiService.baseUrl).toBeDefined()
    expect(typeof ApiService.baseUrl).toBe('string')
    expect(ApiService.baseUrl).toContain('/api/v1')
  })
})

// ============ TOKEN MANAGEMENT ============

describe('Token Management', () => {
  test('setToken stores token in localStorage', () => {
    ApiService.setToken('test-token-123')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('br_admin_token', 'test-token-123')
  })

  test('getToken retrieves token from localStorage', () => {
    localStorageMock.store['br_admin_token'] = 'stored-token'
    ApiService.token = null // Reset cache
    const token = ApiService.getToken()
    expect(token).toBe('stored-token')
  })

  test('clearToken removes token and user from localStorage', () => {
    ApiService.clearToken()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('br_admin_token')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('br_admin_user')
  })
})

// ============ LOGIN ============

describe('Login', () => {
  test('login sends correct request', async () => {
    const mockResponse = {
      access_token: 'token123',
      refresh_token: 'refresh123',
      user: { id: 1, username: 'admin', role: 'supreme_admin' }
    }

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    })

    const result = await ApiService.login('admin', 'password123')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toContain('/api/v1/auth/login')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      username: 'admin',
      password: 'password123'
    })
    expect(result.access_token).toBe('token123')
  })

  test('login stores token on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-token',
        user: { id: 1, username: 'admin' }
      })
    })

    await ApiService.login('admin', 'pass')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('br_admin_token', 'new-token')
  })

  test('login throws on invalid credentials', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid username or password' })
    })

    // Should redirect on 401
    delete global.window
    global.window = { location: { href: '' } }

    await expect(ApiService.login('wrong', 'wrong')).rejects.toThrow()
  })
})

// ============ REQUEST METHOD ============

describe('Request Method', () => {
  test('adds authorization header when token exists', async () => {
    ApiService.token = 'bearer-token'

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' })
    })

    await ApiService.request('/test-endpoint')

    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer bearer-token')
  })

  test('handles 401 by clearing token', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' })
    })

    delete global.window
    global.window = { location: { href: '' } }

    await expect(ApiService.request('/test')).rejects.toThrow('Unauthorized')
  })

  test('handles server errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Internal server error' })
    })

    await expect(ApiService.request('/test')).rejects.toThrow()
  })
})

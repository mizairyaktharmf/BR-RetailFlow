/**
 * Tests for utility functions
 * Run: cd apps/admin-dashboard && npm test
 */

import { formatCurrency, getCurrentSalesWindow, SALES_WINDOWS } from '../lib/utils'

// ============ FORMAT CURRENCY ============

describe('formatCurrency', () => {
  test('formats positive amounts correctly', () => {
    const result = formatCurrency(100)
    expect(result).toContain('100')
    expect(result).toContain('AED')
  })

  test('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  test('formats decimal amounts', () => {
    const result = formatCurrency(99.99)
    expect(result).toContain('99.99')
  })

  test('formats large amounts', () => {
    const result = formatCurrency(1000000)
    expect(result).toContain('1,000,000')
  })
})

// ============ SALES WINDOWS ============

describe('SALES_WINDOWS', () => {
  test('has 4 windows defined', () => {
    expect(SALES_WINDOWS).toHaveLength(4)
  })

  test('windows have correct ids', () => {
    const ids = SALES_WINDOWS.map(w => w.id)
    expect(ids).toEqual(['3pm', '7pm', '9pm', 'closing'])
  })

  test('each window has required fields', () => {
    SALES_WINDOWS.forEach(window => {
      expect(window).toHaveProperty('id')
      expect(window).toHaveProperty('label')
      expect(window).toHaveProperty('time')
      expect(window).toHaveProperty('hour')
    })
  })

  test('window hours are in correct order', () => {
    const hours = SALES_WINDOWS.map(w => w.hour)
    expect(hours).toEqual([15, 19, 21, 22])
  })
})

// ============ SALES WINDOW LOGIC ============

describe('getCurrentSalesWindow', () => {
  test('returns null outside sales windows', () => {
    // Mock time to 10 AM
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 1, 10, 10, 0, 0))
    expect(getCurrentSalesWindow()).toBeNull()
    jest.useRealTimers()
  })

  test('returns 3pm during 3PM window', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 1, 10, 15, 30, 0))
    expect(getCurrentSalesWindow()).toBe('3pm')
    jest.useRealTimers()
  })

  test('returns 7pm during 7PM window', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 1, 10, 19, 30, 0))
    expect(getCurrentSalesWindow()).toBe('7pm')
    jest.useRealTimers()
  })

  test('returns 9pm during 9PM window', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 1, 10, 21, 30, 0))
    expect(getCurrentSalesWindow()).toBe('9pm')
    jest.useRealTimers()
  })

  test('returns closing after 10PM', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 1, 10, 23, 0, 0))
    expect(getCurrentSalesWindow()).toBe('closing')
    jest.useRealTimers()
  })
})

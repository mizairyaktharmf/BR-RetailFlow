import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format date to readable string
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-AE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format time to readable string
 */
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-AE', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format currency (AED)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2
  }).format(amount)
}

/**
 * Check if current time is within a sales window
 * Windows: 3PM (15:00-16:00), 7PM (19:00-20:00), 9PM (21:00-22:00), Closing (22:00+)
 */
export function getCurrentSalesWindow() {
  const now = new Date()
  const hour = now.getHours()

  if (hour >= 15 && hour < 16) return '3pm'
  if (hour >= 19 && hour < 20) return '7pm'
  if (hour >= 21 && hour < 22) return '9pm'
  if (hour >= 22 || hour < 6) return 'closing'

  return null
}

/**
 * Get next sales window info
 */
export function getNextSalesWindow() {
  const now = new Date()
  const hour = now.getHours()

  if (hour < 15) {
    return { window: '3pm', opensAt: '3:00 PM', opensIn: getTimeUntil(15) }
  }
  if (hour >= 16 && hour < 19) {
    return { window: '7pm', opensAt: '7:00 PM', opensIn: getTimeUntil(19) }
  }
  if (hour >= 20 && hour < 21) {
    return { window: '9pm', opensAt: '9:00 PM', opensIn: getTimeUntil(21) }
  }
  if (hour >= 22 || hour < 6) {
    return { window: 'closing', opensAt: 'Now', opensIn: 'Open now' }
  }

  return null
}

function getTimeUntil(targetHour) {
  const now = new Date()
  const target = new Date()
  target.setHours(targetHour, 0, 0, 0)

  const diff = target - now
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Check if a sales window is currently open
 */
export function isWindowOpen(windowType) {
  const currentWindow = getCurrentSalesWindow()
  return currentWindow === windowType
}

/**
 * Sales windows configuration
 */
export const SALES_WINDOWS = [
  { id: '3pm', label: '3 PM Report', time: '3:00 PM - 4:00 PM', hour: 15 },
  { id: '7pm', label: '7 PM Report', time: '7:00 PM - 8:00 PM', hour: 19 },
  { id: '9pm', label: '9 PM Report', time: '9:00 PM - 10:00 PM', hour: 21 },
  { id: 'closing', label: 'Closing Report', time: '10:00 PM onwards', hour: 22 }
]

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  IceCream,
  Package,
  TrendingUp,
  Clock,
  LogOut,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Camera,
  ClipboardList,
  AlertCircle,
  Cake,
  PackagePlus,
  Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatDate, getCurrentSalesWindow, getNextSalesWindow, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSync, setPendingSync] = useState({ total: 0 })
  const [currentWindow, setCurrentWindow] = useState(null)
  const [nextWindow, setNextWindow] = useState(null)
  const [todayDate, setTodayDate] = useState('')
  const [cakeAlerts, setCakeAlerts] = useState([])

  useEffect(() => {
    // Check authentication
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
    const branchData = localStorage.getItem('br_branch')
    if (branchData) setBranch(JSON.parse(branchData))

    // Set today's date
    setTodayDate(formatDate(new Date()))

    // Check online status
    setIsOnline(navigator.onLine)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))

    // Check sales window
    const checkWindow = () => {
      setCurrentWindow(getCurrentSalesWindow())
      setNextWindow(getNextSalesWindow())
    }
    checkWindow()
    const windowInterval = setInterval(checkWindow, 60000) // Check every minute

    // Check pending sync count
    const checkPending = async () => {
      const pending = await offlineStore.getPendingCount()
      setPendingSync(pending)
    }
    checkPending()

    // Load cake low-stock alerts
    const loadCakeAlerts = async () => {
      try {
        const alertData = await api.getCakeLowStockAlerts()
        setCakeAlerts(alertData.alerts || [])
      } catch (err) {
        // Silently fail - alerts are not critical
      }
    }
    loadCakeAlerts()

    return () => {
      window.removeEventListener('online', () => setIsOnline(true))
      window.removeEventListener('offline', () => setIsOnline(false))
      clearInterval(windowInterval)
    }
  }, [router])

  const handleLogout = () => {
    api.clearToken()
    router.push('/login')
  }

  const menuItems = [
    {
      title: 'Ice Cream Inventory',
      description: 'Record opening & closing stock for each flavor',
      icon: IceCream,
      href: '/inventory',
      color: 'bg-pink-500',
      info: 'Track daily inventory levels by measuring each tub'
    },
    {
      title: 'Receive from Warehouse',
      description: 'Record new tubs received today',
      icon: Package,
      href: '/receive',
      color: 'bg-blue-500',
      info: 'Log incoming stock with quantity and reference number'
    },
    {
      title: 'Submit Sales Report',
      description: currentWindow
        ? `${currentWindow.toUpperCase()} window is OPEN now!`
        : nextWindow
          ? `Next window: ${nextWindow.opensAt}`
          : 'Submit sales with photo proof',
      icon: Camera,
      href: '/sales',
      color: currentWindow ? 'bg-green-500' : 'bg-orange-500',
      info: 'Report sales at 3PM, 7PM, 9PM, and Closing',
      highlight: !!currentWindow
    },
    {
      title: 'Daily Summary',
      description: 'View today\'s complete summary',
      icon: ClipboardList,
      href: '/summary',
      color: 'bg-purple-500',
      info: 'See consumption, sales, and inventory at a glance'
    },
    {
      title: 'Cake Stock',
      description: cakeAlerts.length > 0
        ? `${cakeAlerts.length} low stock alert${cakeAlerts.length > 1 ? 's' : ''}!`
        : 'View and record cake sales',
      icon: Cake,
      href: '/cake/stock',
      color: cakeAlerts.length > 0 ? 'bg-red-500' : 'bg-orange-500',
      info: 'Track cake inventory and record sales in real-time',
      highlight: cakeAlerts.length > 0
    },
    {
      title: 'Receive Cakes',
      description: 'Record cakes from warehouse',
      icon: PackagePlus,
      href: '/cake/receive',
      color: 'bg-emerald-500',
      info: 'Log incoming cake deliveries from warehouse'
    },
  ]

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white safe-area-top">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <IceCream className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg">BR-RetailFlow</h1>
                <p className="text-pink-100 text-sm">{user.full_name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          {/* Branch Info */}
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-xs">Branch</p>
                <p className="font-medium">{branch?.name || user.branch_name || 'My Branch'}</p>
              </div>
              <div className="text-right">
                <p className="text-pink-100 text-xs">Today</p>
                <p className="font-medium">{todayDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!isOnline && (
        <Alert variant="warning" className="mx-4 mt-4">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>You're Offline</AlertTitle>
          <AlertDescription>
            Your data will be saved locally and synced when you're back online.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Sync */}
      {pendingSync.total > 0 && isOnline && (
        <Alert variant="info" className="mx-4 mt-4">
          <RefreshCw className="h-4 w-4" />
          <AlertTitle>Pending Sync</AlertTitle>
          <AlertDescription>
            {pendingSync.total} items waiting to sync with server.
          </AlertDescription>
        </Alert>
      )}

      {/* Cake Low Stock Alerts */}
      {cakeAlerts.length > 0 && (
        <Alert className="mx-4 mt-4 border-red-500 bg-red-50 cursor-pointer" onClick={() => router.push('/cake/stock')}>
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">
            Low Cake Stock! ({cakeAlerts.length} item{cakeAlerts.length > 1 ? 's' : ''})
          </AlertTitle>
          <AlertDescription className="text-red-700">
            {cakeAlerts.slice(0, 3).map(a => `${a.cake_name}: ${a.current_quantity} pcs`).join(' | ')}
            {cakeAlerts.length > 3 && ` +${cakeAlerts.length - 3} more`}
          </AlertDescription>
        </Alert>
      )}

      {/* Sales Window Alert */}
      {currentWindow && (
        <Alert variant="success" className="mx-4 mt-4 border-green-500 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sales Window Open!</AlertTitle>
          <AlertDescription className="text-green-700">
            The {currentWindow.toUpperCase()} sales reporting window is now open.
            Don't forget to submit your sales with a photo!
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-gradient-to-br from-pink-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-pink-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Next Window</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {nextWindow?.opensAt || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {nextWindow?.opensIn || ''}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                {isOnline ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <WifiOff className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">Status</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-xs text-gray-500">
                {pendingSync.total > 0 ? `${pendingSync.total} pending` : 'All synced'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Menu */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Card
              key={item.href}
              className={`cursor-pointer transition-all hover:shadow-md ${
                item.highlight ? 'ring-2 ring-green-500 ring-offset-2' : ''
              }`}
              onClick={() => router.push(item.href)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500 truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
                {/* Info tooltip */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-400">{item.info}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sales Windows Info */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sales Reporting Windows</h2>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Submit your sales report during these time windows. Each window is open for 1 hour.
              </p>
              <div className="space-y-3">
                {SALES_WINDOWS.map((window) => {
                  const isActive = currentWindow === window.id
                  return (
                    <div
                      key={window.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isActive
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                          {window.label}
                        </p>
                        <p className={`text-sm ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                          {window.time}
                        </p>
                      </div>
                      {isActive && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                          OPEN
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <div className="mt-8">
          <Card className="bg-gradient-to-br from-gray-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                This app helps you manage daily ice cream inventory and report sales.
                Your accurate data helps the company order the right amount of each flavor.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">1.</span>
                  <span className="text-gray-600">Start each day by recording opening inventory</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">2.</span>
                  <span className="text-gray-600">Record any new tubs received from warehouse</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">3.</span>
                  <span className="text-gray-600">Submit sales reports at 3PM, 7PM, 9PM, and Closing</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">4.</span>
                  <span className="text-gray-600">End day by recording closing inventory</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-bottom">
        <div className="grid grid-cols-4 gap-1 p-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center p-2 text-pink-500"
          >
            <IceCream className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button
            onClick={() => router.push('/inventory')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs mt-1">Inventory</span>
          </button>
          <button
            onClick={() => router.push('/sales')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Sales</span>
          </button>
          <button
            onClick={() => router.push('/receive')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs mt-1">Receive</span>
          </button>
        </div>
      </div>
    </div>
  )
}

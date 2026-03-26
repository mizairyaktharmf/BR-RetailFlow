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
  ChevronDown,
  RefreshCw,
  Camera,
  ClipboardList,
  AlertCircle,
  Cake,
  Bell,
  CalendarClock,
  Sparkles,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, getCurrentSalesWindow, getNextSalesWindow, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'
import { initPushNotifications } from '@/lib/push'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [currentWindow, setCurrentWindow] = useState(null)
  const [nextWindow, setNextWindow] = useState(null)
  const [todayDate, setTodayDate] = useState('')
  const [cakeAlerts, setCakeAlerts] = useState([])
  const [expiryRequests, setExpiryRequests] = useState([])
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [pushStatus, setPushStatus] = useState('unknown') // 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [pushLoading, setPushLoading] = useState(false)
  const [brief, setBrief] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)

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

    // Check sales window
    const checkWindow = () => {
      setCurrentWindow(getCurrentSalesWindow())
      setNextWindow(getNextSalesWindow())
    }
    checkWindow()
    const windowInterval = setInterval(checkWindow, 60000)

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

    // Load expiry tracking requests
    const loadExpiryRequests = async () => {
      try {
        const data = await api.getBranchExpiryRequests()
        setExpiryRequests(data || [])
      } catch (err) {
        // Silently fail
      }
    }
    loadExpiryRequests()

    // Load AI Daily Brief
    const loadBrief = async () => {
      setBriefLoading(true)
      try {
        const data = await api.getDailyBrief()
        if (data?.success) setBrief(data)
      } catch (err) { /* Silently fail */ }
      finally { setBriefLoading(false) }
    }
    loadBrief()

    // Check push notification status (don't request — just check)
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported')
    } else if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        setPushStatus('granted')
        // Already granted — silently re-register subscription
        initPushNotifications().catch(() => {})
      } else if (Notification.permission === 'denied') {
        setPushStatus('denied')
      } else {
        setPushStatus('prompt')
      }
    }

    return () => {
      clearInterval(windowInterval)
    }
  }, [router])

  const handleEnablePush = async () => {
    setPushLoading(true)
    try {
      const result = await initPushNotifications()
      setPushStatus(result ? 'granted' : 'denied')
    } catch {
      setPushStatus('denied')
    } finally {
      setPushLoading(false)
    }
  }

  const handleLogout = () => {
    api.clearToken()
    router.push('/login')
  }

  const toggleCategory = (cat) => {
    setExpandedCategory(prev => prev === cat ? null : cat)
  }

  const categories = [
    {
      id: 'icecream',
      name: 'Ice Cream',
      description: 'Inventory & receiving',
      icon: IceCream,
      color: 'pink',
      gradient: 'from-pink-500 to-rose-500',
      bgLight: 'bg-pink-50',
      borderColor: 'border-l-pink-500',
      badge: null,
      items: [
        {
          title: 'Stock Inventory',
          description: 'Record opening & closing stock levels',
          icon: ClipboardList,
          href: '/inventory',
          iconBg: 'bg-pink-100',
          iconColor: 'text-pink-600',
        },
        {
          title: 'Receive from Warehouse',
          description: 'Log new tubs received today',
          icon: Package,
          href: '/receive',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
        },
      ],
    },
    {
      id: 'cake',
      name: 'Cake',
      description: 'Stock, sales & alerts',
      icon: Cake,
      color: 'orange',
      gradient: 'from-orange-500 to-amber-500',
      bgLight: 'bg-orange-50',
      borderColor: 'border-l-orange-500',
      badge: cakeAlerts.length > 0 ? { count: cakeAlerts.length, type: 'danger' } : null,
      items: [
        {
          title: 'Cake',
          description: 'Stock, sell & receive cakes',
          icon: Cake,
          href: '/cake/stock',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        },
        {
          title: 'Alerts',
          description: 'Set low stock alert thresholds',
          icon: Bell,
          href: '/cake/alerts',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
        },
      ],
    },
    {
      id: 'sales',
      name: 'Sales & Reports',
      description: 'Sales submission & summary',
      icon: TrendingUp,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      bgLight: 'bg-green-50',
      borderColor: 'border-l-green-500',
      badge: currentWindow ? { text: 'LIVE', type: 'live' } : null,
      items: [
        {
          title: 'Submit Sales Report',
          description: currentWindow
            ? `${currentWindow.toUpperCase()} window is OPEN!`
            : nextWindow
              ? `Next window: ${nextWindow.opensAt}`
              : 'Submit sales with photo proof',
          icon: Camera,
          href: '/sales',
          iconBg: currentWindow ? 'bg-green-100' : 'bg-gray-100',
          iconColor: currentWindow ? 'text-green-600' : 'text-gray-600',
          highlight: !!currentWindow,
        },
      ],
    },
    {
      id: 'expiry',
      name: 'Expiry Tracking',
      description: 'Report near-expiry items',
      icon: CalendarClock,
      color: 'purple',
      gradient: 'from-purple-500 to-violet-500',
      bgLight: 'bg-purple-50',
      borderColor: 'border-l-purple-500',
      badge: expiryRequests.filter(r => r.branch_status === 'pending').length > 0
        ? { count: expiryRequests.filter(r => r.branch_status === 'pending').length, type: 'danger' }
        : null,
      items: [
        {
          title: 'Expiry Requests',
          description: expiryRequests.length > 0
            ? `${expiryRequests.filter(r => r.branch_status === 'pending').length} pending requests`
            : 'No active requests',
          icon: CalendarClock,
          href: '/expiry',
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          highlight: expiryRequests.filter(r => r.branch_status === 'pending').length > 0,
        },
      ],
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 relative"
                onClick={() => router.push('/cake/stock')}
              >
                <Bell className="w-5 h-5" />
                {cakeAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {cakeAlerts.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
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

      {/* Push Notification Enable Banner */}
      {pushStatus === 'prompt' && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 text-sm">Enable Notifications</h3>
              <p className="text-xs text-blue-700 mt-0.5">
                Get instant alerts when cake stock is running low
              </p>
              <button
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {pushLoading ? 'Enabling...' : 'Enable Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Window Alert */}
      {currentWindow && (
        <Alert variant="success" className="mx-4 mt-4 border-green-500 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sales Window Open!</AlertTitle>
          <AlertDescription className="text-green-700">
            Take a photo of your POS and submit your {currentWindow.toUpperCase()} sales now!
          </AlertDescription>
        </Alert>
      )}

      {/* AI Daily Brief */}
      <div className="mx-4 mt-4">
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold text-indigo-900">AI Daily Brief</h3>
              </div>
              <button
                onClick={async () => {
                  setBriefLoading(true)
                  try {
                    const data = await api.getDailyBrief()
                    if (data?.success) setBrief(data)
                  } catch {}
                  finally { setBriefLoading(false) }
                }}
                disabled={briefLoading}
                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {briefLoading && !brief ? (
              <div className="flex items-center gap-2 text-sm text-indigo-400 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing your branch data...
              </div>
            ) : brief?.brief ? (
              <div className="space-y-1">
                {brief.brief.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-indigo-400 py-2">Tap refresh to generate your daily brief.</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Status</span>
              </div>
              <p className="text-lg font-bold text-gray-900">Online</p>
              <p className="text-xs text-gray-500">All synced</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Cards */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="space-y-4">
          {categories.map((cat) => {
            const isExpanded = expandedCategory === cat.id
            const CatIcon = cat.icon

            return (
              <div key={cat.id} className="rounded-xl overflow-hidden shadow-sm">
                {/* Category Header — clickable */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full flex items-center gap-4 p-4 bg-white border-l-4 ${cat.borderColor} transition-all active:scale-[0.99]`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <CatIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">{cat.name}</h3>
                      {cat.badge && cat.badge.type === 'danger' && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[11px] font-semibold">
                          {cat.badge.count} alert{cat.badge.count > 1 ? 's' : ''}
                        </span>
                      )}
                      {cat.badge && cat.badge.type === 'live' && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-[11px] font-semibold animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                </button>

                {/* Expanded Sub-items */}
                {isExpanded && (
                  <div className={`${cat.bgLight} p-3 space-y-2 border-l-4 ${cat.borderColor} border-t border-gray-100`}>
                    {cat.items.map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <button
                          key={item.href}
                          onClick={() => router.push(item.href)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl bg-white shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${
                            item.highlight ? 'ring-2 ring-green-400 ring-offset-1' : ''
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <ItemIcon className={`w-5 h-5 ${item.iconColor}`} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                            <p className="text-xs text-gray-500 truncate">{item.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Help Section */}
        <div className="mt-8">
          <Card className="bg-gradient-to-br from-gray-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                This app helps you manage daily ice cream & cake inventory and report sales.
                Your accurate data helps the company order the right amount of stock.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">1.</span>
                  <span className="text-gray-600">Start each day by recording opening inventory</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">2.</span>
                  <span className="text-gray-600">Record any new stock received from warehouse</span>
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
        <div className="grid grid-cols-3 gap-1 p-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center p-2 text-pink-500"
          >
            <IceCream className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button
            onClick={() => router.push('/sales-dashboard')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Sales</span>
          </button>
          <button
            onClick={() => router.push('/cake/alerts')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500 relative"
          >
            <Bell className="w-5 h-5" />
            <span className="text-xs mt-1">Cake Alerts</span>
            {cakeAlerts.length > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {cakeAlerts.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

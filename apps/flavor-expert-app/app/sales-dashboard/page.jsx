"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  ArrowLeft,
  Clock,
  DollarSign,
  ShoppingBag,
  BarChart3,
  Loader2,
  Calendar,
  CheckCircle2,
  IceCream,
  Cake
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

export default function SalesDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState([])
  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

    const branchData = localStorage.getItem('br_branch')
    if (branchData) setBranch(JSON.parse(branchData))

    loadSalesData(parsedUser)
  }, [router])

  const loadSalesData = async (userData) => {
    setLoading(true)
    try {
      const branchData = localStorage.getItem('br_branch')
      const branchInfo = branchData ? JSON.parse(branchData) : null
      if (branchInfo?.id) {
        const sales = await api.getDailySales(branchInfo.id, todayDate)
        setTodaySales(Array.isArray(sales) ? sales : [])
      }
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals from today's sales
  const totalSalesAmount = todaySales.reduce((sum, s) => sum + (s.total_sales || 0), 0)
  const totalTransactions = todaySales.reduce((sum, s) => sum + (s.transaction_count || 0), 0)
  const submittedWindows = todaySales.map(s => s.window_type)

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white safe-area-top">
        <div className="px-4 py-5">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Sales Dashboard</h1>
              <p className="text-green-100 text-sm">{branch?.name || 'My Branch'}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-xs">Today</p>
              <p className="font-medium text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            {/* Today's Stats */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Today's Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-green-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-medium">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalSalesAmount > 0 ? `AED ${totalSalesAmount.toFixed(0)}` : '—'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <ShoppingBag className="w-4 h-4" />
                      <span className="text-xs font-medium">Transactions</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalTransactions > 0 ? totalTransactions : '—'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-xs font-medium">Windows Done</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {submittedWindows.length} / {SALES_WINDOWS.length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-medium">Date</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sales Windows Status */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Window Status</h2>
              <Card>
                <CardContent className="p-0">
                  {SALES_WINDOWS.map((window, idx) => {
                    const isSubmitted = submittedWindows.includes(window.id)
                    const salesRecord = todaySales.find(s => s.window_type === window.id)
                    return (
                      <div
                        key={window.id}
                        className={`flex items-center justify-between p-4 ${
                          idx < SALES_WINDOWS.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSubmitted ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {isSubmitted ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{window.label}</p>
                            <p className="text-xs text-gray-500">{window.time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isSubmitted ? (
                            <>
                              <p className="text-sm font-semibold text-green-600">
                                AED {(salesRecord?.total_sales || 0).toFixed(0)}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {salesRecord?.transaction_count || 0} txn
                              </p>
                            </>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Empty State */}
            {todaySales.length === 0 && (
              <Card className="bg-gradient-to-br from-gray-50 to-white">
                <CardContent className="p-8 text-center">
                  <TrendingUp className="w-14 h-14 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No Sales Submitted Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Submit your first sales report from the Home page when a sales window opens.
                  </p>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    Go to Home
                  </button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-bottom">
        <div className="grid grid-cols-3 gap-1 p-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <IceCream className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button
            className="flex flex-col items-center p-2 text-green-500"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs mt-1">Sales</span>
          </button>
          <button
            onClick={() => router.push('/cake/stock')}
            className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"
          >
            <Cake className="w-5 h-5" />
            <span className="text-xs mt-1">Cake Alerts</span>
          </button>
        </div>
      </div>
    </div>
  )
}

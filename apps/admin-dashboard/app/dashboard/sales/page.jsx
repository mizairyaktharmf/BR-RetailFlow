"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  BarChart3,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

// Category colors for donut chart
const getCategoryColor = (name) => {
  const lower = name.toLowerCase()
  if (lower.includes('cup') || lower.includes('cone')) return '#ec4899'
  if (lower.includes('sundae')) return '#f59e0b'
  if (lower.includes('beverage') || lower.includes('shake') || lower.includes('drink')) return '#3b82f6'
  if (lower.includes('cake')) return '#f97316'
  if (lower.includes('take') || lower.includes('home') || lower.includes('pint')) return '#8b5cf6'
  return '#6b7280'
}

// Donut chart component
function CategoryDonut({ categories, categoryTotal }) {
  if (!categories.length) return null

  const radius = 50
  const circumference = 2 * Math.PI * radius

  let offset = 0
  const segments = categories.map((cat) => {
    const pct = categoryTotal > 0 ? cat.sales / categoryTotal : 0
    const dashLength = pct * circumference
    const dashOffset = -offset
    offset += dashLength
    return { ...cat, pct, dashLength, dashOffset }
  })

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="14" />
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={getCategoryColor(seg.name)}
              strokeWidth="14"
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.dashOffset}
              transform="rotate(-90 60 60)"
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[9px] text-gray-400 uppercase">Total</p>
          <p className="text-sm font-bold text-gray-900">{categoryTotal.toFixed(0)}</p>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segments.map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(cat.name) }}
              />
              <span className="text-xs text-gray-700 truncate max-w-[120px]">{cat.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">{Math.round(cat.pct * 100)}%</span>
              <span className="text-[10px] text-gray-400 w-12 text-right">{cat.sales.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Window detail modal
function WindowDetail({ salesRecord, window: windowInfo, onClose }) {
  if (!salesRecord) return null

  let categories = []
  if (salesRecord.category_data) {
    try {
      categories = JSON.parse(salesRecord.category_data)
    } catch {}
  }
  const categoryTotal = categories.reduce((sum, c) => sum + c.sales, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">{windowInfo.label}</h3>
            <p className="text-xs text-gray-500">{windowInfo.time}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {/* Sales Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium">Net Sales</p>
              <p className="text-lg font-bold text-gray-900">AED {(salesRecord.total_sales || 0).toFixed(2)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium">Gross Sales</p>
              <p className="text-lg font-bold text-gray-900">AED {(salesRecord.gross_sales || 0).toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">Transactions</p>
              <p className="text-lg font-bold text-gray-900">{salesRecord.transaction_count || 0}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-600 font-medium">Cash Sales</p>
              <p className="text-lg font-bold text-gray-900">AED {(salesRecord.cash_sales || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Category Breakdown</p>
              <CategoryDonut categories={categories} categoryTotal={categoryTotal} />
            </div>
          )}

          {/* Notes */}
          {salesRecord.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{salesRecord.notes}</p>
            </div>
          )}

          {/* Photo */}
          {salesRecord.photo_url && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Receipt Photo</p>
              <img
                src={salesRecord.photo_url}
                alt="Receipt"
                className="w-full rounded-lg border"
              />
            </div>
          )}

          {/* Submitted time */}
          <p className="text-[10px] text-gray-400 text-center">
            Submitted: {new Date(salesRecord.created_at).toLocaleString('en-AE')}
          </p>
        </div>
      </div>
    </div>
  )
}

// Branch sales card (expandable)
function BranchSalesCard({ branch, salesData, loading }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedWindow, setSelectedWindow] = useState(null)

  const sales = salesData || []
  const submittedWindows = sales.map(s => s.sales_window)
  const totalSales = sales.reduce((sum, s) => sum + (s.total_sales || 0), 0)
  const totalGross = sales.reduce((sum, s) => sum + (s.gross_sales || 0), 0)
  const totalTransactions = sales.reduce((sum, s) => sum + (s.transaction_count || 0), 0)

  // Aggregate categories
  const allCategories = sales.reduce((acc, s) => {
    if (s.category_data) {
      try {
        const cats = JSON.parse(s.category_data)
        cats.forEach(cat => {
          const existing = acc.find(a => a.name === cat.name)
          if (existing) {
            existing.qty += cat.qty
            existing.sales += cat.sales
          } else {
            acc.push({ ...cat })
          }
        })
      } catch {}
    }
    return acc
  }, [])
  const categoryTotal = allCategories.reduce((sum, c) => sum + c.sales, 0)

  const windowClicked = (windowInfo) => {
    const record = sales.find(s => s.sales_window === windowInfo.id)
    if (record) {
      setSelectedWindow({ record, windowInfo })
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        {/* Branch Header - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                submittedWindows.length > 0 ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <Building2 className={`w-5 h-5 ${
                  submittedWindows.length > 0 ? 'text-green-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{branch.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{branch.code}</span>
                  {branch.territory_name && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                      {branch.territory_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <>
                    <p className={`text-sm font-bold ${totalSales > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {totalSales > 0 ? `AED ${totalSales.toFixed(0)}` : '—'}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      <span className={`text-[10px] font-medium ${
                        submittedWindows.length === SALES_WINDOWS.length ? 'text-green-500' : 'text-amber-500'
                      }`}>
                        {submittedWindows.length}/{SALES_WINDOWS.length}
                      </span>
                      <span className="text-[10px] text-gray-400">windows</span>
                    </div>
                  </>
                )}
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Content */}
        {expanded && !loading && (
          <div className="border-t">
            {/* Summary Stats */}
            {sales.length > 0 && (
              <div className="p-4 grid grid-cols-4 gap-2">
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <DollarSign className="w-3.5 h-3.5 mx-auto text-green-600 mb-1" />
                  <p className="text-[10px] text-green-600 font-medium">Net Sales</p>
                  <p className="text-sm font-bold text-gray-900">{totalSales.toFixed(0)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <TrendingUp className="w-3.5 h-3.5 mx-auto text-amber-600 mb-1" />
                  <p className="text-[10px] text-amber-600 font-medium">Gross</p>
                  <p className="text-sm font-bold text-gray-900">{totalGross.toFixed(0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <ShoppingBag className="w-3.5 h-3.5 mx-auto text-blue-600 mb-1" />
                  <p className="text-[10px] text-blue-600 font-medium">Txns</p>
                  <p className="text-sm font-bold text-gray-900">{totalTransactions}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                  <BarChart3 className="w-3.5 h-3.5 mx-auto text-purple-600 mb-1" />
                  <p className="text-[10px] text-purple-600 font-medium">Windows</p>
                  <p className="text-sm font-bold text-gray-900">{submittedWindows.length}/{SALES_WINDOWS.length}</p>
                </div>
              </div>
            )}

            {/* Category Donut */}
            {allCategories.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Category Breakdown</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <CategoryDonut categories={allCategories} categoryTotal={categoryTotal} />
                </div>
              </div>
            )}

            {/* Window Status */}
            <div className="px-4 pb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Window Status</p>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                {SALES_WINDOWS.map((window, idx) => {
                  const isSubmitted = submittedWindows.includes(window.id)
                  const salesRecord = sales.find(s => s.sales_window === window.id)
                  return (
                    <button
                      key={window.id}
                      onClick={() => windowClicked(window)}
                      disabled={!isSubmitted}
                      className={`w-full flex items-center justify-between p-3 transition-colors ${
                        idx < SALES_WINDOWS.length - 1 ? 'border-b border-gray-200' : ''
                      } ${isSubmitted ? 'hover:bg-white cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSubmitted ? 'bg-green-100' : 'bg-gray-200'
                        }`}>
                          {isSubmitted ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{window.label}</p>
                          <p className="text-[10px] text-gray-400">{window.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isSubmitted ? (
                          <div>
                            <p className="text-sm font-semibold text-green-600">
                              AED {(salesRecord?.total_sales || 0).toFixed(0)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {salesRecord?.transaction_count || 0} txn • tap to view
                            </p>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[10px]">
                            Pending
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Empty state */}
            {sales.length === 0 && (
              <div className="p-6 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No sales submitted yet for this date</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Window Detail Modal */}
      {selectedWindow && (
        <WindowDetail
          salesRecord={selectedWindow.record}
          window={selectedWindow.windowInfo}
          onClose={() => setSelectedWindow(null)}
        />
      )}
    </>
  )
}

export default function SalesReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchSales, setBranchSales] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingSales, setLoadingSales] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsed = JSON.parse(userData)
    setUser(parsed)
    loadBranches()
  }, [router])

  useEffect(() => {
    if (branches.length > 0) {
      loadAllSales()
    }
  }, [branches, selectedDate])

  const loadBranches = async () => {
    setLoading(true)
    try {
      const data = await api.getBranches()
      setBranches(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load branches:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllSales = async () => {
    const salesMap = {}
    const loadingMap = {}

    // Mark all as loading
    branches.forEach(b => { loadingMap[b.id] = true })
    setLoadingSales(loadingMap)

    // Fetch sales for each branch in parallel
    await Promise.all(
      branches.map(async (branch) => {
        try {
          const sales = await api.getDailySales(branch.id, selectedDate)
          salesMap[branch.id] = Array.isArray(sales) ? sales : []
        } catch {
          salesMap[branch.id] = []
        } finally {
          loadingMap[branch.id] = false
        }
      })
    )

    setBranchSales(salesMap)
    setLoadingSales(loadingMap)
  }

  // Calculate overall stats
  const allSales = Object.values(branchSales).flat()
  const overallTotalSales = allSales.reduce((sum, s) => sum + (s.total_sales || 0), 0)
  const overallGrossSales = allSales.reduce((sum, s) => sum + (s.gross_sales || 0), 0)
  const overallTransactions = allSales.reduce((sum, s) => sum + (s.transaction_count || 0), 0)
  const branchesWithSales = Object.entries(branchSales).filter(([, sales]) => sales.length > 0).length

  // Date navigation
  const changeDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          View daily sales for your {user.role === 'admin' ? 'assigned' : user.role === 'super_admin' ? 'territory' : 'all'} branches
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-between mb-5">
        <Button variant="outline" size="sm" onClick={() => changeDate(-1)}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {isToday && (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Today</span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => changeDate(1)} disabled={isToday}>
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <>
          {/* Overall Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-medium">Total Net Sales</p>
                <p className="text-lg font-bold text-gray-900">
                  {overallTotalSales > 0 ? `AED ${overallTotalSales.toFixed(0)}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-medium">Total Gross</p>
                <p className="text-lg font-bold text-gray-900">
                  {overallGrossSales > 0 ? `AED ${overallGrossSales.toFixed(0)}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <ShoppingBag className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-medium">Transactions</p>
                <p className="text-lg font-bold text-gray-900">
                  {overallTransactions > 0 ? overallTransactions : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Building2 className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-medium">Branches Reported</p>
                <p className="text-lg font-bold text-gray-900">
                  {branchesWithSales}/{branches.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Branch List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Branches ({branches.length})
            </h2>
            {branches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No branches assigned to your account</p>
                </CardContent>
              </Card>
            ) : (
              branches.map(branch => (
                <BranchSalesCard
                  key={branch.id}
                  branch={branch}
                  salesData={branchSales[branch.id]}
                  loading={loadingSales[branch.id]}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

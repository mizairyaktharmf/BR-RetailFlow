"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Clock,
  DollarSign,
  BarChart3,
  Loader2,
  CheckCircle2,
  IceCream,
  Cake,
  Users,
  PieChart,
  Target,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const CAT_COLORS = {
  'Cups & Cones': '#ec4899', 'Sundaes': '#f59e0b', 'Beverages': '#3b82f6',
  'Shakes': '#3b82f6', 'Cakes': '#f97316', 'Cake / Deserts': '#f97316',
  'Take Home': '#8b5cf6', 'Hand Pack': '#8b5cf6',
}
const DEFAULT_COLORS = ['#ec4899', '#f59e0b', '#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#6b7280']

function getCatColor(name, idx) {
  for (const [key, color] of Object.entries(CAT_COLORS)) {
    if (name?.toLowerCase().includes(key.toLowerCase())) return color
  }
  return DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
}

function DonutChart({ categories, totalSales }) {
  const size = 140, strokeWidth = 28
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      {categories.map((cat, i) => {
        const pct = totalSales > 0 ? cat.sales / totalSales : 0
        const dash = pct * circumference
        const seg = <circle key={i} cx={center} cy={center} r={radius} fill="none" stroke={getCatColor(cat.name, i)} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${center} ${center})`} />
        offset += dash
        return seg
      })}
      <text x={center} y={center - 6} textAnchor="middle" className="fill-gray-500 text-[10px]">Total</text>
      <text x={center} y={center + 10} textAnchor="middle" className="fill-gray-900 text-sm font-bold">{totalSales > 0 ? totalSales.toFixed(0) : '—'}</text>
    </svg>
  )
}

export default function SalesDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState([])
  const [todayDate] = useState(new Date().toISOString().split('T')[0])
  const [budget, setBudget] = useState(null)

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
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
        try {
          const now = new Date()
          const b = await api.getBranchBudget(branchInfo.id, now.getFullYear(), now.getMonth() + 1)
          if (b) setBudget(b)
        } catch {}
      }
    } catch {} finally { setLoading(false) }
  }

  // Combined totals
  const totalNetSales = todaySales.reduce((s, r) => s + (r.total_sales || 0), 0)
  const totalHdNet = todaySales.reduce((s, r) => s + (r.hd_net_sales || 0), 0)
  const totalHdGross = todaySales.reduce((s, r) => s + (r.hd_gross_sales || 0), 0)
  const totalHdOrders = todaySales.reduce((s, r) => s + (r.hd_orders || 0), 0)
  const totalDelNet = todaySales.reduce((s, r) => s + (r.deliveroo_net_sales || 0), 0)
  const totalDelGross = todaySales.reduce((s, r) => s + (r.deliveroo_gross_sales || 0), 0)
  const totalDelOrders = todaySales.reduce((s, r) => s + (r.deliveroo_orders || 0), 0)
  const totalGC = todaySales.reduce((s, r) => s + (r.transaction_count || 0), 0)

  const combinedNet = totalNetSales + totalHdNet + totalDelNet
  const combinedGC = totalGC + totalHdOrders + totalDelOrders
  const currentATV = combinedGC > 0 ? combinedNet / combinedGC : 0
  const submittedWindows = todaySales.map(s => s.sales_window)
  const hasHd = totalHdNet > 0
  const hasDel = totalDelNet > 0

  // Category data
  const allCategories = todaySales.reduce((acc, s) => {
    if (s.category_data) {
      try {
        JSON.parse(s.category_data).forEach(cat => {
          const ex = acc.find(a => a.name === cat.name)
          if (ex) { ex.qty += (cat.qty || cat.quantity || 0); ex.sales += (cat.sales || 0) }
          else acc.push({ name: cat.name, qty: cat.qty || cat.quantity || 0, sales: cat.sales || 0, pct: 0 })
        })
      } catch {}
    }
    return acc
  }, [])
  const catTotal = allCategories.reduce((s, c) => s + c.sales, 0)
  allCategories.forEach(c => { c.pct = catTotal > 0 ? c.sales / catTotal * 100 : 0 })

  // Items data for promo tracker
  const allItems = todaySales.reduce((acc, s) => {
    if (s.items_data) {
      try {
        JSON.parse(s.items_data).forEach(item => {
          const ex = acc.find(a => a.name === item.name)
          if (ex) { ex.qty += (item.quantity || 0); ex.sales += (item.sales || 0) }
          else acc.push({ ...item, qty: item.quantity || 0 })
        })
      } catch {}
    }
    return acc
  }, [])

  // Budget
  const daysInMonth = budget ? new Date(budget.year, budget.month, 0).getDate() : 30
  const dailyBudget = budget ? budget.target_sales / daysInMonth : 0
  const achievement = dailyBudget > 0 ? combinedNet / dailyBudget * 100 : 0

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white safe-area-top">
        <div className="px-4 py-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="p-1.5 rounded-lg hover:bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
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
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Today's Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-green-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Combined Net</span></div>
                    <p className="text-2xl font-bold text-gray-900">{combinedNet > 0 ? combinedNet.toFixed(0) : '—'}</p>
                    {(hasHd || hasDel) && <p className="text-[10px] text-gray-400 mt-0.5">POS {totalNetSales.toFixed(0)}{hasHd ? ` +HD ${totalHdNet.toFixed(0)}` : ''}{hasDel ? ` +Del ${totalDelNet.toFixed(0)}` : ''}</p>}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-600 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-medium">Total GC</span></div>
                    <p className="text-2xl font-bold text-gray-900">{combinedGC > 0 ? combinedGC : '—'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">ATV: {currentATV > 0 ? currentATV.toFixed(2) : '—'}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-2"><BarChart3 className="w-4 h-4" /><span className="text-xs font-medium">Windows</span></div>
                    <p className="text-2xl font-bold text-gray-900">{submittedWindows.length} / {SALES_WINDOWS.length}</p>
                  </CardContent>
                </Card>

                {budget ? (
                  <Card className={`bg-gradient-to-br ${achievement >= 100 ? 'from-green-50' : achievement >= 75 ? 'from-amber-50' : 'from-red-50'} to-white`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2"><Target className={`w-4 h-4 ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-amber-600' : 'text-red-600'}`} /><span className="text-xs font-medium text-gray-600">Budget</span></div>
                      <p className={`text-2xl font-bold ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{achievement.toFixed(0)}%</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{dailyBudget.toFixed(0)} target</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-gradient-to-br from-gray-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Gross</span></div>
                      <p className="text-2xl font-bold text-gray-900">{todaySales.reduce((s, r) => s + (r.gross_sales || 0), 0).toFixed(0) || '—'}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Category Donut */}
            {allCategories.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><PieChart className="w-4 h-4" />Category Breakdown</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <DonutChart categories={allCategories} totalSales={catTotal} />
                      <div className="flex-1 space-y-1.5">
                        {allCategories.map((cat, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCatColor(cat.name, i) }} />
                              <span className="text-xs text-gray-700">{cat.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-medium text-gray-900">{cat.pct.toFixed(1)}%</span>
                              <span className="text-[10px] text-gray-400 ml-1">{cat.sales.toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Item / Promo Tracker */}
            {allItems.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Item Tracker (IR & AUV)</h2>
                <Card>
                  <CardContent className="p-3">
                    <table className="w-full text-[11px]">
                      <thead><tr className="text-gray-500 border-b"><th className="text-left py-1.5">Item</th><th className="text-right py-1.5">Qty</th><th className="text-right py-1.5">Sales</th><th className="text-right py-1.5">IR%</th><th className="text-right py-1.5">AUV</th></tr></thead>
                      <tbody>
                        {allItems.sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 15).map((item, i) => {
                          const ir = combinedGC > 0 ? item.qty / combinedGC * 100 : 0
                          const auv = item.qty > 0 ? item.sales / item.qty : 0
                          return (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-1.5 font-medium text-gray-800 truncate max-w-[120px]">{item.name}</td>
                              <td className="text-right text-gray-600">{item.qty}</td>
                              <td className="text-right text-gray-600">{(item.sales || 0).toFixed(0)}</td>
                              <td className="text-right text-blue-600 font-medium">{ir.toFixed(1)}%</td>
                              <td className="text-right text-gray-600">{auv.toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Delivery Channels */}
            {(hasHd || hasDel) && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Delivery Channels</h2>
                <div className="space-y-2">
                  {hasHd && (
                    <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-100">
                      <CardContent className="p-4">
                        <p className="text-xs font-bold text-cyan-700 mb-2">Home Delivery</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div><p className="text-[10px] text-gray-500">Net</p><p className="text-base font-bold">{totalHdNet.toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-gray-500">Gross</p><p className="text-base font-bold">{totalHdGross.toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-gray-500">Orders</p><p className="text-base font-bold">{totalHdOrders}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {hasDel && (
                    <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-100">
                      <CardContent className="p-4">
                        <p className="text-xs font-bold text-teal-700 mb-2">Deliveroo</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div><p className="text-[10px] text-gray-500">Net</p><p className="text-base font-bold">{totalDelNet.toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-gray-500">Gross</p><p className="text-base font-bold">{totalDelGross.toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-gray-500">Orders</p><p className="text-base font-bold">{totalDelOrders}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Window Status */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Window Status</h2>
              <Card>
                <CardContent className="p-0">
                  {SALES_WINDOWS.map((w, idx) => {
                    const done = submittedWindows.includes(w.id)
                    const rec = todaySales.find(s => s.sales_window === w.id)
                    const wNet = (rec?.total_sales || 0) + (rec?.hd_net_sales || 0) + (rec?.deliveroo_net_sales || 0)
                    return (
                      <div key={w.id} className={`flex items-center justify-between p-4 ${idx < SALES_WINDOWS.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${done ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {done ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-gray-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{w.label}</p>
                            <p className="text-xs text-gray-500">{w.time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {done ? (
                            <>
                              <p className="text-sm font-semibold text-green-600">AED {wNet.toFixed(0)}</p>
                              <p className="text-[11px] text-gray-400">{rec?.transaction_count || 0} GC{(rec?.hd_orders || 0) > 0 ? ` +${rec.hd_orders} HD` : ''}{(rec?.deliveroo_orders || 0) > 0 ? ` +${rec.deliveroo_orders} Del` : ''}</p>
                            </>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">Pending</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {todaySales.length === 0 && (
              <Card className="bg-gradient-to-br from-gray-50 to-white">
                <CardContent className="p-8 text-center">
                  <TrendingUp className="w-14 h-14 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No Sales Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Submit your first sales report to see data here.</p>
                  <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600">Go to Home</button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-bottom">
        <div className="grid grid-cols-3 gap-1 p-2">
          <button onClick={() => router.push('/dashboard')} className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"><IceCream className="w-5 h-5" /><span className="text-xs mt-1">Home</span></button>
          <button className="flex flex-col items-center p-2 text-green-500"><BarChart3 className="w-5 h-5" /><span className="text-xs mt-1">Sales</span></button>
          <button onClick={() => router.push('/cake/stock')} className="flex flex-col items-center p-2 text-gray-400 hover:text-pink-500"><Cake className="w-5 h-5" /><span className="text-xs mt-1">Cake Alerts</span></button>
        </div>
      </div>
    </div>
  )
}

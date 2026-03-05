"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
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
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [budget, setBudget] = useState(null)
  const [trackedItems, setTrackedItems] = useState([])
  const [activeWindowId, setActiveWindowId] = useState(null)

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    const branchData = localStorage.getItem('br_branch')
    if (branchData) {
      const b = JSON.parse(branchData)
      setBranch(b)
      api.getTrackedItems(b.id)
        .then(items => setTrackedItems(Array.isArray(items) ? items : []))
        .catch(() => setTrackedItems([]))
    }
  }, [router])

  // Reload sales when date changes
  useEffect(() => {
    if (branch?.id) loadSalesData()
  }, [selectedDate, branch])

  const loadSalesData = async () => {
    setLoading(true)
    try {
      if (branch?.id) {
        const sales = await api.getDailySales(branch.id, selectedDate)
        setTodaySales(Array.isArray(sales) ? sales : [])
        try {
          const d = new Date(selectedDate)
          const b = await api.getBranchBudget(branch.id, d.getFullYear(), d.getMonth() + 1)
          if (b) setBudget(b)
        } catch {}
      }
    } catch {} finally { setLoading(false) }
  }

  const changeDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const submittedWindows = todaySales.map(s => s.sales_window)
  const windowOrder = SALES_WINDOWS.map(w => w.id)

  // Find the latest submitted window (POS data is cumulative)
  const latestWindowId = useMemo(() => {
    for (let i = windowOrder.length - 1; i >= 0; i--) {
      if (todaySales.find(s => s.sales_window === windowOrder[i])) return windowOrder[i]
    }
    return todaySales[0]?.sales_window || null
  }, [todaySales])

  // Auto-select latest window when sales load
  useEffect(() => {
    setActiveWindowId(latestWindowId)
  }, [latestWindowId])

  // The active record based on selected window
  const activeRecord = useMemo(() => {
    if (todaySales.length === 0) return null
    if (activeWindowId) {
      const found = todaySales.find(s => s.sales_window === activeWindowId)
      if (found) return found
    }
    return todaySales.find(s => s.sales_window === latestWindowId) || todaySales[0]
  }, [todaySales, activeWindowId, latestWindowId])

  // POS values from active window
  const posNet = activeRecord?.total_sales || 0
  const posGross = activeRecord?.gross_sales || 0
  const branchGC = activeRecord?.transaction_count || 0
  const branchCash = activeRecord?.cash_sales || 0
  const branchCashGC = activeRecord?.cash_gc || 0
  const branchATV = activeRecord?.atv || (branchGC > 0 ? posNet / branchGC : 0)

  // HD & Deliveroo from active window
  const hdGross = activeRecord?.hd_gross_sales || 0
  const hdNet = activeRecord?.hd_net_sales || 0
  const hdOrders = activeRecord?.hd_orders || 0
  const delGross = activeRecord?.deliveroo_gross_sales || 0
  const delNet = activeRecord?.deliveroo_net_sales || 0
  const delOrders = activeRecord?.deliveroo_orders || 0

  // Combined totals
  const totalNet = posNet + hdNet + delNet
  const totalGross = posGross + hdGross + delGross
  const totalGC = branchGC + hdOrders + delOrders

  // Categories from active window
  const branchCategories = useMemo(() => {
    if (!activeRecord?.category_data) return []
    try {
      return JSON.parse(activeRecord.category_data).map(cat => ({
        name: cat.name, qty: cat.qty || cat.quantity || 0, sales: cat.sales || 0, pct: cat.pct || 0,
      }))
    } catch { return [] }
  }, [activeRecord])

  // Items from active window
  const branchItems = useMemo(() => {
    if (!activeRecord?.items_data) return []
    try { return JSON.parse(activeRecord.items_data) } catch { return [] }
  }, [activeRecord])

  const catTotal = branchCategories.reduce((s, c) => s + c.sales, 0)
  branchCategories.forEach(c => { c.pct = catTotal > 0 ? c.sales / catTotal * 100 : c.pct })

  // Promotion tracking data from active window
  const promotionData = useMemo(() => {
    if (!trackedItems.length || !branchItems.length) return []
    const totalQty = branchItems.reduce((s, it) => s + (it.quantity || 0), 0)

    return trackedItems.map(tracked => {
      const isCategory = tracked.item_code?.startsWith('CAT:')

      if (isCategory) {
        const catName = tracked.item_code.replace('CAT:', '')
        const catRow = branchCategories.find(c => c.name && c.name.toLowerCase() === catName.toLowerCase())
        const catQty = catRow?.qty || 0
        const catSales = catRow?.sales || 0
        const catItems = branchItems.filter(it => it.category && it.category.toLowerCase() === catName.toLowerCase())

        const columns = [{
          code: 'CAT', name: catName, qty: catQty,
          countPct: totalQty > 0 ? ((catQty / totalQty) * 100) : 0,
          auv: catQty > 0 ? (catSales / catQty) : 0,
          ir: branchGC > 0 ? ((catQty / branchGC) * 100) : 0,
          sales: catSales, isMain: true, isCategory: true, itemCount: catItems.length,
        }]
        catItems.forEach(it => {
          const qty = it.quantity || 0
          const sales = it.sales || 0
          columns.push({
            code: it.code, name: it.name, qty,
            countPct: totalQty > 0 ? ((qty / totalQty) * 100) : 0,
            auv: qty > 0 ? (sales / qty) : 0,
            ir: branchGC > 0 ? ((qty / branchGC) * 100) : 0,
            sales, isMain: false,
          })
        })
        return { trackedName: catName, trackedCode: tracked.item_code, columns, isCategory: true }
      }

      const baseName = tracked.item_name.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()
      const matchedItems = branchItems.filter(it => {
        if (it.code === tracked.item_code) return true
        const itBase = it.name?.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()
        return itBase && itBase.toLowerCase() === baseName.toLowerCase() && it.code !== tracked.item_code
      })

      const exactMatch = matchedItems.find(it => it.code === tracked.item_code)
      const variants = matchedItems.filter(it => it.code !== tracked.item_code)
      const columns = []

      if (exactMatch) {
        const qty = exactMatch.quantity || 0
        const sales = exactMatch.sales || 0
        columns.push({
          code: exactMatch.code, name: exactMatch.name, qty,
          countPct: totalQty > 0 ? ((qty / totalQty) * 100) : 0,
          auv: qty > 0 ? (sales / qty) : 0,
          ir: branchGC > 0 ? ((qty / branchGC) * 100) : 0,
          sales, isMain: true,
        })
      } else {
        columns.push({ code: tracked.item_code, name: tracked.item_name, qty: 0, countPct: 0, auv: 0, ir: 0, sales: 0, isMain: true })
      }
      variants.forEach(v => {
        const qty = v.quantity || 0
        const sales = v.sales || 0
        columns.push({
          code: v.code, name: v.name, qty,
          countPct: totalQty > 0 ? ((qty / totalQty) * 100) : 0,
          auv: qty > 0 ? (sales / qty) : 0,
          ir: branchGC > 0 ? ((qty / branchGC) * 100) : 0,
          sales, isMain: false,
        })
      })
      return { trackedName: tracked.item_name, trackedCode: tracked.item_code, columns }
    })
  }, [trackedItems, branchItems, branchCategories, branchGC])

  // Budget
  const daysInMonth = budget ? new Date(budget.year, budget.month, 0).getDate() : 30
  const dailyBudget = budget ? budget.target_sales / daysInMonth : 0
  const achievement = dailyBudget > 0 ? totalNet / dailyBudget * 100 : 0

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white safe-area-top">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="p-1.5 rounded-lg hover:bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Sales Dashboard</h1>
              <p className="text-green-100 text-sm">{branch?.name || 'My Branch'}</p>
            </div>
            <div className="text-right">
              {isToday && <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded-full">Today</span>}
            </div>
          </div>
          {/* Date Navigation */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-white/20 active:scale-95 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 min-w-[160px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-green-100" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
              />
            </div>
            <button onClick={() => changeDate(1)} disabled={isToday} className="p-1.5 rounded-lg hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
        ) : todaySales.length === 0 ? (
          <Card className="bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="p-8 text-center">
              <TrendingUp className="w-14 h-14 mx-auto text-gray-300 mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">No Sales Data</h3>
              <p className="text-sm text-gray-500 mb-4">
                {isToday ? 'Submit your first sales report to see data here.' : 'No sales were submitted for this date.'}
              </p>
              {isToday && (
                <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600">Go to Home</button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ===== WINDOW SELECTOR (at top) ===== */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Window Status</h2>
              <div className="grid grid-cols-4 gap-2">
                {SALES_WINDOWS.map((w) => {
                  const done = submittedWindows.includes(w.id)
                  const isActive = activeWindowId === w.id
                  const rec = todaySales.find(s => s.sales_window === w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => { if (done) setActiveWindowId(w.id) }}
                      disabled={!done}
                      className={`p-2.5 rounded-xl text-center transition-all ${
                        isActive && done
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-[1.02]'
                          : done
                            ? 'bg-green-50 border-2 border-green-300 hover:border-green-400'
                            : 'bg-gray-50 border-2 border-gray-200 opacity-60'
                      }`}
                    >
                      <p className={`text-xs font-bold ${isActive && done ? 'text-white' : done ? 'text-green-700' : 'text-gray-400'}`}>
                        {w.label.split(' ')[0]}
                      </p>
                      {done ? (
                        <>
                          <CheckCircle2 className={`w-4 h-4 mx-auto mt-0.5 ${isActive ? 'text-white' : 'text-green-500'}`} />
                          <p className={`text-[9px] mt-0.5 font-medium ${isActive ? 'text-green-100' : 'text-green-600'}`}>
                            {((rec?.total_sales || 0) + (rec?.hd_net_sales || 0) + (rec?.deliveroo_net_sales || 0)).toFixed(0)}
                          </p>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 mx-auto mt-0.5 text-gray-400" />
                          <p className="text-[9px] mt-0.5 text-gray-400">Pending</p>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Show which window is active */}
            {activeRecord && (
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                Showing: <span className="text-green-600 font-semibold">{SALES_WINDOWS.find(w => w.id === activeRecord.sales_window)?.label || activeRecord.sales_window}</span> report
              </p>
            )}

            {/* ===== SUMMARY CARDS ===== */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-br from-green-50 to-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Total Net</span></div>
                  <p className="text-2xl font-bold text-gray-900">{totalNet > 0 ? totalNet.toFixed(0) : '—'}</p>
                  {(hdNet > 0 || delNet > 0) && <p className="text-[10px] text-gray-400 mt-0.5">POS {posNet.toFixed(0)}{hdNet > 0 ? ` +HD ${hdNet.toFixed(0)}` : ''}{delNet > 0 ? ` +Del ${delNet.toFixed(0)}` : ''}</p>}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-medium">Total GC</span></div>
                  <p className="text-2xl font-bold text-gray-900">{totalGC > 0 ? totalGC : '—'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">ATV: {branchATV > 0 ? branchATV.toFixed(2) : '—'}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Total Gross</span></div>
                  <p className="text-2xl font-bold text-gray-900">{totalGross > 0 ? totalGross.toFixed(0) : '—'}</p>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${budget ? (achievement >= 100 ? 'from-green-50' : achievement >= 75 ? 'from-amber-50' : 'from-red-50') : 'from-gray-50'} to-white`}>
                <CardContent className="p-4">
                  {budget ? (
                    <>
                      <div className="flex items-center gap-2 mb-2"><Target className={`w-4 h-4 ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-amber-600' : 'text-red-600'}`} /><span className="text-xs font-medium text-gray-600">Budget</span></div>
                      <p className={`text-2xl font-bold ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{achievement.toFixed(0)}%</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{dailyBudget.toFixed(0)} target</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-gray-500 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Cash Sales</span></div>
                      <p className="text-2xl font-bold text-gray-900">{branchCash > 0 ? branchCash.toFixed(0) : '—'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Cash GC: {branchCashGC}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== SALES CHANNELS BREAKDOWN ===== */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
                <CardContent className="p-3">
                  <p className="text-[9px] font-bold text-orange-600 uppercase">POS</p>
                  <p className="text-base font-bold text-gray-900 mt-1">{posNet.toFixed(0)}</p>
                  <p className="text-[9px] text-gray-400">{branchGC} GC</p>
                  <p className="text-[9px] text-gray-400">Gross: {posGross.toFixed(0)}</p>
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${hdNet > 0 ? 'from-cyan-50 border-cyan-200' : 'from-gray-50 border-gray-200'} to-white`}>
                <CardContent className="p-3">
                  <p className={`text-[9px] font-bold uppercase ${hdNet > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>Home Delivery</p>
                  <p className={`text-base font-bold mt-1 ${hdNet > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{hdNet > 0 ? hdNet.toFixed(0) : '—'}</p>
                  {hdOrders > 0 && <p className="text-[9px] text-gray-400">{hdOrders} orders</p>}
                  {hdGross > 0 && <p className="text-[9px] text-gray-400">Gross: {hdGross.toFixed(0)}</p>}
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${delNet > 0 ? 'from-teal-50 border-teal-200' : 'from-gray-50 border-gray-200'} to-white`}>
                <CardContent className="p-3">
                  <p className={`text-[9px] font-bold uppercase ${delNet > 0 ? 'text-teal-600' : 'text-gray-400'}`}>Deliveroo</p>
                  <p className={`text-base font-bold mt-1 ${delNet > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{delNet > 0 ? delNet.toFixed(0) : '—'}</p>
                  {delOrders > 0 && <p className="text-[9px] text-gray-400">{delOrders} orders</p>}
                  {delGross > 0 && <p className="text-[9px] text-gray-400">Gross: {delGross.toFixed(0)}</p>}
                </CardContent>
              </Card>
            </div>

            {/* ===== PROMOTION TRACKING ===== */}
            {promotionData.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Promotion Tracking</h2>
                <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
                  <CardContent className="p-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {promotionData.flatMap(p => p.columns).map((col, ci) => (
                        <div
                          key={`promo-${col.code}-${ci}`}
                          className={`flex-shrink-0 min-w-[140px] rounded-lg p-2.5 border ${
                            col.isCategory
                              ? 'bg-orange-50 border-orange-300'
                              : col.isMain
                                ? 'bg-pink-50 border-pink-300'
                                : 'bg-purple-50 border-purple-200'
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-1.5">
                            <span className="text-[8px] font-mono text-gray-500">{col.code}</span>
                            {col.isCategory ? (
                              <span className="text-[7px] px-1 py-0.5 bg-orange-200 text-orange-700 rounded font-bold flex items-center gap-0.5">
                                <Layers className="w-2 h-2" />CAT{col.itemCount > 0 ? ` · ${col.itemCount}` : ''}
                              </span>
                            ) : col.isMain ? (
                              <span className="text-[7px] px-1 py-0.5 bg-pink-200 text-pink-700 rounded font-bold">PROMO</span>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-semibold text-gray-800 truncate mb-2" title={col.name}>{col.name}</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            <div>
                              <p className="text-[8px] text-gray-500 uppercase">QTY</p>
                              <p className="text-xs font-bold text-gray-900">{col.qty}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-gray-500 uppercase">%Count</p>
                              <p className="text-xs font-bold text-amber-600">{col.countPct.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-gray-500 uppercase">AUV</p>
                              <p className="text-xs font-bold text-blue-600">{col.auv.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-gray-500 uppercase">IR</p>
                              <p className="text-xs font-bold text-purple-600">{col.ir.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                            <p className="text-[8px] text-gray-500">Sales</p>
                            <p className="text-[11px] font-semibold text-green-600">{col.sales.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== CATEGORY BREAKDOWN ===== */}
            {branchCategories.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><PieChart className="w-4 h-4" />Category Breakdown</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-center mb-4">
                      <DonutChart categories={branchCategories} totalSales={catTotal} />
                    </div>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1.5 text-gray-500 font-medium">Category</th>
                          <th className="text-right py-1.5 text-gray-500 font-medium">Qty</th>
                          <th className="text-right py-1.5 text-gray-500 font-medium">Sales</th>
                          <th className="text-right py-1.5 text-gray-500 font-medium">%</th>
                          <th className="text-right py-1.5 text-gray-500 font-medium">AUV</th>
                          <th className="text-right py-1.5 text-gray-500 font-medium">IR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchCategories.map((cat, i) => {
                          const qty = cat.qty || 0
                          const auv = qty > 0 ? (cat.sales / qty).toFixed(2) : '0.00'
                          const ir = branchGC > 0 ? ((qty / branchGC) * 100).toFixed(1) : '0.0'
                          return (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-1.5 text-gray-800 font-medium">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCatColor(cat.name, i) }} />
                                  {cat.name}
                                </div>
                              </td>
                              <td className="text-right py-1.5 text-gray-600">{qty}</td>
                              <td className="text-right py-1.5 text-gray-800 font-medium">{cat.sales.toFixed(0)}</td>
                              <td className="text-right py-1.5 text-gray-600">{cat.pct.toFixed(1)}%</td>
                              <td className="text-right py-1.5 text-blue-600 font-medium">{auv}</td>
                              <td className="text-right py-1.5 text-purple-600 font-medium">{ir}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== ITEM TRACKER ===== */}
            {branchItems.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Item Tracker ({branchItems.length} items)</h2>
                <Card>
                  <CardContent className="p-3">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-white"><tr className="text-gray-500 border-b"><th className="text-left py-1.5">Item</th><th className="text-right py-1.5">Qty</th><th className="text-right py-1.5">Sales</th><th className="text-right py-1.5">IR%</th><th className="text-right py-1.5">AUV</th></tr></thead>
                        <tbody>
                          {branchItems.sort((a, b) => (b.sales || 0) - (a.sales || 0)).map((item, i) => {
                            const qty = item.quantity || 0
                            const ir = branchGC > 0 ? qty / branchGC * 100 : 0
                            const auv = qty > 0 ? item.sales / qty : 0
                            return (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-1.5 font-medium text-gray-800 truncate max-w-[120px]">{item.name}</td>
                                <td className="text-right text-gray-600">{qty}</td>
                                <td className="text-right text-gray-600">{(item.sales || 0).toFixed(0)}</td>
                                <td className="text-right text-blue-600 font-medium">{ir.toFixed(1)}%</td>
                                <td className="text-right text-gray-600">{auv.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
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

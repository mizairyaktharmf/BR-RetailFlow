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
  Sparkles,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [activeTab, setActiveTab] = useState('sales') // 'sales' | 'advisor'
  const [advisorData, setAdvisorData] = useState(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [budgetChart, setBudgetChart] = useState(null)

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
          const chart = await api.getBudgetChart(branch.id, selectedDate.substring(0, 7))
          if (chart) setBudgetChart(chart)
        } catch {}
      }
    } catch {} finally { setLoading(false) }
  }

  const changeDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const loadAdvisor = async () => {
    if (!branch?.id) return
    setAdvisorLoading(true)
    try {
      const data = await api.getSmartAdvisor(branch.id, selectedDate)
      setAdvisorData(data)
    } catch {
      setAdvisorData(null)
    } finally {
      setAdvisorLoading(false)
    }
  }

  // Load advisor when tab switches to advisor or date changes
  useEffect(() => {
    if (activeTab === 'advisor' && branch?.id) loadAdvisor()
  }, [activeTab, selectedDate, branch])

  const fmt = (v) => v != null ? Number(v).toFixed(v % 1 === 0 ? 0 : 2) : '—'

  const adviceIcon = (a) => {
    if (a.priority === 'success') return <CheckCircle2 className="w-4 h-4 text-green-400" />
    if (a.priority === 'critical') return <AlertTriangle className="w-4 h-4 text-red-400" />
    if (a.priority === 'warning') return <Zap className="w-4 h-4 text-amber-400" />
    return <TrendingUp className="w-4 h-4 text-blue-400" />
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
  const cmGross = activeRecord?.cm_gross_sales || 0
  const cmNet = activeRecord?.cm_net_sales || 0
  const cmOrders = activeRecord?.cm_orders || 0

  // Combined totals
  const totalNet = posNet + hdNet + delNet + cmNet
  const totalGross = posGross + hdGross + delGross + cmGross
  const totalGC = branchGC + hdOrders + delOrders + cmOrders

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
        const catLower = catName.toLowerCase()
        // Word-root matching for spelling variations (Desserts vs Deserts)
        const tWords = catLower.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
        const catRow = branchCategories.find(c => {
          if (!c.name) return false
          const cLow = c.name.toLowerCase()
          if (cLow === catLower || cLow.includes(catLower) || catLower.includes(cLow)) return true
          const cWords = cLow.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
          return tWords.some(tw => cWords.some(cw => cw === tw || cw.includes(tw) || tw.includes(cw)))
        })
        const catQty = catRow?.qty || 0
        const catSales = catRow?.sales || 0
        // Match items using tracked name + matched category_data name + word-root
        const matchNames = [catLower]
        if (catRow?.name && catRow.name.toLowerCase() !== catLower) matchNames.push(catRow.name.toLowerCase())
        const catWords = catLower.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
        const catItems = branchItems.filter(it => {
          if (!it.category) return false
          const itCat = it.category.toLowerCase()
          if (matchNames.some(mn => itCat === mn || itCat.includes(mn) || mn.includes(itCat))) return true
          const itWords = itCat.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
          return catWords.some(cw => itWords.some(iw => iw === cw || iw.includes(cw) || cw.includes(iw)))
        })

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

      // Name-based tracking: match ALL items whose name contains the base name
      const isNameTrack = tracked.item_code?.startsWith('NAME:')
      const baseName = isNameTrack
        ? tracked.item_code.replace('NAME:', '').trim()
        : tracked.item_name.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()

      const matchedItems = branchItems.filter(it => {
        if (!isNameTrack && it.code === tracked.item_code) return true
        if (isNameTrack) {
          return it.name && it.name.toLowerCase().includes(baseName.toLowerCase())
        }
        const itBase = it.name?.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()
        return itBase && itBase.toLowerCase() === baseName.toLowerCase()
      })

      const columns = []

      if (isNameTrack) {
        const totalMatchQty = matchedItems.reduce((s, it) => s + (it.quantity || 0), 0)
        const totalMatchSales = matchedItems.reduce((s, it) => s + (it.sales || 0), 0)
        columns.push({
          code: 'ALL', name: baseName, qty: totalMatchQty,
          countPct: totalQty > 0 ? ((totalMatchQty / totalQty) * 100) : 0,
          auv: totalMatchQty > 0 ? (totalMatchSales / totalMatchQty) : 0,
          ir: branchGC > 0 ? ((totalMatchQty / branchGC) * 100) : 0,
          sales: totalMatchSales, isMain: true, isNameGroup: true, itemCount: matchedItems.length,
        })
        matchedItems.forEach(it => {
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
      } else {
        const exactMatch = matchedItems.find(it => it.code === tracked.item_code)
        const variants = matchedItems.filter(it => it.code !== tracked.item_code)

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
      }
      return { trackedName: isNameTrack ? baseName : tracked.item_name, trackedCode: tracked.item_code, columns }
    })
  }, [trackedItems, branchItems, branchCategories, branchGC])

  // Budget
  const daysInMonth = budget ? new Date(budget.year, budget.month, 0).getDate() : 30
  const dayBudgetData = useMemo(() => {
    if (!budgetChart?.days) return null
    return budgetChart.days.find(d => d.date === selectedDate) || null
  }, [budgetChart, selectedDate])
  const dailyBudget = dayBudgetData?.budget || (budget ? budget.target_sales / daysInMonth : 0)
  const dayLySales = dayBudgetData?.ly_sales || 0
  const dayLyGC = dayBudgetData?.ly_gc || 0
  const dayBudgetGC = dayBudgetData?.budget_gc || 0
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

      {/* Sales / Advisor Tabs */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'sales'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Sales
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'advisor'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Advisor
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ============== SALES TAB ============== */}
        {activeTab === 'sales' && (loading ? (
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

            {/* ===== BUDGET & LY DATA ===== */}
            {dailyBudget > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-2"><Target className="w-4 h-4" /><span className="text-xs font-medium">Day Budget</span></div>
                    <p className="text-2xl font-bold text-gray-900">{dailyBudget.toFixed(0)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">GC: {dayBudgetGC}</p>
                  </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br ${achievement >= 100 ? 'from-green-50 border-green-200' : achievement >= 80 ? 'from-amber-50 border-amber-200' : 'from-red-50 border-red-200'} to-white`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp className={`w-4 h-4 ${achievement >= 100 ? 'text-green-600' : achievement >= 80 ? 'text-amber-600' : 'text-red-600'}`} /><span className="text-xs font-medium text-gray-600">Achievement</span></div>
                    <p className={`text-2xl font-bold ${achievement >= 100 ? 'text-green-600' : achievement >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{achievement.toFixed(1)}%</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Gap: {(totalNet - dailyBudget).toFixed(0)}</p>
                  </CardContent>
                </Card>
                {dayLySales > 0 && (
                  <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-indigo-600 mb-2"><BarChart3 className="w-4 h-4" /><span className="text-xs font-medium">LY Sales</span></div>
                      <p className="text-2xl font-bold text-gray-900">{dayLySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">vs Today: {totalNet > 0 ? ((totalNet / dayLySales * 100) - 100).toFixed(1) + '%' : '—'}</p>
                    </CardContent>
                  </Card>
                )}
                {dayLyGC > 0 && (
                  <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-teal-600 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-medium">LY GC</span></div>
                      <p className="text-2xl font-bold text-gray-900">{dayLyGC}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">vs Today: {totalGC > 0 ? ((totalGC / dayLyGC * 100) - 100).toFixed(1) + '%' : '—'}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ===== SALES CHANNELS BREAKDOWN ===== */}
            <div className="grid grid-cols-2 gap-2">
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
              <Card className={`bg-gradient-to-br ${cmNet > 0 ? 'from-violet-50 border-violet-200' : 'from-gray-50 border-gray-200'} to-white`}>
                <CardContent className="p-3">
                  <p className={`text-[9px] font-bold uppercase ${cmNet > 0 ? 'text-violet-600' : 'text-gray-400'}`}>Cool Mood</p>
                  <p className={`text-base font-bold mt-1 ${cmNet > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{cmNet > 0 ? cmNet.toFixed(0) : '—'}</p>
                  {cmOrders > 0 && <p className="text-[9px] text-gray-400">{cmOrders} orders</p>}
                  {cmGross > 0 && <p className="text-[9px] text-gray-400">Gross: {cmGross.toFixed(0)}</p>}
                </CardContent>
              </Card>
            </div>

            {/* ===== PROMOTION TRACKING ===== */}
            {promotionData.length > 0 && (() => {
              const mainItems = promotionData.map(p => p.columns[0]).filter(c => c.sales > 0)
              return (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Promotion Tracking</h2>
                  {/* Donut for main totals */}
                  {mainItems.length > 1 && (
                    <Card className="bg-white border-gray-200 mb-3">
                      <CardContent className="p-3 flex justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <DonutChart categories={mainItems.map(c => ({ name: c.name, sales: c.sales }))} totalSales={mainItems.reduce((s, c) => s + c.sales, 0)} />
                          <div className="flex flex-wrap justify-center gap-3">
                            {mainItems.map((c, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCatColor(c.name, i) }} />
                                <span className="text-[10px] text-gray-600">{c.name}</span>
                                <span className="text-[10px] font-bold text-gray-800">{Math.round(c.sales / mainItems.reduce((s, x) => s + x.sales, 0) * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {/* Grouped containers — one per tracked item */}
                  <div className="space-y-3">
                    {promotionData.map((group, gi) => {
                      const main = group.columns[0]
                      const variants = group.columns.slice(1)
                      const borderColor = main.isCategory
                        ? 'border-orange-300' : main.isNameGroup
                        ? 'border-green-300' : 'border-pink-300'
                      const bgColor = main.isCategory
                        ? 'bg-orange-50' : main.isNameGroup
                        ? 'bg-green-50' : 'bg-pink-50'
                      return (
                        <Card key={`group-${gi}`} className={`${bgColor} ${borderColor} overflow-hidden`}>
                          {/* Main total header */}
                          <div className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <p className="text-xs font-bold text-gray-900 truncate">{main.name}</p>
                                {main.isCategory ? (
                                  <span className="text-[7px] px-1 py-0.5 bg-orange-200 text-orange-700 rounded flex-shrink-0 font-bold">CAT</span>
                                ) : main.isNameGroup ? (
                                  <span className="text-[7px] px-1 py-0.5 bg-green-200 text-green-700 rounded flex-shrink-0 font-bold">ALL</span>
                                ) : (
                                  <span className="text-[7px] px-1 py-0.5 bg-pink-200 text-pink-700 rounded flex-shrink-0 font-bold">PROMO</span>
                                )}
                              </div>
                              {variants.length > 0 && (
                                <p className="text-[9px] text-gray-500">{variants.length} variant{variants.length > 1 ? 's' : ''} sold</p>
                              )}
                            </div>
                            <div className="grid grid-cols-4 gap-3 flex-shrink-0 text-center">
                              <div>
                                <p className="text-[8px] text-gray-500">QTY</p>
                                <p className="text-sm font-bold text-gray-900">{main.qty}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-gray-500">IR</p>
                                <p className="text-sm font-bold text-purple-600">{main.ir.toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-gray-500">AUV</p>
                                <p className="text-sm font-bold text-blue-600">{main.auv.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-gray-500">Sales</p>
                                <p className="text-sm font-bold text-green-600">{main.sales.toFixed(0)}</p>
                              </div>
                            </div>
                          </div>
                          {/* Variant cards — horizontal scroll */}
                          {variants.length > 0 && (
                            <div className="border-t border-gray-200 px-3 py-2">
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {variants.map((v, vi) => (
                                  <div key={`v-${gi}-${vi}`} className="flex-shrink-0 min-w-[120px] bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                                    <p className="text-[10px] font-medium text-gray-800 truncate mb-1.5" title={v.name}>{v.name}</p>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                      <div>
                                        <p className="text-[7px] text-gray-500">QTY</p>
                                        <p className="text-[11px] font-bold text-gray-900">{v.qty}</p>
                                      </div>
                                      <div>
                                        <p className="text-[7px] text-gray-500">Sales</p>
                                        <p className="text-[11px] font-bold text-green-600">{v.sales.toFixed(0)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[7px] text-gray-500">AUV</p>
                                        <p className="text-[11px] font-bold text-blue-600">{v.auv.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[7px] text-gray-500">IR</p>
                                        <p className="text-[11px] font-bold text-purple-600">{v.ir.toFixed(1)}%</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
        ))}

        {/* ============== ADVISOR TAB ============== */}
        {activeTab === 'advisor' && (
          <div className="space-y-4">
            {advisorLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-gray-500">Loading advisor...</span>
              </div>
            )}

            {!advisorLoading && advisorData && (
              <div className="space-y-4">
                {/* Title */}
                <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">{advisorData.parlor_name || branch?.name}</span>
                  <span className="text-gray-400">— {advisorData.day_name} {advisorData.date}</span>
                  {advisorData.latest_window && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium uppercase">
                      {advisorData.latest_window === 'closing' ? 'Closing' : advisorData.latest_window.toUpperCase()} Report
                    </span>
                  )}
                </div>

                {/* Daily Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Actual Sales</p>
                      <p className="text-xl font-bold text-gray-900">{fmt(advisorData.daily?.actual_gross)}</p>
                      <p className="text-[10px] text-gray-400">{advisorData.daily?.actual_gc || 0} GC</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Budget</p>
                      <p className="text-xl font-bold text-purple-600">{fmt(advisorData.daily?.budget)}</p>
                      <p className="text-[10px] text-gray-400">{advisorData.daily?.budget_gc || 0} GC target</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${
                    (advisorData.daily?.achievement_pct || 0) >= 100 ? 'from-green-50'
                    : (advisorData.daily?.achievement_pct || 0) >= 75 ? 'from-amber-50'
                    : 'from-red-50'
                  } to-white`}>
                    <CardContent className="p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Achievement</p>
                      <p className={`text-xl font-bold ${
                        (advisorData.daily?.achievement_pct || 0) >= 100 ? 'text-green-600'
                        : (advisorData.daily?.achievement_pct || 0) >= 75 ? 'text-amber-600'
                        : 'text-red-600'
                      }`}>
                        {fmt(advisorData.daily?.achievement_pct)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Remaining</p>
                      <p className="text-xl font-bold text-amber-600">{fmt(advisorData.daily?.remaining)}</p>
                      <p className="text-[10px] text-gray-400">{advisorData.daily?.remaining_gc || 0} GC needed</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Bar */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                      <span>0</span>
                      <span>{fmt(advisorData.daily?.budget)} AED target</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          (advisorData.daily?.achievement_pct || 0) >= 100 ? 'bg-green-500'
                          : (advisorData.daily?.achievement_pct || 0) >= 75 ? 'bg-purple-500'
                          : (advisorData.daily?.achievement_pct || 0) >= 50 ? 'bg-amber-500'
                          : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(advisorData.daily?.achievement_pct || 0, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Advice Cards */}
                {advisorData.advice?.map((a, i) => (
                  <Card key={i} className={`border ${
                    a.priority === 'success' ? 'bg-green-50 border-green-200'
                    : a.priority === 'critical' ? 'bg-red-50 border-red-200'
                    : a.priority === 'warning' ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-gray-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          a.priority === 'success' ? 'bg-green-100'
                          : a.priority === 'critical' ? 'bg-red-100'
                          : a.priority === 'warning' ? 'bg-amber-100'
                          : 'bg-gray-100'
                        }`}>
                          {adviceIcon(a)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* ATV & KPI Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">ATV & KPI Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-gray-500">Current ATV</p>
                        <p className="text-lg font-bold text-gray-900">{fmt(advisorData.daily?.current_atv)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Budget ATV</p>
                        <p className="text-lg font-bold text-purple-600">{fmt(advisorData.daily?.budget_atv)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">LY ATV</p>
                        <p className="text-lg font-bold text-blue-600">{fmt(advisorData.daily?.ly_atv)}</p>
                      </div>
                    </div>
                    {advisorData.ly_kpis && (
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">LY AUV</p>
                          <p className="text-sm font-medium text-gray-700">{fmt(advisorData.ly_kpis.auv)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">LY Cake</p>
                          <p className="text-sm font-medium text-gray-700">{fmt(advisorData.ly_kpis.cake_qty)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">LY HP</p>
                          <p className="text-sm font-medium text-gray-700">{fmt(advisorData.ly_kpis.hp_qty)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">vs LY</p>
                          <p className={`text-sm font-medium ${(advisorData.daily?.growth_vs_ly || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {advisorData.daily?.growth_vs_ly >= 0 ? '+' : ''}{fmt(advisorData.daily?.growth_vs_ly)}%
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* MTD Summary */}
                {advisorData.mtd?.actual_sales > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-600">MTD Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-gray-500">MTD Actual</p>
                          <p className="text-lg font-bold text-gray-900">{fmt(advisorData.mtd.actual_sales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500">MTD Budget</p>
                          <p className="text-lg font-bold text-purple-600">{fmt(advisorData.mtd.budget)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500">MTD Ach %</p>
                          <p className={`text-lg font-bold ${(advisorData.mtd.achievement_pct || 0) >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
                            {fmt(advisorData.mtd.achievement_pct)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No budget warning */}
                {!advisorData.budget_loaded && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4 text-center">
                      <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-amber-700 font-medium">No budget uploaded for this branch</p>
                      <p className="text-xs text-gray-500 mt-1">Ask your area manager to upload the budget sheet first</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!advisorLoading && !advisorData && (
              <Card className="bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="p-8 text-center">
                  <Sparkles className="w-14 h-14 mx-auto text-purple-300 mb-4" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Budget Advisor</h3>
                  <p className="text-sm text-gray-500">No advisor data available for this date. Budget may not be uploaded yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
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

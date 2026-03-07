"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingBag,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

// Pie chart colors
const PIE_COLORS = [
  '#ec4899', '#f59e0b', '#3b82f6', '#f97316', '#8b5cf6',
  '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#84cc16',
]

// Donut chart component
function CategoryDonut({ categories, size = 120 }) {
  if (!categories?.length) return null
  const total = categories.reduce((s, c) => s + (c.sales || 0), 0)
  if (total === 0) return null

  const radius = size * 0.42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const half = size / 2

  const segments = categories.map((cat, i) => {
    const pct = cat.sales / total
    const dashLength = pct * circumference
    const dashOffset = -offset
    offset += dashLength
    return { ...cat, pct, dashLength, dashOffset, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={half} cy={half} r={radius} fill="none" stroke="#374151" strokeWidth="14" />
          {segments.map((seg, idx) => (
            <circle
              key={idx}
              cx={half} cy={half} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.dashOffset}
              transform={`rotate(-90 ${half} ${half})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[9px] text-gray-500 uppercase">Total</p>
          <p className="text-sm font-bold text-white">{total.toFixed(0)}</p>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5">
        {segments.map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-xs text-gray-300 truncate">{cat.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold text-white">{Math.round(cat.pct * 100)}%</span>
              <span className="text-[10px] text-gray-500 w-14 text-right">{cat.sales.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function SalesReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [branchSales, setBranchSales] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingSales, setLoadingSales] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeWindowId, setActiveWindowId] = useState(null)
  const [trackedItems, setTrackedItems] = useState([])

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) { router.push('/login'); return }
    setUser(JSON.parse(userData))
    loadBranches()
  }, [router])

  useEffect(() => {
    if (branches.length > 0) loadAllSales()
  }, [branches, selectedDate])

  useEffect(() => {
    if (!selectedBranch) return
    api.getTrackedItems(selectedBranch.id)
      .then(items => setTrackedItems(Array.isArray(items) ? items : []))
      .catch(() => setTrackedItems([]))
  }, [selectedBranch])

  const loadBranches = async () => {
    setLoading(true)
    try {
      const data = await api.getBranches()
      const list = Array.isArray(data) ? data : []
      setBranches(list)
      if (list.length > 0) setSelectedBranch(list[0])
    } catch (err) {
      console.error('Failed to load branches:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllSales = async () => {
    const salesMap = {}
    const loadingMap = {}
    branches.forEach(b => { loadingMap[b.id] = true })
    setLoadingSales(loadingMap)

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

  const currentSales = selectedBranch ? (branchSales[selectedBranch.id] || []) : []
  const currentLoading = selectedBranch ? loadingSales[selectedBranch.id] : false
  const submittedWindows = currentSales.map(s => s.sales_window)

  const windowOrder = SALES_WINDOWS.map(w => w.id)
  const latestWindowId = useMemo(() => {
    for (let i = windowOrder.length - 1; i >= 0; i--) {
      if (currentSales.find(s => s.sales_window === windowOrder[i])) return windowOrder[i]
    }
    return currentSales[0]?.sales_window || null
  }, [currentSales])

  useEffect(() => {
    setActiveWindowId(latestWindowId)
  }, [latestWindowId, selectedBranch])

  const activeRecord = useMemo(() => {
    if (currentSales.length === 0) return null
    if (activeWindowId) {
      const found = currentSales.find(s => s.sales_window === activeWindowId)
      if (found) return found
    }
    return currentSales.find(s => s.sales_window === latestWindowId) || currentSales[0]
  }, [currentSales, activeWindowId, latestWindowId])

  const posNet = activeRecord?.total_sales || 0
  const posGross = activeRecord?.gross_sales || 0
  const branchGC = activeRecord?.transaction_count || 0
  const branchCash = activeRecord?.cash_sales || 0
  const branchCashGC = activeRecord?.cash_gc || 0
  const branchATV = activeRecord?.atv || (branchGC > 0 ? posNet / branchGC : 0)

  const hdGross = activeRecord?.hd_gross_sales || 0
  const hdNet = activeRecord?.hd_net_sales || 0
  const hdOrders = activeRecord?.hd_orders || 0
  const delGross = activeRecord?.deliveroo_gross_sales || 0
  const delNet = activeRecord?.deliveroo_net_sales || 0
  const delOrders = activeRecord?.deliveroo_orders || 0
  const cmGross = activeRecord?.cm_gross_sales || 0
  const cmNet = activeRecord?.cm_net_sales || 0
  const cmOrders = activeRecord?.cm_orders || 0

  const totalNet = posNet + hdNet + delNet + cmNet
  const totalGross = posGross + hdGross + delGross + cmGross
  const totalGC = branchGC + hdOrders + delOrders + cmOrders

  const branchCategories = useMemo(() => {
    if (!activeRecord?.category_data) return []
    try {
      return JSON.parse(activeRecord.category_data).map(cat => ({
        name: cat.name, qty: cat.qty || cat.quantity || 0, sales: cat.sales || 0, pct: cat.pct || 0,
      }))
    } catch { return [] }
  }, [activeRecord])

  const branchItems = useMemo(() => {
    if (!activeRecord?.items_data) return []
    try { return JSON.parse(activeRecord.items_data) } catch { return [] }
  }, [activeRecord])

  const promotionData = useMemo(() => {
    if (!trackedItems.length || !branchItems.length) return []
    const totalQty = branchItems.reduce((s, it) => s + (it.quantity || 0), 0)

    return trackedItems.map(tracked => {
      const isCategory = tracked.item_code?.startsWith('CAT:')

      if (isCategory) {
        const catName = tracked.item_code.replace('CAT:', '')
        const catRow = branchCategories.find(c =>
          c.name && c.name.toLowerCase() === catName.toLowerCase()
        )
        const catQty = catRow?.qty || 0
        const catSales = catRow?.sales || 0
        const catItems = branchItems.filter(it =>
          it.category && it.category.toLowerCase() === catName.toLowerCase()
        )

        const columns = [{
          code: `CAT`,
          name: catName,
          qty: catQty,
          countPct: totalQty > 0 ? ((catQty / totalQty) * 100) : 0,
          auv: catQty > 0 ? (catSales / catQty) : 0,
          ir: branchGC > 0 ? ((catQty / branchGC) * 100) : 0,
          sales: catSales,
          isMain: true,
          isCategory: true,
          itemCount: catItems.length,
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

      // Name-based tracking: match ALL items whose base name matches
      const isNameTrack = tracked.item_code?.startsWith('NAME:')
      const baseName = isNameTrack
        ? tracked.item_code.replace('NAME:', '').trim()
        : tracked.item_name.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()

      const matchedItems = branchItems.filter(it => {
        if (!isNameTrack && it.code === tracked.item_code) return true
        // For name tracking, use contains match — item name should contain the base name
        if (isNameTrack) {
          return it.name && it.name.toLowerCase().includes(baseName.toLowerCase())
        }
        const itBase = it.name?.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()
        return itBase && itBase.toLowerCase() === baseName.toLowerCase()
      })

      const columns = []

      if (isNameTrack) {
        // Name tracking: show combined total as main card, then individual variants
        const totalMatchQty = matchedItems.reduce((s, it) => s + (it.quantity || 0), 0)
        const totalMatchSales = matchedItems.reduce((s, it) => s + (it.sales || 0), 0)

        columns.push({
          code: 'ALL',
          name: baseName,
          qty: totalMatchQty,
          countPct: totalQty > 0 ? ((totalMatchQty / totalQty) * 100) : 0,
          auv: totalMatchQty > 0 ? (totalMatchSales / totalMatchQty) : 0,
          ir: branchGC > 0 ? ((totalMatchQty / branchGC) * 100) : 0,
          sales: totalMatchSales,
          isMain: true,
          isNameGroup: true,
          itemCount: matchedItems.length,
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
        // Code-based tracking: exact match + variants
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
          columns.push({
            code: tracked.item_code, name: tracked.item_name,
            qty: 0, countPct: 0, auv: 0, ir: 0, sales: 0, isMain: true,
          })
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
  }, [trackedItems, branchItems, branchGC])

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
    <div className="space-y-4 md:space-y-5">
      {/* Header + Date */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Sales Reports</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">Daily sales across all branches</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-500 hidden sm:block" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none w-[130px]"
            />
            {isToday && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded font-medium">Today</span>
            )}
          </div>
          <button onClick={() => changeDate(1)} disabled={isToday} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <>
          {/* Branch Selector — horizontal scroll on mobile */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Branch</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {branches.map((b) => {
                const hasSales = (branchSales[b.id] || []).length > 0
                const isSelected = selectedBranch?.id === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b)}
                    className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all relative whitespace-nowrap flex-shrink-0 ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : hasSales
                          ? 'bg-green-900/30 border border-green-800/50 text-green-400 hover:bg-green-900/50'
                          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {b.name}
                    {hasSales && !isSelected && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Branch Report */}
          {selectedBranch && (
            <div className="space-y-4">
              {/* Branch Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-white">{selectedBranch.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{selectedBranch.code}</span>
                    {selectedBranch.territory_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded">
                        {selectedBranch.territory_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {SALES_WINDOWS.map(w => (
                    <div
                      key={w.id}
                      className={`w-3 h-3 rounded-full ${
                        submittedWindows.includes(w.id) ? 'bg-green-400' : 'bg-gray-700'
                      }`}
                      title={`${w.label}: ${submittedWindows.includes(w.id) ? 'Submitted' : 'Pending'}`}
                    />
                  ))}
                  <span className="text-[10px] text-gray-500 ml-1">{submittedWindows.length}/{SALES_WINDOWS.length}</span>
                </div>
              </div>

              {currentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : currentSales.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 md:p-8 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                  <p className="text-gray-400">No sales submitted for this date</p>
                  <p className="text-xs text-gray-600 mt-1">Sales will appear here once the branch submits reports</p>
                </div>
              ) : (
                <>
                  {/* Window Selector — compact 4-col grid like flavor expert */}
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Window Status</p>
                    <div className="grid grid-cols-4 gap-2">
                      {SALES_WINDOWS.map((w) => {
                        const done = submittedWindows.includes(w.id)
                        const isActive = activeWindowId === w.id
                        const rec = currentSales.find(s => s.sales_window === w.id)
                        return (
                          <button
                            key={w.id}
                            onClick={() => { if (done) setActiveWindowId(w.id) }}
                            disabled={!done}
                            className={`p-2 sm:p-2.5 rounded-xl text-center transition-all ${
                              isActive && done
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                                : done
                                  ? 'bg-green-900/30 border border-green-700/50 hover:border-green-600'
                                  : 'bg-gray-800/50 border border-gray-700 opacity-60'
                            }`}
                          >
                            <p className={`text-[10px] sm:text-xs font-bold ${isActive && done ? 'text-white' : done ? 'text-green-400' : 'text-gray-500'}`}>
                              {w.label.split(' ')[0]}
                            </p>
                            {done ? (
                              <>
                                <CheckCircle2 className={`w-3.5 h-3.5 mx-auto mt-0.5 ${isActive ? 'text-white' : 'text-green-400'}`} />
                                <p className={`text-[9px] mt-0.5 font-medium ${isActive ? 'text-purple-200' : 'text-green-300'}`}>
                                  {((rec?.total_sales || 0) + (rec?.hd_net_sales || 0) + (rec?.deliveroo_net_sales || 0) + (rec?.cm_net_sales || 0)).toFixed(0)}
                                </p>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 mx-auto mt-0.5 text-gray-600" />
                                <p className="text-[9px] mt-0.5 text-gray-600">Pending</p>
                              </>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Window label */}
                  {activeRecord && (
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Showing: <span className="text-purple-400 font-semibold">{SALES_WINDOWS.find(w => w.id === activeRecord.sales_window)?.label || activeRecord.sales_window}</span> report
                    </p>
                  )}

                  {/* Summary Cards — 2-col mobile, 4-col tablet, 6-col desktop */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2">
                    <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] text-green-400 font-medium">Total Net</p>
                      <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{totalNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      {(hdNet > 0 || delNet > 0 || cmNet > 0) && <p className="text-[9px] text-gray-500 mt-0.5">POS {posNet.toFixed(0)}{hdNet > 0 ? ` +HD ${hdNet.toFixed(0)}` : ''}{delNet > 0 ? ` +Del ${delNet.toFixed(0)}` : ''}</p>}
                    </div>
                    <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] text-blue-400 font-medium">Total GC</p>
                      <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{totalGC}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">ATV: {branchATV.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] text-amber-400 font-medium">Total Gross</p>
                      <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium">Cash Sales</p>
                      <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{branchCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">Cash GC: {branchCashGC}</p>
                    </div>
                  </div>

                  {/* Sales Channels — 2-col grid like flavor expert */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* POS */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-orange-400 uppercase">POS</p>
                      <p className="text-base font-bold text-white mt-1">{posNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-[9px] text-gray-500">{branchGC} GC</p>
                      <p className="text-[9px] text-gray-500">Gross: {posGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    {/* Home Delivery */}
                    <div className={`rounded-xl p-3 border ${hdNet > 0 ? 'bg-cyan-900/20 border-cyan-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
                      <p className={`text-[9px] font-bold uppercase ${hdNet > 0 ? 'text-cyan-400' : 'text-gray-600'}`}>Home Delivery</p>
                      <p className={`text-base font-bold mt-1 ${hdNet > 0 ? 'text-white' : 'text-gray-600'}`}>{hdNet > 0 ? hdNet.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                      {hdOrders > 0 && <p className="text-[9px] text-gray-500">{hdOrders} orders</p>}
                      {hdGross > 0 && <p className="text-[9px] text-gray-500">Gross: {hdGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                    </div>
                    {/* Deliveroo */}
                    <div className={`rounded-xl p-3 border ${delNet > 0 ? 'bg-teal-900/20 border-teal-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
                      <p className={`text-[9px] font-bold uppercase ${delNet > 0 ? 'text-teal-400' : 'text-gray-600'}`}>Deliveroo</p>
                      <p className={`text-base font-bold mt-1 ${delNet > 0 ? 'text-white' : 'text-gray-600'}`}>{delNet > 0 ? delNet.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                      {delOrders > 0 && <p className="text-[9px] text-gray-500">{delOrders} orders</p>}
                      {delGross > 0 && <p className="text-[9px] text-gray-500">Gross: {delGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                    </div>
                    {/* Cool Mood */}
                    <div className={`rounded-xl p-3 border ${cmNet > 0 ? 'bg-violet-900/20 border-violet-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
                      <p className={`text-[9px] font-bold uppercase ${cmNet > 0 ? 'text-violet-400' : 'text-gray-600'}`}>Cool Mood</p>
                      <p className={`text-base font-bold mt-1 ${cmNet > 0 ? 'text-white' : 'text-gray-600'}`}>{cmNet > 0 ? cmNet.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                      {cmOrders > 0 && <p className="text-[9px] text-gray-500">{cmOrders} orders</p>}
                      {cmGross > 0 && <p className="text-[9px] text-gray-500">Gross: {cmGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                    </div>
                  </div>

                  {/* Promotion Tracking */}
                  {promotionData.length > 0 && (() => {
                    const allCols = promotionData.flatMap(p => p.columns)
                    const promoWithSales = allCols.filter(c => c.sales > 0)
                    return (
                      <div className="bg-gradient-to-r from-pink-900/20 to-purple-900/20 border border-pink-800/40 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-pink-800/30">
                          <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider">
                            Promotion Tracking
                          </p>
                        </div>
                        <div className="p-3 sm:p-4 space-y-4">
                          {/* Donut — hidden on mobile */}
                          {promoWithSales.length > 1 && (
                            <div className="mb-4 hidden sm:block">
                              <CategoryDonut categories={promoWithSales.map(c => ({ name: c.name, sales: c.sales }))} size={110} />
                            </div>
                          )}
                          {/* Promo Cards — horizontal scroll on mobile, grid on desktop */}
                          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:overflow-x-visible">
                            {allCols.map((col, ci) => (
                              <div
                                key={`promo-${col.code}-${ci}`}
                                className={`flex-shrink-0 min-w-[140px] sm:min-w-0 rounded-xl p-2.5 sm:p-3 border ${
                                  col.isCategory
                                    ? 'bg-orange-900/30 border-orange-700/50'
                                    : col.isNameGroup
                                      ? 'bg-green-900/30 border-green-700/50'
                                      : col.isMain
                                        ? 'bg-pink-900/30 border-pink-700/50'
                                        : 'bg-purple-900/20 border-purple-700/40'
                                }`}
                              >
                                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                                  <span className="text-[8px] font-mono text-gray-500">{col.code}</span>
                                  {col.isCategory ? (
                                    <span className="text-[7px] px-1 py-0.5 bg-orange-800/50 text-orange-300 rounded">
                                      CAT{col.itemCount > 0 ? ` · ${col.itemCount}` : ''}
                                    </span>
                                  ) : col.isNameGroup ? (
                                    <span className="text-[7px] px-1 py-0.5 bg-green-800/50 text-green-300 rounded">
                                      ALL{col.itemCount > 0 ? ` · ${col.itemCount}` : ''}
                                    </span>
                                  ) : col.isMain ? (
                                    <span className="text-[7px] px-1 py-0.5 bg-pink-800/50 text-pink-300 rounded">PROMO</span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] font-semibold text-white truncate mb-2" title={col.name}>
                                  {col.name}
                                </p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase">QTY</p>
                                    <p className="text-xs font-bold text-white">{col.qty}</p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase">%Count</p>
                                    <p className="text-xs font-bold text-amber-400">{col.countPct.toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase">AUV</p>
                                    <p className="text-xs font-bold text-blue-400">{col.auv.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase">IR</p>
                                    <p className="text-xs font-bold text-purple-400">{col.ir.toFixed(1)}%</p>
                                  </div>
                                </div>
                                <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                                  <p className="text-[8px] text-gray-500">Sales</p>
                                  <p className="text-[11px] font-semibold text-green-400">{col.sales.toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Category Breakdown */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-700">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Category Breakdown</p>
                      </div>
                      <div className="p-4">
                        {branchCategories.length > 0 ? (
                          <>
                            <div className="hidden sm:block">
                              <CategoryDonut categories={branchCategories} size={110} />
                            </div>
                            <div className="overflow-x-auto mt-3">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="border-b border-gray-700">
                                    <th className="text-left py-1 text-gray-500">Category</th>
                                    <th className="text-right py-1 text-gray-500">Qty</th>
                                    <th className="text-right py-1 text-gray-500">Sales</th>
                                    <th className="text-right py-1 text-gray-500">AUV</th>
                                    <th className="text-right py-1 text-gray-500">IR</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {branchCategories.map((cat, i) => {
                                    const qty = cat.qty || 0
                                    const auv = qty > 0 ? (cat.sales / qty).toFixed(2) : '0.00'
                                    const ir = branchGC > 0 ? ((qty / branchGC) * 100).toFixed(1) : '0.0'
                                    return (
                                      <tr key={i} className="border-b border-gray-800">
                                        <td className="py-1 text-gray-300">{cat.name}</td>
                                        <td className="text-right py-1 text-gray-400">{qty}</td>
                                        <td className="text-right py-1 text-white">{cat.sales.toFixed(0)}</td>
                                        <td className="text-right py-1 text-blue-400 font-medium">{auv}</td>
                                        <td className="text-right py-1 text-purple-400 font-medium">{ir}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-6">
                            <ShoppingBag className="w-8 h-8 mx-auto text-gray-700 mb-2" />
                            <p className="text-xs text-gray-500">No category data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items Table — scrollable */}
                  {branchItems.length > 0 && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 py-3 border-b border-gray-700">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Item Tracker ({branchItems.length} items)
                        </p>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-3">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-gray-800">
                            <tr className="text-gray-500 border-b border-gray-700">
                              <th className="text-left py-1.5">Item</th>
                              <th className="text-right py-1.5">Qty</th>
                              <th className="text-right py-1.5">Sales</th>
                              <th className="text-right py-1.5">IR%</th>
                              <th className="text-right py-1.5">AUV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branchItems
                              .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                              .map((item, i) => {
                              const qty = item.quantity || 0
                              const sales = item.sales || 0
                              const auv = qty > 0 ? (sales / qty).toFixed(2) : '0.00'
                              const ir = branchGC > 0 ? ((qty / branchGC) * 100).toFixed(1) : '0.0'
                              return (
                                <tr key={i} className="border-b border-gray-800/50">
                                  <td className="py-1.5 font-medium text-white truncate max-w-[120px]">{item.name}</td>
                                  <td className="text-right py-1.5 text-gray-400">{qty}</td>
                                  <td className="text-right py-1.5 text-white font-medium">{sales.toFixed(0)}</td>
                                  <td className="text-right py-1.5 text-blue-400 font-medium">{ir}%</td>
                                  <td className="text-right py-1.5 text-gray-400">{auv}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

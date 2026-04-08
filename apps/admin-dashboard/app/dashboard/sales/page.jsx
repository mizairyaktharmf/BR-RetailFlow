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
  Download,
  FileSpreadsheet,
  FileText,
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
    <div className="flex flex-col items-center gap-3">
      {/* Donut — smaller on mobile */}
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
      {/* Legend — 2-col grid on mobile to save space */}
      <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1">
        {segments.map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-[10px] text-gray-300 truncate">{cat.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] font-semibold text-white">{Math.round(cat.pct * 100)}%</span>
              <span className="text-[9px] text-gray-500 w-10 text-right">{cat.sales.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// Budget vs Actual line chart
function BudgetLineChart({ data, selectedDate }) {
  if (!data?.days?.length) return null
  const days = data.days
  const today = new Date().toISOString().split('T')[0]
  const selectedDay = parseInt(selectedDate.split('-')[2])

  // Only show days up to today (or all if viewing past month)
  const visibleDays = days.filter(d => d.date <= today || d.budget > 0)
  if (visibleDays.length === 0) return null

  const maxVal = Math.max(
    ...visibleDays.map(d => Math.max(d.budget || 0, d.actual || 0, d.ly_sales || 0)),
    1
  )

  const w = 600, h = 160, padL = 40, padR = 10, padT = 10, padB = 25
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const x = (i) => padL + (i / (visibleDays.length - 1 || 1)) * chartW
  const y = (val) => padT + chartH - (val / maxVal) * chartH

  const line = (key) => visibleDays
    .filter(d => d[key] > 0)
    .map((d, i, arr) => {
      const idx = visibleDays.indexOf(d)
      return `${i === 0 ? 'M' : 'L'}${x(idx).toFixed(1)},${y(d[key]).toFixed(1)}`
    }).join(' ')

  const budgetLine = line('budget')
  const actualLine = line('actual')
  const lyLine = line('ly_sales')

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)]

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-gray-700 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Budget vs Actual</p>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />Budget</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block rounded" />Actual</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500 inline-block rounded" />LY</span>
        </div>
      </div>
      <div className="p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[400px]" style={{ height: 160 }}>
          {/* Grid lines */}
          {yLabels.map((val, i) => (
            <g key={i}>
              <line x1={padL} y1={y(val)} x2={w - padR} y2={y(val)} stroke="#374151" strokeWidth="0.5" strokeDasharray="4,4" />
              <text x={padL - 4} y={y(val) + 3} textAnchor="end" className="fill-gray-500" fontSize="8">{val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}</text>
            </g>
          ))}
          {/* X-axis day labels */}
          {visibleDays.map((d, i) => (
            (d.day % 5 === 1 || d.day === visibleDays.length) && (
              <text key={d.day} x={x(i)} y={h - 4} textAnchor="middle" className="fill-gray-500" fontSize="8">{d.day}</text>
            )
          ))}
          {/* LY line */}
          {lyLine && <path d={lyLine} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" />}
          {/* Budget line */}
          {budgetLine && <path d={budgetLine} fill="none" stroke="#f59e0b" strokeWidth="1.5" />}
          {/* Actual line */}
          {actualLine && <path d={actualLine} fill="none" stroke="#4ade80" strokeWidth="2" />}
          {/* Dots for actual */}
          {visibleDays.filter(d => d.actual > 0).map((d) => {
            const idx = visibleDays.indexOf(d)
            const isSelected = d.day === selectedDay
            return (
              <circle key={d.day} cx={x(idx)} cy={y(d.actual)} r={isSelected ? 4 : 2}
                fill={d.actual >= d.budget ? '#4ade80' : '#f87171'}
                stroke={isSelected ? '#fff' : 'none'} strokeWidth="1.5" />
            )
          })}
          {/* Selected day vertical line */}
          {(() => {
            const selIdx = visibleDays.findIndex(d => d.day === selectedDay)
            if (selIdx >= 0) return (
              <line x1={x(selIdx)} y1={padT} x2={x(selIdx)} y2={padT + chartH} stroke="#a78bfa" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
            )
            return null
          })()}
        </svg>
      </div>
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function YoYBarChart({ data, currentYear, prevYear }) {
  if (!data?.months?.length) return null

  const months = data.months
  const maxVal = Math.max(...months.flatMap(m => [m.current ?? 0, m.previous ?? 0]), 1)

  const w = 600, h = 180
  const padL = 42, padR = 10, padT = 24, padB = 30
  const chartW = w - padL - padR
  const chartH = h - padT - padB
  const groupW = chartW / 12
  const barW = Math.min(groupW * 0.38, 14)
  const gap = groupW * 0.06

  const yScale = (v) => padT + chartH - (v / maxVal) * chartH
  const fmt = (v) => {
    if (v == null || v === 0) return ''
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
    return `${v}`
  }

  const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)]

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-gray-700 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Year-over-Year Sales</p>
        <div className="flex items-center gap-4 text-[9px] text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> {currentYear}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> {prevYear}
          </span>
        </div>
      </div>
      <div className="p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[380px]" style={{ height: 180 }}>
          {/* Y-axis labels + grid */}
          {yLabels.map((val, i) => (
            <g key={i}>
              <line x1={padL} y1={yScale(val)} x2={w - padR} y2={yScale(val)} stroke="#374151" strokeWidth="0.5" strokeDasharray="4,4" />
              <text x={padL - 4} y={yScale(val) + 3} textAnchor="end" fill="#6b7280" fontSize="8">{fmt(val)}</text>
            </g>
          ))}

          {months.map((m, idx) => {
            const cx = padL + idx * groupW + groupW / 2
            const curX = cx - barW - gap / 2
            const prevX = cx + gap / 2
            const curH = ((m.current ?? 0) / maxVal) * chartH
            const prevH = ((m.previous ?? 0) / maxVal) * chartH
            const curY = yScale(m.current ?? 0)
            const prevY = yScale(m.previous ?? 0)

            const growth = m.previous > 0 ? Math.round(((m.current - m.previous) / m.previous) * 100) : null

            return (
              <g key={idx}>
                {/* Previous year bar */}
                {prevH > 0 && (
                  <rect x={prevX} y={prevY} width={barW} height={prevH} fill="#6b7280" rx="1" opacity="0.7" />
                )}
                {/* Current year bar */}
                {curH > 0 && (
                  <rect x={curX} y={curY} width={barW} height={curH} fill="#6366f1" rx="1" />
                )}
                {/* Value label on current bar */}
                {m.current > 0 && (
                  <text x={curX + barW / 2} y={curY - 3} textAnchor="middle" fill="#a5b4fc" fontSize="7">
                    {fmt(m.current)}
                  </text>
                )}
                {/* Growth % label */}
                {growth !== null && growth !== 0 && (
                  <text
                    x={cx}
                    y={Math.min(curY, prevY) - (growth > 0 ? 12 : 3)}
                    textAnchor="middle"
                    fill={growth > 0 ? '#4ade80' : '#f87171'}
                    fontSize="7"
                    fontWeight="bold"
                  >
                    {growth > 0 ? '+' : ''}{growth}%
                  </text>
                )}
                {/* Month label */}
                <text x={cx} y={h - 6} textAnchor="middle" fill="#6b7280" fontSize="8">
                  {MONTHS[idx]}
                </text>
              </g>
            )
          })}
        </svg>
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
  const [selectedDate, setSelectedDate] = useState('')
  const [activeWindowId, setActiveWindowId] = useState(null)
  const [trackedItems, setTrackedItems] = useState([])
  const [budgetChart, setBudgetChart] = useState(null)
  const [yoyData, setYoyData] = useState(null)
  const [yoyLoading, setYoyLoading] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) { router.push('/login'); return }
    setUser(JSON.parse(userData))
    setSelectedDate(new Date().toISOString().split('T')[0])
    loadBranches()
  }, [router])

  useEffect(() => {
    if (branches.length > 0 && selectedDate) loadAllSales()
  }, [branches, selectedDate])

  useEffect(() => {
    if (!selectedBranch) return
    api.getTrackedItems(selectedBranch.id)
      .then(items => setTrackedItems(Array.isArray(items) ? items : []))
      .catch(() => setTrackedItems([]))
  }, [selectedBranch])

  useEffect(() => {
    if (!selectedBranch) return
    const month = selectedDate.slice(0, 7)
    api.getBudgetChart(selectedBranch.id, month)
      .then(data => setBudgetChart(data))
      .catch(() => setBudgetChart(null))
  }, [selectedBranch, selectedDate])

  useEffect(() => {
    if (!selectedBranch) return
    const year = parseInt(selectedDate.split('-')[0])
    setYoyLoading(true)
    api.getMonthlySalesYoY(selectedBranch.id, year)
      .then(data => setYoyData(data))
      .catch(() => setYoyData(null))
      .finally(() => setYoyLoading(false))
  }, [selectedBranch, selectedDate])

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

  const exportExcel = async () => {
    if (!selectedBranch || currentSales.length === 0) return
    const xlsxModule = await import('xlsx')
    const XLSX = xlsxModule.default || xlsxModule
    const rows = [
      ['Branch', 'Date', 'Window', 'Gross Sales', 'Net Sales', 'GC', 'ATV', 'HD Gross', 'HD Net', 'HD Orders', 'Deliveroo Gross', 'Deliveroo Net', 'Cool Mood Gross', 'Cash Sales'],
      ...currentSales.map(s => [
        selectedBranch.name, selectedDate, s.sales_window,
        s.gross_sales || 0, s.total_sales || 0, s.transaction_count || 0, s.atv || 0,
        s.hd_gross_sales || 0, s.hd_net_sales || 0, s.hd_orders || 0,
        s.deliveroo_gross_sales || 0, s.deliveroo_net_sales || 0,
        s.cm_gross_sales || 0, s.cash_sales || 0,
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0].map(() => ({ wch: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')

    // Add budget sheet if available
    if (budgetChart?.days?.length) {
      const budgetRows = [
        ['Date', 'Day', 'Budget', 'Actual', 'LY Sales', 'Achievement %'],
        ...budgetChart.days.map(d => [
          d.date, d.day_name, d.budget || 0, d.actual || 0, d.ly_sales || 0,
          d.budget > 0 ? ((d.actual / d.budget) * 100).toFixed(1) + '%' : '-'
        ])
      ]
      const ws2 = XLSX.utils.aoa_to_sheet(budgetRows)
      XLSX.utils.book_append_sheet(wb, ws2, 'Budget vs Actual')
    }

    XLSX.writeFile(wb, `sales-${selectedBranch.name.replace(/\s+/g, '-')}-${selectedDate}.xlsx`)
  }

  const exportPDF = async () => {
    if (!selectedBranch || currentSales.length === 0) return
    const jsPDF = (await import('jspdf')).default
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFillColor(17, 24, 39)
    doc.rect(0, 0, 297, 210, 'F')

    doc.setTextColor(167, 139, 250)
    doc.setFontSize(14)
    doc.text(`Sales Report — ${selectedBranch.name}`, 14, 15)
    doc.setTextColor(156, 163, 175)
    doc.setFontSize(9)
    doc.text(`Date: ${selectedDate}  |  Generated: ${new Date().toLocaleString()}`, 14, 22)

    const body = currentSales.map(s => [
      s.sales_window,
      (s.gross_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      (s.total_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      s.transaction_count || 0,
      s.atv ? Number(s.atv).toFixed(2) : '-',
      (s.hd_gross_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      (s.deliveroo_gross_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      (s.cm_gross_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      (s.cash_sales || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    ])

    doc.autoTable({
      head: [['Window', 'Gross', 'Net', 'GC', 'ATV', 'HD Gross', 'Deliveroo', 'Cool Mood', 'Cash']],
      body,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81], textColor: [209, 213, 219], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [31, 41, 55], textColor: [209, 213, 219], fontSize: 8 },
      alternateRowStyles: { fillColor: [37, 49, 65] },
    })

    // Budget summary if available
    if (budgetChart?.days?.length) {
      const todayBudget = budgetChart.days.find(d => d.date === selectedDate)
      if (todayBudget && doc.lastAutoTable) {
        const y = (doc.lastAutoTable.finalY || 80) + 8
        doc.setTextColor(167, 139, 250)
        doc.setFontSize(10)
        doc.text('Budget vs Actual (Today)', 14, y)
        doc.autoTable({
          head: [['Budget', 'Actual', 'LY Sales', 'Achievement']],
          body: [[
            (todayBudget.budget || 0).toLocaleString(),
            (todayBudget.actual || 0).toLocaleString(),
            (todayBudget.ly_sales || 0).toLocaleString(),
            todayBudget.budget > 0 ? `${((todayBudget.actual / todayBudget.budget) * 100).toFixed(1)}%` : '-'
          ]],
          startY: y + 4,
          theme: 'grid',
          headStyles: { fillColor: [55, 65, 81], textColor: [209, 213, 219], fontSize: 8 },
          bodyStyles: { fillColor: [31, 41, 55], textColor: [209, 213, 219], fontSize: 8 },
        })
      }
    }

    doc.save(`sales-${selectedBranch.name.replace(/\s+/g, '-')}-${selectedDate}.pdf`)
  }

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

  // Day budget & LY data from budget chart
  const dayBudgetData = useMemo(() => {
    if (!budgetChart?.days) return null
    return budgetChart.days.find(d => d.date === selectedDate) || null
  }, [budgetChart, selectedDate])
  const dayBudget = dayBudgetData?.budget || 0
  const dayLySales = dayBudgetData?.ly_sales || 0
  const dayLyGC = dayBudgetData?.ly_gc || 0
  const dayBudgetGC = dayBudgetData?.budget_gc || 0
  const achievement = dayBudget > 0 ? (totalNet / dayBudget * 100) : 0

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
    try {
      const raw = JSON.parse(activeRecord.items_data)
      // Remove true duplicates — same name + same qty + same sales
      const seen = new Set()
      return raw.filter(it => {
        const key = `${(it.name || '').toLowerCase()}|${it.quantity || 0}|${it.sales || 0}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } catch { return [] }
  }, [activeRecord])

  const promotionData = useMemo(() => {
    if (!trackedItems.length || !branchItems.length) return []
    const totalQty = branchItems.reduce((s, it) => s + (it.quantity || 0), 0)

    return trackedItems.map(tracked => {
      const isCategory = tracked.item_code?.startsWith('CAT:')

      if (isCategory) {
        const catName = tracked.item_code.replace('CAT:', '')
        const catLower = catName.toLowerCase()
        const catRow = branchCategories.find(c => {
          if (!c.name) return false
          const cLow = c.name.toLowerCase()
          if (cLow === catLower || cLow.includes(catLower) || catLower.includes(cLow)) return true
          // Word-root match for spelling variations (Desserts vs Deserts)
          const cWords = cLow.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
          const tWords = catLower.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
          return tWords.some(tw => cWords.some(cw => cw === tw || cw.includes(tw) || tw.includes(cw)))
        })
        const catQty = catRow?.qty || 0
        const catSales = catRow?.sales || 0
        // Match items by category field — use tracked name, matched category_data name, and word-root matching
        const matchNames = [catLower]
        if (catRow?.name && catRow.name.toLowerCase() !== catLower) {
          matchNames.push(catRow.name.toLowerCase())
        }
        // Also extract word roots for fuzzy matching (e.g., "desserts" → "dessert", "deserts" → "desert")
        const catWords = catLower.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
        const catItems = branchItems.filter(it => {
          if (!it.category) return false
          const itCat = it.category.toLowerCase()
          // Direct match or includes match
          if (matchNames.some(mn => itCat === mn || itCat.includes(mn) || mn.includes(itCat))) return true
          // Word-root match: any significant word root from tracked name found in item category
          const itWords = itCat.replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.replace(/s$/, ''))
          return catWords.some(cw => itWords.some(iw => iw === cw || iw.includes(cw) || cw.includes(iw)))
        })

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
      // Strip prefixes (TA, TA-, numbers like 6", 8") and size suffixes to get core product name
      const stripName = (name) => name
        ?.replace(/^(TA\s*-?\s*|T\s*A\s+)/i, '')
        .replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '')
        .replace(/^\d+"\s*/, '')
        .trim()
      const baseName = isNameTrack
        ? stripName(tracked.item_code.replace('NAME:', ''))
        : stripName(tracked.item_name)
      const baseNameLower = baseName.toLowerCase()

      // Split base name into significant keywords (2+ chars) for fuzzy matching
      const baseKeywords = baseNameLower.split(/\s+/).filter(w => w.length >= 2)

      const matchedItems = branchItems.filter(it => {
        // Exact code match
        if (!isNameTrack && it.code === tracked.item_code) return true
        if (!it.name) return false
        const itStripped = stripName(it.name).toLowerCase()
        // Direct contains match (e.g. "umm ali" found in "umm ali sgl kid")
        if (itStripped.includes(baseNameLower)) return true
        if (baseNameLower.includes(itStripped) && itStripped.length >= 4) return true
        // Keyword match: ALL significant keywords must appear as exact word matches
        if (baseKeywords.length >= 2) {
          const itWords = itStripped.split(/\s+/)
          const allMatch = baseKeywords.every(kw =>
            itWords.some(iw => iw === kw || iw.startsWith(kw) || kw.startsWith(iw))
          )
          if (allMatch) return true
        }
        return false
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 max-w-full overflow-x-hidden">
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
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                  {currentSales.length > 0 && (
                    <>
                      <Button variant="ghost" size="sm" onClick={exportExcel} className="text-green-400 hover:text-green-300 text-xs h-8 px-2">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                      </Button>
                      <Button variant="ghost" size="sm" onClick={exportPDF} className="text-purple-400 hover:text-purple-300 text-xs h-8 px-2">
                        <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                    </>
                  )}

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
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 md:p-8 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">No sales submitted for this date</p>
                  <p className="text-[11px] text-gray-600 mt-1">Sales will appear once the branch submits reports</p>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2">
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

                  {/* Budget & LY Cards */}
                  {dayBudget > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2">
                      <div className="bg-purple-900/20 border border-purple-800/40 rounded-xl p-3">
                        <p className="text-[9px] sm:text-[10px] text-purple-400 font-medium">Day Budget</p>
                        <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{dayBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">GC: {dayBudgetGC}</p>
                      </div>
                      <div className={`rounded-xl p-3 border ${achievement >= 100 ? 'bg-green-900/20 border-green-800/40' : achievement >= 80 ? 'bg-yellow-900/20 border-yellow-800/40' : 'bg-red-900/20 border-red-800/40'}`}>
                        <p className={`text-[9px] sm:text-[10px] font-medium ${achievement >= 100 ? 'text-green-400' : achievement >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>Achievement</p>
                        <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{achievement.toFixed(1)}%</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">Gap: {(totalNet - dayBudget).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-3">
                        <p className="text-[9px] sm:text-[10px] text-indigo-400 font-medium">LY Sales</p>
                        <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{dayLySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">vs Today: {totalNet > 0 && dayLySales > 0 ? ((totalNet / dayLySales * 100) - 100).toFixed(1) + '%' : '—'}</p>
                      </div>
                      <div className="bg-teal-900/20 border border-teal-800/40 rounded-xl p-3">
                        <p className="text-[9px] sm:text-[10px] text-teal-400 font-medium">LY GC</p>
                        <p className="text-lg sm:text-sm md:text-base font-bold text-white mt-0.5">{dayLyGC}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">vs Today: {totalGC > 0 && dayLyGC > 0 ? ((totalGC / dayLyGC * 100) - 100).toFixed(1) + '%' : '—'}</p>
                      </div>
                    </div>
                  )}

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

                  {/* Budget vs Actual Chart */}
                  <BudgetLineChart data={budgetChart} selectedDate={selectedDate} />

                  {/* Promotion Tracking */}
                  {promotionData.length > 0 && (() => {
                    const mainItems = promotionData.map(p => p.columns[0]).filter(c => c.sales > 0)
                    return (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Promotion Tracking</p>
                        {/* Donut for main totals */}
                        {mainItems.length > 1 && (
                          <div className="mb-3">
                            <CategoryDonut categories={mainItems.map(c => ({ name: c.name, sales: c.sales }))} size={100} />
                          </div>
                        )}
                        {/* Grouped containers — one per tracked item */}
                        <div className="space-y-3">
                          {promotionData.map((group, gi) => {
                            const main = group.columns[0]
                            const variants = group.columns.slice(1)
                            const borderColor = main.isCategory
                              ? 'border-orange-700/50' : main.isNameGroup
                              ? 'border-green-700/50' : 'border-pink-700/50'
                            const bgColor = main.isCategory
                              ? 'bg-orange-900/20' : main.isNameGroup
                              ? 'bg-green-900/20' : 'bg-pink-900/20'
                            return (
                              <div key={`group-${gi}`} className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
                                {/* Main total header */}
                                <div className="p-3 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <p className="text-xs font-bold text-white truncate">{main.name}</p>
                                      {main.isCategory ? (
                                        <span className="text-[7px] px-1 py-0.5 bg-orange-800/50 text-orange-300 rounded flex-shrink-0">CAT</span>
                                      ) : main.isNameGroup ? (
                                        <span className="text-[7px] px-1 py-0.5 bg-green-800/50 text-green-300 rounded flex-shrink-0">ALL</span>
                                      ) : (
                                        <span className="text-[7px] px-1 py-0.5 bg-pink-800/50 text-pink-300 rounded flex-shrink-0">PROMO</span>
                                      )}
                                    </div>
                                    {variants.length > 0 && (
                                      <p className="text-[9px] text-gray-500">{variants.length} variant{variants.length > 1 ? 's' : ''} sold</p>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-4 gap-3 flex-shrink-0 text-center">
                                    <div>
                                      <p className="text-[8px] text-gray-500">QTY</p>
                                      <p className="text-sm font-bold text-white">{main.qty}</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] text-gray-500">IR</p>
                                      <p className="text-sm font-bold text-purple-400">{main.ir.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] text-gray-500">AUV</p>
                                      <p className="text-sm font-bold text-blue-400">{main.auv.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[8px] text-gray-500">Sales</p>
                                      <p className="text-sm font-bold text-green-400">{main.sales.toFixed(0)}</p>
                                    </div>
                                  </div>
                                </div>
                                {/* Variant cards — horizontal scroll */}
                                {variants.length > 0 && (
                                  <div className="border-t border-gray-700/50 px-3 py-2">
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {variants.map((v, vi) => (
                                        <div key={`v-${gi}-${vi}`} className="flex-shrink-0 min-w-[120px] bg-gray-800/60 rounded-lg p-2 border border-gray-700/50">
                                          <p className="text-[10px] font-medium text-white truncate mb-1.5" title={v.name}>{v.name}</p>
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                            <div>
                                              <p className="text-[7px] text-gray-500">QTY</p>
                                              <p className="text-[11px] font-bold text-white">{v.qty}</p>
                                            </div>
                                            <div>
                                              <p className="text-[7px] text-gray-500">Sales</p>
                                              <p className="text-[11px] font-bold text-green-400">{v.sales.toFixed(0)}</p>
                                            </div>
                                            <div>
                                              <p className="text-[7px] text-gray-500">AUV</p>
                                              <p className="text-[11px] font-bold text-blue-400">{v.auv.toFixed(2)}</p>
                                            </div>
                                            <div>
                                              <p className="text-[7px] text-gray-500">IR</p>
                                              <p className="text-[11px] font-bold text-purple-400">{v.ir.toFixed(1)}%</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Category Breakdown */}
                  <div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 py-2.5 border-b border-gray-700">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Category Breakdown</p>
                      </div>
                      <div className="p-3 sm:p-4">
                        {branchCategories.length > 0 ? (
                          <>
                            <div>
                              <CategoryDonut categories={branchCategories} size={100} />
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
                                  <td className="py-1.5 font-medium text-white"><span className="block truncate max-w-[100px] sm:max-w-[200px]">{item.name}</span></td>
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

              {/* Year-over-Year Sales Chart */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Year-over-Year Comparison</p>
                  {yoyLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
                </div>
                {yoyData ? (
                  <YoYBarChart
                    data={yoyData}
                    currentYear={parseInt(selectedDate.split('-')[0])}
                    prevYear={parseInt(selectedDate.split('-')[0]) - 1}
                  />
                ) : !yoyLoading ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
                    <p className="text-xs text-gray-500">No year-over-year data available for this branch.</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

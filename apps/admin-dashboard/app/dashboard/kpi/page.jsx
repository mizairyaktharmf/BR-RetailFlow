"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, RefreshCw, TrendingUp, Calendar, Download } from 'lucide-react'
import api from '@/services/api'

const STATUS_CONFIG = {
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: '🟢', label: 'On Track' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: '🟡', label: 'Watch' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: '🔴', label: 'Needs Attention' },
}

const STATUS_SORT = { red: 0, yellow: 1, green: 2 }

function statusColor(pct, thresholds = [70, 90]) {
  if (pct === null || pct === undefined) return 'yellow'
  if (pct >= thresholds[1]) return 'green'
  if (pct >= thresholds[0]) return 'yellow'
  return 'red'
}

function MetricRow({ label, value, status, note }) {
  const conf = STATUS_CONFIG[status || 'green']
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</span>
      <span className="text-xs text-white flex-1 px-2">{value}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {note && <span className="text-[10px] text-gray-500">{note}</span>}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>{conf.dot}</span>
      </div>
    </div>
  )
}

function ScorecardCard({ card }) {
  const overallConf = STATUS_CONFIG[card.overall_status || 'green']

  // Backend returns nested: card.sales.today, card.mtd.actual, card.feedback.avg_rating etc.
  const todayActual = card.sales?.today ?? 0
  const todayBudget = card.sales?.budget_today ?? 0
  const todayPct = card.sales?.achievement_pct ?? (todayBudget > 0 ? Math.round(todayActual / todayBudget * 100) : null)
  const todaySt = card.sales?.status || statusColor(todayPct, [70, 90])

  const mtdActual = card.mtd?.actual ?? 0
  const mtdBudget = card.mtd?.budget ?? 0
  const mtdPct = card.mtd?.achievement_pct ?? (mtdBudget > 0 ? Math.round(mtdActual / mtdBudget * 100) : null)
  const mtdSt = card.mtd?.status || statusColor(mtdPct, [80, 95])

  const avgRating = card.feedback?.avg_rating ?? null
  const complaints = card.feedback?.complaints_7d ?? 0
  const fbSt = card.feedback?.status || 'green'

  const nearExpiry = card.expiry?.near_expiry_items ?? null
  const expSt = card.expiry?.status || 'green'

  const visitCount = card.visits?.this_month ?? null
  const visitSt = card.visits?.status || 'red'

  const fmtAed = (v) => {
    if (v == null || v === 0) return 'AED 0'
    if (v >= 1000000) return `AED ${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `AED ${(v / 1000).toFixed(0)}k`
    return `AED ${Math.round(v)}`
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-700 ${overallConf.bg}`}>
        <span className="text-sm font-bold text-white truncate">{card.branch_name}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${overallConf.bg} ${overallConf.text} border ${overallConf.border}`}>
          {overallConf.dot} {overallConf.label}
        </span>
      </div>
      <CardContent className="p-3 space-y-0">
        <MetricRow
          label="Today Sales"
          value={`${fmtAed(todayActual)} / ${fmtAed(todayBudget)}`}
          status={todaySt}
          note={todayPct != null ? `${todayPct}%` : ''}
        />
        <MetricRow
          label="MTD"
          value={`${fmtAed(mtdActual)} / ${fmtAed(mtdBudget)}`}
          status={mtdSt}
          note={mtdPct != null ? `${mtdPct}%` : ''}
        />
        <MetricRow
          label="Feedback"
          value={avgRating != null && avgRating > 0 ? `⭐ ${Number(avgRating).toFixed(1)}` : 'No feedback yet'}
          status={fbSt}
          note={complaints > 0 ? `${complaints} complaint${complaints > 1 ? 's' : ''}` : ''}
        />
        <MetricRow
          label="Expiry"
          value={nearExpiry != null ? `${nearExpiry} near-expiry item${nearExpiry !== 1 ? 's' : ''}` : '0 items'}
          status={expSt}
        />
        <MetricRow
          label="Visits"
          value={visitCount != null ? `${visitCount} visit${visitCount !== 1 ? 's' : ''} this month` : '0 visits'}
          status={visitSt}
        />
      </CardContent>
    </Card>
  )
}

export default function KpiScorecardsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState([])
  const [error, setError] = useState(null)
  const [date, setDate] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) { router.push('/login'); return }
    setDate(new Date().toISOString().split('T')[0])
  }, [router])

  useEffect(() => {
    if (date) loadScorecards()
  }, [date])

  const loadScorecards = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getKpiScorecards(date)
      const list = Array.isArray(data) ? data : (data?.scorecards || [])
      // Sort: red first, yellow, then green
      const sorted = [...list].sort((a, b) =>
        (STATUS_SORT[a.overall_status] ?? 1) - (STATUS_SORT[b.overall_status] ?? 1)
      )
      setCards(sorted)
    } catch (err) {
      setError(err.message || 'Failed to load KPI scorecards')
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = async () => {
    if (cards.length === 0) return
    setExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFontSize(16)
      doc.setTextColor(255, 255, 255)
      doc.setFillColor(30, 41, 59)
      doc.rect(0, 0, 297, 210, 'F')

      doc.setTextColor(168, 85, 247)
      doc.setFontSize(14)
      doc.text('KPI Scorecards', 14, 16)
      doc.setTextColor(150, 150, 150)
      doc.setFontSize(9)
      doc.text(`Date: ${date}  |  Generated: ${new Date().toLocaleString()}`, 14, 22)

      const statusDot = (s) => s === 'green' ? 'OK' : s === 'yellow' ? 'WATCH' : 'ALERT'
      const fmtAed = (v) => {
        if (v == null) return '-'
        if (v >= 1000) return `AED ${(v / 1000).toFixed(0)}k`
        return `AED ${v}`
      }

      const tableData = cards.map(card => {
        const todayPct = card.sales?.achievement_pct ?? null
        const mtdPct = card.mtd?.achievement_pct ?? null
        const avgRating = card.feedback?.avg_rating ?? null
        const complaints = card.feedback?.complaints_7d ?? 0
        const nearExpiry = card.expiry?.near_expiry_items ?? 0
        const visitCount = card.visits?.this_month ?? 0
        return [
          card.branch_name || '-',
          statusDot(card.overall_status || 'green'),
          `${fmtAed(card.sales?.today ?? 0)} / ${fmtAed(card.sales?.budget_today ?? 0)}${todayPct != null ? ` (${todayPct}%)` : ''}`,
          `${fmtAed(card.mtd?.actual ?? 0)} / ${fmtAed(card.mtd?.budget ?? 0)}${mtdPct != null ? ` (${mtdPct}%)` : ''}`,
          avgRating != null && avgRating > 0 ? `${Number(avgRating).toFixed(1)} ★${complaints > 0 ? ` (${complaints} cmplt)` : ''}` : 'No data',
          `${nearExpiry} items`,
          `${visitCount} visits`,
        ]
      })

      doc.autoTable({
        head: [['Branch', 'Status', 'Today Sales', 'MTD', 'Feedback', 'Expiry', 'Visits']],
        body: tableData,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81], textColor: [209, 213, 219], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fillColor: [31, 41, 55], textColor: [209, 213, 219], fontSize: 8 },
        alternateRowStyles: { fillColor: [37, 49, 65] },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const v = data.cell.raw
            if (v === 'ALERT') data.cell.styles.textColor = [248, 113, 113]
            else if (v === 'WATCH') data.cell.styles.textColor = [251, 191, 36]
            else data.cell.styles.textColor = [74, 222, 128]
          }
        }
      })

      doc.save(`kpi-scorecards-${date}.pdf`)
    } catch (err) {
      alert('PDF export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">KPI Scorecards</h1>
            <p className="text-xs text-gray-500">Branch performance at a glance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            />
          </div>
          <button
            onClick={loadScorecards}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting || cards.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex gap-4 text-xs text-gray-400">
        {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
          <span key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${conf.bg} ${conf.text}`}>
            {conf.dot} {conf.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400">
          <p>{error}</p>
          <button onClick={loadScorecards} className="mt-3 text-sm text-purple-400 hover:underline">Retry</button>
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No scorecard data for {date}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card, idx) => (
            <ScorecardCard key={card.branch_id || idx} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

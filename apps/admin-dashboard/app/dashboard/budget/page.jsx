"use client"

import { useState, useEffect, useRef } from 'react'
import {
  Target,
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RotateCcw,
  Save,
  Eye,
  Users,
  Flame,
  Trophy,
  Clock,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/services/api'

export default function BudgetPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  // Upload state
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [budgetStatus, setBudgetStatus] = useState({})
  const fileRef = useRef(null)

  // Tabs & advisor
  const [activeTab, setActiveTab] = useState('upload')
  const [advisorBranch, setAdvisorBranch] = useState(null)
  const [advisorData, setAdvisorData] = useState(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)

  // Tracker overview
  const [trackerData, setTrackerData] = useState(null)
  const [trackerLoading, setTrackerLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const branchList = await api.getBranches()
      setBranches(Array.isArray(branchList) ? branchList : [])

      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const statusMap = {}
      for (const b of (Array.isArray(branchList) ? branchList : [])) {
        try {
          const check = await api.checkBudget(b.id, month)
          statusMap[b.id] = check
        } catch {
          statusMap[b.id] = { budget_uploaded: false, days_loaded: 0 }
        }
      }
      setBudgetStatus(statusMap)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ---- Upload handlers ----
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBranch) return
    if (fileRef.current) fileRef.current.value = ''

    setExtracting(true)
    setExtractedData(null)
    try {
      const result = await api.uploadBudgetSheet(file, selectedBranch.id)
      if (result.success) {
        setExtractedData(result)
      } else {
        alert(result.error || 'Extraction failed')
      }
    } catch (err) {
      alert('Failed to extract: ' + err.message)
    } finally {
      setExtracting(false)
    }
  }

  const handleConfirm = async () => {
    if (!extractedData || !selectedBranch) return
    const ext = extractedData.extracted
    const header = ext?.header || {}
    const kpis = ext?.kpis || {}
    const dailyData = ext?.daily_data || []

    // Transform daily_data to confirm format
    const days = dailyData
      .filter(d => (d.days_sales?.budget || d.days_sales?.ly_2025))
      .map(d => ({
        date: d.date_2026 ? parseDateString(d.date_2026, header.month_code) : null,
        day_name: d.day || null,
        day_of_week: d.day || null,
        budget: d.days_sales?.budget || 0,
        ly_sales: d.days_sales?.ly_2025 || 0,
        ly_gc: d.days_guest_count?.ly_2025 || 0,
        budget_gc: d._budget_gc || 0,
        mtd_ly_sales: d.mtd_sales?.ly_2025 || 0,
        mtd_budget: d.mtd_sales?.budget || 0,
        ly_atv: d._ly_atv || 0,
      }))
      .filter(d => d.date)

    setSaving(true)
    try {
      await api.confirmBudget({
        branch_id: selectedBranch.id,
        month: header.month_code || selectedMonth,
        parlor_name: header.parlor_name || (selectedBranch.name || selectedBranch.branch_name),
        area_manager: header.area_manager || null,
        kpis: kpis,
        days: days,
      })
      alert(`Budget saved for ${header.parlor_name || selectedBranch.name || selectedBranch.branch_name} — ${days.length} days`)
      setExtractedData(null)
      setSelectedBranch(null)
      loadData()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Parse date string like "2/1/2026" to "2026-02-01"
  const parseDateString = (dateStr, monthCode) => {
    if (!dateStr) return null
    try {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const m = parts[0].padStart(2, '0')
        const d = parts[1].padStart(2, '0')
        const y = parts[2]
        return `${y}-${m}-${d}`
      }
      // Fallback: use monthCode + day
      if (monthCode && parts.length >= 1) {
        const d = parts[0].padStart(2, '0')
        return `${monthCode}-${d}`
      }
    } catch { }
    return null
  }

  // ---- Advisor ----
  const loadAdvisor = async (branch) => {
    setAdvisorBranch(branch)
    setAdvisorLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await api.getSmartAdvisor(branch.id, today)
      setAdvisorData(data)
    } catch (err) {
      setAdvisorData(null)
    } finally {
      setAdvisorLoading(false)
    }
  }

  // ---- Tracker ----
  const loadTracker = async () => {
    setTrackerLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await api.getTrackerOverview(today)
      setTrackerData(data)
    } catch (err) {
      setTrackerData(null)
    } finally {
      setTrackerLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'tracker' && !trackerData) loadTracker()
  }, [activeTab])

  const fmt = (n) => {
    if (n === null || n === undefined) return '—'
    return Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  const adviceIcon = (a) => {
    const icons = {
      trophy: Trophy, fire: Flame, alert: AlertTriangle, clock: Clock,
      trending_up: TrendingUp, trending_down: TrendingDown,
      users: Users, target: Target, ice_cream: Sparkles, calendar: Calendar,
    }
    const Icon = icons[a.icon] || Sparkles
    const colors = {
      success: 'text-green-400', critical: 'text-red-400',
      warning: 'text-amber-400', info: 'text-blue-400',
    }
    return <Icon className={`w-4 h-4 ${colors[a.priority] || 'text-slate-400'}`} />
  }

  const statusColor = (s) => ({
    achieved: 'bg-green-500/10 border-green-500/30 text-green-400',
    on_track: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    behind: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
    no_budget: 'bg-slate-800/50 border-slate-700 text-slate-500',
  }[s] || 'bg-slate-800/50 border-slate-700 text-slate-400')

  const statusLabel = (s) => ({
    achieved: 'Achieved', on_track: 'On Track', behind: 'Behind',
    critical: 'Critical', no_budget: 'No Budget',
  }[s] || s)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-purple-400" />
          Budget & Smart Advisor
        </h1>
        <p className="text-sm text-slate-400 mt-1">Upload budget sheets, track targets, get smart advice</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'status', label: 'Status', icon: Eye },
          { key: 'advisor', label: 'Advisor', icon: Sparkles },
          { key: 'tracker', label: 'All Branches', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============== UPLOAD TAB ============== */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {/* Step 1: Select Branch */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300 font-bold">1</span>
                Select Branch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {branches.map(b => {
                  const status = budgetStatus[b.id]
                  const uploaded = status?.budget_uploaded
                  const selected = selectedBranch?.id === b.id
                  return (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBranch(b); setExtractedData(null) }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-purple-500 bg-purple-500/10'
                          : uploaded
                            ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                      }`}
                    >
                      <p className="text-sm font-medium text-white truncate">{b.name || b.branch_name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{b.branch_code || b.code || ''}</p>
                      {uploaded && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] text-green-400">{status.days_loaded} days</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Upload Photo */}
          {selectedBranch && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300 font-bold">2</span>
                  Upload Budget Sheet — {selectedBranch.name || selectedBranch.branch_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400">Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {extracting ? (
                  <div className="flex items-center justify-center gap-3 py-12 border-2 border-dashed border-slate-600 rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    <span className="text-sm text-slate-400">Extracting budget data from image...</span>
                  </div>
                ) : !extractedData ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-12 border-2 border-dashed border-slate-600 hover:border-purple-500/50 rounded-lg flex flex-col items-center gap-2 transition-all"
                  >
                    <Camera className="w-8 h-8 text-slate-500" />
                    <span className="text-sm text-slate-400">Tap to capture or select budget sheet photo</span>
                    <span className="text-xs text-slate-500">{selectedBranch.name || selectedBranch.branch_name} — {selectedMonth}</span>
                  </button>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review & Confirm */}
          {extractedData && extractedData.success && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300 font-bold">3</span>
                  Review & Confirm
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Warnings */}
                {extractedData.warnings?.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    {extractedData.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Header Info */}
                {extractedData.extracted?.header && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-900/50">
                      <span className="text-slate-500">Parlor:</span>
                      <span className="ml-1 text-white font-medium">{extractedData.extracted.header.parlor_name}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/50">
                      <span className="text-slate-500">Month:</span>
                      <span className="ml-1 text-white font-medium">{extractedData.extracted.header.month}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/50">
                      <span className="text-slate-500">Manager:</span>
                      <span className="ml-1 text-white font-medium">{extractedData.extracted.header.area_manager}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900/50">
                      <span className="text-slate-500">Days:</span>
                      <span className="ml-1 text-white font-medium">{extractedData.calculated?.days_with_data}</span>
                    </div>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 uppercase">Total Budget</p>
                    <p className="text-lg font-bold text-purple-300">{fmt(extractedData.calculated?.total_budget)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 uppercase">Total LY Sales</p>
                    <p className="text-lg font-bold text-blue-300">{fmt(extractedData.calculated?.total_ly_sales)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 uppercase">LY GC</p>
                    <p className="text-lg font-bold text-white">{fmt(extractedData.calculated?.total_ly_gc)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 uppercase">Avg Daily Budget</p>
                    <p className="text-lg font-bold text-white">{fmt(extractedData.calculated?.avg_daily_budget)}</p>
                  </div>
                </div>

                {/* KPIs from footer */}
                {extractedData.extracted?.kpis && (
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(extractedData.extracted.kpis).map(([key, val]) => (
                      <div key={key} className="p-2 rounded bg-slate-900/30 text-center">
                        <p className="text-[10px] text-slate-500 uppercase">{key.replace('_', ' ')}</p>
                        <p className="text-sm font-bold text-slate-300">{val?.ly_2025 ?? '—'}</p>
                        <p className="text-[10px] text-slate-500">LY</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Daily Data Table */}
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left py-2 px-2">Day</th>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-right py-2 px-2 text-blue-400">LY Sales</th>
                        <th className="text-right py-2 px-2 text-purple-400">Budget</th>
                        <th className="text-center py-2 px-2">LY GC</th>
                        <th className="text-center py-2 px-2">Bgt GC</th>
                        <th className="text-center py-2 px-2">LY ATV</th>
                        <th className="text-right py-2 px-2 text-slate-500">MTD LY</th>
                        <th className="text-right py-2 px-2 text-slate-500">MTD Bgt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(extractedData.extracted?.daily_data || []).map((d, i) => {
                        const budget = d.days_sales?.budget
                        const lySales = d.days_sales?.ly_2025
                        if (!budget && !lySales) return null
                        return (
                          <tr key={i} className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                            <td className={`py-1.5 px-2 ${d.day === 'Fri' || d.day === 'Sat' ? 'text-amber-400 font-medium' : 'text-slate-400'}`}>
                              {d.day}
                            </td>
                            <td className="py-1.5 px-2 text-white text-[11px]">{d.date_2026}</td>
                            <td className="py-1.5 px-2 text-right text-blue-300">{fmt(lySales)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-purple-300">{fmt(budget)}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{d.days_guest_count?.ly_2025 || '—'}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{d._budget_gc || '—'}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{d._ly_atv ? fmt(d._ly_atv) : '—'}</td>
                            <td className="py-1.5 px-2 text-right text-slate-500 text-[10px]">{fmt(d.mtd_sales?.ly_2025)}</td>
                            <td className="py-1.5 px-2 text-right text-slate-500 text-[10px]">{fmt(d.mtd_sales?.budget)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />Confirm & Save Budget</>
                    )}
                  </Button>
                  <Button
                    onClick={() => { setExtractedData(null); fileRef.current?.click() }}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />Retake
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============== STATUS TAB ============== */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm text-slate-300">Budget Status — {selectedMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {branches.map(b => {
                  const status = budgetStatus[b.id]
                  const uploaded = status?.budget_uploaded
                  return (
                    <div key={b.id} className={`flex items-center justify-between p-3 rounded-lg ${uploaded ? 'bg-green-500/5 border border-green-500/20' : 'bg-slate-900/50 border border-slate-700'}`}>
                      <div className="flex items-center gap-3">
                        <Building2 className={`w-4 h-4 ${uploaded ? 'text-green-400' : 'text-slate-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-white">{b.name || b.branch_name}</p>
                          <p className="text-[10px] text-slate-500">{b.branch_code || ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {uploaded ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400">{status.days_loaded}/{status.expected_days} days</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============== ADVISOR TAB ============== */}
      {activeTab === 'advisor' && (
        <div className="space-y-4">
          {/* Branch Selector */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-300">Select Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => loadAdvisor(b)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      advisorBranch?.id === b.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <p className="text-sm font-medium text-white truncate">{b.name || b.branch_name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Loading */}
          {advisorLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="ml-2 text-sm text-slate-400">Loading advisor...</span>
            </div>
          )}

          {/* Advisor Results */}
          {advisorData && !advisorLoading && (
            <div className="space-y-4">
              {/* Title */}
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="font-medium">{advisorData.parlor_name}</span>
                <span className="text-slate-500">— {advisorData.day_name} {advisorData.date}</span>
              </div>

              {/* Daily Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-[10px] text-slate-500 uppercase">Actual Sales</p>
                    <p className="text-xl font-bold text-white">{fmt(advisorData.daily?.actual_gross)}</p>
                    <p className="text-[10px] text-slate-500">{advisorData.daily?.actual_gc} GC</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-[10px] text-slate-500 uppercase">Budget</p>
                    <p className="text-xl font-bold text-purple-300">{fmt(advisorData.daily?.budget)}</p>
                    <p className="text-[10px] text-slate-500">{advisorData.daily?.budget_gc} GC target</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-[10px] text-slate-500 uppercase">Achievement</p>
                    <p className={`text-xl font-bold ${
                      (advisorData.daily?.achievement_pct || 0) >= 100 ? 'text-green-400'
                        : (advisorData.daily?.achievement_pct || 0) >= 75 ? 'text-amber-400'
                          : 'text-red-400'
                    }`}>
                      {fmt(advisorData.daily?.achievement_pct)}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <p className="text-[10px] text-slate-500 uppercase">Remaining</p>
                    <p className="text-xl font-bold text-amber-300">{fmt(advisorData.daily?.remaining)}</p>
                    <p className="text-[10px] text-slate-500">{advisorData.daily?.remaining_gc} GC needed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bar */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>0</span>
                    <span>{fmt(advisorData.daily?.budget)} AED target</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
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
                  a.priority === 'success' ? 'bg-green-500/5 border-green-500/20'
                    : a.priority === 'critical' ? 'bg-red-500/5 border-red-500/20'
                      : a.priority === 'warning' ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-slate-800/50 border-slate-700'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        a.priority === 'success' ? 'bg-green-500/20'
                          : a.priority === 'critical' ? 'bg-red-500/20'
                            : a.priority === 'warning' ? 'bg-amber-500/20'
                              : 'bg-slate-700'
                      }`}>
                        {adviceIcon(a)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{a.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* ATV Comparison */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">ATV & KPI Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Current ATV</p>
                      <p className="text-lg font-bold text-white">{fmt(advisorData.daily?.current_atv)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Budget ATV</p>
                      <p className="text-lg font-bold text-purple-300">{fmt(advisorData.daily?.budget_atv)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">LY ATV</p>
                      <p className="text-lg font-bold text-blue-300">{fmt(advisorData.daily?.ly_atv)}</p>
                    </div>
                  </div>
                  {advisorData.ly_kpis && (
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-700">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">LY AUV</p>
                        <p className="text-sm font-medium text-slate-300">{fmt(advisorData.ly_kpis.auv)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">LY Cake</p>
                        <p className="text-sm font-medium text-slate-300">{fmt(advisorData.ly_kpis.cake_qty)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">LY HP</p>
                        <p className="text-sm font-medium text-slate-300">{fmt(advisorData.ly_kpis.hp_qty)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">vs LY</p>
                        <p className={`text-sm font-medium ${(advisorData.daily?.growth_vs_ly || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {advisorData.daily?.growth_vs_ly >= 0 ? '+' : ''}{fmt(advisorData.daily?.growth_vs_ly)}%
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* MTD Summary */}
              {advisorData.mtd?.actual_sales > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">MTD Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-slate-500">MTD Actual</p>
                        <p className="text-lg font-bold text-white">{fmt(advisorData.mtd.actual_sales)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">MTD Budget</p>
                        <p className="text-lg font-bold text-purple-300">{fmt(advisorData.mtd.budget)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">MTD Ach %</p>
                        <p className={`text-lg font-bold ${advisorData.mtd.achievement_pct >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                          {fmt(advisorData.mtd.achievement_pct)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!advisorData.budget_loaded && (
                <Card className="bg-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-amber-300 font-medium">No budget uploaded for this branch today</p>
                    <p className="text-xs text-slate-400 mt-1">Upload a budget sheet first to get full advisor data</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============== TRACKER OVERVIEW TAB ============== */}
      {activeTab === 'tracker' && (
        <div className="space-y-4">
          {trackerLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="ml-2 text-sm text-slate-400">Loading all branches...</span>
            </div>
          )}

          {trackerData && !trackerLoading && (
            <>
              {/* Summary Pills */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Achieved', count: trackerData.summary?.achieved, color: 'bg-green-500/20 text-green-400' },
                  { label: 'On Track', count: trackerData.summary?.on_track, color: 'bg-purple-500/20 text-purple-400' },
                  { label: 'Behind', count: trackerData.summary?.behind, color: 'bg-amber-500/20 text-amber-400' },
                  { label: 'Critical', count: trackerData.summary?.critical, color: 'bg-red-500/20 text-red-400' },
                  { label: 'No Budget', count: trackerData.summary?.no_budget, color: 'bg-slate-700 text-slate-400' },
                ].map(p => (
                  <span key={p.label} className={`px-3 py-1 rounded-full text-xs font-medium ${p.color}`}>
                    {p.label}: {p.count}
                  </span>
                ))}
              </div>

              {/* Branch Cards */}
              <div className="space-y-2">
                {trackerData.branches?.map(b => (
                  <Card key={b.branch_id} className={`border ${statusColor(b.status)}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {b.status === 'achieved' ? <Trophy className="w-5 h-5 text-green-400" /> :
                             b.status === 'critical' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                             b.status === 'behind' ? <TrendingDown className="w-5 h-5 text-amber-400" /> :
                             b.status === 'on_track' ? <TrendingUp className="w-5 h-5 text-purple-400" /> :
                             <Building2 className="w-5 h-5 text-slate-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{b.branch_name}</p>
                            <p className="text-[10px] text-slate-500">{b.branch_code} {b.day_name ? `— ${b.day_name}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            b.achievement_pct >= 100 ? 'text-green-400'
                              : b.achievement_pct >= 75 ? 'text-purple-400'
                                : b.achievement_pct >= 50 ? 'text-amber-400'
                                  : 'text-red-400'
                          }`}>
                            {b.budget_loaded ? `${fmt(b.achievement_pct)}%` : '—'}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                            {statusLabel(b.status)}
                          </span>
                        </div>
                      </div>

                      {b.budget_loaded && (
                        <div className="grid grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-700/50 text-center text-[11px]">
                          <div>
                            <p className="text-slate-500">Actual</p>
                            <p className="text-white font-medium">{fmt(b.actual_gross)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Budget</p>
                            <p className="text-purple-300 font-medium">{fmt(b.budget)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Remaining</p>
                            <p className="text-amber-300 font-medium">{fmt(b.remaining)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">ATV</p>
                            <p className="text-white font-medium">{fmt(b.atv)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">vs LY</p>
                            <p className={`font-medium ${b.growth_vs_ly >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {b.growth_vs_ly >= 0 ? '+' : ''}{fmt(b.growth_vs_ly)}%
                            </p>
                          </div>
                        </div>
                      )}

                      {b.budget_loaded && b.has_sales && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                b.achievement_pct >= 100 ? 'bg-green-500'
                                  : b.achievement_pct >= 75 ? 'bg-purple-500'
                                    : b.achievement_pct >= 50 ? 'bg-amber-500'
                                      : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(b.achievement_pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

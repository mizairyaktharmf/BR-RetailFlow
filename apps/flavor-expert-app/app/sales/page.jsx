"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  Camera,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const SECTIONS = [
  { key: 'pos', type: 'pos', label: 'POS Sales', bg: 'bg-orange-500', ring: 'ring-orange-400', border: 'border-orange-200', required: true },
  { key: 'hd', type: 'hd', label: 'Home Delivery', bg: 'bg-cyan-500', ring: 'ring-cyan-400', border: 'border-cyan-200', required: false },
  { key: 'deliveroo', type: 'deliveroo', label: 'Deliveroo', bg: 'bg-teal-600', ring: 'ring-teal-400', border: 'border-teal-200', required: false },
]

// States: idle, extracting, extracted, error
const INITIAL_EXTRACT = { status: 'idle', data: null, error: null }

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // Extraction state per section
  const [extractions, setExtractions] = useState({
    pos: { ...INITIAL_EXTRACT },
    hd: { ...INITIAL_EXTRACT },
    deliveroo: { ...INITIAL_EXTRACT },
  })

  // Editable data per section (user can modify after extraction)
  const [posData, setPosData] = useState({})
  const [catData, setCatData] = useState({ categories: [], items: [] })
  const [hdData, setHdData] = useState({})
  const [deliverooData, setDeliverooData] = useState({})

  // Smart Advisor
  const [budget, setBudget] = useState(null)
  const [advisorOpen, setAdvisorOpen] = useState(true)
  const [todaySales, setTodaySales] = useState([])

  // File refs
  const fileRefs = {
    pos: useRef(null),
    hd: useRef(null),
    deliveroo: useRef(null),
  }

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
    const u = JSON.parse(userData)
    setUser(u)
    const branchData = localStorage.getItem('br_branch')
    if (branchData) setBranch(JSON.parse(branchData))
    loadSubmittedWindows()
    loadBudget(u.branch_id)
  }, [router])

  const loadSubmittedWindows = async () => {
    setLoadingWindows(true)
    try {
      const branchData = localStorage.getItem('br_branch')
      const branchInfo = branchData ? JSON.parse(branchData) : null
      if (branchInfo?.id) {
        const today = new Date().toISOString().split('T')[0]
        const sales = await api.getDailySales(branchInfo.id, today)
        const submitted = Array.isArray(sales) ? sales.map(s => s.sales_window) : []
        setSubmittedWindows(submitted)
        setTodaySales(Array.isArray(sales) ? sales : [])
        const firstOpen = SALES_WINDOWS.find(w => !submitted.includes(w.id))
        setSelectedWindow(firstOpen?.id || SALES_WINDOWS[0]?.id || '3pm')
      } else {
        setSelectedWindow(SALES_WINDOWS[0]?.id || '3pm')
      }
    } catch {
      setSelectedWindow(SALES_WINDOWS[0]?.id || '3pm')
    } finally {
      setLoadingWindows(false)
    }
  }

  const loadBudget = async (branchId) => {
    try {
      const now = new Date()
      const result = await api.getBranchBudget(branchId || 1, now.getFullYear(), now.getMonth() + 1)
      if (result) setBudget(result)
    } catch {}
  }

  const handleWindowSelect = (windowId) => {
    if (submittedWindows.includes(windowId)) return
    setSelectedWindow(windowId)
    resetAll()
  }

  const resetAll = () => {
    setExtractions({
      pos: { ...INITIAL_EXTRACT },
      hd: { ...INITIAL_EXTRACT },
      deliveroo: { ...INITIAL_EXTRACT },
    })
    setPosData({})
    setCatData({ categories: [], items: [] })
    setHdData({})
    setDeliverooData({})
  }

  const handleCapture = async (sectionKey, sectionType, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRefs[sectionKey]?.current) fileRefs[sectionKey].current.value = ''

    setExtractions(prev => ({
      ...prev,
      [sectionKey]: { status: 'extracting', data: null, error: null },
    }))

    try {
      if (sectionKey === 'pos') {
        // Extract POS sales and categories from the same photo in parallel
        const [posResult, catResult] = await Promise.all([
          api.extractReceipt(file, 'pos'),
          api.extractReceipt(file, 'pos_categories').catch(() => null),
        ])
        if (posResult.success) {
          setExtractions(prev => ({
            ...prev,
            pos: { status: 'extracted', data: posResult.data, error: null },
          }))
          setPosData(posResult.data)
          if (catResult?.success) setCatData(catResult.data)
        } else {
          setExtractions(prev => ({
            ...prev,
            pos: { status: 'error', data: null, error: posResult.error || 'Extraction failed' },
          }))
        }
      } else {
        const result = await api.extractReceipt(file, sectionType)
        if (result.success) {
          setExtractions(prev => ({
            ...prev,
            [sectionKey]: { status: 'extracted', data: result.data, error: null },
          }))
          if (sectionKey === 'hd') setHdData(result.data)
          if (sectionKey === 'deliveroo') setDeliverooData(result.data.totals || result.data)
        } else {
          setExtractions(prev => ({
            ...prev,
            [sectionKey]: { status: 'error', data: null, error: result.error || 'Extraction failed' },
          }))
        }
      }
    } catch (err) {
      setExtractions(prev => ({
        ...prev,
        [sectionKey]: { status: 'error', data: null, error: err.message },
      }))
    }
  }

  const retake = (sectionKey) => {
    setExtractions(prev => ({
      ...prev,
      [sectionKey]: { ...INITIAL_EXTRACT },
    }))
    if (sectionKey === 'pos') { setPosData({}); setCatData({ categories: [], items: [] }) }
    if (sectionKey === 'hd') setHdData({})
    if (sectionKey === 'deliveroo') setDeliverooData({})
  }

  // Combined totals
  const combinedNet = (posData.net_sales || posData.total_sales || 0) + (hdData.net_sales || 0) + (deliverooData.net_sales || 0)
  const combinedGross = (posData.gross_sales || 0) + (hdData.gross_sales || 0) + (deliverooData.gross_sales || 0)
  const combinedGC = (posData.guest_count || 0) + (hdData.orders || 0) + (deliverooData.total_orders || 0)

  // Smart Advisor calculations
  const getAdvisorData = () => {
    if (!budget) return null
    const daysInMonth = new Date(budget.year, budget.month, 0).getDate()
    const today = new Date().getDate()
    const dailyBudget = budget.target_sales / daysInMonth

    // Sum already submitted windows for today
    const submittedTotal = todaySales.reduce((sum, s) => sum + (s.total_sales || 0), 0)
    const currentTotal = submittedTotal + combinedNet

    const achievement = dailyBudget > 0 ? (currentTotal / dailyBudget) * 100 : 0
    const remaining = Math.max(0, dailyBudget - currentTotal)
    const currentATV = combinedGC > 0 ? combinedNet / combinedGC : 0
    const targetATV = budget.target_transactions ? budget.target_sales / budget.target_transactions / daysInMonth : 0

    // LY comparison
    const lyDailySales = budget.last_year_sales ? budget.last_year_sales / daysInMonth : 0
    const lyGrowth = lyDailySales > 0 ? ((currentTotal - lyDailySales) / lyDailySales) * 100 : 0

    // Guests needed
    const guestsNeeded = currentATV > 0 ? Math.ceil(remaining / currentATV) : 0

    return {
      dailyBudget,
      currentTotal,
      achievement,
      remaining,
      currentATV,
      targetATV,
      lyDailySales,
      lyGrowth,
      guestsNeeded,
    }
  }

  const handleSubmit = async () => {
    if (extractions.pos.status !== 'extracted') {
      alert('Please capture and extract POS receipt first')
      return
    }
    setSaving(true)
    try {
      const categoryJson = catData.categories?.length > 0
        ? JSON.stringify(catData.categories.map(c => ({
            name: c.name,
            qty: c.quantity || 0,
            sales: c.sales || 0,
            pct: c.contribution_pct || 0,
          })))
        : null

      const itemsJson = catData.items?.length > 0
        ? JSON.stringify(catData.items)
        : null

      await api.submitSales({
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        // POS
        gross_sales: posData.gross_sales || 0,
        total_sales: posData.net_sales || posData.total_sales || 0,
        transaction_count: posData.guest_count || 0,
        cash_sales: posData.cash_sales || 0,
        category_data: categoryJson,
        items_data: itemsJson,
        // HD
        hd_gross_sales: hdData.gross_sales || 0,
        hd_net_sales: hdData.net_sales || 0,
        hd_orders: hdData.orders || 0,
        // Deliveroo
        deliveroo_gross_sales: deliverooData.gross_sales || 0,
        deliveroo_net_sales: deliverooData.net_sales || 0,
        deliveroo_orders: deliverooData.total_orders || 0,
      })

      const updated = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updated)
      resetAll()
      const next = SALES_WINDOWS.find(w => !updated.includes(w.id))
      if (next) {
        setSelectedWindow(next.id)
        alert(`${SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} submitted!`)
      } else {
        alert('All windows submitted for today!')
      }
      // Reload today's sales for advisor
      loadSubmittedWindows()
    } catch (err) {
      console.error(err)
      alert('Failed to submit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fmtNum = (n) => {
    if (n === null || n === undefined) return '0'
    return Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  const advisor = getAdvisorData()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white safe-area-top">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="p-1 rounded-lg hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-base">Sales Report</h1>
              <p className="text-orange-100 text-xs">{branch?.name || 'My Branch'} &middot; {formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* Window Selector */}
        {loadingWindows ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {SALES_WINDOWS.map((w) => {
              const sel = selectedWindow === w.id
              const done = submittedWindows.includes(w.id)
              return (
                <button
                  key={w.id}
                  onClick={() => handleWindowSelect(w.id)}
                  disabled={done}
                  className={`p-2 rounded-xl text-center transition-all ${
                    done ? 'bg-green-100 border-2 border-green-300 opacity-80'
                      : sel ? 'bg-orange-100 border-2 border-orange-400'
                        : 'bg-white border-2 border-gray-200 hover:border-orange-200'
                  }`}
                >
                  <p className={`text-xs font-bold ${done ? 'text-green-600' : sel ? 'text-orange-600' : 'text-gray-600'}`}>
                    {w.label.split(' ')[0]}
                  </p>
                  {done ? <CheckCircle2 className="w-4 h-4 mx-auto mt-0.5 text-green-600" /> : (
                    <p className={`text-[10px] ${sel ? 'text-orange-500' : 'text-gray-400'}`}>{w.time.split('-')[0].trim()}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        {selectedWindow && !loadingWindows && (
          submittedWindows.includes(selectedWindow) ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 text-sm">Submitted!</AlertTitle>
              <AlertDescription className="text-green-700 text-xs">
                {selectedWindow.toUpperCase()} report done. Select another window.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {/* Extraction Sections */}
              {SECTIONS.map((s) => {
                const ext = extractions[s.key]
                return (
                  <div key={s.key} className={`bg-white rounded-xl p-3 border ${s.border}`}>
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                        {s.required && <span className="text-[10px] text-red-400 font-medium">Required</span>}
                        {!s.required && <span className="text-[10px] text-gray-400">Optional</span>}
                      </div>
                      {ext.status === 'extracted' && (
                        <button onClick={() => retake(s.key)} className="text-[10px] text-orange-500 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Retake
                        </button>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileRefs[s.key]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleCapture(s.key, s.type, e)}
                    />

                    {/* State: Idle */}
                    {ext.status === 'idle' && (
                      <button
                        onClick={() => fileRefs[s.key].current?.click()}
                        className="w-full py-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center gap-1 transition-all active:scale-95"
                      >
                        <Camera className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-500">Tap to capture {s.label}</span>
                      </button>
                    )}

                    {/* State: Extracting */}
                    {ext.status === 'extracting' && (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                        <span className="text-sm text-gray-600">Extracting data...</span>
                      </div>
                    )}

                    {/* State: Error */}
                    {ext.status === 'error' && (
                      <div className="text-center py-4">
                        <p className="text-xs text-red-500 mb-2">{ext.error}</p>
                        <button
                          onClick={() => fileRefs[s.key].current?.click()}
                          className="text-xs text-orange-500 underline"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {/* State: Extracted — POS Sales + Categories */}
                    {ext.status === 'extracted' && s.key === 'pos' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Gross Sales" value={posData.gross_sales} onChange={(v) => setPosData(p => ({...p, gross_sales: v}))} />
                          <Field label="Net Sales" value={posData.net_sales || posData.total_sales} onChange={(v) => setPosData(p => ({...p, net_sales: v, total_sales: v}))} />
                          <Field label="Guest Count" value={posData.guest_count} onChange={(v) => setPosData(p => ({...p, guest_count: parseInt(v) || 0}))} type="number" />
                          <Field label="Cash Sales" value={posData.cash_sales} onChange={(v) => setPosData(p => ({...p, cash_sales: v}))} />
                          <Field label="Discount" value={posData.discount} onChange={(v) => setPosData(p => ({...p, discount: v}))} />
                          <Field label="Tax" value={posData.tax} onChange={(v) => setPosData(p => ({...p, tax: v}))} />
                        </div>
                        {posData.atv > 0 && (
                          <p className="text-[10px] text-gray-500 text-right">ATV: {fmtNum(posData.atv)}</p>
                        )}
                        {/* Categories extracted from same POS photo */}
                        {catData.categories?.length > 0 && (
                          <details className="mt-1">
                            <summary className="text-[11px] text-pink-600 font-bold cursor-pointer">Categories ({catData.categories.length})</summary>
                            <div className="overflow-x-auto mt-1">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="text-left py-1">Category</th>
                                    <th className="text-right py-1">Qty</th>
                                    <th className="text-right py-1">Sales</th>
                                    <th className="text-right py-1">%</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {catData.categories.map((cat, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                      <td className="py-1 font-medium">{cat.name}</td>
                                      <td className="text-right">{cat.quantity}</td>
                                      <td className="text-right">{fmtNum(cat.sales)}</td>
                                      <td className="text-right">{fmtNum(cat.contribution_pct)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        )}
                        {catData.items?.length > 0 && (
                          <details className="text-[10px]">
                            <summary className="text-orange-500 cursor-pointer">View {catData.items.length} items</summary>
                            <div className="mt-1 max-h-32 overflow-y-auto">
                              {catData.items.map((item, i) => (
                                <div key={i} className="flex justify-between py-0.5 border-b border-gray-50">
                                  <span className="truncate flex-1">{item.name}</span>
                                  <span className="ml-2 text-gray-500">{item.quantity} | {fmtNum(item.sales)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}

                    {/* State: Extracted — HD */}
                    {ext.status === 'extracted' && s.key === 'hd' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Gross Sales" value={hdData.gross_sales} onChange={(v) => setHdData(p => ({...p, gross_sales: v}))} />
                        <Field label="Net Sales" value={hdData.net_sales} onChange={(v) => setHdData(p => ({...p, net_sales: v}))} />
                        <Field label="Orders" value={hdData.orders} onChange={(v) => setHdData(p => ({...p, orders: parseInt(v) || 0}))} type="number" />
                        <Field label="Avg/Order" value={hdData.avg_sales_per_order} onChange={(v) => setHdData(p => ({...p, avg_sales_per_order: v}))} />
                      </div>
                    )}

                    {/* State: Extracted — Deliveroo */}
                    {ext.status === 'extracted' && s.key === 'deliveroo' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Gross Sales" value={deliverooData.gross_sales} onChange={(v) => setDeliverooData(p => ({...p, gross_sales: v}))} />
                        <Field label="Net Sales" value={deliverooData.net_sales} onChange={(v) => setDeliverooData(p => ({...p, net_sales: v}))} />
                        <Field label="Orders" value={deliverooData.total_orders} onChange={(v) => setDeliverooData(p => ({...p, total_orders: parseInt(v) || 0}))} type="number" />
                        <Field label="Discount" value={deliverooData.discount} onChange={(v) => setDeliverooData(p => ({...p, discount: v}))} />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Combined Totals */}
              {extractions.pos.status === 'extracted' && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 border border-orange-200">
                  <p className="text-xs font-bold text-orange-700 mb-2">Combined Totals</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Gross</p>
                      <p className="text-sm font-bold text-gray-800">{fmtNum(combinedGross)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Net Sales</p>
                      <p className="text-sm font-bold text-orange-600">{fmtNum(combinedNet)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Guests</p>
                      <p className="text-sm font-bold text-gray-800">{combinedGC}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Smart Sales Advisor */}
              {extractions.pos.status === 'extracted' && advisor && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 overflow-hidden">
                  <button
                    onClick={() => setAdvisorOpen(!advisorOpen)}
                    className="w-full px-3 py-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-indigo-700">Smart Sales Advisor</span>
                    </div>
                    {advisorOpen ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
                  </button>

                  {advisorOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {/* Budget vs Actual */}
                      <div className="bg-white/60 rounded-lg p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-gray-500">Daily Budget</span>
                          <span className="text-xs font-bold text-gray-700">{fmtNum(advisor.dailyBudget)} AED</span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-gray-500">Current</span>
                          <span className="text-xs font-bold text-indigo-600">{fmtNum(advisor.currentTotal)} AED</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              advisor.achievement >= 100 ? 'bg-green-500'
                                : advisor.achievement >= 75 ? 'bg-indigo-500'
                                  : advisor.achievement >= 50 ? 'bg-amber-500'
                                    : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(advisor.achievement, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-[10px] font-bold ${
                            advisor.achievement >= 100 ? 'text-green-600'
                              : advisor.achievement >= 75 ? 'text-indigo-600'
                                : 'text-red-500'
                          }`}>
                            {fmtNum(advisor.achievement)}% Achievement
                          </span>
                          {advisor.remaining > 0 && (
                            <span className="text-[10px] text-gray-500">
                              {fmtNum(advisor.remaining)} AED needed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ATV Focus */}
                      {advisor.currentATV > 0 && (
                        <div className="bg-white/60 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Target className="w-3 h-3 text-indigo-500" />
                            <span className="text-[10px] font-bold text-gray-700">ATV Focus</span>
                          </div>
                          <p className="text-[10px] text-gray-600">
                            Current: <span className="font-bold">{fmtNum(advisor.currentATV)}</span>
                            {advisor.targetATV > 0 && (
                              <> → Target: <span className="font-bold text-indigo-600">{fmtNum(advisor.targetATV)}</span></>
                            )}
                          </p>
                          {advisor.currentATV < advisor.targetATV && (
                            <p className="text-[10px] text-orange-600 mt-0.5">Upsell to doubles & sundaes!</p>
                          )}
                        </div>
                      )}

                      {/* IR Focus */}
                      {advisor.remaining > 0 && advisor.guestsNeeded > 0 && (
                        <div className="bg-white/60 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] font-bold text-gray-700">Guest Focus</span>
                          </div>
                          <p className="text-[10px] text-gray-600">
                            Need <span className="font-bold text-indigo-600">{advisor.guestsNeeded}</span> more guests x {fmtNum(advisor.currentATV)} ATV = <span className="font-bold">{fmtNum(advisor.remaining)}</span> AED
                          </p>
                        </div>
                      )}

                      {/* vs LY */}
                      {advisor.lyDailySales > 0 && (
                        <div className={`rounded-lg p-2 ${advisor.lyGrowth >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className="flex items-center gap-1">
                            {advisor.lyGrowth >= 0
                              ? <TrendingUp className="w-3 h-3 text-green-500" />
                              : <TrendingDown className="w-3 h-3 text-red-500" />
                            }
                            <span className={`text-[10px] font-bold ${advisor.lyGrowth >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              vs LY: {advisor.lyGrowth >= 0 ? '+' : ''}{fmtNum(advisor.lyGrowth)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            LY Daily: {fmtNum(advisor.lyDailySales)} AED
                          </p>
                          {advisor.lyGrowth < -10 && (
                            <p className="text-[10px] text-red-600 font-medium mt-0.5">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                              Critical: focus on every customer!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={saving || extractions.pos.status !== 'extracted'}
                className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label}</>
                )}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// Editable field component
function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
      <input
        type={type}
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
      />
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  Camera,
  X,
  Plus,
  Eye,
  RotateCcw,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const MAX_PHOTOS = 5

// Color palette for pie chart
const PIE_COLORS = [
  '#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444',
  '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#84CC16',
]

// Merge numeric fields from multiple extraction results
function mergeNumericResults(dataArray) {
  if (!dataArray.length) return {}
  return dataArray.reduce((acc, d) => {
    const keys = ['gross_sales', 'net_sales', 'total_sales', 'guest_count', 'cash_sales',
                  'cash_gc', 'discount', 'tax', 'atv', 'returns', 'cancelled',
                  'total_sales_with_tax', 'orders', 'total_orders']
    const merged = { ...acc }
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null) {
        merged[k] = (merged[k] || 0) + (Number(d[k]) || 0)
      }
    }
    // For branch_code and date, take first non-empty
    if (d.branch_code && !merged.branch_code) merged.branch_code = d.branch_code
    if (d.date && !merged.date) merged.date = d.date
    return merged
  }, {})
}

// Merge category data from multiple POS photos
function mergeCategoryResults(dataArray) {
  const merged = { categories: [], items: [] }
  for (const d of dataArray) {
    if (!d) continue
    for (const cat of (d.categories || [])) {
      const existing = merged.categories.find(c => c.name === cat.name)
      if (existing) {
        existing.quantity = (existing.quantity || 0) + (cat.quantity || 0)
        existing.sales = (existing.sales || 0) + (cat.sales || 0)
      } else {
        merged.categories.push({ ...cat })
      }
    }
    merged.items.push(...(d.items || []))
  }
  return merged
}

// Simple SVG pie chart component
function PieChart({ categories }) {
  if (!categories?.length) return null
  const total = categories.reduce((s, c) => s + (c.sales || 0), 0)
  if (total === 0) return null

  let cumAngle = 0
  const slices = categories.map((cat, i) => {
    const pct = (cat.sales || 0) / total
    const startAngle = cumAngle
    cumAngle += pct * 360
    const endAngle = cumAngle
    const startRad = (startAngle - 90) * Math.PI / 180
    const endRad = (endAngle - 90) * Math.PI / 180
    const largeArc = pct > 0.5 ? 1 : 0
    const x1 = 50 + 40 * Math.cos(startRad)
    const y1 = 50 + 40 * Math.sin(startRad)
    const x2 = 50 + 40 * Math.cos(endRad)
    const y2 = 50 + 40 * Math.sin(endRad)
    const path = pct >= 0.999
      ? `M50,10 A40,40 0 1,1 49.99,10 Z`
      : `M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], name: cat.name, pct: (pct * 100).toFixed(1) }
  })

  return (
    <div className="flex items-start gap-3">
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="0.5" />
        ))}
      </svg>
      <div className="flex-1 space-y-1 pt-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-700 truncate flex-1">{s.name}</span>
            <span className="font-medium text-gray-900">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Input field helper — defined OUTSIDE component to avoid remount on re-render
const NumField = ({ label, value, onChange, placeholder, prefix = 'AED' }) => (
  <div>
    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</label>
    <div className="flex items-center mt-0.5 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
      {prefix && <span className="text-[10px] text-gray-400 pl-2 pr-1">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0'}
        className="flex-1 px-2 py-2 text-sm bg-transparent outline-none text-gray-800"
      />
    </div>
  </div>
)

// Summary card helper — defined OUTSIDE component to avoid remount on re-render
const SummaryCard = ({ label, value, prefix = 'AED', color = 'text-gray-900' }) => (
  <div className="bg-gray-50 rounded-lg p-2 text-center">
    <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-sm font-bold ${color} mt-0.5`}>
      {prefix && <span className="text-[10px] font-normal text-gray-400">{prefix} </span>}
      {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
    </p>
  </div>
)

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // POS photos
  const [posPhotos, setPosPhotos] = useState([])
  const [posPreviews, setPosPreviews] = useState([])
  const [posStatus, setPosStatus] = useState('idle') // idle | extracting | review
  const posFileRef = useRef(null)

  // Tracked promotion items
  const [trackedItems, setTrackedItems] = useState([])
  const [trackedCodes, setTrackedCodes] = useState(new Set())

  // Extracted data for review
  const [extractedSales, setExtractedSales] = useState(null)
  const [extractedCategories, setExtractedCategories] = useState(null)

  // HD manual fields
  const [hdData, setHdData] = useState({ gross_sales: '', net_sales: '', orders: '' })

  // Deliveroo manual fields
  const [delData, setDelData] = useState({ gross_sales: '', net_sales: '', orders: '' })

  // Cool Mood manual fields
  const [cmData, setCmData] = useState({ gross_sales: '', net_sales: '', orders: '' })

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
    const u = JSON.parse(userData)
    setUser(u)
    const branchData = localStorage.getItem('br_branch')
    if (branchData) {
      const b = JSON.parse(branchData)
      setBranch(b)
      // Load tracked promotion items for this branch
      api.getTrackedItems(b.id).then(items => {
        if (Array.isArray(items)) {
          setTrackedItems(items)
          setTrackedCodes(new Set(items.map(i => i.item_code)))
        }
      }).catch(err => console.error('Failed to load tracked items:', err))
    }
    loadSubmittedWindows()
  }, [router])

  useEffect(() => {
    return () => { posPreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, [])

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

  const handleWindowSelect = (windowId) => {
    if (submittedWindows.includes(windowId)) return
    setSelectedWindow(windowId)
    resetAll()
  }

  const resetAll = () => {
    posPreviews.forEach(u => URL.revokeObjectURL(u))
    setPosPhotos([])
    setPosPreviews([])
    setPosStatus('idle')
    setExtractedSales(null)
    setExtractedCategories(null)
    setHdData({ gross_sales: '', net_sales: '', orders: '' })
    setDelData({ gross_sales: '', net_sales: '', orders: '' })
    setCmData({ gross_sales: '', net_sales: '', orders: '' })
  }

  const handleCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (posFileRef.current) posFileRef.current.value = ''
    if (posPhotos.length >= MAX_PHOTOS) return

    setPosPhotos(prev => [...prev, file])
    setPosPreviews(prev => [...prev, URL.createObjectURL(file)])
  }

  const removePhoto = (index) => {
    URL.revokeObjectURL(posPreviews[index])
    setPosPhotos(prev => prev.filter((_, i) => i !== index))
    setPosPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Extract POS data from photos (step 1)
  const handleExtract = async () => {
    if (posPhotos.length === 0) return
    setPosStatus('extracting')

    try {
      // Process ALL photos in parallel for speed
      const combinedResults = await Promise.all(
        posPhotos.map(async (file) => {
          try {
            return await api.extractReceipt(file, 'pos_combined')
          } catch (e1) {
            console.warn('First attempt failed, retrying...', e1.message)
            try {
              return await api.extractReceipt(file, 'pos_combined')
            } catch (e2) {
              console.error('Retry also failed:', e2.message)
              return null
            }
          }
        })
      )

      const successData = combinedResults.filter(r => r?.success).map(r => r.data)
      console.log('All combined results:', JSON.stringify(combinedResults, null, 2))

      if (successData.length === 0) {
        throw new Error('Could not extract data from any photo. Please try again.')
      }

      // Split combined results into sales summaries and category data
      const posDataArray = successData.map(d => d.sales_summary || {})
      const catDataArray = successData.map(d => ({ categories: d.categories || [], items: d.items || [] }))

      console.log('Categories from each photo:', catDataArray.map(c => `cats=${c.categories.length}, items=${c.items.length}`))

      const posData = mergeNumericResults(posDataArray)
      const catData = mergeCategoryResults(catDataArray)

      console.log('Merged catData:', JSON.stringify(catData, null, 2))

      setExtractedSales(posData)
      setExtractedCategories(catData)
      setPosStatus('review')
    } catch (err) {
      console.error(err)
      setPosStatus('idle')
      alert('Extraction failed: ' + err.message)
    }
  }

  // Calculate AUV and IR for items
  const itemsWithCalc = useMemo(() => {
    if (!extractedCategories?.items?.length || !extractedSales) return []
    const gc = extractedSales.guest_count || 0
    return extractedCategories.items.map(item => {
      const qty = item.quantity || 0
      const sales = item.sales || 0
      return {
        ...item,
        auv: qty > 0 ? (sales / qty).toFixed(2) : '0.00',
        ir: gc > 0 ? ((qty / gc) * 100).toFixed(1) : '0.0',
      }
    })
  }, [extractedCategories, extractedSales])

  // Calculate category-level AUV and IR
  const categoriesWithCalc = useMemo(() => {
    if (!extractedCategories?.categories?.length || !extractedSales) return []
    const gc = extractedSales.guest_count || 0
    return extractedCategories.categories.map(cat => {
      const qty = cat.quantity || 0
      const sales = cat.sales || 0
      return {
        ...cat,
        auv: qty > 0 ? (sales / qty).toFixed(2) : '0.00',
        ir: gc > 0 ? ((qty / gc) * 100).toFixed(1) : '0.0',
      }
    })
  }, [extractedCategories, extractedSales])

  // Promotion tracking: match tracked items against extracted POS items
  const promotionData = useMemo(() => {
    if (!trackedItems.length || !extractedCategories?.items?.length) return []
    const items = extractedCategories.items
    const categories = extractedCategories.categories || []
    const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0)
    const gc = extractedSales?.guest_count || 0

    return trackedItems.map(tracked => {
      const isCategory = tracked.item_code?.startsWith('CAT:')

      if (isCategory) {
        const catName = tracked.item_code.replace('CAT:', '')
        const catRow = categories.find(c => c.name && c.name.toLowerCase() === catName.toLowerCase())
        const catQty = catRow?.quantity || catRow?.qty || 0
        const catSales = catRow?.sales || 0
        const catItems = items.filter(it => it.category && it.category.toLowerCase() === catName.toLowerCase())

        const columns = [{
          code: 'CAT', name: catName, qty: catQty,
          countPct: totalQty > 0 ? ((catQty / totalQty) * 100) : 0,
          auv: catQty > 0 ? (catSales / catQty) : 0,
          ir: gc > 0 ? ((catQty / gc) * 100) : 0,
          sales: catSales, isMain: true, isCategory: true, itemCount: catItems.length,
        }]
        catItems.forEach(it => {
          const qty = it.quantity || 0
          const sales = it.sales || 0
          columns.push({
            code: it.code, name: it.name, qty,
            countPct: totalQty > 0 ? ((qty / totalQty) * 100) : 0,
            auv: qty > 0 ? (sales / qty) : 0,
            ir: gc > 0 ? ((qty / gc) * 100) : 0,
            sales, isMain: false,
          })
        })
        return { trackedName: catName, trackedCode: tracked.item_code, columns, isCategory: true }
      }

      // Item tracking: exact match + variants
      const baseName = tracked.item_name.replace(/\s+(Sgl|Val|Dbl|Kids|S|M|L|XL|Single|Value|Double|Regular|Large|Small)$/i, '').trim()
      const matchedItems = items.filter(it => {
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
          ir: gc > 0 ? ((qty / gc) * 100) : 0,
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
          ir: gc > 0 ? ((qty / gc) * 100) : 0,
          sales, isMain: false,
        })
      })
      return { trackedName: tracked.item_name, trackedCode: tracked.item_code, columns }
    })
  }, [trackedItems, extractedCategories, extractedSales])

  // Save all data (step 2)
  const handleSubmit = async () => {
    if (!extractedSales) {
      alert('Please extract POS data first')
      return
    }
    setSaving(true)

    try {
      const catData = extractedCategories?.categories?.length > 0
        ? JSON.stringify(extractedCategories.categories.map(c => ({
            name: c.name, qty: c.quantity || 0, sales: c.sales || 0, pct: c.contribution_pct || 0,
          })))
        : null
      const itemsJson = extractedCategories?.items?.length > 0
        ? JSON.stringify(extractedCategories.items)
        : null

      await api.submitSales({
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        gross_sales: extractedSales.gross_sales || 0,
        total_sales: extractedSales.net_sales || extractedSales.total_sales || 0,
        transaction_count: extractedSales.guest_count || 0,
        cash_sales: extractedSales.cash_sales || 0,
        cash_gc: extractedSales.cash_gc || 0,
        atv: extractedSales.atv || 0,
        category_data: catData,
        items_data: itemsJson,
        hd_gross_sales: parseFloat(hdData.gross_sales) || 0,
        hd_net_sales: parseFloat(hdData.net_sales) || 0,
        hd_orders: parseInt(hdData.orders) || 0,
        deliveroo_gross_sales: parseFloat(delData.gross_sales) || 0,
        deliveroo_net_sales: parseFloat(delData.net_sales) || 0,
        deliveroo_orders: parseInt(delData.orders) || 0,
        cm_gross_sales: parseFloat(cmData.gross_sales) || 0,
        cm_net_sales: parseFloat(cmData.net_sales) || 0,
        cm_orders: parseInt(cmData.orders) || 0,
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
      loadSubmittedWindows()
    } catch (err) {
      console.error(err)
      alert('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

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

              {/* ============== POS SECTION ============== */}
              <div className="bg-white rounded-xl p-3 border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full bg-orange-500">POS Sales</span>
                    <span className="text-[10px] text-red-400 font-medium">Required</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{posPhotos.length}/{MAX_PHOTOS} photos</span>
                </div>

                <input
                  ref={posFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCapture}
                />

                {/* ---- IDLE: Capture photos ---- */}
                {posStatus === 'idle' && (
                  <>
                    {posPhotos.length > 0 && (
                      <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {posPreviews.map((url, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <img src={url} alt={`photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => removePhoto(idx)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                        {posPhotos.length < MAX_PHOTOS && (
                          <button
                            onClick={() => posFileRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 bg-gray-50 flex flex-col items-center justify-center gap-0.5"
                          >
                            <Plus className="w-4 h-4 text-gray-400" />
                            <span className="text-[9px] text-gray-400">Add</span>
                          </button>
                        )}
                      </div>
                    )}

                    {posPhotos.length === 0 && (
                      <button
                        onClick={() => posFileRef.current?.click()}
                        className="w-full py-5 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center gap-1 active:scale-95 transition-all"
                      >
                        <Camera className="w-7 h-7 text-gray-400" />
                        <span className="text-xs text-gray-500">Tap to capture POS receipt</span>
                        <span className="text-[10px] text-gray-400">Up to {MAX_PHOTOS} photos</span>
                      </button>
                    )}

                    {posPhotos.length > 0 && (
                      <Button
                        onClick={handleExtract}
                        className="w-full h-10 text-xs bg-blue-500 hover:bg-blue-600"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />Extract Data from {posPhotos.length} Photo{posPhotos.length > 1 ? 's' : ''}
                      </Button>
                    )}
                  </>
                )}

                {/* ---- EXTRACTING ---- */}
                {posStatus === 'extracting' && (
                  <div className="flex items-center justify-center gap-2 py-6 bg-orange-50 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    <span className="text-xs text-orange-600">Extracting data from {posPhotos.length} photo{posPhotos.length > 1 ? 's' : ''}...</span>
                  </div>
                )}

                {/* ---- REVIEW: Show extracted data ---- */}
                {posStatus === 'review' && extractedSales && (
                  <div className="space-y-3">
                    {/* Re-extract button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-700 font-medium">Data extracted</span>
                      </div>
                      <button
                        onClick={() => { setPosStatus('idle'); setExtractedSales(null); setExtractedCategories(null) }}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-orange-600"
                      >
                        <RotateCcw className="w-3 h-3" />Re-extract
                      </button>
                    </div>

                    {/* Combined Sales Summary Cards (POS + HD + Deliveroo) */}
                    {(() => {
                      const posNet = extractedSales.net_sales || extractedSales.total_sales || 0
                      const posGross = extractedSales.gross_sales || 0
                      const posGC = extractedSales.guest_count || 0
                      const hdNetVal = parseFloat(hdData.net_sales) || 0
                      const hdGrossVal = parseFloat(hdData.gross_sales) || 0
                      const hdOrd = parseInt(hdData.orders) || 0
                      const delNetVal = parseFloat(delData.net_sales) || 0
                      const delGrossVal = parseFloat(delData.gross_sales) || 0
                      const delOrd = parseInt(delData.orders) || 0
                      const cmNetVal = parseFloat(cmData.net_sales) || 0
                      const cmGrossVal = parseFloat(cmData.gross_sales) || 0
                      const cmOrd = parseInt(cmData.orders) || 0
                      const totalNet = posNet + hdNetVal + delNetVal + cmNetVal
                      const totalGross = posGross + hdGrossVal + delGrossVal + cmGrossVal
                      const totalGC = posGC + hdOrd + delOrd + cmOrd
                      return (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales Summary</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            <SummaryCard label="Total Net" value={totalNet} color="text-green-700" />
                            <SummaryCard label="Total Gross" value={totalGross} />
                            <SummaryCard label="ATV" value={extractedSales.atv || 0} />
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <SummaryCard label="Total GC" value={totalGC} prefix="" color="text-blue-700" />
                            <SummaryCard label="Cash Sales" value={extractedSales.cash_sales || 0} />
                            <SummaryCard label="Cash GC" value={extractedSales.cash_gc || 0} prefix="" color="text-blue-700" />
                          </div>

                          {/* Sales Channels Breakdown */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                              <p className="text-[9px] font-semibold text-orange-600 uppercase">POS</p>
                              <p className="text-sm font-bold text-gray-900 mt-0.5">{posNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <p className="text-[9px] text-gray-400">{posGC} GC</p>
                            </div>
                            <div className={`rounded-lg p-2 border ${hdNetVal > 0 ? 'bg-cyan-50 border-cyan-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-[9px] font-semibold uppercase ${hdNetVal > 0 ? 'text-cyan-600' : 'text-gray-400'}`}>Home Delivery</p>
                              <p className={`text-sm font-bold mt-0.5 ${hdNetVal > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{hdNetVal > 0 ? hdNetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
                              {hdOrd > 0 && <p className="text-[9px] text-gray-400">{hdOrd} orders</p>}
                            </div>
                            <div className={`rounded-lg p-2 border ${delNetVal > 0 ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-[9px] font-semibold uppercase ${delNetVal > 0 ? 'text-teal-600' : 'text-gray-400'}`}>Deliveroo</p>
                              <p className={`text-sm font-bold mt-0.5 ${delNetVal > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{delNetVal > 0 ? delNetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
                              {delOrd > 0 && <p className="text-[9px] text-gray-400">{delOrd} orders</p>}
                            </div>
                            <div className={`rounded-lg p-2 border ${cmNetVal > 0 ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-[9px] font-semibold uppercase ${cmNetVal > 0 ? 'text-violet-600' : 'text-gray-400'}`}>Cool Mood</p>
                              <p className={`text-sm font-bold mt-0.5 ${cmNetVal > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{cmNetVal > 0 ? cmNetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
                              {cmOrd > 0 && <p className="text-[9px] text-gray-400">{cmOrd} orders</p>}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Category Pie Chart */}
                    {categoriesWithCalc.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category Breakdown</p>
                        <div className="bg-gray-50 rounded-lg p-2.5">
                          <PieChart categories={categoriesWithCalc} />
                        </div>
                        {/* Category table with AUV/IR */}
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-1 text-gray-500 font-medium">Category</th>
                                <th className="text-right py-1 text-gray-500 font-medium">Qty</th>
                                <th className="text-right py-1 text-gray-500 font-medium">Sales</th>
                                <th className="text-right py-1 text-gray-500 font-medium">%</th>
                                <th className="text-right py-1 text-gray-500 font-medium">AUV</th>
                                <th className="text-right py-1 text-gray-500 font-medium">IR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoriesWithCalc.map((cat, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                  <td className="py-1 text-gray-800 font-medium">{cat.name}</td>
                                  <td className="text-right py-1 text-gray-600">{cat.quantity}</td>
                                  <td className="text-right py-1 text-gray-800">{(cat.sales || 0).toFixed(2)}</td>
                                  <td className="text-right py-1 text-gray-600">{cat.contribution_pct || 0}%</td>
                                  <td className="text-right py-1 text-blue-600 font-medium">{cat.auv}</td>
                                  <td className="text-right py-1 text-purple-600 font-medium">{cat.ir}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Promotion Tracking */}
                    {promotionData.length > 0 && (() => {
                      const allCols = promotionData.flatMap(p => p.columns)
                      return (
                        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200 overflow-hidden">
                          <div className="px-3 py-2 border-b border-pink-200">
                            <p className="text-[10px] font-semibold text-pink-600 uppercase tracking-wider">Promotion Tracking</p>
                          </div>
                          <div className="p-3">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {allCols.map((col, ci) => (
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
                          </div>
                        </div>
                      )
                    })()}

                    {/* Items Table */}
                    {itemsWithCalc.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Item Sales ({itemsWithCalc.length} items)
                        </p>
                        <div className="overflow-x-auto max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-[10px]">
                            <thead className="sticky top-0 bg-gray-100">
                              <tr>
                                <th className="text-left py-1.5 px-1.5 text-gray-500 font-medium">Code</th>
                                <th className="text-left py-1.5 px-1 text-gray-500 font-medium">Item</th>
                                <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Qty</th>
                                <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Sales</th>
                                <th className="text-right py-1.5 px-1 text-gray-500 font-medium">%</th>
                                <th className="text-right py-1.5 px-1 text-gray-500 font-medium">AUV</th>
                                <th className="text-right py-1.5 px-1.5 text-gray-500 font-medium">IR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsWithCalc.map((item, i) => {
                                const isPromo = trackedCodes.has(item.code)
                                return (
                                  <tr key={i} className={`border-t ${isPromo ? 'bg-purple-50 border-purple-200' : 'border-gray-100'}`}>
                                    <td className="py-1 px-1.5 font-mono">
                                      <span className={isPromo ? 'text-purple-600 font-bold' : 'text-gray-500'}>{item.code}</span>
                                    </td>
                                    <td className="py-1 px-1 truncate max-w-[100px]">
                                      <span className={isPromo ? 'text-purple-700 font-semibold' : 'text-gray-800'}>{item.name}</span>
                                      {isPromo && <span className="ml-1 text-[8px] bg-purple-200 text-purple-700 px-1 rounded font-bold">PROMO</span>}
                                    </td>
                                    <td className="text-right py-1 px-1 text-gray-600">{item.quantity}</td>
                                    <td className="text-right py-1 px-1 text-gray-800">{(item.sales || 0).toFixed(2)}</td>
                                    <td className="text-right py-1 px-1 text-gray-600">{item.contribution_pct || 0}%</td>
                                    <td className="text-right py-1 px-1 text-blue-600 font-medium">{item.auv}</td>
                                    <td className="text-right py-1 px-1.5 text-purple-600 font-medium">{item.ir}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ============== HOME DELIVERY SECTION (Manual Input) ============== */}
              <div className="bg-white rounded-xl p-3 border border-cyan-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full bg-cyan-500">Home Delivery</span>
                  <span className="text-[10px] text-gray-400">Optional</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="Gross Sales"
                    value={hdData.gross_sales}
                    onChange={(e) => setHdData(p => ({ ...p, gross_sales: e.target.value }))}
                  />
                  <NumField
                    label="Net Sales"
                    value={hdData.net_sales}
                    onChange={(e) => setHdData(p => ({ ...p, net_sales: e.target.value }))}
                  />
                  <NumField
                    label="Orders"
                    value={hdData.orders}
                    onChange={(e) => setHdData(p => ({ ...p, orders: e.target.value }))}
                    prefix=""
                  />
                </div>
              </div>

              {/* ============== DELIVEROO SECTION (Manual Input) ============== */}
              <div className="bg-white rounded-xl p-3 border border-teal-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full bg-teal-600">Deliveroo</span>
                  <span className="text-[10px] text-gray-400">Optional</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="Gross Sales"
                    value={delData.gross_sales}
                    onChange={(e) => setDelData(p => ({ ...p, gross_sales: e.target.value }))}
                  />
                  <NumField
                    label="Net Sales"
                    value={delData.net_sales}
                    onChange={(e) => setDelData(p => ({ ...p, net_sales: e.target.value }))}
                  />
                  <NumField
                    label="Orders"
                    value={delData.orders}
                    onChange={(e) => setDelData(p => ({ ...p, orders: e.target.value }))}
                    prefix=""
                  />
                </div>
              </div>

              {/* ============== COOL MOOD SECTION (Manual Input) ============== */}
              <div className="bg-white rounded-xl p-3 border border-violet-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full bg-violet-600">Cool Mood</span>
                  <span className="text-[10px] text-gray-400">Optional</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="Gross Sales"
                    value={cmData.gross_sales}
                    onChange={(e) => setCmData(p => ({ ...p, gross_sales: e.target.value }))}
                  />
                  <NumField
                    label="Net Sales"
                    value={cmData.net_sales}
                    onChange={(e) => setCmData(p => ({ ...p, net_sales: e.target.value }))}
                  />
                  <NumField
                    label="Orders"
                    value={cmData.orders}
                    onChange={(e) => setCmData(p => ({ ...p, orders: e.target.value }))}
                    prefix=""
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={posStatus !== 'review' || saving}
                className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label}</>
                )}
              </Button>

              {posStatus === 'idle' && (
                <p className="text-center text-[11px] text-gray-400">
                  {posPhotos.length === 0 ? 'Capture POS photos, then extract data to submit' : 'Extract data from photos to review before submitting'}
                </p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

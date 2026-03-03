"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  Camera,
  X,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const MAX_PHOTOS = 5

// Merge numeric fields from multiple extraction results
function mergeNumericResults(dataArray) {
  if (!dataArray.length) return {}
  return dataArray.reduce((acc, d) => {
    const keys = ['gross_sales', 'net_sales', 'total_sales', 'guest_count', 'cash_sales',
                  'discount', 'tax', 'orders', 'total_orders', 'avg_sales_per_order']
    const merged = { ...acc }
    for (const k of keys) {
      if (d[k] !== undefined) {
        merged[k] = (merged[k] || 0) + (Number(d[k]) || 0)
      }
    }
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
  const [posStatus, setPosStatus] = useState('idle') // idle | extracting | done
  const posFileRef = useRef(null)

  // HD manual fields
  const [hdData, setHdData] = useState({ gross_sales: '', net_sales: '', orders: '' })

  // Deliveroo manual fields
  const [delData, setDelData] = useState({ gross_sales: '', net_sales: '', orders: '' })

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
    const u = JSON.parse(userData)
    setUser(u)
    const branchData = localStorage.getItem('br_branch')
    if (branchData) setBranch(JSON.parse(branchData))
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
    setHdData({ gross_sales: '', net_sales: '', orders: '' })
    setDelData({ gross_sales: '', net_sales: '', orders: '' })
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

  const handleSubmit = async () => {
    if (posPhotos.length === 0) {
      alert('Please capture at least one POS receipt photo')
      return
    }
    setSaving(true)
    setPosStatus('extracting')

    try {
      // Extract POS photos with Gemini Vision
      const posPromises = posPhotos.map(f => api.extractReceipt(f, 'pos'))
      const catPromises = posPhotos.map(f => api.extractReceipt(f, 'pos_categories').catch(() => null))
      const [posResults, catResults] = await Promise.all([
        Promise.all(posPromises),
        Promise.all(catPromises),
      ])
      setPosStatus('done')

      const posDataArray = posResults.filter(r => r?.success).map(r => r.data)
      const catDataArray = catResults.filter(r => r?.success).map(r => r.data)
      const posData = mergeNumericResults(posDataArray)
      const catData = mergeCategoryResults(catDataArray)

      // Build category/items JSON
      const categoryJson = catData.categories?.length > 0
        ? JSON.stringify(catData.categories.map(c => ({
            name: c.name, qty: c.quantity || 0, sales: c.sales || 0, pct: c.contribution_pct || 0,
          })))
        : null
      const itemsJson = catData.items?.length > 0 ? JSON.stringify(catData.items) : null

      // Save to DB
      await api.submitSales({
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        gross_sales: posData.gross_sales || 0,
        total_sales: posData.net_sales || posData.total_sales || 0,
        transaction_count: posData.guest_count || 0,
        cash_sales: posData.cash_sales || 0,
        category_data: categoryJson,
        items_data: itemsJson,
        hd_gross_sales: parseFloat(hdData.gross_sales) || 0,
        hd_net_sales: parseFloat(hdData.net_sales) || 0,
        hd_orders: parseInt(hdData.orders) || 0,
        deliveroo_gross_sales: parseFloat(delData.gross_sales) || 0,
        deliveroo_net_sales: parseFloat(delData.net_sales) || 0,
        deliveroo_orders: parseInt(delData.orders) || 0,
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
      setPosStatus(posPhotos.length > 0 ? 'idle' : 'idle')
      alert('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = posPhotos.length > 0 && !saving

  // Input field helper
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

              {/* ============== POS SECTION (Camera) ============== */}
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

                {/* Extracting */}
                {posStatus === 'extracting' && (
                  <div className="flex items-center justify-center gap-2 py-3 bg-orange-50 rounded-lg mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                    <span className="text-xs text-orange-600">Extracting {posPhotos.length} photo{posPhotos.length > 1 ? 's' : ''}...</span>
                  </div>
                )}

                {/* Done */}
                {posStatus === 'done' && (
                  <div className="flex items-center gap-2 py-2 px-2 bg-green-50 rounded-lg mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-700 font-medium">Data extracted & saved</span>
                  </div>
                )}

                {/* Photo thumbnails */}
                {posPhotos.length > 0 && posStatus === 'idle' && (
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

                {/* Empty: camera button */}
                {posPhotos.length === 0 && posStatus === 'idle' && (
                  <button
                    onClick={() => posFileRef.current?.click()}
                    className="w-full py-5 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center gap-1 active:scale-95 transition-all"
                  >
                    <Camera className="w-7 h-7 text-gray-400" />
                    <span className="text-xs text-gray-500">Tap to capture POS Sales receipt</span>
                    <span className="text-[10px] text-gray-400">Up to {MAX_PHOTOS} photos</span>
                  </button>
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

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting &amp; Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label}</>
                )}
              </Button>

              {!posPhotos.length && (
                <p className="text-center text-[11px] text-gray-400">Capture at least one POS photo to submit</p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

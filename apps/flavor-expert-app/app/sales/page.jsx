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
  Sparkles,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const MAX_PHOTOS = 5

const SECTIONS = [
  { key: 'pos', type: 'pos', label: 'POS Sales', bg: 'bg-orange-500', border: 'border-orange-200', required: true },
  { key: 'hd', type: 'hd', label: 'Home Delivery', bg: 'bg-cyan-500', border: 'border-cyan-200', required: false },
  { key: 'deliveroo', type: 'deliveroo', label: 'Deliveroo', bg: 'bg-teal-600', border: 'border-teal-200', required: false },
]

// Sum numeric fields from multiple extraction results
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

  // photos: { pos: File[], hd: File[], deliveroo: File[] }
  const [photos, setPhotos] = useState({ pos: [], hd: [], deliveroo: [] })
  // previews: { pos: string[], hd: string[], deliveroo: string[] }
  const [previews, setPreviews] = useState({ pos: [], hd: [], deliveroo: [] })
  // section submitting status
  const [sectionStatus, setSectionStatus] = useState({ pos: 'idle', hd: 'idle', deliveroo: 'idle' })

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
  }, [router])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).flat().forEach(url => URL.revokeObjectURL(url))
    }
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
    previews.pos.forEach(u => URL.revokeObjectURL(u))
    previews.hd.forEach(u => URL.revokeObjectURL(u))
    previews.deliveroo.forEach(u => URL.revokeObjectURL(u))
    setPhotos({ pos: [], hd: [], deliveroo: [] })
    setPreviews({ pos: [], hd: [], deliveroo: [] })
    setSectionStatus({ pos: 'idle', hd: 'idle', deliveroo: 'idle' })
  }

  const handleCapture = (sectionKey, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRefs[sectionKey]?.current) fileRefs[sectionKey].current.value = ''

    setPhotos(prev => {
      if (prev[sectionKey].length >= MAX_PHOTOS) return prev
      return { ...prev, [sectionKey]: [...prev[sectionKey], file] }
    })

    const url = URL.createObjectURL(file)
    setPreviews(prev => {
      if (prev[sectionKey].length >= MAX_PHOTOS) return prev
      return { ...prev, [sectionKey]: [...prev[sectionKey], url] }
    })
  }

  const removePhoto = (sectionKey, index) => {
    URL.revokeObjectURL(previews[sectionKey][index])
    setPhotos(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].filter((_, i) => i !== index),
    }))
    setPreviews(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].filter((_, i) => i !== index),
    }))
  }

  // Extract all captured photos and save in one shot on Submit
  const handleSubmit = async () => {
    if (photos.pos.length === 0) {
      alert('Please capture at least one POS receipt photo')
      return
    }
    setSaving(true)
    setSectionStatus({
      pos: 'extracting',
      hd: photos.hd.length > 0 ? 'extracting' : 'idle',
      deliveroo: photos.deliveroo.length > 0 ? 'extracting' : 'idle',
    })

    try {
      // Extract all POS photos (sales + categories) in parallel
      const posPromises = photos.pos.map(f => api.extractReceipt(f, 'pos'))
      const catPromises = photos.pos.map(f => api.extractReceipt(f, 'pos_categories').catch(() => null))
      const [posResults, catResults] = await Promise.all([
        Promise.all(posPromises),
        Promise.all(catPromises),
      ])
      setSectionStatus(prev => ({ ...prev, pos: 'done' }))

      const posDataArray = posResults.filter(r => r?.success).map(r => r.data)
      const catDataArray = catResults.filter(r => r?.success).map(r => r.data)
      const posData = mergeNumericResults(posDataArray)
      const catData = mergeCategoryResults(catDataArray)

      // Extract all HD photos
      let hdData = {}
      if (photos.hd.length > 0) {
        const hdResults = await Promise.all(photos.hd.map(f => api.extractReceipt(f, 'hd')))
        const hdDataArray = hdResults.filter(r => r?.success).map(r => r.data)
        hdData = mergeNumericResults(hdDataArray)
        setSectionStatus(prev => ({ ...prev, hd: 'done' }))
      }

      // Extract all Deliveroo photos
      let deliverooData = {}
      if (photos.deliveroo.length > 0) {
        const drResults = await Promise.all(photos.deliveroo.map(f => api.extractReceipt(f, 'deliveroo')))
        const drDataArray = drResults.filter(r => r?.success).map(r => r.data?.totals || r.data)
        deliverooData = mergeNumericResults(drDataArray)
        setSectionStatus(prev => ({ ...prev, deliveroo: 'done' }))
      }

      // Build JSON payloads
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
        hd_gross_sales: hdData.gross_sales || 0,
        hd_net_sales: hdData.net_sales || 0,
        hd_orders: hdData.orders || 0,
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
      loadSubmittedWindows()
    } catch (err) {
      console.error(err)
      setSectionStatus({
        pos: photos.pos.length > 0 ? 'captured' : 'idle',
        hd: photos.hd.length > 0 ? 'captured' : 'idle',
        deliveroo: photos.deliveroo.length > 0 ? 'captured' : 'idle',
      })
      alert('Failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = photos.pos.length > 0 && !saving

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
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700">
                  Capture up to <strong>5 photos per section</strong>, then tap <strong>Submit</strong> — AI will extract and save all automatically.
                </p>
              </div>

              {/* Photo Sections */}
              {SECTIONS.map((s) => {
                const sPhotos = photos[s.key]
                const sPreviews = previews[s.key]
                const status = sectionStatus[s.key]
                const hasPhotos = sPhotos.length > 0
                const canAddMore = sPhotos.length < MAX_PHOTOS && !saving

                return (
                  <div key={s.key} className={`bg-white rounded-xl p-3 border ${s.border}`}>
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                        {s.required && <span className="text-[10px] text-red-400 font-medium">Required</span>}
                        {!s.required && <span className="text-[10px] text-gray-400">Optional</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{sPhotos.length}/{MAX_PHOTOS} photos</span>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileRefs[s.key]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleCapture(s.key, e)}
                    />

                    {/* Extracting overlay */}
                    {status === 'extracting' && (
                      <div className="flex items-center justify-center gap-2 py-3 bg-orange-50 rounded-lg mb-2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                        <span className="text-xs text-orange-600">Extracting {sPhotos.length} photo{sPhotos.length > 1 ? 's' : ''}...</span>
                      </div>
                    )}

                    {/* Done state */}
                    {status === 'done' && (
                      <div className="flex items-center gap-2 py-2 px-2 bg-green-50 rounded-lg mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-700 font-medium">Data extracted & saved</span>
                      </div>
                    )}

                    {/* Photo thumbnails grid */}
                    {hasPhotos && status !== 'extracting' && status !== 'done' && (
                      <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {sPreviews.map((url, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            <img src={url} alt={`photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => removePhoto(s.key, idx)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                            <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-black/50 text-white px-1 rounded">
                              {idx + 1}
                            </span>
                          </div>
                        ))}

                        {/* Add more button (if under limit) */}
                        {canAddMore && (
                          <button
                            onClick={() => fileRefs[s.key].current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 bg-gray-50 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                          >
                            <Plus className="w-4 h-4 text-gray-400" />
                            <span className="text-[9px] text-gray-400">Add</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Idle: first camera button */}
                    {!hasPhotos && status !== 'extracting' && status !== 'done' && (
                      <button
                        onClick={() => fileRefs[s.key].current?.click()}
                        className="w-full py-5 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center gap-1 active:scale-95 transition-all"
                      >
                        <Camera className="w-7 h-7 text-gray-400" />
                        <span className="text-xs text-gray-500">Tap to capture {s.label}</span>
                        <span className="text-[10px] text-gray-400">Up to {MAX_PHOTOS} photos</span>
                      </button>
                    )}

                    {/* Show photo count when captured */}
                    {hasPhotos && status !== 'extracting' && status !== 'done' && (
                      <p className="text-[10px] text-green-600 font-medium mt-1">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        {sPhotos.length} photo{sPhotos.length > 1 ? 's' : ''} ready
                        {sPhotos.length < MAX_PHOTOS && ' — tap + to add more'}
                      </p>
                    )}
                  </div>
                )
              })}

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

              {!photos.pos.length && (
                <p className="text-center text-[11px] text-gray-400">Capture at least one POS photo to submit</p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

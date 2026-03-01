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
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

const SECTIONS = [
  { key: 'pos', type: 'pos', label: 'POS Sales', bg: 'bg-orange-500', border: 'border-orange-200', required: true },
  { key: 'hd', type: 'hd', label: 'Home Delivery', bg: 'bg-cyan-500', border: 'border-cyan-200', required: false },
  { key: 'deliveroo', type: 'deliveroo', label: 'Deliveroo', bg: 'bg-teal-600', border: 'border-teal-200', required: false },
]

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // Photos stored per section (File objects, not yet extracted)
  const [photos, setPhotos] = useState({ pos: null, hd: null, deliveroo: null })
  // Per-section status: idle | captured | extracting | done | error
  const [sectionStatus, setSectionStatus] = useState({ pos: 'idle', hd: 'idle', deliveroo: 'idle' })
  const [sectionError, setSectionError] = useState({ pos: null, hd: null, deliveroo: null })

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
    setPhotos({ pos: null, hd: null, deliveroo: null })
    setSectionStatus({ pos: 'idle', hd: 'idle', deliveroo: 'idle' })
    setSectionError({ pos: null, hd: null, deliveroo: null })
  }

  // Just store the photo — do NOT extract yet
  const handleCapture = (sectionKey, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRefs[sectionKey]?.current) fileRefs[sectionKey].current.value = ''
    setPhotos(prev => ({ ...prev, [sectionKey]: file }))
    setSectionStatus(prev => ({ ...prev, [sectionKey]: 'captured' }))
    setSectionError(prev => ({ ...prev, [sectionKey]: null }))
  }

  const retakePhoto = (sectionKey) => {
    setPhotos(prev => ({ ...prev, [sectionKey]: null }))
    setSectionStatus(prev => ({ ...prev, [sectionKey]: 'idle' }))
    setSectionError(prev => ({ ...prev, [sectionKey]: null }))
  }

  // Extract ALL captured photos and save in one shot
  const handleSubmit = async () => {
    if (!photos.pos) {
      alert('Please capture POS receipt first')
      return
    }
    setSaving(true)

    // Mark all captured sections as extracting
    setSectionStatus(prev => ({
      pos: 'extracting',
      hd: prev.hd === 'captured' ? 'extracting' : prev.hd,
      deliveroo: prev.deliveroo === 'captured' ? 'extracting' : prev.deliveroo,
    }))

    try {
      // Extract POS + categories in parallel from same photo
      const [posResult, catResult] = await Promise.all([
        api.extractReceipt(photos.pos, 'pos'),
        api.extractReceipt(photos.pos, 'pos_categories').catch(() => null),
      ])

      setSectionStatus(prev => ({ ...prev, pos: 'done' }))

      const posData = posResult?.success ? posResult.data : {}
      const catData = catResult?.success ? catResult.data : { categories: [], items: [] }

      // Extract HD if photo taken
      let hdData = {}
      if (photos.hd) {
        const hdResult = await api.extractReceipt(photos.hd, 'hd')
        hdData = hdResult?.success ? hdResult.data : {}
        setSectionStatus(prev => ({ ...prev, hd: 'done' }))
      }

      // Extract Deliveroo if photo taken
      let deliverooData = {}
      if (photos.deliveroo) {
        const drResult = await api.extractReceipt(photos.deliveroo, 'deliveroo')
        deliverooData = drResult?.success ? (drResult.data?.totals || drResult.data) : {}
        setSectionStatus(prev => ({ ...prev, deliveroo: 'done' }))
      }

      // Build JSON payloads
      const categoryJson = catData.categories?.length > 0
        ? JSON.stringify(catData.categories.map(c => ({
            name: c.name, qty: c.quantity || 0, sales: c.sales || 0, pct: c.contribution_pct || 0,
          })))
        : null

      const itemsJson = catData.items?.length > 0
        ? JSON.stringify(catData.items)
        : null

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
      // Revert extracting → captured so user can retry
      setSectionStatus(prev => ({
        pos: prev.pos === 'extracting' ? 'captured' : prev.pos,
        hd: prev.hd === 'extracting' ? 'captured' : prev.hd,
        deliveroo: prev.deliveroo === 'extracting' ? 'captured' : prev.deliveroo,
      }))
      alert('Extraction/save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const posReady = sectionStatus.pos === 'captured' || sectionStatus.pos === 'done'
  const canSubmit = photos.pos !== null && !saving

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
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-[11px] text-blue-700">
                  Capture all photos first, then tap <strong>Submit</strong> — AI will extract and save automatically.
                </p>
              </div>

              {/* Photo Sections */}
              {SECTIONS.map((s) => {
                const status = sectionStatus[s.key]
                const hasPhoto = photos[s.key] !== null
                return (
                  <div key={s.key} className={`bg-white rounded-xl p-3 border ${s.border}`}>
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                        {s.required && <span className="text-[10px] text-red-400 font-medium">Required</span>}
                        {!s.required && <span className="text-[10px] text-gray-400">Optional</span>}
                      </div>
                      {hasPhoto && status !== 'extracting' && (
                        <button onClick={() => retakePhoto(s.key)} className="text-[10px] text-orange-500 flex items-center gap-1">
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
                      onChange={(e) => handleCapture(s.key, e)}
                    />

                    {/* Idle: show camera button */}
                    {status === 'idle' && (
                      <button
                        onClick={() => fileRefs[s.key].current?.click()}
                        className="w-full py-5 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center gap-1 active:scale-95 transition-all"
                      >
                        <Camera className="w-7 h-7 text-gray-400" />
                        <span className="text-xs text-gray-500">Tap to capture {s.label}</span>
                      </button>
                    )}

                    {/* Captured: show ready state */}
                    {status === 'captured' && (
                      <div className="flex items-center gap-3 py-3 px-2 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700">Photo ready</p>
                          <p className="text-[10px] text-green-600">{photos[s.key]?.name}</p>
                        </div>
                        <button
                          onClick={() => fileRefs[s.key].current?.click()}
                          className="text-[11px] text-orange-500 underline"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* Extracting: spinner */}
                    {status === 'extracting' && (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                        <span className="text-sm text-gray-600">Extracting with AI...</span>
                      </div>
                    )}

                    {/* Done: success */}
                    {status === 'done' && (
                      <div className="flex items-center gap-2 py-3 px-2 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <p className="text-sm font-medium text-green-700">Data extracted & saved</p>
                      </div>
                    )}

                    {/* Error */}
                    {status === 'error' && (
                      <div className="text-center py-3">
                        <p className="text-xs text-red-500 mb-2">{sectionError[s.key] || 'Extraction failed'}</p>
                        <button
                          onClick={() => fileRefs[s.key].current?.click()}
                          className="text-xs text-orange-500 underline"
                        >
                          Try again
                        </button>
                      </div>
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

              {!photos.pos && (
                <p className="text-center text-[11px] text-gray-400">Capture POS receipt to enable submit</p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

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

// ============================================================
// SALES WINDOW TIME RULES (commented out — enable when ready)
//
// const WINDOW_TIME_RULES = {
//   '3pm':     { openHour: 15, closeHour: 19 },
//   '7pm':     { openHour: 19, closeHour: 21 },
//   '9pm':     { openHour: 21, closeHour: 22 },
//   'closing': { openHour: 22, closeHour: 6 },
// }
//
// function isWindowAvailable(windowId) {
//   const rule = WINDOW_TIME_RULES[windowId]
//   if (!rule) return false
//   const hour = new Date().getHours()
//   if (rule.openHour < rule.closeHour) {
//     return hour >= rule.openHour && hour < rule.closeHour
//   } else {
//     return hour >= rule.openHour || hour < rule.closeHour
//   }
// }
//
// To enable: uncomment above, then change isLocked to:
//   const isLocked = !isWindowAvailable(window.id)
// ============================================================

const MAX_PHOTOS = 4

const SECTIONS = [
  { key: 'pos', label: 'POS', bg: 'bg-orange-500', ring: 'ring-orange-400', borderColor: 'border-orange-200', required: true },
  { key: 'hd', label: 'HD', bg: 'bg-cyan-500', ring: 'ring-cyan-400', borderColor: 'border-cyan-200', required: false },
  { key: 'deliveroo', label: 'Deliveroo', bg: 'bg-teal-600', ring: 'ring-teal-400', borderColor: 'border-teal-200', required: false },
]

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // Photos: { pos: [{ file, preview }], hd: [...], deliveroo: [...] }
  const [photos, setPhotos] = useState({ pos: [], hd: [], deliveroo: [] })
  const fileRefs = { pos: useRef(null), hd: useRef(null), deliveroo: useRef(null) }

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) { router.push('/login'); return }
    setUser(JSON.parse(userData))
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
    resetPhotos()
  }

  const resetPhotos = () => {
    Object.values(photos).forEach(arr =>
      arr.forEach(p => { if (p?.preview) URL.revokeObjectURL(p.preview) })
    )
    setPhotos({ pos: [], hd: [], deliveroo: [] })
  }

  const addPhoto = (key, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photos[key].length >= MAX_PHOTOS) return
    const preview = URL.createObjectURL(file)
    setPhotos(prev => ({ ...prev, [key]: [...prev[key], { file, preview }] }))
    // Reset input so same file can be selected again
    if (fileRefs[key]?.current) fileRefs[key].current.value = ''
  }

  const removePhoto = (key, idx) => {
    const photo = photos[key][idx]
    if (photo?.preview) URL.revokeObjectURL(photo.preview)
    setPhotos(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async () => {
    if (photos.pos.length === 0) { alert('Please add at least one POS receipt photo'); return }
    setSaving(true)
    try {
      // Upload all photos per section, collect URLs
      const urls = {}
      for (const s of SECTIONS) {
        if (photos[s.key].length > 0) {
          const uploaded = []
          for (const p of photos[s.key]) {
            const result = await api.uploadSalesPhoto(p.file)
            uploaded.push(result.url)
          }
          urls[s.key] = uploaded.join(',')
        }
      }

      await api.submitSales({
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        total_sales: 0,
        transaction_count: 0,
        photo_url: urls.pos || null,
        hd_photo_url: urls.hd || null,
        deliveroo_photo_url: urls.deliveroo || null,
      })

      const updated = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updated)
      resetPhotos()
      const next = SALES_WINDOWS.find(w => !updated.includes(w.id))
      if (next) {
        setSelectedWindow(next.id)
        alert(`${SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} submitted!`)
      } else {
        alert('All windows submitted for today!')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to submit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const totalPhotos = Object.values(photos).reduce((sum, arr) => sum + arr.length, 0)

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
              {/* Photo Sections */}
              {SECTIONS.map((s) => {
                const sectionPhotos = photos[s.key]
                const canAdd = sectionPhotos.length < MAX_PHOTOS

                return (
                  <div key={s.key} className={`bg-white rounded-xl p-3 border ${s.borderColor}`}>
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                        {s.required && <span className="text-[10px] text-red-400 font-medium">Required</span>}
                        {!s.required && <span className="text-[10px] text-gray-400">Optional</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{sectionPhotos.length}/{MAX_PHOTOS}</span>
                    </div>

                    {/* Photos Grid */}
                    <input
                      ref={fileRefs[s.key]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => addPhoto(s.key, e)}
                    />

                    <div className="grid grid-cols-4 gap-2">
                      {/* Existing photos */}
                      {sectionPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square">
                          <img
                            src={photo.preview}
                            alt={`${s.label} ${idx + 1}`}
                            className={`w-full h-full rounded-lg object-cover ring-2 ${s.ring}`}
                          />
                          <button
                            onClick={() => removePhoto(s.key, idx)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}

                      {/* Add button */}
                      {canAdd && (
                        <button
                          onClick={() => fileRefs[s.key].current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                        >
                          {sectionPhotos.length === 0 ? (
                            <Camera className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Plus className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={saving || photos.pos.length === 0}
                className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} ({totalPhotos} photo{totalPhotos !== 1 ? 's' : ''})</>
                )}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

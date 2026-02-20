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

const SECTIONS = [
  { key: 'pos', label: 'POS', bg: 'bg-orange-500', ring: 'ring-orange-400', required: true },
  { key: 'hd', label: 'HD', bg: 'bg-cyan-500', ring: 'ring-cyan-400', required: false },
  { key: 'deliveroo', label: 'Deliveroo', bg: 'bg-teal-600', ring: 'ring-teal-400', required: false },
]

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  const [photos, setPhotos] = useState({ pos: null, hd: null, deliveroo: null })
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
    Object.values(photos).forEach(p => { if (p?.preview) URL.revokeObjectURL(p.preview) })
    setPhotos({ pos: null, hd: null, deliveroo: null })
  }

  const handlePhotoSelect = (key, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photos[key]?.preview) URL.revokeObjectURL(photos[key].preview)
    setPhotos(prev => ({ ...prev, [key]: { file, preview: URL.createObjectURL(file) } }))
  }

  const removePhoto = (key) => {
    if (photos[key]?.preview) URL.revokeObjectURL(photos[key].preview)
    setPhotos(prev => ({ ...prev, [key]: null }))
    if (fileRefs[key]?.current) fileRefs[key].current.value = ''
  }

  const handleSubmit = async () => {
    if (!photos.pos) { alert('Please add POS receipt photo'); return }
    setSaving(true)
    try {
      const urls = {}
      for (const s of SECTIONS) {
        if (photos[s.key]?.file) {
          const result = await api.uploadSalesPhoto(photos[s.key].file)
          urls[s.key] = result.url
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

  const photoCount = Object.values(photos).filter(p => p?.file).length

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
              {/* Photo Upload Row */}
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Upload Receipt Photos</p>
                <div className="grid grid-cols-3 gap-3">
                  {SECTIONS.map((s) => {
                    const photo = photos[s.key]
                    return (
                      <div key={s.key} className="flex flex-col items-center gap-1.5">
                        <input
                          ref={fileRefs[s.key]}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handlePhotoSelect(s.key, e)}
                        />

                        {photo?.preview ? (
                          <div className="relative w-full aspect-square">
                            <img
                              src={photo.preview}
                              alt={s.label}
                              className={`w-full h-full rounded-xl object-cover ring-2 ${s.ring}`}
                              onClick={() => fileRefs[s.key].current?.click()}
                            />
                            <button
                              onClick={() => removePhoto(s.key)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileRefs[s.key].current?.click()}
                            className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                          >
                            <Camera className="w-6 h-6 text-gray-400" />
                          </button>
                        )}

                        <div className="text-center">
                          <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${s.bg}`}>
                            {s.label}
                          </span>
                          {s.required && !photo && (
                            <p className="text-[9px] text-red-400 mt-0.5">Required</p>
                          )}
                          {!s.required && !photo && (
                            <p className="text-[9px] text-gray-400 mt-0.5">Optional</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={saving || !photos.pos}
                className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} ({photoCount} photo{photoCount !== 1 ? 's' : ''})</>
                )}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

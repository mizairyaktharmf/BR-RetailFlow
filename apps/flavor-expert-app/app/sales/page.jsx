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
  Store,
  Truck,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

// Photo section config
const SECTIONS = [
  {
    key: 'pos',
    label: 'POS Receipt',
    icon: Store,
    color: 'orange',
    bgFrom: 'from-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    textColor: 'text-orange-700',
    ringColor: 'ring-orange-300',
    required: true,
  },
  {
    key: 'hd',
    label: 'Home Delivery',
    icon: Truck,
    color: 'cyan',
    bgFrom: 'from-cyan-50',
    border: 'border-cyan-200',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-500',
    textColor: 'text-cyan-700',
    ringColor: 'ring-cyan-300',
    required: false,
  },
  {
    key: 'deliveroo',
    label: 'Deliveroo',
    icon: Truck,
    color: 'teal',
    bgFrom: 'from-teal-50',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-700',
    ringColor: 'ring-teal-300',
    required: false,
  },
]

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // Photos state: { pos: { file, preview, uploading }, hd: {...}, deliveroo: {...} }
  const [photos, setPhotos] = useState({
    pos: null,
    hd: null,
    deliveroo: null,
  })

  // File input refs
  const fileRefs = {
    pos: useRef(null),
    hd: useRef(null),
    deliveroo: useRef(null),
  }

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

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
    // Revoke old previews
    Object.values(photos).forEach(p => {
      if (p?.preview) URL.revokeObjectURL(p.preview)
    })
    setPhotos({ pos: null, hd: null, deliveroo: null })
  }

  const handlePhotoSelect = (sectionKey, e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Revoke old preview
    if (photos[sectionKey]?.preview) {
      URL.revokeObjectURL(photos[sectionKey].preview)
    }

    const preview = URL.createObjectURL(file)
    setPhotos(prev => ({
      ...prev,
      [sectionKey]: { file, preview, uploading: false },
    }))
  }

  const removePhoto = (sectionKey) => {
    if (photos[sectionKey]?.preview) {
      URL.revokeObjectURL(photos[sectionKey].preview)
    }
    setPhotos(prev => ({ ...prev, [sectionKey]: null }))
    // Reset file input
    if (fileRefs[sectionKey]?.current) {
      fileRefs[sectionKey].current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!photos.pos) {
      alert('Please take a POS receipt photo')
      return
    }

    setSaving(true)

    try {
      // Upload photos that exist
      const uploadedUrls = {}

      for (const section of SECTIONS) {
        const photo = photos[section.key]
        if (photo?.file) {
          setPhotos(prev => ({
            ...prev,
            [section.key]: { ...prev[section.key], uploading: true },
          }))
          const result = await api.uploadSalesPhoto(photo.file)
          uploadedUrls[section.key] = result.url
          setPhotos(prev => ({
            ...prev,
            [section.key]: { ...prev[section.key], uploading: false },
          }))
        }
      }

      // Submit sales record with photo URLs
      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        total_sales: 0,
        transaction_count: 0,
        photo_url: uploadedUrls.pos || null,
        hd_photo_url: uploadedUrls.hd || null,
        deliveroo_photo_url: uploadedUrls.deliveroo || null,
      }

      await api.submitSales(submitData)

      const updatedSubmitted = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updatedSubmitted)
      resetPhotos()

      const nextWindow = SALES_WINDOWS.find(w => !updatedSubmitted.includes(w.id))
      if (nextWindow) {
        setSelectedWindow(nextWindow.id)
        alert(`${SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} submitted! Moving to ${nextWindow.label}.`)
      } else {
        alert('All sales windows submitted for today!')
      }
    } catch (error) {
      console.error('Error submitting sales:', error)
      alert('Failed to submit sales. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const photoCount = Object.values(photos).filter(p => p?.file).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white safe-area-top">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Submit Sales Report</h1>
              <p className="text-orange-100 text-sm">{branch?.name || 'My Branch'} &middot; {formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Window Selector */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">Select Window</h2>
        {loadingWindows ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {SALES_WINDOWS.map((window) => {
              const isSelected = selectedWindow === window.id
              const isSubmitted = submittedWindows.includes(window.id)
              const isLocked = false // change to !isWindowAvailable(window.id) to enable time rules
              return (
                <button
                  key={window.id}
                  onClick={() => handleWindowSelect(window.id)}
                  disabled={isSubmitted || isLocked}
                  className={`p-3 rounded-xl text-center transition-all ${
                    isSubmitted
                      ? 'bg-green-100 border-2 border-green-300 opacity-80'
                      : isLocked
                        ? 'bg-gray-100 border-2 border-gray-200 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-orange-100 border-2 border-orange-400 shadow-sm'
                          : 'bg-white border-2 border-gray-200 hover:border-orange-200'
                  }`}
                >
                  <p className={`text-xs font-bold ${
                    isSubmitted ? 'text-green-600' : isLocked ? 'text-gray-400' : isSelected ? 'text-orange-600' : 'text-gray-600'
                  }`}>{window.label.split(' ')[0]}</p>
                  {isSubmitted ? (
                    <CheckCircle2 className="w-5 h-5 mx-auto mt-1 text-green-600" />
                  ) : (
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                      {window.time.split('-')[0].trim()}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="px-4">
        {!selectedWindow || loadingWindows ? null : submittedWindows.includes(selectedWindow) ? (
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Already Submitted!</AlertTitle>
            <AlertDescription className="text-green-700">
              You've submitted the {selectedWindow.toUpperCase()} report. Select another window or go back.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Photo Sections */}
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const photo = photos[section.key]

              return (
                <Card key={section.key} className={section.border}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${section.iconBg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${section.iconColor}`} />
                        </div>
                        <span>{section.label}</span>
                        {section.required && <span className="text-red-500 text-xs">*</span>}
                      </div>
                      {!section.required && !photo && (
                        <span className="text-[10px] uppercase text-gray-400 font-medium">Optional</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Hidden file input */}
                    <input
                      ref={fileRefs[section.key]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(section.key, e)}
                    />

                    {photo?.preview ? (
                      /* Photo Preview */
                      <div className="relative">
                        <img
                          src={photo.preview}
                          alt={section.label}
                          className={`w-full rounded-xl object-cover max-h-64 ring-2 ${section.ringColor}`}
                        />
                        {photo.uploading && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          onClick={() => removePhoto(section.key)}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                        {/* Retake button */}
                        <button
                          onClick={() => fileRefs[section.key].current?.click()}
                          className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 hover:bg-black/80 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-white" />
                          <span className="text-xs text-white font-medium">Retake</span>
                        </button>
                      </div>
                    ) : (
                      /* Capture Button */
                      <button
                        onClick={() => fileRefs[section.key].current?.click()}
                        className={`w-full py-10 rounded-xl border-2 border-dashed ${section.border} bg-gradient-to-b ${section.bgFrom} to-white hover:shadow-md transition-all flex flex-col items-center gap-3 active:scale-[0.98]`}
                      >
                        <div className={`w-14 h-14 rounded-2xl ${section.iconBg} flex items-center justify-center`}>
                          <Camera className={`w-7 h-7 ${section.iconColor}`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${section.textColor}`}>
                            Tap to take photo
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">or select from gallery</p>
                        </div>
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={saving || !photos.pos}
              className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading {photoCount} photo{photoCount !== 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label || ''} ({photoCount} photo{photoCount !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

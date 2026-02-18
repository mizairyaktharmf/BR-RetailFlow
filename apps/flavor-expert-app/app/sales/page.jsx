"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  Save,
  Loader2,
  CheckCircle2,
  X,
  Plus,
  ScanLine,
  DollarSign,
  Users,
  AlertCircle,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  Banknote,
  BarChart3,
  Truck,
  Store
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

const MAX_PHOTOS = 4

// ============================================================
// SALES WINDOW TIME RULES (commented out — enable when ready)
// Each window has an open/close time. Outside that range,
// the window is locked and the user cannot submit for it.
//
// const WINDOW_TIME_RULES = {
//   '3pm':     { openHour: 15, closeHour: 19 },   // 3 PM → 7 PM
//   '7pm':     { openHour: 19, closeHour: 21 },   // 7 PM → 9 PM
//   '9pm':     { openHour: 21, closeHour: 22 },   // 9 PM → 10 PM (closing)
//   'closing': { openHour: 22, closeHour: 6 },     // 10 PM → 6 AM next day
// }
//
// function isWindowAvailable(windowId) {
//   const rule = WINDOW_TIME_RULES[windowId]
//   if (!rule) return false
//   const hour = new Date().getHours()
//   if (rule.openHour < rule.closeHour) {
//     // Normal range (e.g. 15→19)
//     return hour >= rule.openHour && hour < rule.closeHour
//   } else {
//     // Overnight range (e.g. 22→6) — closing window
//     return hour >= rule.openHour || hour < rule.closeHour
//   }
// }
//
// To enable: uncomment above, then change isLocked to:
//   const isLocked = !isWindowAvailable(window.id)
// ============================================================

// ============ Photo Upload Section Component ============
function PhotoUploadSection({ title, icon: Icon, color, photos, onPhotosChange, fileInputRef, maxPhotos = MAX_PHOTOS }) {
  const readFileAsDataURL = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
  }

  const handleCapture = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const newPhotos = []
    for (const file of files) {
      if (photos.length + newPhotos.length >= maxPhotos) break
      const preview = await readFileAsDataURL(file)
      newPhotos.push({ file, preview })
    }

    onPhotosChange([...photos, ...newPhotos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (index) => {
    onPhotosChange(photos.filter((_, i) => i !== index))
  }

  const borderColor = color === 'orange' ? 'border-orange-400 hover:border-orange-400 hover:bg-orange-50' : 'border-cyan-400 hover:border-cyan-400 hover:bg-cyan-50'
  const bgColor = color === 'orange' ? 'bg-orange-100' : 'bg-cyan-100'
  const iconColor = color === 'orange' ? 'text-orange-500' : 'text-cyan-500'
  const textColor = color === 'orange' ? 'text-orange-600' : 'text-cyan-600'

  return (
    <div>
      {photos.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-300 ${borderColor} transition-colors`}
        >
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-800">{title}</p>
            <p className="text-xs text-gray-500">Upload up to {maxPhotos} photos</p>
          </div>
          <Plus className="w-5 h-5 text-gray-400 ml-auto" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{photos.length} of {maxPhotos} photos</p>
            {photos.length < maxPhotos && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`text-xs font-medium ${textColor} flex items-center gap-1`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add more
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img src={photo.preview} alt={`${title} ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
    </div>
  )
}

// ============ Extracted Data Display Component ============
function ExtractedDataCard({ data, onChange, label, color }) {
  const isHd = color === 'cyan'
  const gcLabel = isHd ? 'Orders' : 'Guest Count'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            <Label className="text-xs font-semibold text-blue-800">Gross Sales</Label>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={data.gross_sales}
            onChange={(e) => onChange('gross_sales', e.target.value)}
            className="h-9 text-sm font-bold bg-white border-blue-200"
          />
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3.5 h-3.5 text-green-600" />
            <Label className="text-xs font-semibold text-green-800">Net Sales</Label>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={data.net_sales}
            onChange={(e) => onChange('net_sales', e.target.value)}
            className="h-9 text-sm font-bold bg-white border-green-200"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <Label className="text-xs font-semibold text-purple-800">{gcLabel}</Label>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={data.guest_count}
            onChange={(e) => onChange('guest_count', e.target.value)}
            className="h-9 text-sm font-bold bg-white border-purple-200"
          />
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Banknote className="w-3.5 h-3.5 text-amber-600" />
            <Label className="text-xs font-semibold text-amber-800">Cash Sales</Label>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={data.cash_sales}
            onChange={(e) => onChange('cash_sales', e.target.value)}
            className="h-9 text-sm font-bold bg-white border-amber-200"
          />
        </div>
      </div>
    </div>
  )
}

export default function SalesPage() {
  const router = useRouter()
  const posFileRef = useRef(null)
  const hdFileRef = useRef(null)
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // POS state
  const [posPhotos, setPosPhotos] = useState([])
  const [posData, setPosData] = useState(null)
  const [posProcessing, setPosProcessing] = useState(false)
  const [posError, setPosError] = useState(null)

  // HD state
  const [hdPhotos, setHdPhotos] = useState([])
  const [hdData, setHdData] = useState(null)
  const [hdProcessing, setHdProcessing] = useState(false)
  const [hdError, setHdError] = useState(null)

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

    loadSubmittedWindows(parsedUser)
  }, [router])

  const loadSubmittedWindows = async (userData) => {
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
    // Reset both sections
    setPosPhotos([])
    setPosData(null)
    setPosError(null)
    setHdPhotos([])
    setHdData(null)
    setHdError(null)
  }

  // ===== POS Photo handling =====
  const handlePosPhotosChange = async (newPhotos) => {
    setPosPhotos(newPhotos)
    if (newPhotos.length === 0) {
      setPosData(null)
      setPosError(null)
      return
    }
    await extractData(newPhotos, 'pos')
  }

  // ===== HD Photo handling =====
  const handleHdPhotosChange = async (newPhotos) => {
    setHdPhotos(newPhotos)
    if (newPhotos.length === 0) {
      setHdData(null)
      setHdError(null)
      return
    }
    await extractData(newPhotos, 'hd')
  }

  const extractData = async (photoList, type) => {
    const setProcessing = type === 'pos' ? setPosProcessing : setHdProcessing
    const setError = type === 'pos' ? setPosError : setHdError
    const setData = type === 'pos' ? setPosData : setHdData

    setProcessing(true)
    setError(null)
    try {
      const result = await api.extractSalesFromPhotos(
        photoList.map(p => p.file),
        branch?.name || '',
        type
      )
      setData({
        branch_name: result.branch_name || '',
        branch_match: result.branch_match || false,
        gross_sales: result.gross_sales || '',
        net_sales: result.net_sales || '',
        guest_count: result.guest_count || '',
        cash_sales: result.cash_sales || '',
        categories: result.categories || [],
        confidence: result.confidence || 'low',
      })
    } catch (error) {
      console.error(`${type} extraction failed:`, error)
      setError('Could not auto-extract. Please enter values manually.')
      setData({
        branch_name: '',
        branch_match: true,
        gross_sales: '',
        net_sales: '',
        guest_count: '',
        cash_sales: '',
        categories: [],
        confidence: 'none',
      })
    } finally {
      setProcessing(false)
    }
  }

  const handlePosDataChange = (field, value) => {
    setPosData(prev => ({ ...prev, [field]: value }))
  }

  const handleHdDataChange = (field, value) => {
    setHdData(prev => ({ ...prev, [field]: value }))
  }

  // ===== Combined Totals =====
  const posGross = parseFloat(posData?.gross_sales) || 0
  const posNet = parseFloat(posData?.net_sales) || 0
  const posGc = parseInt(posData?.guest_count) || 0
  const hdGross = parseFloat(hdData?.gross_sales) || 0
  const hdNet = parseFloat(hdData?.net_sales) || 0
  const hdOrders = parseInt(hdData?.guest_count) || 0
  const totalGross = posGross + hdGross
  const totalNet = posNet + hdNet
  const totalCount = posGc + hdOrders
  const hasHd = hdPhotos.length > 0 && hdData

  const handleSubmit = async () => {
    if (posPhotos.length === 0) {
      alert('Please upload at least one POS photo')
      return
    }

    if (posData && !posData.branch_match && posData.confidence !== 'none') {
      alert('POS receipt branch does not match your branch. Cannot submit.')
      return
    }

    if (hdData && !hdData.branch_match && hdData.confidence !== 'none') {
      alert('Home Delivery receipt branch does not match your branch. Cannot submit.')
      return
    }

    if (!posData?.gross_sales && !posData?.net_sales) {
      alert('Please enter POS sales data before submitting')
      return
    }

    setSaving(true)

    try {
      // Upload POS photos
      const posPhotoUrls = []
      for (const photo of posPhotos) {
        try {
          const uploadResult = await api.uploadSalesPhoto(photo.file)
          posPhotoUrls.push(uploadResult.url)
        } catch {
          console.log('POS photo upload failed, will store locally')
        }
      }

      // Upload HD photos
      const hdPhotoUrls = []
      for (const photo of hdPhotos) {
        try {
          const uploadResult = await api.uploadSalesPhoto(photo.file)
          hdPhotoUrls.push(uploadResult.url)
        } catch {
          console.log('HD photo upload failed, will store locally')
        }
      }

      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        // POS data
        gross_sales: posGross,
        total_sales: posNet,
        transaction_count: posGc,
        cash_sales: parseFloat(posData?.cash_sales) || 0,
        category_data: posData?.categories?.length > 0
          ? JSON.stringify(posData.categories)
          : null,
        photo_url: posPhotoUrls.length > 0 ? posPhotoUrls.join(',') : null,
        // HD data
        hd_gross_sales: hdGross,
        hd_net_sales: hdNet,
        hd_orders: hdOrders,
        hd_photo_url: hdPhotoUrls.length > 0 ? hdPhotoUrls.join(',') : null,
      }

      try {
        await api.submitSales(submitData)
      } catch (error) {
        await offlineStore.saveSalesEntry({
          ...submitData,
          photos_base64: posPhotos.map(p => p.preview),
          hd_photos_base64: hdPhotos.map(p => p.preview),
        })
      }

      const updatedSubmitted = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updatedSubmitted)
      setPosPhotos([])
      setPosData(null)
      setPosError(null)
      setHdPhotos([])
      setHdData(null)
      setHdError(null)

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

  // Branch verification badge
  const BranchBadge = ({ data, processing, label }) => {
    if (processing || !data) return null
    if (data.confidence === 'none') {
      return (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">OCR not available — enter manually</p>
        </div>
      )
    }
    if (data.branch_match) {
      return (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
          <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700"><span className="font-medium">Verified</span> — {data.branch_name || branch?.name}</p>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
        <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
        <p className="text-xs text-red-700">
          <span className="font-medium">Mismatch!</span> Receipt: {data.branch_name || 'Unknown'} | Your: {branch?.name || 'Unknown'}
        </p>
      </div>
    )
  }

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
              <p className="text-orange-100 text-sm">{formatDate(new Date())}</p>
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

      {/* Main Form */}
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

            {/* ========== POS SECTION ========== */}
            <Card className="border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-500" />
                  POS Sales
                </CardTitle>
                <CardDescription className="text-xs">Upload your store POS receipt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <PhotoUploadSection
                  title="Upload POS Receipt"
                  icon={Camera}
                  color="orange"
                  photos={posPhotos}
                  onPhotosChange={handlePosPhotosChange}
                  fileInputRef={posFileRef}
                />

                {posProcessing && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                    <p className="text-sm text-orange-700">Processing POS receipt...</p>
                  </div>
                )}

                {posError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-amber-700">{posError}</p>
                  </div>
                )}

                <BranchBadge data={posData} processing={posProcessing} label="POS" />

                {posData && !posProcessing && (
                  <ExtractedDataCard data={posData} onChange={handlePosDataChange} label="POS" color="orange" />
                )}

                {/* POS Category Breakdown */}
                {posData && !posProcessing && posData.categories.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Categories
                    </p>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase border-b border-gray-200">
                        <div className="col-span-5">Category</div>
                        <div className="col-span-2 text-right">QTY</div>
                        <div className="col-span-3 text-right">Sales</div>
                        <div className="col-span-2 text-right">%</div>
                      </div>
                      {posData.categories.map((cat, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 px-2 py-1.5 text-xs">
                          <div className="col-span-5 font-medium text-gray-800 truncate">{cat.name}</div>
                          <div className="col-span-2 text-right text-gray-600">{cat.qty}</div>
                          <div className="col-span-3 text-right font-medium text-gray-800">{cat.sales.toFixed(2)}</div>
                          <div className="col-span-2 text-right text-gray-500">{cat.pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ========== HOME DELIVERY SECTION ========== */}
            <Card className="border-cyan-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-5 h-5 text-cyan-500" />
                  Home Delivery
                </CardTitle>
                <CardDescription className="text-xs">Optional — upload if your branch has home delivery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <PhotoUploadSection
                  title="Upload HD Receipt"
                  icon={Truck}
                  color="cyan"
                  photos={hdPhotos}
                  onPhotosChange={handleHdPhotosChange}
                  fileInputRef={hdFileRef}
                />

                {hdProcessing && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                    <p className="text-sm text-cyan-700">Processing HD receipt...</p>
                  </div>
                )}

                {hdError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-amber-700">{hdError}</p>
                  </div>
                )}

                <BranchBadge data={hdData} processing={hdProcessing} label="HD" />

                {hdData && !hdProcessing && (
                  <ExtractedDataCard data={hdData} onChange={handleHdDataChange} label="HD" color="cyan" />
                )}
              </CardContent>
            </Card>

            {/* ========== COMBINED TOTALS ========== */}
            {posData && !posProcessing && (
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-purple-500" />
                    {hasHd ? 'Combined Totals' : 'Summary'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-white border border-purple-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Gross Sales</p>
                      <p className="text-lg font-bold text-gray-900">{totalGross.toFixed(2)}</p>
                      {hasHd && (
                        <p className="text-[10px] text-gray-400">POS {posGross.toFixed(0)} + HD {hdGross.toFixed(0)}</p>
                      )}
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white border border-purple-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Net Sales</p>
                      <p className="text-lg font-bold text-green-700">{totalNet.toFixed(2)}</p>
                      {hasHd && (
                        <p className="text-[10px] text-gray-400">POS {posNet.toFixed(0)} + HD {hdNet.toFixed(0)}</p>
                      )}
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white border border-purple-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">{hasHd ? 'GC + Orders' : 'Guest Count'}</p>
                      <p className="text-lg font-bold text-purple-700">{totalCount}</p>
                      {hasHd && (
                        <p className="text-[10px] text-gray-400">GC {posGc} + HD {hdOrders}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========== SUBMIT BUTTON ========== */}
            {posData && !posProcessing && !hdProcessing && (
              <Button
                onClick={handleSubmit}
                disabled={
                  saving ||
                  posPhotos.length === 0 ||
                  (posData && !posData.branch_match && posData.confidence !== 'none') ||
                  (hdData && !hdData.branch_match && hdData.confidence !== 'none')
                }
                className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (posData && !posData.branch_match && posData.confidence !== 'none') ||
                     (hdData && !hdData.branch_match && hdData.confidence !== 'none') ? (
                  <>
                    <ShieldAlert className="w-5 h-5 mr-2" />
                    Branch Mismatch - Cannot Submit
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label || ''} Report
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Help Info */}
        <Card className="mt-6 bg-gray-50">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>1. Select the sales window you are reporting for</p>
              <p>2. Upload POS receipt photos — system verifies branch & extracts data</p>
              <p>3. If your branch has Home Delivery, upload HD receipt too</p>
              <p>4. Review extracted data (Gross, Net, GC/Orders, Cash)</p>
              <p>5. Combined totals show POS + HD together</p>
              <p>6. Submit your report</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

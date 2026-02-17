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
  BarChart3
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
// Each window has an open/close time. Outside that range, the
// window is locked and the user cannot submit for it.
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
// To enforce: replace `isLocked` in the window selector with:
//   const isLocked = !isWindowAvailable(window.id)
// and disable the button when isLocked is true.
// ============================================================

export default function SalesPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState([])
  const [extractedData, setExtractedData] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [extractionError, setExtractionError] = useState(null)
  const [loadingWindows, setLoadingWindows] = useState(true)

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

    // Load already-submitted windows for today
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
        // Auto-select first unsubmitted window
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

  // Reset form when switching windows — each window is independent
  const handleWindowSelect = (windowId) => {
    if (submittedWindows.includes(windowId)) return
    setSelectedWindow(windowId)
    setPhotos([])
    setExtractedData(null)
    setExtractionError(null)
  }

  const readFileAsDataURL = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoCapture = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const newPhotos = []
    for (const file of files) {
      if (photos.length + newPhotos.length >= MAX_PHOTOS) break
      const preview = await readFileAsDataURL(file)
      newPhotos.push({ file, preview })
    }

    const updatedPhotos = [...photos, ...newPhotos]
    setPhotos(updatedPhotos)

    if (fileInputRef.current) fileInputRef.current.value = ''

    await extractDataFromPhotos(updatedPhotos)
  }

  const removePhoto = (index) => {
    const updated = photos.filter((_, i) => i !== index)
    setPhotos(updated)
    if (updated.length === 0) {
      setExtractedData(null)
      setExtractionError(null)
    }
  }

  const extractDataFromPhotos = async (photoList) => {
    setProcessing(true)
    setExtractionError(null)
    try {
      const result = await api.extractSalesFromPhotos(
        photoList.map(p => p.file),
        branch?.name || ''
      )
      setExtractedData({
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
      console.error('Extraction failed:', error)
      setExtractionError('Could not auto-extract. Please enter values manually.')
      if (!extractedData) {
        setExtractedData({
          branch_name: '',
          branch_match: true,
          gross_sales: '',
          net_sales: '',
          guest_count: '',
          cash_sales: '',
          categories: [],
          confidence: 'none',
        })
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleExtractedChange = (field, value) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async () => {
    if (photos.length === 0) {
      alert('Please upload at least one POS photo')
      return
    }

    if (!extractedData?.branch_match && extractedData?.confidence !== 'none') {
      alert('Branch name on receipt does not match your branch. Cannot submit.')
      return
    }

    if (!extractedData?.gross_sales && !extractedData?.net_sales) {
      alert('Please enter sales data before submitting')
      return
    }

    setSaving(true)

    try {
      const photoUrls = []
      for (const photo of photos) {
        try {
          const uploadResult = await api.uploadSalesPhoto(photo.file)
          photoUrls.push(uploadResult.url)
        } catch (error) {
          console.log('Photo upload failed, will store locally')
        }
      }

      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        gross_sales: parseFloat(extractedData.gross_sales) || 0,
        total_sales: parseFloat(extractedData.net_sales) || 0,
        transaction_count: parseInt(extractedData.guest_count) || 0,
        cash_sales: parseFloat(extractedData.cash_sales) || 0,
        category_data: extractedData.categories.length > 0
          ? JSON.stringify(extractedData.categories)
          : null,
        photo_url: photoUrls.length > 0 ? photoUrls.join(',') : null,
      }

      try {
        await api.submitSales(submitData)
      } catch (error) {
        await offlineStore.saveSalesEntry({
          ...submitData,
          photos_base64: photos.map(p => p.preview),
        })
      }

      const updatedSubmitted = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updatedSubmitted)
      setPhotos([])
      setExtractedData(null)
      setExtractionError(null)

      // Auto-advance to next unsubmitted window
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
              // For now all windows are open. To enforce time rules,
              // replace false with: !isWindowAvailable(window.id)
              const isLocked = false
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
          <div className="space-y-3">
            {/* Photo Upload */}
            <Card>
              <CardContent className="p-4">
                {photos.length === 0 ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">Upload POS Photos</p>
                      <p className="text-xs text-gray-500">Take or upload up to {MAX_PHOTOS} photos for auto-extraction</p>
                    </div>
                    <Plus className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">{photos.length} of {MAX_PHOTOS} photos</p>
                      {photos.length < MAX_PHOTOS && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add more
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={photo.preview}
                            alt={`POS ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
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
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* Processing */}
            {processing && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <div>
                    <p className="font-medium text-orange-800">Processing photos...</p>
                    <p className="text-sm text-orange-600">Verifying branch & extracting sales data</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extraction Error */}
            {extractionError && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">{extractionError}</AlertDescription>
              </Alert>
            )}

            {/* Branch Verification */}
            {extractedData && !processing && (
              extractedData.confidence === 'none' ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">OCR Not Available</p>
                    <p className="text-xs text-amber-600">Please enter sales values manually below</p>
                  </div>
                </div>
              ) : extractedData.branch_match ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Branch Verified</p>
                    <p className="text-xs text-green-600">{extractedData.branch_name || branch?.name}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Branch Mismatch!</p>
                    <p className="text-xs text-red-600">
                      Receipt: <span className="font-semibold">{extractedData.branch_name || 'Unknown'}</span>
                      {' | '}Your branch: <span className="font-semibold">{branch?.name || 'Unknown'}</span>
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Extracted Sales Data */}
            {extractedData && !processing && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-green-500" />
                    Sales Data
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    Verify and edit if needed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Gross & Net Sales */}
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
                        value={extractedData.gross_sales}
                        onChange={(e) => handleExtractedChange('gross_sales', e.target.value)}
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
                        value={extractedData.net_sales}
                        onChange={(e) => handleExtractedChange('net_sales', e.target.value)}
                        className="h-9 text-sm font-bold bg-white border-green-200"
                      />
                    </div>
                  </div>

                  {/* Guest Count & Cash Sales */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <Label className="text-xs font-semibold text-purple-800">Guest Count</Label>
                      </div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        value={extractedData.guest_count}
                        onChange={(e) => handleExtractedChange('guest_count', e.target.value)}
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
                        value={extractedData.cash_sales}
                        onChange={(e) => handleExtractedChange('cash_sales', e.target.value)}
                        className="h-9 text-sm font-bold bg-white border-amber-200"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category Sales Breakdown */}
            {extractedData && !processing && extractedData.categories.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase border-b border-gray-100">
                    <div className="col-span-5">Category</div>
                    <div className="col-span-2 text-right">QTY</div>
                    <div className="col-span-3 text-right">Sales</div>
                    <div className="col-span-2 text-right">%</div>
                  </div>
                  {/* Table Rows */}
                  {extractedData.categories.map((cat, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 gap-1 px-2 py-2 text-sm ${
                        idx < extractedData.categories.length - 1 ? 'border-b border-gray-50' : ''
                      } ${
                        cat.name.toLowerCase().includes('cup') || cat.name.toLowerCase().includes('sundae')
                          ? 'bg-orange-50/50'
                          : ''
                      }`}
                    >
                      <div className="col-span-5 font-medium text-gray-800 truncate">{cat.name}</div>
                      <div className="col-span-2 text-right text-gray-600">{cat.qty}</div>
                      <div className="col-span-3 text-right font-medium text-gray-800">{cat.sales.toFixed(2)}</div>
                      <div className="col-span-2 text-right text-gray-500">{cat.pct}%</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            {extractedData && !processing && (
              <Button
                onClick={handleSubmit}
                disabled={saving || photos.length === 0 || (!extractedData.branch_match && extractedData.confidence !== 'none')}
                className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : !extractedData.branch_match && extractedData.confidence !== 'none' ? (
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
              <p>2. Upload up to {MAX_PHOTOS} photos of your POS receipt</p>
              <p>3. System verifies branch name and extracts sales data</p>
              <p>4. Review Gross Sales, Net Sales, Guest Count, Cash Sales</p>
              <p>5. Check category breakdown (Cups & Cones, Sundaes, etc.)</p>
              <p>6. Submit your report</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  Upload,
  Clock,
  DollarSign,
  ShoppingCart,
  IceCream,
  Coffee,
  Cake,
  Save,
  Loader2,
  CheckCircle2,
  Lock,
  AlertCircle,
  Image as ImageIcon,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency, getCurrentSalesWindow, SALES_WINDOWS, isWindowOpen } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

export default function SalesPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const [user, setUser] = useState(null)
  const [currentWindow, setCurrentWindow] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())

  const [salesData, setSalesData] = useState({
    total_sales: '',
    transaction_count: '',
    kids_scoop_count: '',
    single_scoop_count: '',
    double_scoop_count: '',
    triple_scoop_count: '',
    sundae_count: '',
    shake_count: '',
    cake_count: '',
    take_home_count: '',
    notes: '',
  })

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))

    // Check current sales window
    const checkWindow = () => {
      const window = getCurrentSalesWindow()
      setCurrentWindow(window)
      if (window && !selectedWindow) {
        setSelectedWindow(window)
      }
      setCurrentTime(new Date())
    }
    checkWindow()

    // Update every minute
    const interval = setInterval(checkWindow, 60000)
    return () => clearInterval(interval)
  }, [router, selectedWindow])

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = () => {
    setPhotoPreview(null)
    setPhotoFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleInputChange = (field, value) => {
    setSalesData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!salesData.total_sales || !salesData.transaction_count) {
      alert('Please enter total sales and transaction count')
      return
    }

    if (!photoFile) {
      alert('Please take a photo of your POS screen as proof')
      return
    }

    if (!currentWindow) {
      alert('Sales submission is only allowed during designated windows')
      return
    }

    setSaving(true)

    try {
      // Upload photo first
      let photoUrl = null
      try {
        const uploadResult = await api.uploadSalesPhoto(photoFile)
        photoUrl = uploadResult.url
      } catch (error) {
        console.log('Photo upload failed, will store locally')
      }

      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: currentWindow,
        total_sales: parseFloat(salesData.total_sales),
        transaction_count: parseInt(salesData.transaction_count),
        kids_scoop_count: parseInt(salesData.kids_scoop_count) || 0,
        single_scoop_count: parseInt(salesData.single_scoop_count) || 0,
        double_scoop_count: parseInt(salesData.double_scoop_count) || 0,
        triple_scoop_count: parseInt(salesData.triple_scoop_count) || 0,
        sundae_count: parseInt(salesData.sundae_count) || 0,
        shake_count: parseInt(salesData.shake_count) || 0,
        cake_count: parseInt(salesData.cake_count) || 0,
        take_home_count: parseInt(salesData.take_home_count) || 0,
        photo_url: photoUrl,
        notes: salesData.notes,
      }

      // Try to submit to API
      try {
        await api.submitSales(submitData)
      } catch (error) {
        // Save offline
        await offlineStore.saveSalesEntry({
          ...submitData,
          photo_base64: photoPreview, // Store photo locally
        })
      }

      // Mark window as submitted
      setSubmittedWindows(prev => [...prev, currentWindow])

      // Reset form
      setSalesData({
        total_sales: '',
        transaction_count: '',
        kids_scoop_count: '',
        single_scoop_count: '',
        double_scoop_count: '',
        triple_scoop_count: '',
        sundae_count: '',
        shake_count: '',
        cake_count: '',
        take_home_count: '',
        notes: '',
      })
      setPhotoPreview(null)
      setPhotoFile(null)

      alert('Sales report submitted successfully!')

    } catch (error) {
      console.error('Error submitting sales:', error)
      alert('Failed to submit sales. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isWindowSubmitted = (windowId) => submittedWindows.includes(windowId)
  const canSubmit = currentWindow && !isWindowSubmitted(currentWindow)

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
              <h1 className="font-bold text-lg">Sales Report</h1>
              <p className="text-orange-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Time & Window Status */}
      <div className="px-4 py-4">
        <Card className={currentWindow ? 'border-green-500 bg-green-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentWindow ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {currentWindow ? (
                    <Clock className="w-6 h-6 text-white" />
                  ) : (
                    <Lock className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Time</p>
                  <p className="text-xl font-bold">
                    {currentTime.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Window Status</p>
                {currentWindow ? (
                  <span className="inline-flex items-center px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                    {currentWindow.toUpperCase()} OPEN
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-400 text-white text-sm font-medium rounded-full">
                    CLOSED
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Windows Overview */}
      <div className="px-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">Today's Windows</h2>
        <div className="grid grid-cols-4 gap-2">
          {SALES_WINDOWS.map((window) => {
            const isActive = currentWindow === window.id
            const isSubmitted = isWindowSubmitted(window.id)

            return (
              <div
                key={window.id}
                className={`p-2 rounded-lg text-center ${
                  isSubmitted
                    ? 'bg-green-100 border border-green-300'
                    : isActive
                      ? 'bg-orange-100 border border-orange-300'
                      : 'bg-gray-100 border border-gray-200'
                }`}
              >
                <p className="text-xs font-medium text-gray-600">{window.id.toUpperCase()}</p>
                {isSubmitted ? (
                  <CheckCircle2 className="w-5 h-5 mx-auto mt-1 text-green-600" />
                ) : isActive ? (
                  <span className="text-xs text-orange-600 font-medium">NOW</span>
                ) : (
                  <Lock className="w-4 h-4 mx-auto mt-1 text-gray-400" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4">
        {!currentWindow ? (
          <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Window Closed</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Sales reporting is only available during designated windows:
              <ul className="mt-2 space-y-1">
                {SALES_WINDOWS.map(w => (
                  <li key={w.id} className="flex items-center gap-2">
                    <span className="font-medium">{w.label}:</span>
                    <span>{w.time}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : isWindowSubmitted(currentWindow) ? (
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Already Submitted!</AlertTitle>
            <AlertDescription className="text-green-700">
              You have already submitted the {currentWindow.toUpperCase()} sales report.
              Wait for the next window to submit again.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-orange-500" />
                {currentWindow.toUpperCase()} Sales Report
              </CardTitle>
              <CardDescription>
                Enter your sales data and take a photo of your POS screen.
                This window closes at {SALES_WINDOWS.find(w => w.id === currentWindow)?.time.split('-')[1] || ''}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Photo Upload */}
              <div className="space-y-2">
                <Label className="text-base font-medium">POS Photo (Required)</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Take a clear photo of your POS screen showing today's sales
                </p>

                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="POS Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removePhoto}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  >
                    <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">Tap to take photo</p>
                    <p className="text-sm text-gray-400">or upload from gallery</p>
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
              </div>

              <Separator />

              {/* Sales Figures */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Sales Figures
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Sales (AED) *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={salesData.total_sales}
                      onChange={(e) => handleInputChange('total_sales', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transactions *</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.transaction_count}
                      onChange={(e) => handleInputChange('transaction_count', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Scoop Counts */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <IceCream className="w-4 h-4 text-pink-500" />
                  Scoop Counts
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kids Scoop</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.kids_scoop_count}
                      onChange={(e) => handleInputChange('kids_scoop_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Single Scoop</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.single_scoop_count}
                      onChange={(e) => handleInputChange('single_scoop_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Double Scoop</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.double_scoop_count}
                      onChange={(e) => handleInputChange('double_scoop_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Triple Scoop</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.triple_scoop_count}
                      onChange={(e) => handleInputChange('triple_scoop_count', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Other Products */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  Other Products
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sundaes</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.sundae_count}
                      onChange={(e) => handleInputChange('sundae_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shakes</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.shake_count}
                      onChange={(e) => handleInputChange('shake_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cakes</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.cake_count}
                      onChange={(e) => handleInputChange('cake_count', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Take Home</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={salesData.take_home_count}
                      onChange={(e) => handleInputChange('take_home_count', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Any additional notes..."
                  value={salesData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={saving || !photoFile}
                className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Submit {currentWindow?.toUpperCase()} Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Info */}
        <Card className="mt-6 bg-gray-50">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-2">Why take a photo?</h3>
            <p className="text-sm text-gray-600">
              The POS photo serves as verification for your sales report. This helps maintain
              accuracy and allows managers to cross-check the figures if needed.
              Make sure the photo clearly shows the sales total and transaction count.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

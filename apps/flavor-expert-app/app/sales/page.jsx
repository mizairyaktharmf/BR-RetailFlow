"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Camera,
  DollarSign,
  ShoppingCart,
  IceCream,
  Cake,
  Save,
  Loader2,
  CheckCircle2,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

export default function SalesPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const [user, setUser] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(SALES_WINDOWS[0]?.id || '3pm')
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [submittedWindows, setSubmittedWindows] = useState([])

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
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
  }, [router])

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
    if (!salesData.total_sales || !salesData.transaction_count) {
      alert('Please enter total sales and transaction count')
      return
    }

    if (!photoFile) {
      alert('Please take a photo of your POS screen as proof')
      return
    }

    setSaving(true)

    try {
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
        sales_window: selectedWindow,
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

      try {
        await api.submitSales(submitData)
      } catch (error) {
        await offlineStore.saveSalesEntry({
          ...submitData,
          photo_base64: photoPreview,
        })
      }

      setSubmittedWindows(prev => [...prev, selectedWindow])

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
        <div className="grid grid-cols-4 gap-2">
          {SALES_WINDOWS.map((window) => {
            const isSelected = selectedWindow === window.id
            const isSubmitted = submittedWindows.includes(window.id)

            return (
              <button
                key={window.id}
                onClick={() => !isSubmitted && setSelectedWindow(window.id)}
                className={`p-3 rounded-xl text-center transition-all ${
                  isSubmitted
                    ? 'bg-green-100 border-2 border-green-300'
                    : isSelected
                      ? 'bg-orange-100 border-2 border-orange-400 shadow-sm'
                      : 'bg-white border-2 border-gray-200 hover:border-orange-200'
                }`}
              >
                <p className={`text-xs font-bold ${
                  isSubmitted ? 'text-green-600' : isSelected ? 'text-orange-600' : 'text-gray-600'
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
      </div>

      {/* Main Form */}
      <div className="px-4">
        {submittedWindows.includes(selectedWindow) ? (
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Already Submitted!</AlertTitle>
            <AlertDescription className="text-green-700">
              You've submitted the {selectedWindow.toUpperCase()} report. Select another window or go back.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-orange-500" />
                {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label || 'Sales'} Report
              </CardTitle>
              <CardDescription>
                Enter your sales data and take a photo of your POS screen.
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
                    Submit {SALES_WINDOWS.find(w => w.id === selectedWindow)?.label || ''} Report
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

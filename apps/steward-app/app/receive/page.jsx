"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  Save,
  Loader2,
  Search,
  IceCream,
  Trash2,
  CheckCircle2,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

// Sample flavors data
const SAMPLE_FLAVORS = [
  { id: 1, name: 'Vanilla', code: 'VANILLA' },
  { id: 2, name: 'Chocolate', code: 'CHOCOLATE' },
  { id: 3, name: 'Strawberry', code: 'STRAWBERRY' },
  { id: 4, name: 'Pralines and Cream', code: 'PRALINES' },
  { id: 5, name: 'Mint Chocolate Chip', code: 'MINT-CHOC' },
  { id: 6, name: 'Cookies and Cream', code: 'COOKIES-CREAM' },
  { id: 7, name: 'Mango', code: 'MANGO' },
  { id: 8, name: 'Rainbow Sherbet', code: 'RAINBOW-SHERBET' },
  { id: 9, name: 'Gold Medal Ribbon', code: 'GOLD-MEDAL' },
  { id: 10, name: 'Saffron Pistachio', code: 'SAFFRON-PIST' },
]

export default function ReceivePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [flavors, setFlavors] = useState(SAMPLE_FLAVORS)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipts, setReceipts] = useState([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [todaysReceipts, setTodaysReceipts] = useState([])

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))

    // Load cached flavors
    loadFlavors()
  }, [router])

  const loadFlavors = async () => {
    try {
      const cached = await offlineStore.getCachedFlavors()
      if (cached.length > 0) {
        setFlavors(cached)
      }
    } catch (error) {
      console.log('Using default flavors')
    }
  }

  const addReceipt = (flavor) => {
    // Check if flavor already in list
    const existing = receipts.find(r => r.flavor_id === flavor.id)
    if (existing) {
      // Increment quantity
      setReceipts(prev => prev.map(r =>
        r.flavor_id === flavor.id
          ? { ...r, quantity: r.quantity + 1 }
          : r
      ))
    } else {
      // Add new
      setReceipts(prev => [...prev, {
        flavor_id: flavor.id,
        flavor_name: flavor.name,
        flavor_code: flavor.code,
        quantity: 1,
        inches_per_tub: 10,
      }])
    }
    setSearchQuery('')
  }

  const updateQuantity = (flavorId, delta) => {
    setReceipts(prev => prev.map(r => {
      if (r.flavor_id === flavorId) {
        const newQty = Math.max(0, r.quantity + delta)
        return { ...r, quantity: newQty }
      }
      return r
    }).filter(r => r.quantity > 0))
  }

  const removeReceipt = (flavorId) => {
    setReceipts(prev => prev.filter(r => r.flavor_id !== flavorId))
  }

  const getTotalTubs = () => {
    return receipts.reduce((sum, r) => sum + r.quantity, 0)
  }

  const getTotalInches = () => {
    return receipts.reduce((sum, r) => sum + (r.quantity * r.inches_per_tub), 0)
  }

  const handleSubmit = async () => {
    if (receipts.length === 0) {
      alert('Please add at least one tub to submit')
      return
    }

    setSaving(true)

    try {
      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        reference_number: referenceNumber || null,
        items: receipts.map(r => ({
          flavor_id: r.flavor_id,
          quantity: r.quantity,
          inches_per_tub: r.inches_per_tub,
        }))
      }

      // Try to submit to API
      try {
        await api.submitBulkTubReceipts(submitData)
      } catch (error) {
        // Save offline
        await offlineStore.saveTubReceipt(submitData)
      }

      // Add to today's receipts display
      setTodaysReceipts(prev => [...prev, ...receipts])

      // Clear form
      setReceipts([])
      setReferenceNumber('')

      alert('Tub receipts submitted successfully!')

    } catch (error) {
      console.error('Error submitting receipts:', error)
      alert('Failed to submit receipts. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredFlavors = flavors.filter(flavor =>
    (flavor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flavor.code.toLowerCase().includes(searchQuery.toLowerCase())) &&
    !receipts.find(r => r.flavor_id === flavor.id)
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white safe-area-top">
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
              <h1 className="font-bold text-lg">Receive from Warehouse</h1>
              <p className="text-blue-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="px-4 py-4">
        <Alert variant="info" className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Recording New Stock</AlertTitle>
          <AlertDescription className="text-blue-700">
            Record all ice cream tubs received from the warehouse today.
            Each full tub is 10 inches. Search and add flavors, then submit.
          </AlertDescription>
        </Alert>
      </div>

      {/* Main Content */}
      <div className="px-4">
        {/* Search & Add */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              Add Received Tubs
            </CardTitle>
            <CardDescription>
              Search for flavors and tap to add to your receipt list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search flavors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="mt-3 max-h-60 overflow-y-auto">
                {filteredFlavors.length > 0 ? (
                  <div className="space-y-2">
                    {filteredFlavors.slice(0, 5).map(flavor => (
                      <button
                        key={flavor.id}
                        onClick={() => addReceipt(flavor)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <IceCream className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{flavor.name}</p>
                          <p className="text-xs text-gray-500">{flavor.code}</p>
                        </div>
                        <Plus className="w-5 h-5 text-blue-500 ml-auto" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">No flavors found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt List */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Tubs to Receive
              </span>
              <span className="text-sm font-normal text-gray-500">
                {getTotalTubs()} tubs
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">No tubs added yet</p>
                <p className="text-sm text-gray-400">Search above to add flavors</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map(receipt => (
                  <div
                    key={receipt.flavor_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <IceCream className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{receipt.flavor_name}</p>
                        <p className="text-xs text-gray-500">
                          {receipt.quantity} tubs = {receipt.quantity * receipt.inches_per_tub} inches
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(receipt.flavor_id, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{receipt.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(receipt.flavor_id, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeReceipt(receipt.flavor_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Total Tubs:</span>
                    <span className="font-bold text-blue-600">{getTotalTubs()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Inches:</span>
                    <span className="font-bold text-blue-600">{getTotalInches()} inches</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reference Number */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Label>Delivery Reference Number (Optional)</Label>
            <Input
              placeholder="Enter delivery note or invoice number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={saving || receipts.length === 0}
          className="w-full h-14 text-base bg-blue-500 hover:bg-blue-600"
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
              Submit {getTotalTubs()} Tubs Received
            </>
          )}
        </Button>

        {/* Today's Receipts */}
        {todaysReceipts.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Today's Submitted Receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todaysReceipts.map((receipt, index) => (
                  <div
                    key={`${receipt.flavor_id}-${index}`}
                    className="flex items-center justify-between p-2 bg-green-50 rounded"
                  >
                    <span className="text-green-800">{receipt.flavor_name}</span>
                    <span className="text-green-600 font-medium">{receipt.quantity} tubs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Info */}
        <Card className="mt-6 bg-gray-50">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-2">Tips for Recording</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Record all tubs immediately when they arrive</li>
              <li>• One full tub = 10 inches of ice cream</li>
              <li>• Keep the delivery note for reference</li>
              <li>• Contact your manager if quantities don't match</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

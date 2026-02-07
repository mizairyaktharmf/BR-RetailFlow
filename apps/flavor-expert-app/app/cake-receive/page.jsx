"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  PackagePlus,
  Plus,
  Minus,
  Save,
  Loader2,
  Search,
  Cake,
  Trash2,
  CheckCircle2,
  Info,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'

export default function CakeReceivePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [cakeProducts, setCakeProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipts, setReceipts] = useState([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [todaysReceipts, setTodaysReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))

    // Load cake products
    loadCakeProducts()
  }, [router])

  const loadCakeProducts = async () => {
    setLoading(true)
    try {
      const data = await api.getCakeProducts()
      if (data && data.length > 0) {
        setCakeProducts(data)
      }
    } catch (error) {
      console.error('Error loading cake products:', error)
    } finally {
      setLoading(false)
    }
  }

  const addReceipt = (product) => {
    // Check if product already in list
    const existing = receipts.find(r => r.cake_product_id === product.id)
    if (existing) {
      // Increment quantity
      setReceipts(prev => prev.map(r =>
        r.cake_product_id === product.id
          ? { ...r, quantity: r.quantity + 1 }
          : r
      ))
    } else {
      // Add new
      setReceipts(prev => [...prev, {
        cake_product_id: product.id,
        cake_name: product.name,
        cake_code: product.code,
        quantity: 1,
      }])
    }
    setSearchQuery('')
  }

  const updateQuantity = (productId, delta) => {
    setReceipts(prev => prev.map(r => {
      if (r.cake_product_id === productId) {
        const newQty = Math.max(0, r.quantity + delta)
        return { ...r, quantity: newQty }
      }
      return r
    }).filter(r => r.quantity > 0))
  }

  const removeReceipt = (productId) => {
    setReceipts(prev => prev.filter(r => r.cake_product_id !== productId))
  }

  const getTotalItems = () => {
    return receipts.reduce((sum, r) => sum + r.quantity, 0)
  }

  const handleSubmit = async () => {
    if (receipts.length === 0) {
      alert('Please add at least one cake to submit')
      return
    }

    setSaving(true)

    try {
      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        reference_number: referenceNumber || null,
        items: receipts.map(r => ({
          cake_product_id: r.cake_product_id,
          quantity: r.quantity,
        }))
      }

      await api.receiveCakes(submitData)

      // Add to today's receipts display
      setTodaysReceipts(prev => [...prev, ...receipts])

      // Clear form
      setReceipts([])
      setReferenceNumber('')

      alert('Cake receipts submitted successfully!')

    } catch (error) {
      console.error('Error submitting receipts:', error)
      alert('Failed to submit receipts. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = cakeProducts.filter(product => {
    const name = (product.name || '').toLowerCase()
    const code = (product.code || '').toLowerCase()
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase())
    const notAlreadyAdded = !receipts.find(r => r.cake_product_id === product.id)
    return matchesSearch && notAlreadyAdded
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white safe-area-top">
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
              <h1 className="font-bold text-lg flex items-center gap-2">
                <PackagePlus className="w-5 h-5" />
                Receive Cakes
              </h1>
              <p className="text-green-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="px-4 py-4">
        <Alert variant="info" className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Recording Cake Delivery</AlertTitle>
          <AlertDescription className="text-blue-700">
            Record all cakes received from the warehouse today.
            Search and add cake products, set quantities, then submit.
          </AlertDescription>
        </Alert>
      </div>

      {/* Main Content */}
      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            {/* Search & Add */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-500" />
                  Add Received Cakes
                </CardTitle>
                <CardDescription>
                  Search for cake products and tap to add to your receipt list
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search cakes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Search Results */}
                {searchQuery && (
                  <div className="mt-3 max-h-60 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      <div className="space-y-2">
                        {filteredProducts.slice(0, 5).map(product => (
                          <button
                            key={product.id}
                            onClick={() => addReceipt(product)}
                            className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Cake className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.code}</p>
                            </div>
                            <Plus className="w-5 h-5 text-green-500 ml-auto" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">No cake products found</p>
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
                    <Package className="w-5 h-5 text-green-500" />
                    Cakes to Receive
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {getTotalItems()} items
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No cakes added yet</p>
                    <p className="text-sm text-gray-400">Search above to add cake products</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {receipts.map(receipt => (
                      <div
                        key={receipt.cake_product_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Cake className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{receipt.cake_name}</p>
                            <p className="text-xs text-gray-500">
                              {receipt.cake_code} - {receipt.quantity} unit{receipt.quantity > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(receipt.cake_product_id, -1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{receipt.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(receipt.cake_product_id, 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeReceipt(receipt.cake_product_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Separator className="my-4" />

                    {/* Summary */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-bold text-green-600">{getTotalItems()}</span>
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
              className="w-full h-14 text-base bg-green-500 hover:bg-green-600"
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
                  Submit {getTotalItems()} Cakes Received
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
                        key={`${receipt.cake_product_id}-${index}`}
                        className="flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="text-green-800">{receipt.cake_name}</span>
                        <span className="text-green-600 font-medium">{receipt.quantity} units</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Help Info */}
            <Card className="mt-6 bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Tips for Receiving Cakes</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>- Record all cakes immediately when they arrive</li>
                  <li>- Verify the count matches the delivery note</li>
                  <li>- Keep the delivery note for reference</li>
                  <li>- Contact your manager if quantities don't match</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

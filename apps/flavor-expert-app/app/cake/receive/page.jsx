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
  Cake,
  CheckCircle2,
  Info,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'

export default function CakeReceivePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [cakeProducts, setCakeProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [quantities, setQuantities] = useState({})
  const [referenceNumber, setReferenceNumber] = useState('')
  const [todaysReceipts, setTodaysReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))
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

  const updateQuantity = (productId, delta) => {
    setQuantities(prev => {
      const current = prev[productId] || 0
      const newQty = Math.max(0, current + delta)
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: newQty }
    })
  }

  const setDirectQuantity = (productId, value) => {
    const num = parseInt(value) || 0
    if (num <= 0) {
      setQuantities(prev => {
        const { [productId]: _, ...rest } = prev
        return rest
      })
    } else {
      setQuantities(prev => ({ ...prev, [productId]: num }))
    }
  }

  const getTotalItems = () => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0)
  }

  const getItemCount = () => {
    return Object.keys(quantities).length
  }

  const handleSubmit = async () => {
    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        cake_product_id: parseInt(productId),
        quantity: qty,
      }))

    if (items.length === 0) {
      alert('Please add quantities for at least one cake product')
      return
    }

    setSaving(true)
    try {
      await api.receiveCakes({
        branch_id: user.branch_id,
        date: new Date().toISOString().split('T')[0],
        reference_number: referenceNumber || null,
        items,
      })

      // Save to today's display
      const received = items.map(item => {
        const product = cakeProducts.find(p => p.id === item.cake_product_id)
        return { name: product?.name || 'Unknown', quantity: item.quantity }
      })
      setTodaysReceipts(prev => [...prev, ...received])

      // Clear form
      setQuantities({})
      setReferenceNumber('')
      setSuccessMessage('Cakes received and stock updated!')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (error) {
      console.error('Error submitting receipts:', error)
      alert('Failed to submit receipts. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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

      {/* Success Message */}
      {successMessage && (
        <div className="px-4 py-3">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Info */}
      <div className="px-4 py-4">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Recording Cake Delivery</AlertTitle>
          <AlertDescription className="text-blue-700">
            Enter the quantity received for each cake product from warehouse delivery.
          </AlertDescription>
        </Alert>
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : cakeProducts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Cake className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No cake products found. Ask admin to add products.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* All Cake Products */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-500" />
                    Cake Products
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {getItemCount()} selected
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cakeProducts.map(product => {
                    const qty = quantities[product.id] || 0
                    const isActive = qty > 0

                    return (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isActive ? 'bg-green-200' : 'bg-gray-200'
                          }`}>
                            <Cake className={`w-4 h-4 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                            <p className="text-[10px] text-gray-500">{product.code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            disabled={qty <= 0}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              qty > 0
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-300'
                            }`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={qty || ''}
                            placeholder="0"
                            onChange={(e) => setDirectQuantity(product.id, e.target.value)}
                            className="w-12 h-8 text-center text-sm font-medium border rounded-lg bg-white outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Reference Number */}
            {getItemCount() > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <Label className="text-sm text-gray-700">Delivery Reference (Optional)</Label>
                  <Input
                    placeholder="Delivery note or invoice number"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="mt-1"
                  />
                </CardContent>
              </Card>
            )}

            {/* Summary & Submit */}
            {getItemCount() > 0 && (
              <Card className="mb-4 bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-600">Products:</span>
                    <span className="font-medium text-green-700">{getItemCount()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Units:</span>
                    <span className="font-bold text-green-700 text-lg">{getTotalItems()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleSubmit}
              disabled={saving || getItemCount() === 0}
              className="w-full h-14 text-base bg-green-500 hover:bg-green-600"
              size="lg"
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> Submit {getTotalItems()} Cakes Received</>
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
                        key={index}
                        className="flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="text-green-800 text-sm">{receipt.name}</span>
                        <span className="text-green-600 font-medium text-sm">{receipt.quantity} units</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

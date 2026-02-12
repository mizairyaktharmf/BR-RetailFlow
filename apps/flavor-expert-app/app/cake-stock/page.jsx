"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Cake,
  Minus,
  Search,
  Loader2,
  CheckCircle2,
  Info,
  AlertTriangle,
  Package,
  ShoppingCart
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'

export default function CakeStockPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sellingItemId, setSellingItemId] = useState(null)
  const [sellQuantity, setSellQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [hasStock, setHasStock] = useState(true)

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

    // Load cake stock
    loadCakeStock(parsedUser.branch_id)
  }, [router])

  const loadCakeStock = async (branchId) => {
    setLoading(true)
    try {
      const data = await api.getCakeStock(branchId)
      if (data && data.length > 0) {
        setStock(data)
        setHasStock(true)
      } else {
        setStock([])
        setHasStock(false)
      }
    } catch (error) {
      console.error('Error loading cake stock:', error)
      setStock([])
      setHasStock(false)
    } finally {
      setLoading(false)
    }
  }

  const getQuantityColor = (quantity, threshold) => {
    if (quantity <= 0) return 'bg-red-500 text-white'
    if (quantity <= threshold) return 'bg-red-500 text-white'
    if (quantity <= threshold * 1.5) return 'bg-orange-500 text-white'
    return 'bg-green-500 text-white'
  }

  const getRowBackground = (quantity, threshold) => {
    if (quantity <= threshold) return 'bg-red-50 border border-red-200'
    return 'bg-gray-50'
  }

  const handleSellClick = (itemId) => {
    if (sellingItemId === itemId) {
      // Toggle off
      setSellingItemId(null)
      setSellQuantity(1)
    } else {
      setSellingItemId(itemId)
      setSellQuantity(1)
    }
  }

  const handleConfirmSale = async (item) => {
    if (sellQuantity <= 0 || sellQuantity > item.current_quantity) return

    setSubmitting(true)
    setSuccessMessage('')

    try {
      await api.recordCakeSale({
        branch_id: user.branch_id,
        items: [{
          cake_product_id: item.cake_product_id,
          quantity: sellQuantity,
        }]
      })

      // Optimistically update local state
      setStock(prev => prev.map(s => {
        if (s.cake_product_id === item.cake_product_id) {
          return { ...s, current_quantity: s.current_quantity - sellQuantity }
        }
        return s
      }))

      setSellingItemId(null)
      setSellQuantity(1)
      setSuccessMessage(`Sold ${sellQuantity}x ${item.cake_name || item.name} successfully!`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000)

    } catch (error) {
      console.error('Error recording sale:', error)
      alert('Failed to record sale. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredStock = stock.filter(item => {
    const name = (item.cake_name || item.name || '').toLowerCase()
    const code = (item.cake_code || item.code || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase())
  })

  const lowStockCount = stock.filter(item =>
    item.current_quantity <= (item.alert_threshold || item.default_alert_threshold || 3)
  ).length

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
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Cake className="w-5 h-5" />
                Cake Stock
              </h1>
              <p className="text-orange-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="px-4 py-3">
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Sale Recorded</AlertTitle>
            <AlertDescription className="text-green-700">
              {successMessage}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Low Stock Warning */}
      {lowStockCount > 0 && (
        <div className="px-4 pt-4">
          <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Low Stock Alert</AlertTitle>
            <AlertDescription className="text-yellow-700">
              {lowStockCount} cake product{lowStockCount > 1 ? 's are' : ' is'} running low on stock.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : !hasStock ? (
          /* No Stock - Show Init */
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cake Stock Found</h3>
              <p className="text-gray-500 mb-6">
                It looks like cake stock hasn't been initialized for your branch yet.
                Set up your initial cake inventory to get started.
              </p>
              <Button
                onClick={() => router.push('/cake-receive')}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Package className="w-4 h-4 mr-2" />
                Set Initial Stock
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Search */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search cakes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Info */}
            <div className="mb-4">
              <Alert variant="info" className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Cake Inventory</AlertTitle>
                <AlertDescription className="text-blue-700">
                  View current cake stock and record sales. Tap "Sell" to record a cake sale.
                </AlertDescription>
              </Alert>
            </div>

            {/* Stock List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cake className="w-5 h-5 text-orange-500" />
                    Current Stock
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {stock.length} products
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStock.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No cakes match your search</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredStock.map(item => {
                      const threshold = item.alert_threshold || item.default_alert_threshold || 3
                      const isExpanded = sellingItemId === item.cake_product_id

                      return (
                        <div
                          key={item.cake_product_id}
                          className={`rounded-lg overflow-hidden ${getRowBackground(item.current_quantity, threshold)}`}
                        >
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <Cake className="w-5 h-5 text-orange-500" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {item.cake_name || item.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.cake_code || item.code}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getQuantityColor(item.current_quantity, threshold)}`}>
                                {item.current_quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                onClick={() => handleSellClick(item.cake_product_id)}
                                disabled={item.current_quantity <= 0}
                              >
                                <Minus className="w-4 h-4 mr-1" />
                                Sell
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Sell Controls */}
                          {isExpanded && (
                            <div className="px-3 pb-3">
                              <Separator className="mb-3" />
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">Qty:</span>
                                <div className="flex items-center gap-2">
                                  {[1, 2, 3, 4, 5].map(qty => (
                                    <button
                                      key={qty}
                                      onClick={() => setSellQuantity(qty)}
                                      disabled={qty > item.current_quantity}
                                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                        sellQuantity === qty
                                          ? 'bg-orange-500 text-white'
                                          : qty > item.current_quantity
                                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                            : 'bg-gray-100 text-gray-700 hover:bg-orange-100'
                                      }`}
                                    >
                                      {qty}
                                    </button>
                                  ))}
                                </div>
                                <Button
                                  size="sm"
                                  className="ml-auto bg-orange-500 hover:bg-orange-600"
                                  onClick={() => handleConfirmSale(item)}
                                  disabled={submitting || sellQuantity > item.current_quantity}
                                >
                                  {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-4 h-4 mr-1" />
                                      Confirm
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help Info */}
            <Card className="mt-6 bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Stock Level Indicators</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-green-500 inline-block"></span>
                    <span>Good stock level</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-500 inline-block"></span>
                    <span>Getting low - consider reordering</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                    <span>Critical - at or below threshold</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

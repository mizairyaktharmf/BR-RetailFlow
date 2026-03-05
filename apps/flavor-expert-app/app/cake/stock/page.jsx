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
  ShoppingCart,
  Bell,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [needsInit, setNeedsInit] = useState(false)

  // Init stock state
  const [initQuantities, setInitQuantities] = useState({})
  const [initSubmitting, setInitSubmitting] = useState(false)

  // Alert settings state
  const [showAlertSettings, setShowAlertSettings] = useState(false)
  const [alertConfigs, setAlertConfigs] = useState({})
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertSaved, setAlertSaved] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    loadCakeStock(parsedUser.branch_id)
  }, [router])

  const loadCakeStock = async (branchId) => {
    setLoading(true)
    try {
      const data = await api.getCakeStock(branchId)
      if (data && data.length > 0) {
        // Check if any product has stock initialized (quantity > 0 or has been updated)
        const hasAnyStock = data.some(s => s.current_quantity > 0 || s.last_updated_at)
        setStock(data)
        setNeedsInit(!hasAnyStock)

        if (!hasAnyStock) {
          // Pre-fill init quantities with 0
          const initQty = {}
          data.forEach(item => { initQty[item.cake_product_id] = '' })
          setInitQuantities(initQty)
        }

        // Load alert configs
        loadAlertConfigs(branchId, data)
      } else {
        setStock([])
        setNeedsInit(true)
      }
    } catch (error) {
      console.error('Error loading cake stock:', error)
      setStock([])
      setNeedsInit(true)
    } finally {
      setLoading(false)
    }
  }

  const loadAlertConfigs = async (branchId, stockData) => {
    try {
      const configs = await api.getCakeAlertConfigs(branchId).catch(() => [])
      const configMap = {}
      // Default from stock data thresholds
      stockData.forEach(item => {
        configMap[item.cake_product_id] = {
          cake_product_id: item.cake_product_id,
          threshold: item.alert_threshold || 3,
          enabled: true,
        }
      })
      // Override with saved configs
      if (configs && configs.length > 0) {
        configs.forEach(c => {
          configMap[c.cake_product_id] = {
            cake_product_id: c.cake_product_id,
            threshold: c.threshold !== undefined ? c.threshold : 3,
            enabled: c.is_enabled !== undefined ? c.is_enabled : true,
          }
        })
      }
      setAlertConfigs(configMap)
    } catch (error) {
      console.error('Error loading alert configs:', error)
    }
  }

  // ---- Init Stock ----
  const handleInitSubmit = async () => {
    if (!user) return
    setInitSubmitting(true)
    try {
      const items = Object.entries(initQuantities)
        .filter(([_, qty]) => qty !== '' && parseInt(qty) >= 0)
        .map(([productId, qty]) => ({
          cake_product_id: parseInt(productId),
          quantity: parseInt(qty) || 0,
        }))

      if (items.length === 0) {
        alert('Please enter at least one quantity')
        setInitSubmitting(false)
        return
      }

      await api.initCakeStock({
        branch_id: user.branch_id,
        items,
      })

      setSuccessMessage('Initial stock saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
      setNeedsInit(false)
      loadCakeStock(user.branch_id)
    } catch (error) {
      console.error('Error initializing stock:', error)
      alert('Failed to save initial stock. Please try again.')
    } finally {
      setInitSubmitting(false)
    }
  }

  // ---- Sell ----
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
        items: [{ cake_product_id: item.cake_product_id, quantity: sellQuantity }]
      })
      setStock(prev => prev.map(s => {
        if (s.cake_product_id === item.cake_product_id) {
          return { ...s, current_quantity: s.current_quantity - sellQuantity }
        }
        return s
      }))
      setSellingItemId(null)
      setSellQuantity(1)
      setSuccessMessage(`Sold ${sellQuantity}x ${item.cake_name} successfully!`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error recording sale:', error)
      alert('Failed to record sale. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Alert Settings ----
  const handleThresholdChange = (productId, value) => {
    const numValue = value.replace(/[^0-9]/g, '')
    setAlertConfigs(prev => ({
      ...prev,
      [productId]: { ...prev[productId], threshold: numValue === '' ? '' : parseInt(numValue) }
    }))
    setAlertSaved(false)
  }

  const handleToggleAlert = (productId) => {
    setAlertConfigs(prev => ({
      ...prev,
      [productId]: { ...prev[productId], enabled: !prev[productId]?.enabled }
    }))
    setAlertSaved(false)
  }

  const handleSaveAlerts = async () => {
    setAlertSaving(true)
    try {
      const configsList = Object.values(alertConfigs).map(c => ({
        cake_product_id: c.cake_product_id,
        threshold: parseInt(c.threshold) || 3,
        is_enabled: c.enabled,
      }))
      await api.updateCakeAlertConfigBulk({
        branch_id: user.branch_id,
        configs: configsList,
      })
      setAlertSaved(true)
      setSuccessMessage('Alert settings saved!')
      setTimeout(() => { setSuccessMessage(''); setAlertSaved(false) }, 3000)
    } catch (error) {
      console.error('Error saving alerts:', error)
      alert('Failed to save alert settings.')
    } finally {
      setAlertSaving(false)
    }
  }

  const filteredStock = stock.filter(item => {
    const name = (item.cake_name || '').toLowerCase()
    const code = (item.cake_code || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase())
  })

  const lowStockCount = stock.filter(item =>
    item.current_quantity <= (item.alert_threshold || 3)
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
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : needsInit ? (
          /* ====== INITIAL STOCK SETUP ====== */
          <>
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <Package className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Initial Stock Setup</AlertTitle>
              <AlertDescription className="text-blue-700">
                Enter the current cake quantity in your store for each product.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" />
                  Set Opening Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stock.length === 0 ? (
                  <div className="text-center py-8">
                    <Cake className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No cake products found. Ask admin to add products first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stock.map(item => (
                      <div key={item.cake_product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <Cake className="w-4 h-4 text-orange-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{item.cake_name}</p>
                            <p className="text-[10px] text-gray-500">{item.cake_code}</p>
                          </div>
                        </div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="0"
                          value={initQuantities[item.cake_product_id] ?? ''}
                          onChange={(e) => setInitQuantities(prev => ({
                            ...prev,
                            [item.cake_product_id]: e.target.value
                          }))}
                          className="w-20 text-center h-9"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {stock.length > 0 && (
              <Button
                onClick={handleInitSubmit}
                disabled={initSubmitting}
                className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600 mt-4"
                size="lg"
              >
                {initSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5 mr-2" /> Save Initial Stock</>
                )}
              </Button>
            )}
          </>
        ) : (
          /* ====== STOCK VIEW ====== */
          <>
            {/* Low Stock Warning */}
            {lowStockCount > 0 && (
              <div className="mb-4">
                <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">Low Stock Alert</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                    {lowStockCount} cake product{lowStockCount > 1 ? 's are' : ' is'} running low.
                  </AlertDescription>
                </Alert>
              </div>
            )}

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
                      const threshold = item.alert_threshold || 3
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
                                <p className="font-medium text-gray-900">{item.cake_name}</p>
                                <p className="text-xs text-gray-500">{item.cake_code}</p>
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
                                    <><ShoppingCart className="w-4 h-4 mr-1" /> Confirm</>
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

            {/* ====== ALERT SETTINGS (collapsible) ====== */}
            <Card className="mt-4">
              <button
                onClick={() => setShowAlertSettings(!showAlertSettings)}
                className="w-full px-4 py-3 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 font-medium text-sm text-gray-900">
                  <Bell className="w-4 h-4 text-red-500" />
                  Alert Settings
                </span>
                {showAlertSettings
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {showAlertSettings && (
                <CardContent className="pt-0">
                  <Separator className="mb-3" />
                  <p className="text-xs text-gray-500 mb-3">
                    Set the minimum stock threshold for each cake. You'll be alerted when stock falls below.
                  </p>

                  <div className="space-y-2">
                    {stock.map(item => {
                      const config = alertConfigs[item.cake_product_id] || { threshold: 3, enabled: true }
                      return (
                        <div key={item.cake_product_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Cake className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <p className="text-sm text-gray-800 truncate">{item.cake_name}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="999"
                              placeholder="3"
                              value={config.threshold}
                              onChange={(e) => handleThresholdChange(item.cake_product_id, e.target.value)}
                              className="w-14 text-center h-8 text-sm"
                            />
                            <button
                              onClick={() => handleToggleAlert(item.cake_product_id)}
                              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                                config.enabled ? 'bg-red-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                config.enabled ? 'translate-x-5' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <Button
                    onClick={handleSaveAlerts}
                    disabled={alertSaving}
                    className="w-full mt-3 bg-red-500 hover:bg-red-600"
                    size="sm"
                  >
                    {alertSaving ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-1" /> Save Alert Settings</>
                    )}
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Stock Level Guide */}
            <Card className="mt-4 bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2 text-sm">Stock Level Indicators</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                    <span>Good stock level</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
                    <span>Getting low - consider reordering</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
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

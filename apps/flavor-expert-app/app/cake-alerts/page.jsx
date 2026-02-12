"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bell,
  Save,
  Loader2,
  Search,
  Cake,
  CheckCircle2,
  Info,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'

export default function CakeAlertsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [cakeProducts, setCakeProducts] = useState([])
  const [configs, setConfigs] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

    // Load data
    loadData(parsedUser.branch_id)
  }, [router])

  const loadData = async (branchId) => {
    setLoading(true)
    try {
      // Load cake products and alert configs in parallel
      const [productsData, configsData] = await Promise.all([
        api.getCakeProducts().catch(() => []),
        api.getCakeAlertConfigs(branchId).catch(() => []),
      ])

      if (productsData && productsData.length > 0) {
        setCakeProducts(productsData)
      }

      // Build configs map from existing data
      const configMap = {}
      if (productsData && productsData.length > 0) {
        productsData.forEach(product => {
          // Default values from product
          configMap[product.id] = {
            cake_product_id: product.id,
            threshold: product.default_alert_threshold || 3,
            enabled: true,
          }
        })
      }

      // Override with existing configs from API
      if (configsData && configsData.length > 0) {
        configsData.forEach(config => {
          configMap[config.cake_product_id] = {
            cake_product_id: config.cake_product_id,
            threshold: config.threshold !== undefined ? config.threshold : (config.alert_threshold || 3),
            enabled: config.is_enabled !== undefined ? config.is_enabled : true,
          }
        })
      }

      setConfigs(configMap)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleThresholdChange = (productId, value) => {
    const numValue = value.replace(/[^0-9]/g, '')
    setConfigs(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        threshold: numValue === '' ? '' : parseInt(numValue),
      }
    }))
    setSaved(false)
  }

  const handleToggleEnabled = (productId) => {
    setConfigs(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        enabled: !prev[productId]?.enabled,
      }
    }))
    setSaved(false)
  }

  const handleSaveAll = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const configsList = Object.values(configs).map(config => ({
        cake_product_id: config.cake_product_id,
        threshold: parseInt(config.threshold) || 3,
        is_enabled: config.enabled,
      }))

      await api.updateCakeAlertConfigBulk({
        branch_id: user.branch_id || 1,
        configs: configsList,
      })

      setSaved(true)
      alert('Alert settings saved successfully!')

    } catch (error) {
      console.error('Error saving alert configs:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = cakeProducts.filter(product => {
    const name = (product.name || '').toLowerCase()
    const code = (product.code || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase())
  })

  const enabledCount = Object.values(configs).filter(c => c.enabled).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white safe-area-top">
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
                <Bell className="w-5 h-5" />
                Alert Settings
              </h1>
              <p className="text-red-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="px-4 py-3">
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Settings Saved</AlertTitle>
            <AlertDescription className="text-green-700">
              Your alert configurations have been updated successfully.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Info Alert */}
      <div className="px-4 py-4">
        <Alert variant="info" className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Low Stock Alerts</AlertTitle>
          <AlertDescription className="text-blue-700">
            Set the minimum stock threshold for each cake product. You will be alerted
            when stock falls below the threshold. Toggle alerts on or off per product.
          </AlertDescription>
        </Alert>
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
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

            {/* Summary */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Alert Configuration</p>
                      <p className="text-sm text-gray-500">
                        {enabledCount} of {cakeProducts.length} alerts enabled
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cake className="w-5 h-5 text-red-500" />
                  Cake Products
                </CardTitle>
                <CardDescription>
                  Set threshold and enable/disable alerts for each product
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No cake products found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProducts.map(product => {
                      const config = configs[product.id] || { threshold: product.default_alert_threshold || 3, enabled: true }

                      return (
                        <div
                          key={product.id}
                          className={`p-3 rounded-lg ${
                            config.enabled ? 'bg-gray-50' : 'bg-gray-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Cake className="w-5 h-5 text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.code}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Threshold Input */}
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  placeholder="3"
                                  value={config.threshold}
                                  onChange={(e) => handleThresholdChange(product.id, e.target.value)}
                                  className="w-16 text-center h-9"
                                  min="0"
                                  max="999"
                                />
                              </div>

                              {/* Enable/Disable Toggle Button */}
                              <button
                                onClick={() => handleToggleEnabled(product.id)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  config.enabled
                                    ? 'bg-red-500'
                                    : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-full h-14 text-base bg-red-500 hover:bg-red-600"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save All Settings
                </>
              )}
            </Button>

            {/* Help Info */}
            <Card className="mt-6 bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">How Alerts Work</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>- <strong>Threshold:</strong> The minimum stock level before an alert is triggered</li>
                  <li>- <strong>Toggle:</strong> Enable or disable alerts for individual products</li>
                  <li>- When stock falls at or below the threshold, you'll see a warning on the Cake Stock page</li>
                  <li>- Set lower thresholds for slow-moving products and higher for popular ones</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  IceCream,
  Sun,
  Moon,
  Save,
  Loader2,
  Search,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

// Sample flavors data (will be fetched from API)
const SAMPLE_FLAVORS = [
  { id: 1, name: 'Vanilla', code: 'VANILLA', category: 'Classic' },
  { id: 2, name: 'Chocolate', code: 'CHOCOLATE', category: 'Classic' },
  { id: 3, name: 'Strawberry', code: 'STRAWBERRY', category: 'Classic' },
  { id: 4, name: 'Pralines and Cream', code: 'PRALINES', category: 'Classic' },
  { id: 5, name: 'Mint Chocolate Chip', code: 'MINT-CHOC', category: 'Classic' },
  { id: 6, name: 'Cookies and Cream', code: 'COOKIES-CREAM', category: 'Classic' },
  { id: 7, name: 'Mango', code: 'MANGO', category: 'Fruit' },
  { id: 8, name: 'Rainbow Sherbet', code: 'RAINBOW-SHERBET', category: 'Fruit' },
  { id: 9, name: 'Gold Medal Ribbon', code: 'GOLD-MEDAL', category: 'Premium' },
  { id: 10, name: 'Saffron Pistachio', code: 'SAFFRON-PIST', category: 'Regional' },
]

export default function InventoryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('opening')
  const [flavors, setFlavors] = useState(SAMPLE_FLAVORS)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inventory, setInventory] = useState({})
  const [openingSubmitted, setOpeningSubmitted] = useState(false)
  const [closingSubmitted, setClosingSubmitted] = useState(false)
  const [user, setUser] = useState(null)
  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(userData))

    // Initialize inventory state
    const initialInventory = {}
    SAMPLE_FLAVORS.forEach(flavor => {
      initialInventory[flavor.id] = {
        opening: '',
        closing: '',
      }
    })
    setInventory(initialInventory)

    // Fetch flavors from API or cache
    loadFlavors()
  }, [router])

  const loadFlavors = async () => {
    try {
      // Try to get from API
      const flavorsData = await api.getFlavors()
      setFlavors(flavorsData)
      await offlineStore.cacheFlavors(flavorsData)
    } catch (error) {
      // Fall back to cached data
      const cached = await offlineStore.getCachedFlavors()
      if (cached.length > 0) {
        setFlavors(cached)
      }
    }
  }

  const handleInchesChange = (flavorId, type, value) => {
    // Only allow numbers and decimal point, max 10 inches
    const numValue = value.replace(/[^0-9.]/g, '')
    if (parseFloat(numValue) > 10) return

    setInventory(prev => ({
      ...prev,
      [flavorId]: {
        ...prev[flavorId],
        [type]: numValue,
      }
    }))
  }

  const handleSubmit = async (type) => {
    setSaving(true)

    try {
      // Prepare data
      const items = Object.entries(inventory)
        .filter(([_, data]) => data[type] !== '')
        .map(([flavorId, data]) => ({
          flavor_id: parseInt(flavorId),
          inches: parseFloat(data[type]),
        }))

      if (items.length === 0) {
        alert('Please enter at least one inventory value')
        setSaving(false)
        return
      }

      const submitData = {
        branch_id: user.branch_id || 1, // TODO: Get from user
        date: todayDate,
        entry_type: type,
        items,
      }

      // Try to submit to API
      try {
        if (type === 'opening') {
          await api.submitOpeningInventory(submitData)
        } else {
          await api.submitClosingInventory(submitData)
        }
      } catch (error) {
        // Save offline if API fails
        await offlineStore.saveInventoryEntry(submitData)
      }

      // Update UI
      if (type === 'opening') {
        setOpeningSubmitted(true)
      } else {
        setClosingSubmitted(true)
      }

      // Show success message
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} inventory submitted successfully!`)

    } catch (error) {
      console.error('Error submitting inventory:', error)
      alert('Failed to submit inventory. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredFlavors = flavors.filter(flavor =>
    flavor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flavor.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group flavors by category
  const groupedFlavors = filteredFlavors.reduce((acc, flavor) => {
    const category = flavor.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(flavor)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white safe-area-top">
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
              <h1 className="font-bold text-lg">Ice Cream Inventory</h1>
              <p className="text-pink-100 text-sm">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="px-4 py-4">
        <Alert variant="info" className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">How to Measure</AlertTitle>
          <AlertDescription className="text-blue-700">
            Measure the remaining ice cream in each tub using inches.
            A full tub is 10 inches. Enter the current level for each flavor.
          </AlertDescription>
        </Alert>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="opening" className="gap-2 data-[state=active]:bg-amber-100">
              <Sun className="w-4 h-4" />
              Opening
              {openingSubmitted && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </TabsTrigger>
            <TabsTrigger value="closing" className="gap-2 data-[state=active]:bg-indigo-100">
              <Moon className="w-4 h-4" />
              Closing
              {closingSubmitted && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search flavors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Opening Tab */}
          <TabsContent value="opening" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  Opening Inventory
                </CardTitle>
                <CardDescription>
                  Enter the ice cream levels at the start of your shift.
                  This should match yesterday's closing (carried forward automatically if available).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {openingSubmitted ? (
                  <Alert variant="success" className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Opening Submitted!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Your opening inventory has been recorded. You can now receive new stock
                      or wait until closing time.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedFlavors).map(([category, categoryFlavors]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-500 mb-3">{category}</h3>
                        <div className="space-y-3">
                          {categoryFlavors.map(flavor => (
                            <div
                              key={flavor.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                                  <IceCream className="w-5 h-5 text-pink-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{flavor.name}</p>
                                  <p className="text-xs text-gray-500">{flavor.code}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={inventory[flavor.id]?.opening || ''}
                                  onChange={(e) => handleInchesChange(flavor.id, 'opening', e.target.value)}
                                  className="w-20 text-center"
                                  max="10"
                                  step="0.5"
                                />
                                <span className="text-sm text-gray-500 w-8">in</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Separator />

                    <Button
                      onClick={() => handleSubmit('opening')}
                      disabled={saving}
                      className="w-full h-12"
                      size="lg"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Submit Opening Inventory
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Closing Tab */}
          <TabsContent value="closing" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Moon className="w-5 h-5 text-indigo-500" />
                  Closing Inventory
                </CardTitle>
                <CardDescription>
                  Enter the ice cream levels at the end of your shift.
                  The system will calculate how much was consumed today.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {closingSubmitted ? (
                  <Alert variant="success" className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Closing Submitted!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Your closing inventory has been recorded. Tomorrow's opening will
                      automatically start with these values.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {!openingSubmitted && (
                      <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800">Opening Not Submitted</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                          Please submit opening inventory first to accurately track consumption.
                        </AlertDescription>
                      </Alert>
                    )}

                    {Object.entries(groupedFlavors).map(([category, categoryFlavors]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-500 mb-3">{category}</h3>
                        <div className="space-y-3">
                          {categoryFlavors.map(flavor => (
                            <div
                              key={flavor.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <IceCream className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{flavor.name}</p>
                                  <p className="text-xs text-gray-500">{flavor.code}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={inventory[flavor.id]?.closing || ''}
                                  onChange={(e) => handleInchesChange(flavor.id, 'closing', e.target.value)}
                                  className="w-20 text-center"
                                  max="10"
                                  step="0.5"
                                />
                                <span className="text-sm text-gray-500 w-8">in</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Separator />

                    <Button
                      onClick={() => handleSubmit('closing')}
                      disabled={saving}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700"
                      size="lg"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Submit Closing Inventory
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

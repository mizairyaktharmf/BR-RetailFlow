"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  IceCream,
  Save,
  Loader2,
  Search,
  CheckCircle2,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import api from '@/services/api'
import offlineStore from '@/store/offline-store'

// Standard Baskin Robbins flavors (will be fetched from API later)
const SAMPLE_FLAVORS = [
  { id: 1, name: 'Blackberry Caramel', code: 'BCAR' },
  { id: 2, name: 'Cup of Cocoa', code: 'COC' },
  { id: 3, name: 'Love Potion 31™', code: 'LP31' },
  { id: 4, name: 'Citrus Twist Ice', code: 'CTI' },
  { id: 5, name: 'It Takes Two to Mango', code: 'ITTM' },
  { id: 6, name: 'World Class™ Chocolate', code: 'WCC' },
  { id: 7, name: 'Golden Toffee Chocolate Chunk', code: 'GTCC' },
  { id: 8, name: 'Summer Seal Salt', code: 'SSS' },
  { id: 9, name: 'Summer Sunset', code: 'SSUN' },
  { id: 10, name: 'Mint Chocolate Chip', code: 'MCC' },
  { id: 11, name: 'Vanilla', code: 'VAN' },
  { id: 12, name: 'Very Berry Strawberry', code: 'VBS' },
  { id: 13, name: 'Strawberry Cheesecake', code: 'SC' },
  { id: 14, name: 'Cotton Candy', code: 'CCAN' },
  { id: 15, name: 'Cookies and Cream', code: 'CAC' },
  { id: 16, name: 'Chocolate Chip', code: 'CC' },
  { id: 17, name: 'Chocolate Chip NSA', code: 'CC-NSA' },
  { id: 18, name: 'Caramel Turtle Truffle NSA', code: 'CTT-NSA' },
  { id: 19, name: 'Chocolate Cookie Crackle', code: 'CCC' },
  { id: 20, name: 'Gold Medal Ribbon', code: 'GMR' },
  { id: 21, name: 'Jamoca Almond Fudge', code: 'JAF' },
  { id: 22, name: 'Chocolate', code: 'CHOC' },
  { id: 23, name: 'Pralines and Cream', code: 'PAC' },
  { id: 24, name: 'Rainbow Sherbet', code: 'RS' },
  { id: 25, name: 'Tiramisu Cold Brew', code: 'TCB' },
  { id: 26, name: 'Pistachio Almond', code: 'PA' },
  { id: 27, name: 'Peanut Butter and Chocolate', code: 'PBC' },
  { id: 28, name: 'Chocolate Chip Cookie Dough', code: 'CCCD' },
  { id: 29, name: 'Mango Passion Fruit', code: 'MPF' },
  { id: 30, name: 'Caramel Churro Espresso', code: 'CCE' },
  { id: 31, name: 'Blueberry Crumble', code: 'BC' },
]

export default function InventoryPage() {
  const router = useRouter()
  const [flavors, setFlavors] = useState(SAMPLE_FLAVORS)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [inventory, setInventory] = useState({})
  const [submitted, setSubmitted] = useState(false)
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
      initialInventory[flavor.id] = ''
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

  const handleInchesChange = (flavorId, value) => {
    // Only allow numbers and decimal point, max 10 inches
    const numValue = value.replace(/[^0-9.]/g, '')
    if (parseFloat(numValue) > 10) return

    setInventory(prev => ({
      ...prev,
      [flavorId]: numValue,
    }))
  }

  const handleSubmit = async () => {
    setSaving(true)

    try {
      // Prepare data
      const items = Object.entries(inventory)
        .filter(([_, value]) => value !== '')
        .map(([flavorId, value]) => ({
          flavor_id: parseInt(flavorId),
          inches: parseFloat(value),
        }))

      if (items.length === 0) {
        alert('Please enter at least one inventory value')
        setSaving(false)
        return
      }

      const submitData = {
        branch_id: user.branch_id || 1,
        date: todayDate,
        entry_type: 'closing',
        items,
      }

      // Try to submit to API
      try {
        await api.submitClosingInventory(submitData)
      } catch (error) {
        // Save offline if API fails
        await offlineStore.saveInventoryEntry(submitData)
      }

      setSubmitted(true)
      alert('Inventory submitted successfully!')

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
              <h1 className="font-bold text-lg">Closing Inventory</h1>
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

      {/* Content */}
      <div className="px-4">
        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search flavors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <IceCream className="w-5 h-5 text-pink-500" />
              Ice Cream Inventory
            </CardTitle>
            <CardDescription>
              Enter the ice cream levels at the end of your shift.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <Alert variant="success" className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Inventory Submitted!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Your closing inventory has been recorded successfully.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {filteredFlavors.map(flavor => (
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
                        value={inventory[flavor.id] || ''}
                        onChange={(e) => handleInchesChange(flavor.id, e.target.value)}
                        className="w-20 text-center"
                        max="10"
                        step="0.5"
                      />
                      <span className="text-sm text-gray-500 w-8">in</span>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full h-12 bg-pink-600 hover:bg-pink-700"
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
                      Submit Inventory
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  DollarSign,
  Users,
  Cake,
  IceCream,
  TrendingDown,
  Package,
  Truck,
  Store,
  Percent
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { formatDate, SALES_WINDOWS } from '@/lib/utils'
import api from '@/services/api'

// ============================================================
// SALES WINDOW TIME RULES (commented out — enable when ready)
//
// const WINDOW_TIME_RULES = {
//   '3pm':     { openHour: 15, closeHour: 19 },
//   '7pm':     { openHour: 19, closeHour: 21 },
//   '9pm':     { openHour: 21, closeHour: 22 },
//   'closing': { openHour: 22, closeHour: 6 },
// }
//
// function isWindowAvailable(windowId) {
//   const rule = WINDOW_TIME_RULES[windowId]
//   if (!rule) return false
//   const hour = new Date().getHours()
//   if (rule.openHour < rule.closeHour) {
//     return hour >= rule.openHour && hour < rule.closeHour
//   } else {
//     return hour >= rule.openHour || hour < rule.closeHour
//   }
// }
//
// To enable: uncomment above, then change isLocked to:
//   const isLocked = !isWindowAvailable(window.id)
// ============================================================

export default function SalesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branch, setBranch] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submittedWindows, setSubmittedWindows] = useState([])
  const [loadingWindows, setLoadingWindows] = useState(true)

  // POS fields
  const [netSale, setNetSale] = useState('')
  const [lySale, setLySale] = useState('')
  const [tyGc, setTyGc] = useState('')
  const [cakeUnits, setCakeUnits] = useState('')
  const [handPackUnits, setHandPackUnits] = useState('')
  const [sundaePct, setSundaePct] = useState('')
  const [cupsConesPct, setCupsConesPct] = useState('')

  // HD fields (optional)
  const [showHd, setShowHd] = useState(false)
  const [hdNetSales, setHdNetSales] = useState('')
  const [hdGrossSales, setHdGrossSales] = useState('')
  const [hdOrders, setHdOrders] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

    const branchData = localStorage.getItem('br_branch')
    if (branchData) setBranch(JSON.parse(branchData))

    loadSubmittedWindows()
  }, [router])

  const loadSubmittedWindows = async () => {
    setLoadingWindows(true)
    try {
      const branchData = localStorage.getItem('br_branch')
      const branchInfo = branchData ? JSON.parse(branchData) : null
      if (branchInfo?.id) {
        const today = new Date().toISOString().split('T')[0]
        const sales = await api.getDailySales(branchInfo.id, today)
        const submitted = Array.isArray(sales) ? sales.map(s => s.sales_window) : []
        setSubmittedWindows(submitted)
        const firstOpen = SALES_WINDOWS.find(w => !submitted.includes(w.id))
        setSelectedWindow(firstOpen?.id || SALES_WINDOWS[0]?.id || '3pm')
      } else {
        setSelectedWindow(SALES_WINDOWS[0]?.id || '3pm')
      }
    } catch {
      setSelectedWindow(SALES_WINDOWS[0]?.id || '3pm')
    } finally {
      setLoadingWindows(false)
    }
  }

  const handleWindowSelect = (windowId) => {
    if (submittedWindows.includes(windowId)) return
    setSelectedWindow(windowId)
    resetForm()
  }

  const resetForm = () => {
    setNetSale('')
    setLySale('')
    setTyGc('')
    setCakeUnits('')
    setHandPackUnits('')
    setSundaePct('')
    setCupsConesPct('')
    setShowHd(false)
    setHdNetSales('')
    setHdGrossSales('')
    setHdOrders('')
  }

  const handleSubmit = async () => {
    if (!netSale || parseFloat(netSale) <= 0) {
      alert('Please enter Net Sale amount')
      return
    }

    setSaving(true)

    try {
      const submitData = {
        branch_id: user.branch_id || 1,
        date: new Date().toISOString().split('T')[0],
        sales_window: selectedWindow,
        total_sales: parseFloat(netSale) || 0,
        transaction_count: parseInt(tyGc) || 0,
        ly_sale: parseFloat(lySale) || 0,
        cake_units: parseInt(cakeUnits) || 0,
        hand_pack_units: parseInt(handPackUnits) || 0,
        sundae_pct: parseFloat(sundaePct) || 0,
        cups_cones_pct: parseFloat(cupsConesPct) || 0,
        // HD data (optional)
        hd_net_sales: showHd ? (parseFloat(hdNetSales) || 0) : 0,
        hd_gross_sales: showHd ? (parseFloat(hdGrossSales) || 0) : 0,
        hd_orders: showHd ? (parseInt(hdOrders) || 0) : 0,
      }

      await api.submitSales(submitData)

      const updatedSubmitted = [...submittedWindows, selectedWindow]
      setSubmittedWindows(updatedSubmitted)
      resetForm()

      const nextWindow = SALES_WINDOWS.find(w => !updatedSubmitted.includes(w.id))
      if (nextWindow) {
        setSelectedWindow(nextWindow.id)
        alert(`${SALES_WINDOWS.find(w => w.id === selectedWindow)?.label} submitted! Moving to ${nextWindow.label}.`)
      } else {
        alert('All sales windows submitted for today!')
      }
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
              <p className="text-orange-100 text-sm">{branch?.name || 'My Branch'} &middot; {formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Window Selector */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">Select Window</h2>
        {loadingWindows ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {SALES_WINDOWS.map((window) => {
              const isSelected = selectedWindow === window.id
              const isSubmitted = submittedWindows.includes(window.id)
              const isLocked = false // change to !isWindowAvailable(window.id) to enable time rules
              return (
                <button
                  key={window.id}
                  onClick={() => handleWindowSelect(window.id)}
                  disabled={isSubmitted || isLocked}
                  className={`p-3 rounded-xl text-center transition-all ${
                    isSubmitted
                      ? 'bg-green-100 border-2 border-green-300 opacity-80'
                      : isLocked
                        ? 'bg-gray-100 border-2 border-gray-200 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-orange-100 border-2 border-orange-400 shadow-sm'
                          : 'bg-white border-2 border-gray-200 hover:border-orange-200'
                  }`}
                >
                  <p className={`text-xs font-bold ${
                    isSubmitted ? 'text-green-600' : isLocked ? 'text-gray-400' : isSelected ? 'text-orange-600' : 'text-gray-600'
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
        )}
      </div>

      {/* Main Form */}
      <div className="px-4">
        {!selectedWindow || loadingWindows ? null : submittedWindows.includes(selectedWindow) ? (
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Already Submitted!</AlertTitle>
            <AlertDescription className="text-green-700">
              You've submitted the {selectedWindow.toUpperCase()} report. Select another window or go back.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">

            {/* ========== POS SECTION ========== */}
            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-500" />
                  POS Sales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Net Sale & LY Sale */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-green-600" />
                      <Label className="text-xs font-semibold text-green-800">NET SALE *</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={netSale}
                      onChange={(e) => setNetSale(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-green-200"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-gray-500" />
                      <Label className="text-xs font-semibold text-gray-600">LY SALE</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={lySale}
                      onChange={(e) => setLySale(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-gray-200"
                    />
                  </div>
                </div>

                {/* TY GC */}
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <Label className="text-xs font-semibold text-purple-800">TY GC (Guest Count)</Label>
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={tyGc}
                    onChange={(e) => setTyGc(e.target.value)}
                    className="h-10 text-sm font-bold bg-white border-purple-200"
                  />
                </div>

                {/* Cake Units & Hand Pack Units */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-pink-50 border border-pink-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Cake className="w-3.5 h-3.5 text-pink-600" />
                      <Label className="text-xs font-semibold text-pink-800">CAKE UNITS</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={cakeUnits}
                      onChange={(e) => setCakeUnits(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-pink-200"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <Label className="text-xs font-semibold text-indigo-800">HAND PACK UNITS</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={handPackUnits}
                      onChange={(e) => setHandPackUnits(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-indigo-200"
                    />
                  </div>
                </div>

                {/* Sundae % & Cups & Cones % */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-600" />
                      <Label className="text-xs font-semibold text-amber-800">SUNDAE %</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={sundaePct}
                      onChange={(e) => setSundaePct(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-amber-200"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <IceCream className="w-3.5 h-3.5 text-blue-600" />
                      <Label className="text-xs font-semibold text-blue-800">CUPS & CONES %</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={cupsConesPct}
                      onChange={(e) => setCupsConesPct(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-blue-200"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ========== HOME DELIVERY SECTION (Optional) ========== */}
            {!showHd ? (
              <button
                onClick={() => setShowHd(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-cyan-300 hover:border-cyan-400 hover:bg-cyan-50 transition-colors"
              >
                <Truck className="w-5 h-5 text-cyan-500" />
                <span className="text-sm font-medium text-cyan-700">+ Add Home Delivery (Optional)</span>
              </button>
            ) : (
              <Card className="border-cyan-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Truck className="w-5 h-5 text-cyan-500" />
                      Home Delivery
                    </CardTitle>
                    <button
                      onClick={() => { setShowHd(false); setHdNetSales(''); setHdGrossSales(''); setHdOrders('') }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  <CardDescription className="text-xs">Optional — for branches with home delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-green-600" />
                        <Label className="text-xs font-semibold text-green-800">Net Sales</Label>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={hdNetSales}
                        onChange={(e) => setHdNetSales(e.target.value)}
                        className="h-10 text-sm font-bold bg-white border-green-200"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                        <Label className="text-xs font-semibold text-blue-800">Gross Sales</Label>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={hdGrossSales}
                        onChange={(e) => setHdGrossSales(e.target.value)}
                        className="h-10 text-sm font-bold bg-white border-blue-200"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      <Label className="text-xs font-semibold text-purple-800">Orders / GC</Label>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={hdOrders}
                      onChange={(e) => setHdOrders(e.target.value)}
                      className="h-10 text-sm font-bold bg-white border-purple-200"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========== SUBMIT BUTTON ========== */}
            <Button
              onClick={handleSubmit}
              disabled={saving || !netSale || parseFloat(netSale) <= 0}
              className="w-full h-14 text-base bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
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
          </div>
        )}
      </div>
    </div>
  )
}

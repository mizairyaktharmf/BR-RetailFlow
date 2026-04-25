"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  Loader2,
  Tag,
  Search,
  Package,
  Layers,
  Type,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react'
import api from '@/services/api'

export default function PromotionsPage() {
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [trackedItems, setTrackedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [activeTab, setActiveTab] = useState('items') // 'items' or 'roi'
  const [roiData, setRoiData] = useState([])
  const [roiLoading, setRoiLoading] = useState(false)

  // Form fields
  const [trackMode, setTrackMode] = useState('name') // 'name', 'item', or 'category'
  const [itemCode, setItemCode] = useState('')
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [trackName, setTrackName] = useState('')
  const [addingAll, setAddingAll] = useState(false)

  // ROI filters
  const [roiPeriod, setRoiPeriod] = useState('this-month')

  useEffect(() => {
    const userData = localStorage.getItem('admin_user')
    if (userData) {
      const u = JSON.parse(userData)
      setUser(u)
    }
    loadBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch) {
      loadTrackedItems()
      if (activeTab === 'roi') loadROI()
    }
  }, [selectedBranch, activeTab, roiPeriod])

  const loadBranches = async () => {
    try {
      const data = await api.getBranches()
      setBranches(Array.isArray(data) ? data : [])
      if (data.length > 0) setSelectedBranch(data[0])
    } catch (err) {
      console.error('Failed to load branches:', err)
    }
  }

  const loadTrackedItems = async () => {
    if (!selectedBranch) return
    setLoading(true)
    try {
      const data = await api.getTrackedItems(selectedBranch.id)
      setTrackedItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load tracked items:', err)
      setTrackedItems([])
    } finally {
      setLoading(false)
    }
  }

  const getROIDateRange = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const formatDate = (d) => d.toISOString().split('T')[0]

    switch (roiPeriod) {
      case 'this-month':
        return { from: formatDate(firstDay), to: formatDate(today) }
      case 'last-month':
        const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0)
        return { from: formatDate(prevMonthFirst), to: formatDate(prevMonthLast) }
      case 'last-7':
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)
        return { from: formatDate(sevenDaysAgo), to: formatDate(today) }
      default:
        return { from: formatDate(firstDay), to: formatDate(today) }
    }
  }

  const loadROI = async () => {
    if (!selectedBranch) return
    setRoiLoading(true)
    try {
      const { from, to } = getROIDateRange()
      const data = await api.getPromotionROI(from, to, selectedBranch.id)
      setRoiData(data.items || [])
    } catch (err) {
      console.error('Failed to load ROI data:', err)
      setRoiData([])
    } finally {
      setRoiLoading(false)
    }
  }

  const getPayload = () => {
    if (trackMode === 'name') {
      if (!trackName.trim()) return null
      return {
        item_code: `NAME:${trackName.trim()}`,
        item_name: trackName.trim(),
        category: null,
      }
    }
    if (trackMode === 'category') {
      if (!categoryName.trim()) return null
      return {
        item_code: `CAT:${categoryName.trim()}`,
        item_name: categoryName.trim(),
        category: categoryName.trim(),
      }
    }
    // item mode
    if (!itemCode.trim() || !itemName.trim()) return null
    return {
      item_code: itemCode.trim(),
      item_name: itemName.trim(),
      category: category.trim() || null,
    }
  }

  const clearForm = () => {
    setTrackName('')
    setItemCode('')
    setItemName('')
    setCategory('')
    setCategoryName('')
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!selectedBranch) return
    const payload = getPayload()
    if (!payload) return
    setAdding(true)
    try {
      await api.addTrackedItem({ branch_id: selectedBranch.id, ...payload })
      clearForm()
      loadTrackedItems()
    } catch (err) {
      alert(err.message || 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (item) => {
    if (!confirm(`Stop tracking "${item.item_name}"?`)) return
    try {
      await api.removeTrackedItem(item.id)
      loadTrackedItems()
    } catch (err) {
      alert(err.message || 'Failed to remove item')
    }
  }

  const handleAddToAll = async () => {
    const payload = getPayload()
    if (!payload) return
    if (!confirm(`Add "${payload.item_name}" to ALL ${branches.length} branches?`)) return
    setAddingAll(true)
    let added = 0
    let skipped = 0
    for (const branch of branches) {
      try {
        await api.addTrackedItem({ branch_id: branch.id, ...payload })
        added++
      } catch {
        skipped++
      }
    }
    clearForm()
    setAddingAll(false)
    loadTrackedItems()
    alert(`Added to ${added} branches${skipped > 0 ? ` (${skipped} already had it)` : ''}`)
  }

  const isFormValid = () => {
    if (trackMode === 'name') return trackName.trim().length > 0
    if (trackMode === 'category') return categoryName.trim().length > 0
    return itemCode.trim().length > 0 && itemName.trim().length > 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Tag className="w-6 h-6 text-purple-400" />
          Promotion Item Tracker
        </h1>
        <p className="text-gray-400 mt-1">
          Track POS items by name, code, or category. Tracked items are highlighted in sales reports.
        </p>
      </div>

      {/* Branch Selector */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400 uppercase tracking-wider">Select Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedBranch?.id === b.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {selectedBranch && (
        <div className="flex gap-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Tracked Items
          </button>
          <button
            onClick={() => setActiveTab('roi')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'roi'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            ROI Analytics
          </button>
        </div>
      )}

      {selectedBranch && activeTab === 'items' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Form */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-400" />
                Add Promotion Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mode Toggle — 3 options */}
              <div className="flex rounded-lg bg-gray-700 p-0.5 mb-4">
                <button
                  type="button"
                  onClick={() => setTrackMode('name')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                    trackMode === 'name' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Type className="w-3 h-3" />
                  By Name
                </button>
                <button
                  type="button"
                  onClick={() => setTrackMode('item')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                    trackMode === 'item' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  By Code
                </button>
                <button
                  type="button"
                  onClick={() => setTrackMode('category')}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                    trackMode === 'category' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Category
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                {trackMode === 'name' ? (
                  <div>
                    <Label className="text-gray-400 text-xs">Product Name *</Label>
                    <Input
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                      placeholder="e.g. Umm Ali"
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      Matches ALL sizes/variants — Sgl, Val, Dbl, Kids, etc. Just type the base product name.
                    </p>
                  </div>
                ) : trackMode === 'item' ? (
                  <>
                    <div>
                      <Label className="text-gray-400 text-xs">Item Code *</Label>
                      <Input
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        placeholder="e.g. 1142"
                        className="bg-gray-700 border-gray-600 text-white mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Item Name *</Label>
                      <Input
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="e.g. Chc Pnt Bliss Sgl"
                        className="bg-gray-700 border-gray-600 text-white mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Category (optional)</Label>
                      <Input
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. Cups & Cones"
                        className="bg-gray-700 border-gray-600 text-white mt-1"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label className="text-gray-400 text-xs">Category Name *</Label>
                    <Input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Desserts"
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      Tracks ALL items in this POS category. Shows combined QTY, AUV, IR.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={adding || addingAll || !isFormValid()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {adding ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Add to {selectedBranch.name}</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleAddToAll}
                  disabled={adding || addingAll || !isFormValid()}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white"
                >
                  {addingAll ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding to all...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Add to All Branches</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tracked Items List */}
          <Card className="bg-gray-800/50 border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-400" />
                  Tracked Items — {selectedBranch.name}
                </span>
                <span className="text-xs text-gray-500 font-normal">{trackedItems.length} items</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : trackedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No promotion items tracked yet</p>
                  <p className="text-xs mt-1">Add items using the form to start tracking</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trackedItems.map((item) => {
                    const isCategory = item.item_code?.startsWith('CAT:')
                    const isName = item.item_code?.startsWith('NAME:')
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isCategory
                            ? 'bg-orange-900/20 border-orange-800/40 hover:border-orange-500/50'
                            : isName
                              ? 'bg-green-900/20 border-green-800/40 hover:border-green-500/50'
                              : 'bg-gray-700/50 border-gray-600 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isCategory ? (
                            <span className="text-xs font-medium text-orange-400 bg-orange-900/30 px-2 py-1 rounded flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              Category
                            </span>
                          ) : isName ? (
                            <span className="text-xs font-medium text-green-400 bg-green-900/30 px-2 py-1 rounded flex items-center gap-1">
                              <Type className="w-3 h-3" />
                              Name
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                              {item.item_code}
                            </span>
                          )}
                          <div>
                            <p className="text-sm text-white font-medium">{item.item_name}</p>
                            {isCategory && (
                              <p className="text-[10px] text-orange-400/60">All items in this category</p>
                            )}
                            {isName && (
                              <p className="text-[10px] text-green-400/60">All sizes &amp; variants</p>
                            )}
                            {!isCategory && !isName && item.category && (
                              <p className="text-xs text-gray-500">{item.category}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(item)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Stop tracking"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ROI Analytics Tab */}
      {selectedBranch && activeTab === 'roi' && (
        <div className="space-y-4">
          {/* Period Filter */}
          <div className="flex gap-2">
            <select
              value={roiPeriod}
              onChange={(e) => setRoiPeriod(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-7">Last 7 Days</option>
            </select>
          </div>

          {/* ROI Table */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Performance Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              ) : roiData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No promotion data available</p>
                  <p className="text-xs mt-1">Add tracked items to see ROI analytics</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Item / Category</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Period QTY</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Baseline QTY</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Change</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Period Sales</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">ROI %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roiData.map((item) => (
                        <tr key={item.tracked_item_id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {item.type === 'name' && (
                                <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                                  <Type className="w-3 h-3" />
                                  Name
                                </span>
                              )}
                              {item.type === 'category' && (
                                <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  Category
                                </span>
                              )}
                              {item.type === 'code' && (
                                <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-1 rounded font-mono">
                                  {item.name}
                                </span>
                              )}
                              {(item.type === 'name' || item.type === 'category') && (
                                <span className="text-white">{item.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 text-white font-medium">{item.qty}</td>
                          <td className="text-right py-3 px-4 text-gray-400">{item.baseline_qty}</td>
                          <td className={`text-right py-3 px-4 font-medium flex items-center justify-end gap-1 ${
                            item.qty_change_pct > 0 ? 'text-green-400' : item.qty_change_pct < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {item.qty_change_pct > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : item.qty_change_pct < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {Math.abs(item.qty_change_pct).toFixed(1)}%
                          </td>
                          <td className="text-right py-3 px-4 text-white font-medium">{item.sales.toLocaleString()} AED</td>
                          <td className={`text-right py-3 px-4 font-bold flex items-center justify-end gap-1 ${
                            item.sales_change_pct > 0 ? 'text-green-400' : item.sales_change_pct < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {item.sales_change_pct > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : item.sales_change_pct < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {Math.abs(item.sales_change_pct).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

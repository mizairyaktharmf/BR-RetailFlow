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
} from 'lucide-react'
import api from '@/services/api'

export default function PromotionsPage() {
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [trackedItems, setTrackedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  // Form fields
  const [trackMode, setTrackMode] = useState('item') // 'item' or 'category'
  const [itemCode, setItemCode] = useState('')
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [categoryName, setCategoryName] = useState('') // for category tracking
  const [addingAll, setAddingAll] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('admin_user')
    if (userData) {
      const u = JSON.parse(userData)
      setUser(u)
    }
    loadBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch) loadTrackedItems()
  }, [selectedBranch])

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

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!selectedBranch) return
    if (trackMode === 'item' && (!itemCode.trim() || !itemName.trim())) return
    if (trackMode === 'category' && !categoryName.trim()) return
    setAdding(true)
    try {
      if (trackMode === 'category') {
        await api.addTrackedItem({
          branch_id: selectedBranch.id,
          item_code: `CAT:${categoryName.trim()}`,
          item_name: categoryName.trim(),
          category: categoryName.trim(),
        })
        setCategoryName('')
      } else {
        await api.addTrackedItem({
          branch_id: selectedBranch.id,
          item_code: itemCode.trim(),
          item_name: itemName.trim(),
          category: category.trim() || null,
        })
        setItemCode('')
        setItemName('')
        setCategory('')
      }
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
    const isCategory = trackMode === 'category'
    if (isCategory && !categoryName.trim()) return
    if (!isCategory && (!itemCode.trim() || !itemName.trim())) return
    const code = isCategory ? `CAT:${categoryName.trim()}` : itemCode.trim()
    const name = isCategory ? categoryName.trim() : itemName.trim()
    if (!confirm(`Add "${name}" (${code}) to ALL ${branches.length} branches?`)) return
    setAddingAll(true)
    let added = 0
    let skipped = 0
    for (const branch of branches) {
      try {
        await api.addTrackedItem({
          branch_id: branch.id,
          item_code: code,
          item_name: name,
          category: isCategory ? name : (category.trim() || null),
        })
        added++
      } catch {
        skipped++
      }
    }
    if (isCategory) { setCategoryName('') } else { setItemCode(''); setItemName(''); setCategory('') }
    setAddingAll(false)
    loadTrackedItems()
    alert(`Added to ${added} branches${skipped > 0 ? ` (${skipped} already had it)` : ''}`)
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
          Select POS items to track as promotion items. Tracked items will be highlighted in sales reports.
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

      {selectedBranch && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Item / Category Form */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-400" />
                Add Promotion Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mode Toggle */}
              <div className="flex rounded-lg bg-gray-700 p-0.5 mb-4">
                <button
                  type="button"
                  onClick={() => setTrackMode('item')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    trackMode === 'item' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  Item
                </button>
                <button
                  type="button"
                  onClick={() => setTrackMode('category')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    trackMode === 'category' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Category
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                {trackMode === 'item' ? (
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
                        placeholder="e.g. Chc Pnt Bliss S"
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
                  disabled={adding || addingAll || (trackMode === 'item' ? (!itemCode.trim() || !itemName.trim()) : !categoryName.trim())}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {adding ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />{trackMode === 'item' ? 'Add Item' : 'Add Category'}</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleAddToAll}
                  disabled={adding || addingAll || (trackMode === 'item' ? (!itemCode.trim() || !itemName.trim()) : !categoryName.trim())}
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
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isCategory
                            ? 'bg-orange-900/20 border-orange-800/40 hover:border-orange-500/50'
                            : 'bg-gray-700/50 border-gray-600 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isCategory ? (
                            <span className="text-xs font-medium text-orange-400 bg-orange-900/30 px-2 py-1 rounded flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              Category
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                              {item.item_code}
                            </span>
                          )}
                          <div>
                            <p className="text-sm text-white font-medium">{item.item_name}</p>
                            {!isCategory && item.category && (
                              <p className="text-xs text-gray-500">{item.category}</p>
                            )}
                            {isCategory && (
                              <p className="text-[10px] text-orange-400/60">All items in this category</p>
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
    </div>
  )
}

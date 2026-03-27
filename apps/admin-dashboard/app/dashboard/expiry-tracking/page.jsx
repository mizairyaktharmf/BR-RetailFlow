"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  CalendarClock, Plus, Search, Loader2, X, Send, Trash2,
  CheckCircle2, Clock, Eye, Lock, Building2, Copy, Download
} from 'lucide-react'
import api from '@/services/api'

export default function ExpiryTrackingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [branches, setBranches] = useState([])

  // Create form state
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_name: '', expiry_date: '' }])
  const [selectedBranches, setSelectedBranches] = useState([])
  const [creating, setCreating] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      loadRequests()
      loadBranches()
    }
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await api.getExpiryRequests()
      setRequests(data || [])
    } catch (err) {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const loadBranches = async () => {
    try {
      const data = await api.getBranches()
      setBranches(data || [])
    } catch (err) {
      setBranches([])
    }
  }

  const addItem = () => setItems([...items, { product_name: '', expiry_date: '' }])
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index))
  const updateItem = (index, field, value) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const toggleBranch = (branchId) => {
    setSelectedBranches(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    )
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedBranches([])
    } else {
      setSelectedBranches(branches.map(b => b.id))
    }
    setSelectAll(!selectAll)
  }

  // Copy from previous request
  const handleCopy = async (reqId) => {
    try {
      const detail = await api.getExpiryRequestDetail(reqId)
      if (detail) {
        setTitle(detail.title + ' (Copy)')
        setNotes(detail.notes || '')
        setItems(detail.items.map(item => ({
          product_name: item.product_name,
          expiry_date: item.expiry_date || '',
        })))
        const branchIds = detail.branches.map(b => b.branch_id)
        setSelectedBranches(branchIds)
        setSelectAll(branchIds.length === branches.length)
        setShowCreate(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      alert('Failed to copy request')
    }
  }

  const handleCreate = async () => {
    const validItems = items.filter(i => i.product_name.trim())
    if (!title.trim() || !validItems.length || !selectedBranches.length) {
      alert('Please fill title, at least one product, and select branches')
      return
    }
    setCreating(true)
    try {
      await api.createExpiryRequest({
        title: title.trim(),
        notes: notes.trim() || null,
        items: validItems.map(i => ({
          product_name: i.product_name.trim(),
          expiry_date: i.expiry_date || null,
        })),
        branch_ids: selectedBranches,
      })
      setShowCreate(false)
      setTitle('')
      setNotes('')
      setItems([{ product_name: '', expiry_date: '' }])
      setSelectedBranches([])
      setSelectAll(false)
      loadRequests()
    } catch (err) {
      alert('Failed to create request: ' + (err.message || 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const handleClose = async (id) => {
    if (!confirm('Close this request? Branches will no longer be able to respond.')) return
    try {
      await api.closeExpiryRequest(id)
      loadRequests()
    } catch (err) {
      alert('Failed to close request')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this request permanently?')) return
    try {
      await api.deleteExpiryRequest(id)
      loadRequests()
    } catch (err) {
      alert('Failed to delete request')
    }
  }

  const filtered = requests.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openCount = requests.filter(r => r.status === 'open').length
  const closedCount = requests.filter(r => r.status === 'closed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-8 w-8 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Expiry Tracking</h1>
            <p className="text-sm text-gray-400">Send expiry check requests to your branches</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {showCreate ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showCreate ? 'Cancel' : 'New Request'}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="bg-gray-800/50 border-orange-500/30">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Create Expiry Check Request</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Title</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. March Week 4 Expiry Check"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Notes (optional)</label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Excel-like Product Table */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Products to Check</label>
              <div className="border border-gray-600 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_1fr_160px_40px] bg-gray-700/80 text-xs text-gray-400 font-medium">
                  <div className="p-2 text-center">#</div>
                  <div className="p-2 border-l border-gray-600">Product Name</div>
                  <div className="p-2 border-l border-gray-600">Expiry Date</div>
                  <div className="p-2 border-l border-gray-600"></div>
                </div>
                {/* Table Rows */}
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[40px_1fr_160px_40px] border-t border-gray-700/50 group hover:bg-gray-700/30">
                    <div className="p-1.5 text-center text-xs text-gray-500 flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="p-1 border-l border-gray-700/50">
                      <input
                        value={item.product_name}
                        onChange={e => updateItem(i, 'product_name', e.target.value)}
                        placeholder="Type product name..."
                        className="w-full bg-transparent text-white text-sm px-2 py-1.5 focus:outline-none focus:bg-gray-700/50 rounded"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addItem() }
                          if (e.key === 'Backspace' && !item.product_name && items.length > 1) { e.preventDefault(); removeItem(i) }
                        }}
                      />
                    </div>
                    <div className="p-1 border-l border-gray-700/50">
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={e => updateItem(i, 'expiry_date', e.target.value)}
                        className="w-full bg-transparent text-white text-sm px-2 py-1.5 focus:outline-none focus:bg-gray-700/50 rounded [color-scheme:dark]"
                      />
                    </div>
                    <div className="p-1 border-l border-gray-700/50 flex items-center justify-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={addItem} className="text-orange-400 hover:text-orange-300 mt-2 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row (or press Enter)
              </Button>
            </div>

            {/* Branch Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Select Branches</label>
                <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-orange-400 hover:text-orange-300 text-xs">
                  {selectAll ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => toggleBranch(branch.id)}
                    className={`p-2 rounded-lg text-xs text-left transition-all ${
                      selectedBranches.includes(branch.id)
                        ? 'bg-orange-500/20 border border-orange-500 text-orange-300'
                        : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <Building2 className="h-3 w-3 inline mr-1" />
                    {branch.name}
                  </button>
                ))}
              </div>
              {selectedBranches.length > 0 && (
                <p className="text-xs text-orange-400 mt-1">{selectedBranches.length} branches selected</p>
              )}
            </div>

            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-orange-500 hover:bg-orange-600 text-white w-full"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {creating ? 'Sending...' : 'Send to Branches'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="bg-gray-800/50 border-gray-700 flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-2xl font-bold text-white">{requests.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700 flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-green-400">Open</p>
            <p className="text-2xl font-bold text-green-400">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700 flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Closed</p>
            <p className="text-2xl font-bold text-gray-400">{closedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search requests..."
          className="pl-10 bg-gray-800/50 border-gray-700 text-white"
        />
      </div>

      {/* Request List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center text-gray-400">
            <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No expiry tracking requests yet</p>
            <p className="text-sm mt-1">Click "New Request" to create one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{req.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'open'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {req.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    {req.notes && <p className="text-sm text-gray-400 mb-2">{req.notes}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{req.item_count} products</span>
                      <span>{req.branch_count} branches</span>
                      <span className={req.responded_count === req.branch_count ? 'text-green-400' : 'text-orange-400'}>
                        {req.responded_count}/{req.branch_count} responded
                      </span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          req.responded_count === req.branch_count ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${req.branch_count > 0 ? (req.responded_count / req.branch_count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => router.push(`/dashboard/expiry-tracking/detail?id=${req.id}`)}
                      className="text-blue-400 hover:text-blue-300"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleCopy(req.id)}
                      className="text-purple-400 hover:text-purple-300"
                      title="Copy & Edit"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {req.status === 'open' && (
                      <Button variant="ghost" size="sm" onClick={() => handleClose(req.id)} className="text-yellow-400 hover:text-yellow-300" title="Close">
                        <Lock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(req.id)} className="text-red-400 hover:text-red-300" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Clock, Building2 } from 'lucide-react'
import api from '@/services/api'

export default function SalesWindowsPage() {
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [windowData, setWindowData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newWindowName, setNewWindowName] = useState('')

  const FIXED_WINDOWS = ['3pm', '7pm', '9pm', 'closing']

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
    loadBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch) {
      loadWindows()
    }
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

  const loadWindows = async () => {
    if (!selectedBranch) return
    setLoading(true)
    try {
      const data = await api.getAvailableWindows(selectedBranch.id)
      setWindowData(data)
    } catch (err) {
      console.error('Failed to load windows:', err)
      setWindowData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAddWindow = async (e) => {
    e.preventDefault()
    if (!newWindowName.trim() || !selectedBranch) return

    setCreating(true)
    try {
      await api.createCustomWindow(selectedBranch.id, newWindowName.trim())
      setNewWindowName('')
      await loadWindows()
    } catch (err) {
      alert(err.message || 'Failed to create window')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteWindow = async (windowId) => {
    if (!confirm('Delete this custom window?')) return
    try {
      await api.deleteCustomWindow(windowId)
      await loadWindows()
    } catch (err) {
      alert(err.message || 'Failed to delete window')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-400" />
          Sales Reporting Windows
        </h1>
        <p className="text-gray-400 mt-1">
          Manage custom sales windows per branch. Fixed windows (3pm, 7pm, 9pm, closing) are always available.
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                {b.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedBranch && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Custom Window Form */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-400" />
                Add Custom Window
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddWindow} className="space-y-4">
                <div>
                  <Label className="text-gray-400 text-xs">Window Name</Label>
                  <Input
                    value={newWindowName}
                    onChange={(e) => setNewWindowName(e.target.value)}
                    placeholder="e.g., 5pm, 6pm, 10pm"
                    className="bg-gray-700 border-gray-600 text-white mt-1"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Enter any time format (5pm, 6pm, lunch, evening, etc.)
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={creating || !newWindowName.trim()}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Add Window</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Windows List */}
          <Card className="bg-gray-800/50 border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Available Windows — {selectedBranch.name}
                </span>
                <span className="text-xs text-gray-500 font-normal">
                  {(windowData?.fixed_windows?.length || 0) + (windowData?.custom_windows?.length || 0)} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : !windowData ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Failed to load windows</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Fixed Windows */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Fixed Windows (Always Available)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {windowData.fixed_windows?.map((window) => (
                        <div
                          key={window}
                          className="p-3 rounded-lg bg-blue-900/30 border border-blue-800/50 hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-300">{window}</span>
                            <Clock className="w-3 h-3 text-blue-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Windows */}
                  {windowData.custom_windows && windowData.custom_windows.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Custom Windows</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {windowData.custom_windows.map((window) => (
                          <div
                            key={window.id}
                            className="p-3 rounded-lg bg-green-900/30 border border-green-800/50 hover:border-green-500/50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-green-300">{window.window_name}</span>
                              <button
                                onClick={() => handleDeleteWindow(window.id)}
                                className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete window"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!windowData.custom_windows || windowData.custom_windows.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No custom windows yet</p>
                      <p className="text-xs mt-1">Add one using the form on the left</p>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

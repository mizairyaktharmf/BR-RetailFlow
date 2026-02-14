"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  X,
  Loader2,
  AlertCircle,
  Globe,
  MapPin,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  MapPinned
} from 'lucide-react'
import api from '@/services/api'

export default function BranchesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [branches, setBranches] = useState([])
  const [areas, setAreas] = useState([])
  const [territories, setTerritories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterTerritory, setFilterTerritory] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    area_id: '',
    address: '',
    phone: '',
    is_active: true
  })
  const [error, setError] = useState('')
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
    }

    // Load real data from API
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const [branchesData, areasData, territoriesData] = await Promise.all([
        api.getBranches().catch(() => []),
        api.getAreas().catch(() => []),
        api.getTerritories().catch(() => []),
      ])
      setBranches(branchesData)
      setAreas(areasData)
      setTerritories(territoriesData)
    } catch (err) {
      // Silently fail
    }
  }

  const filteredBranches = branches.filter(b => {
    const matchesSearch = b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.code?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesArea = !filterArea || b.area_id?.toString() === filterArea
    const matchesTerritory = !filterTerritory || b.territory_id?.toString() === filterTerritory
    return matchesSearch && matchesArea && matchesTerritory
  })

  const handleOpenModal = (branch = null) => {
    setSelectedBranch(branch)
    if (branch) {
      setFormData({
        name: branch.name,
        code: branch.code,
        area_id: branch.area_id?.toString() || '',
        address: branch.address || '',
        phone: branch.phone || '',
        is_active: branch.is_active
      })
    } else {
      setFormData({
        name: '',
        code: '',
        area_id: user?.role === 'admin' ? user.area_id?.toString() : '',
        address: '',
        phone: '',
        is_active: true
      })
    }
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedBranch(null)
    setFormData({ name: '', code: '', area_id: '', address: '', phone: '', is_active: true })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.code.trim() || !formData.area_id) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)

    try {
      const apiData = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        area_id: parseInt(formData.area_id),
        address: formData.address || null,
        phone: formData.phone || null,
        is_active: formData.is_active
      }

      if (selectedBranch) {
        const updated = await api.updateBranch(selectedBranch.id, apiData)
        setBranches(branches.map(b => b.id === selectedBranch.id ? updated : b))
      } else {
        const created = await api.createBranch(apiData)
        setBranches([...branches, created])
      }
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Failed to save branch')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (branch) => {
    setSelectedBranch(branch)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await api.deleteBranch(selectedBranch.id)
      setBranches(branches.filter(b => b.id !== selectedBranch.id))
      setIsDeleteModalOpen(false)
      setSelectedBranch(null)
    } catch (err) {
      alert(err.message || 'Failed to delete branch')
    } finally {
      setLoading(false)
    }
  }

  const toggleBranchStatus = async (branch) => {
    try {
      const updated = await api.updateBranch(branch.id, { is_active: !branch.is_active })
      setBranches(branches.map(b => b.id === branch.id ? updated : b))
    } catch (err) {
      alert(err.message || 'Failed to update branch status')
    }
  }

  // Filter areas based on selected territory (for HQ)
  const displayAreas = user?.role === 'supreme_admin' && filterTerritory
    ? areas.filter(a => a.territory_id?.toString() === filterTerritory)
    : areas

  if (!user) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            Branches
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user.role === 'supreme_admin'
              ? 'Manage all branches across the network'
              : user.role === 'super_admin'
                ? `Manage branches in ${user.territory_name}`
                : `Manage branches in ${user.area_name}`
            }
          </p>
        </div>
        {user.role === 'supreme_admin' && (
          <Button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {user.role === 'supreme_admin' && (
          <div className="relative">
            <button
              onClick={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Globe className="w-4 h-4 text-purple-400" />
              <span>
                {filterTerritory
                  ? territories.find(t => t.id.toString() === filterTerritory)?.name
                  : 'All Territories'
                }
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showTerritoryDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTerritoryDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setFilterTerritory('')
                      setFilterArea('')
                      setShowTerritoryDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                      !filterTerritory ? 'text-purple-300 bg-slate-700/50' : 'text-slate-300'
                    }`}
                  >
                    All Territories
                  </button>
                  {territories.map((territory) => (
                    <button
                      key={territory.id}
                      onClick={() => {
                        setFilterTerritory(territory.id.toString())
                        setFilterArea('')
                        setShowTerritoryDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                        filterTerritory === territory.id.toString() ? 'text-purple-300 bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      {territory.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {(user.role === 'supreme_admin' || user.role === 'super_admin') && (
          <div className="relative">
            <button
              onClick={() => setShowAreaDropdown(!showAreaDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>
                {filterArea
                  ? displayAreas.find(a => a.id.toString() === filterArea)?.name
                  : 'All Areas'
                }
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showAreaDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAreaDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFilterArea('')
                      setShowAreaDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                      !filterArea ? 'text-blue-300 bg-slate-700/50' : 'text-slate-300'
                    }`}
                  >
                    All Areas
                  </button>
                  {displayAreas.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => {
                        setFilterArea(area.id.toString())
                        setShowAreaDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                        filterArea === area.id.toString() ? 'text-blue-300 bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Branches Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredBranches.map((branch) => (
          <Card key={branch.id} className={`bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors ${!branch.is_active && 'opacity-60'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${branch.is_active ? 'bg-cyan-500/20' : 'bg-slate-600/20'}`}>
                    <Building2 className={`w-5 h-5 ${branch.is_active ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      {branch.name}
                      {branch.is_active ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-xs font-mono">{branch.code}</CardDescription>
                  </div>
                </div>
                {user.role === 'supreme_admin' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenModal(branch)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(branch)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Location Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs">
                  <MapPin className="w-3 h-3" />
                  {branch.area_name || areas.find(a => a.id === branch.area_id)?.name || 'Unknown'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  <Globe className="w-3 h-3" />
                  {branch.territory_name || 'Unknown'}
                </span>
              </div>

              {/* Address & Phone */}
              {(branch.address || branch.phone) && (
                <div className="pt-2 border-t border-slate-700 space-y-1.5">
                  {branch.address && (
                    <div className="flex items-start gap-2 text-xs">
                      <MapPinned className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                      <span className="text-slate-400">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-400">{branch.phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Active - HQ only */}
              {user.role === 'supreme_admin' && (
                <button
                  onClick={() => toggleBranchStatus(branch)}
                  className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                    branch.is_active
                      ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'bg-green-500/10 text-green-300 hover:bg-green-500/20'
                  }`}
                >
                  {branch.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBranches.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">No branches found</p>
          {searchTerm && (
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedBranch ? 'Edit Branch' : 'Add New Branch'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">Branch Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., KRM-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Branch Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Karama Center"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area" className="text-slate-300">Area *</Label>
                <select
                  id="area"
                  value={formData.area_id}
                  onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                  disabled={user?.role === 'admin'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                >
                  <option value="">Select area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id.toString()}>
                      {area.name} ({area.territory_name || territories.find(t => t.id === area.territory_id)?.name || ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-slate-300">Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., Shop 12, Karama Shopping Complex"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g., +971-4-123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <Label htmlFor="is_active" className="text-slate-300">Branch is active</Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedBranch ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Delete Branch</h2>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedBranch?.name}</span> ({selectedBranch?.code})? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

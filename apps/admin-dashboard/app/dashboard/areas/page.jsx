"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  Users,
  X,
  Loader2,
  AlertCircle,
  Globe,
  ChevronDown
} from 'lucide-react'
import api from '@/services/api'

export default function AreasPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [areas, setAreas] = useState([])
  const [territories, setTerritories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTerritory, setFilterTerritory] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', code: '', territory_id: '' })
  const [error, setError] = useState('')
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)

      // Only HQ and TM can access this page
      if (!['supreme_admin', 'super_admin'].includes(userData.role)) {
        router.push('/dashboard')
        return
      }
    }

    // Load real data from API
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const [areasData, territoriesData] = await Promise.all([
        api.getAreas().catch(() => []),
        api.getTerritories().catch(() => []),
      ])
      setAreas(areasData)
      setTerritories(territoriesData)
    } catch (err) {
      // Silently fail
    }
  }

  const filteredAreas = areas.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTerritory = !filterTerritory || a.territory_id?.toString() === filterTerritory
    return matchesSearch && matchesTerritory
  })

  const handleOpenModal = (area = null) => {
    setSelectedArea(area)
    setFormData(area
      ? { name: area.name, code: area.code, territory_id: area.territory_id?.toString() || '' }
      : { name: '', code: '', territory_id: user?.role === 'super_admin' ? user.territory_id?.toString() : '' }
    )
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedArea(null)
    setFormData({ name: '', code: '', territory_id: '' })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.code.trim() || !formData.territory_id) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      const apiData = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        territory_id: parseInt(formData.territory_id)
      }

      if (selectedArea) {
        const updated = await api.updateArea(selectedArea.id, apiData)
        setAreas(areas.map(a => a.id === selectedArea.id ? updated : a))
      } else {
        const created = await api.createArea(apiData)
        setAreas([...areas, created])
      }
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Failed to save area')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (area) => {
    setSelectedArea(area)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await api.deleteArea(selectedArea.id)
      setAreas(areas.filter(a => a.id !== selectedArea.id))
      setIsDeleteModalOpen(false)
      setSelectedArea(null)
    } catch (err) {
      alert(err.message || 'Failed to delete area')
    } finally {
      setLoading(false)
    }
  }

  if (!user || !['supreme_admin', 'super_admin'].includes(user.role)) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            Areas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user.role === 'supreme_admin'
              ? 'Manage all areas across territories'
              : `Manage areas in ${user.territory_name}`
            }
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Area
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search areas..."
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
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowTerritoryDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setFilterTerritory('')
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
      </div>

      {/* Areas Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAreas.map((area) => (
          <Card key={area.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">{area.name}</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">{area.code}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenModal(area)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(area)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Territory Badge */}
              <div className="mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  <Globe className="w-3 h-3" />
                  {area.territory_name || territories.find(t => t.id === area.territory_id)?.name || 'Unknown'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
                    <Building2 className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold text-white">{area.branches_count || 0}</p>
                  <p className="text-[10px] text-slate-500">Branches</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                    <Users className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold text-white">{area.users_count || 0}</p>
                  <p className="text-[10px] text-slate-500">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAreas.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">No areas found</p>
          {searchTerm && (
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedArea ? 'Edit Area' : 'Add New Area'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="territory" className="text-slate-300">Territory</Label>
                <select
                  id="territory"
                  value={formData.territory_id}
                  onChange={(e) => setFormData({ ...formData, territory_id: e.target.value })}
                  disabled={user.role === 'super_admin'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select territory</option>
                  {territories.map((territory) => (
                    <option key={territory.id} value={territory.id.toString()}>
                      {territory.name} ({territory.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Area Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Karama"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">Area Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., KRM"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={5}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 uppercase"
                />
                <p className="text-xs text-slate-500">Short code for the area (max 5 chars)</p>
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedArea ? 'Update' : 'Create'
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
              <h2 className="text-lg font-semibold text-white mb-2">Delete Area</h2>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedArea?.name}</span>? This action cannot be undone.
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

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
  ChevronDown,
  UserPlus,
  UserCheck,
  Mail,
  Phone
} from 'lucide-react'
import api from '@/services/api'

const roleColors = {
  supreme_admin: 'bg-purple-500/20 text-purple-300',
  super_admin: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-cyan-500/20 text-cyan-300',
  staff: 'bg-green-500/20 text-green-300',
}

export default function AreaManagersPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [areas, setAreas] = useState([])
  const [territories, setTerritories] = useState([])
  const [amUsers, setAmUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTerritory, setFilterTerritory] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateAreaModalOpen, setIsCreateAreaModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)
  const [selectedAM, setSelectedAM] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('areas') // 'areas' | 'managers'

  // Create AM form data
  const [amFormData, setAmFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    territory_id: '',
    area_id: '',
  })

  // Create Area form data
  const [areaFormData, setAreaFormData] = useState({
    name: '',
    code: '',
    territory_id: '',
  })

  // Assign AM modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignAreaId, setAssignAreaId] = useState(null)
  const [assignAmId, setAssignAmId] = useState('')

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)

      if (!['supreme_admin', 'super_admin'].includes(userData.role)) {
        router.push('/dashboard')
        return
      }
    }

    loadData()
  }, [router])

  const loadData = async () => {
    setPageLoading(true)
    try {
      const [areasData, territoriesData, usersData] = await Promise.all([
        api.getAreas().catch(() => []),
        api.getTerritories().catch(() => []),
        api.getUsers({ role: 'admin' }).catch(() => []),
      ])
      setAreas(areasData)
      setTerritories(territoriesData)
      setAmUsers(usersData)
    } catch (err) {
      // Silently fail
    } finally {
      setPageLoading(false)
    }
  }

  // Get AM user assigned to an area
  const getAreaAM = (areaId) => {
    return amUsers.find(u => u.area_id === areaId)
  }

  // Get unassigned AM users (no area_id set)
  const getUnassignedAMs = () => {
    return amUsers.filter(u => !u.area_id)
  }

  // Get AM users for a specific territory
  const getAvailableAMsForTerritory = (territoryId) => {
    return amUsers.filter(u => u.territory_id === territoryId && !u.area_id)
  }

  const filteredAreas = areas.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTerritory = !filterTerritory || a.territory_id?.toString() === filterTerritory
    return matchesSearch && matchesTerritory
  })

  const filteredAMs = amUsers.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTerritory = !filterTerritory || u.territory_id?.toString() === filterTerritory
    return matchesSearch && matchesTerritory
  })

  // ---- Create AM User ----
  const handleOpenCreateAM = () => {
    setAmFormData({
      full_name: '',
      email: '',
      username: '',
      password: '',
      phone: '',
      territory_id: user?.role === 'super_admin' ? user.territory_id?.toString() : '',
      area_id: '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const handleCreateAM = async (e) => {
    e.preventDefault()
    setError('')

    if (!amFormData.full_name.trim() || !amFormData.email.trim() || !amFormData.username.trim() || !amFormData.password.trim() || !amFormData.territory_id) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        full_name: amFormData.full_name,
        email: amFormData.email,
        username: amFormData.username,
        password: amFormData.password,
        phone: amFormData.phone || null,
        role: 'admin',
        territory_id: parseInt(amFormData.territory_id),
        area_id: amFormData.area_id ? parseInt(amFormData.area_id) : null,
      }

      const created = await api.createUser(payload)
      setAmUsers([...amUsers, created])
      setIsModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to create Area Manager')
    } finally {
      setLoading(false)
    }
  }

  // ---- Create Area ----
  const handleOpenCreateArea = () => {
    setAreaFormData({
      name: '',
      code: '',
      territory_id: user?.role === 'super_admin' ? user.territory_id?.toString() : '',
    })
    setError('')
    setIsCreateAreaModalOpen(true)
  }

  const handleCreateArea = async (e) => {
    e.preventDefault()
    setError('')

    if (!areaFormData.name.trim() || !areaFormData.code.trim() || !areaFormData.territory_id) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const apiData = {
        name: areaFormData.name,
        code: areaFormData.code.toUpperCase(),
        territory_id: parseInt(areaFormData.territory_id)
      }

      const created = await api.createArea(apiData)
      setAreas([...areas, created])
      setIsCreateAreaModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to create area')
    } finally {
      setLoading(false)
    }
  }

  // ---- Assign AM to Area ----
  const handleOpenAssign = (area) => {
    setAssignAreaId(area.id)
    setAssignAmId('')
    setError('')
    setIsAssignModalOpen(true)
  }

  const handleAssign = async () => {
    if (!assignAmId) {
      setError('Please select an Area Manager')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.assignUser(parseInt(assignAmId), { area_id: assignAreaId })
      await loadData() // Refresh all data
      setIsAssignModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to assign Area Manager')
    } finally {
      setLoading(false)
    }
  }

  // ---- Unassign AM from Area ----
  const handleUnassign = async (amUser) => {
    setLoading(true)
    try {
      await api.assignUser(amUser.id, { area_id: null, territory_id: amUser.territory_id })
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to unassign Area Manager')
    } finally {
      setLoading(false)
    }
  }

  // ---- Delete Area ----
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
            Area Managers
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user.role === 'supreme_admin'
              ? 'Manage area managers and areas across territories'
              : `Manage area managers in ${user.territory_name || 'your territory'}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleOpenCreateArea}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Area
          </Button>
          <Button
            onClick={handleOpenCreateAM}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Area Manager
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('areas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'areas'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Areas ({areas.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'managers'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Managers ({amUsers.length})
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={activeTab === 'areas' ? 'Search areas...' : 'Search managers...'}
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

      {/* Loading */}
      {pageLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {/* ====== AREAS TAB ====== */}
      {!pageLoading && activeTab === 'areas' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAreas.map((area) => {
              const assignedAM = getAreaAM(area.id)
              return (
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
                          onClick={() => handleDelete(area)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Territory Badge */}
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                        <Globe className="w-3 h-3" />
                        {area.territory_name || territories.find(t => t.id === area.territory_id)?.name || 'Unknown'}
                      </span>
                    </div>

                    {/* Assigned AM */}
                    {assignedAM ? (
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-xs font-medium">
                              {assignedAM.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AM'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{assignedAM.full_name}</p>
                              <p className="text-[10px] text-slate-400">{assignedAM.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassign(assignedAM)}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Unassign AM"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenAssign(area)}
                        className="w-full p-3 rounded-lg border border-dashed border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-300"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="text-sm">Assign Area Manager</span>
                      </button>
                    )}

                    {/* Stats */}
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
              )
            })}
          </div>

          {filteredAreas.length === 0 && !pageLoading && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No areas found</p>
              {searchTerm && (
                <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ====== MANAGERS TAB ====== */}
      {!pageLoading && activeTab === 'managers' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAMs.map((am) => {
              const assignedArea = areas.find(a => a.id === am.area_id)
              return (
                <Card key={am.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {am.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AM'}
                        </div>
                        <div>
                          <CardTitle className="text-base text-white">{am.full_name}</CardTitle>
                          <CardDescription className="text-slate-500 text-xs">@{am.username}</CardDescription>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${roleColors.admin}`}>
                        AM
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Contact */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{am.email}</span>
                      </div>
                      {am.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />
                          <span>{am.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Territory */}
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                        <Globe className="w-3 h-3" />
                        {am.territory_name || 'Not assigned'}
                      </span>
                    </div>

                    {/* Assigned Area */}
                    {assignedArea ? (
                      <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{assignedArea.name}</p>
                            <p className="text-[10px] text-slate-400">{assignedArea.code}</p>
                          </div>
                          <UserCheck className="w-4 h-4 text-green-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs text-amber-300 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Not assigned to any area
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                        am.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {am.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {am.is_approved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300">
                          Approved
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredAMs.length === 0 && !pageLoading && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No area managers found</p>
              <p className="text-slate-500 text-sm mt-1">Create an Area Manager to get started</p>
            </div>
          )}
        </>
      )}

      {/* ====== CREATE AM MODAL ====== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              Add Area Manager
            </h2>

            <form onSubmit={handleCreateAM} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300">Full Name *</Label>
                <Input
                  placeholder="e.g., Ahmed Hassan"
                  value={amFormData.full_name}
                  onChange={(e) => setAmFormData({ ...amFormData, full_name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Email *</Label>
                <Input
                  type="email"
                  placeholder="e.g., ahmed@example.com"
                  value={amFormData.email}
                  onChange={(e) => setAmFormData({ ...amFormData, email: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Username *</Label>
                <Input
                  placeholder="e.g., ahmed.hassan"
                  value={amFormData.username}
                  onChange={(e) => setAmFormData({ ...amFormData, username: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Password *</Label>
                <Input
                  type="password"
                  placeholder="Initial password"
                  value={amFormData.password}
                  onChange={(e) => setAmFormData({ ...amFormData, password: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Phone</Label>
                <Input
                  placeholder="e.g., +971 50 123 4567"
                  value={amFormData.phone}
                  onChange={(e) => setAmFormData({ ...amFormData, phone: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Territory *</Label>
                <select
                  value={amFormData.territory_id}
                  onChange={(e) => setAmFormData({ ...amFormData, territory_id: e.target.value, area_id: '' })}
                  disabled={user.role === 'super_admin'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select territory</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id.toString()}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Assign to Area (optional)</Label>
                <select
                  value={amFormData.area_id}
                  onChange={(e) => setAmFormData({ ...amFormData, area_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No area (assign later)</option>
                  {areas
                    .filter(a => a.territory_id?.toString() === amFormData.territory_id)
                    .map((a) => (
                      <option key={a.id} value={a.id.toString()}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
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
                      Creating...
                    </>
                  ) : (
                    'Create AM'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== CREATE AREA MODAL ====== */}
      {isCreateAreaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateAreaModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <button
              onClick={() => setIsCreateAreaModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Add New Area
            </h2>

            <form onSubmit={handleCreateArea} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300">Territory *</Label>
                <select
                  value={areaFormData.territory_id}
                  onChange={(e) => setAreaFormData({ ...areaFormData, territory_id: e.target.value })}
                  disabled={user.role === 'super_admin'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select territory</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id.toString()}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Area Name *</Label>
                <Input
                  placeholder="e.g., Karama"
                  value={areaFormData.name}
                  onChange={(e) => setAreaFormData({ ...areaFormData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Area Code *</Label>
                <Input
                  placeholder="e.g., KRM"
                  value={areaFormData.code}
                  onChange={(e) => setAreaFormData({ ...areaFormData, code: e.target.value.toUpperCase() })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 uppercase"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateAreaModalOpen(false)}
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
                      Creating...
                    </>
                  ) : (
                    'Create Area'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== ASSIGN AM MODAL ====== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              Assign Area Manager
            </h2>

            <p className="text-sm text-slate-400 mb-4">
              Select an area manager to assign to <span className="text-white font-medium">{areas.find(a => a.id === assignAreaId)?.name}</span>
            </p>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 mb-4">
                <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {(() => {
              const area = areas.find(a => a.id === assignAreaId)
              const availableAMs = area ? getAvailableAMsForTerritory(area.territory_id) : []
              return availableAMs.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {availableAMs.map((am) => (
                    <button
                      key={am.id}
                      onClick={() => setAssignAmId(am.id.toString())}
                      className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center gap-3 ${
                        assignAmId === am.id.toString()
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-xs font-medium">
                        {am.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AM'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{am.full_name}</p>
                        <p className="text-[10px] text-slate-400">{am.email}</p>
                      </div>
                      {assignAmId === am.id.toString() && (
                        <UserCheck className="w-4 h-4 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                  <p className="text-sm text-amber-300">No unassigned area managers available in this territory.</p>
                  <p className="text-xs text-amber-400/70 mt-1">Create a new Area Manager first.</p>
                </div>
              )
            })()}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={loading || !assignAmId}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====== DELETE AREA MODAL ====== */}
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

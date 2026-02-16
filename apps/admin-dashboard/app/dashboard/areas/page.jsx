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
  Phone,
  Link2,
  Unlink
} from 'lucide-react'
import api from '@/services/api'

export default function AreaManagersPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [territories, setTerritories] = useState([])
  const [amUsers, setAmUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTerritory, setFilterTerritory] = useState('')
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')

  // Create AM modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [amFormData, setAmFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    territory_id: '',
  })

  // Assign branch modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignTargetAM, setAssignTargetAM] = useState(null)
  const [selectedBranchId, setSelectedBranchId] = useState('')

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
      const [territoriesData, usersData, branchesData] = await Promise.all([
        api.getTerritories().catch(() => []),
        api.getUsers({ role: 'admin' }).catch(() => []),
        api.getBranches().catch(() => []),
      ])
      setTerritories(territoriesData)
      setAmUsers(usersData)
      setBranches(branchesData)
    } catch (err) {
      // Silently fail
    } finally {
      setPageLoading(false)
    }
  }

  // Get branches assigned to an AM
  const getBranchesForAM = (amId) => {
    return branches.filter(b => b.manager_id === amId)
  }

  // Get unassigned branches for a territory
  const getUnassignedBranches = (territoryId) => {
    return branches.filter(b => !b.manager_id && b.territory_id === territoryId)
  }

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
    })
    setError('')
    setIsCreateModalOpen(true)
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
      }

      const created = await api.createUser(payload)
      setAmUsers([...amUsers, created])
      setIsCreateModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to create Area Manager')
    } finally {
      setLoading(false)
    }
  }

  // ---- Assign Branch to AM ----
  const handleOpenAssign = (am) => {
    setAssignTargetAM(am)
    setSelectedBranchId('')
    setError('')
    setIsAssignModalOpen(true)
  }

  const handleAssignBranch = async () => {
    if (!selectedBranchId) {
      setError('Please select a branch')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.assignBranch(parseInt(selectedBranchId), { manager_id: assignTargetAM.id })
      await loadData()
      setIsAssignModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to assign branch')
    } finally {
      setLoading(false)
    }
  }

  // ---- Unassign Branch from AM ----
  const handleUnassignBranch = async (branch) => {
    setLoading(true)
    try {
      await api.assignBranch(branch.id, { manager_id: null })
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to unassign branch')
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
            <Users className="w-6 h-6 text-cyan-400" />
            Area Managers
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user.role === 'supreme_admin'
              ? 'Manage area managers and assign branches across territories'
              : `Manage area managers in ${user.territory_name || 'your territory'}`
            }
          </p>
        </div>
        <Button
          onClick={handleOpenCreateAM}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Area Manager
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search managers..."
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

      {/* AM Cards */}
      {!pageLoading && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            {filteredAMs.map((am) => {
              const assignedBranches = getBranchesForAM(am.id)
              const unassignedInTerritory = getUnassignedBranches(am.territory_id)
              return (
                <Card key={am.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {am.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AM'}
                        </div>
                        <div>
                          <CardTitle className="text-base text-white">{am.full_name}</CardTitle>
                          <CardDescription className="text-slate-500 text-xs">@{am.username}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300">
                          Area Manager
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          am.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {am.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Contact Info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{am.email}</span>
                      </div>
                      {am.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />
                          <span>{am.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Territory Badge */}
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                        <Globe className="w-3 h-3" />
                        {am.territory_name || territories.find(t => t.id === am.territory_id)?.name || 'Not assigned'}
                      </span>
                    </div>

                    {/* Assigned Branches */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Assigned Branches ({assignedBranches.length})
                        </p>
                        {unassignedInTerritory.length > 0 && (
                          <button
                            onClick={() => handleOpenAssign(am)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            Assign Branch
                          </button>
                        )}
                      </div>

                      {assignedBranches.length > 0 ? (
                        <div className="space-y-1.5">
                          {assignedBranches.map((branch) => (
                            <div
                              key={branch.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-700/40 border border-slate-600/50"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-400" />
                                <div>
                                  <p className="text-sm font-medium text-white">{branch.name}</p>
                                  <p className="text-[10px] text-slate-500">{branch.code}{branch.address ? ` - ${branch.address}` : ''}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleUnassignBranch(branch)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Unassign branch"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenAssign(am)}
                          className="w-full p-3 rounded-lg border border-dashed border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-300"
                        >
                          <Link2 className="w-4 h-4" />
                          <span className="text-sm">Assign a branch</span>
                        </button>
                      )}
                    </div>

                    {/* Staff count */}
                    {assignedBranches.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Users className="w-3 h-3" />
                        {assignedBranches.reduce((sum, b) => sum + (b.staff_count || 0), 0)} staff across {assignedBranches.length} branch{assignedBranches.length !== 1 ? 'es' : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredAMs.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No area managers found</p>
              <p className="text-slate-500 text-sm mt-1">Create an Area Manager to get started</p>
            </div>
          )}
        </>
      )}

      {/* ====== CREATE AM MODAL ====== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateModalOpen(false)}
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
                  onChange={(e) => setAmFormData({ ...amFormData, territory_id: e.target.value })}
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

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
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

      {/* ====== ASSIGN BRANCH MODAL ====== */}
      {isAssignModalOpen && assignTargetAM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-cyan-400" />
              Assign Branch
            </h2>

            <p className="text-sm text-slate-400 mb-4">
              Select a branch to assign to <span className="text-white font-medium">{assignTargetAM.full_name}</span>
            </p>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 mb-4">
                <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {(() => {
              const available = getUnassignedBranches(assignTargetAM.territory_id)
              return available.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {available.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => setSelectedBranchId(branch.id.toString())}
                      className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center gap-3 ${
                        selectedBranchId === branch.id.toString()
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                      }`}
                    >
                      <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{branch.name}</p>
                        <p className="text-[10px] text-slate-400">{branch.code}{branch.address ? ` - ${branch.address}` : ''}</p>
                      </div>
                      {selectedBranchId === branch.id.toString() && (
                        <UserCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                  <p className="text-sm text-amber-300">No unassigned branches available in this territory.</p>
                  <p className="text-xs text-amber-400/70 mt-1">All branches are already assigned or create a new branch first.</p>
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
                onClick={handleAssignBranch}
                disabled={loading || !selectedBranchId}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Branch'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

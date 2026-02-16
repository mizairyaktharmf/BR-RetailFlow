"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Globe,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Key,
  UserCheck,
  UserX,
  Shield,
  Copy,
  Check
} from 'lucide-react'
import api from '@/services/api'

const allRoleOptions = [
  { value: 'supreme_admin', label: 'HQ Admin', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'super_admin', label: 'Territory Manager (TM)', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'admin', label: 'Area Manager (AM)', color: 'bg-cyan-500/20 text-cyan-300' },
  { value: 'staff', label: 'Flavor Expert', color: 'bg-green-500/20 text-green-300' },
]

const roleOptions = allRoleOptions.filter(r => r.value !== 'supreme_admin')

const roleColors = {
  supreme_admin: 'bg-purple-500/20 text-purple-300',
  super_admin: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-cyan-500/20 text-cyan-300',
  staff: 'bg-green-500/20 text-green-300',
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading...</div>}>
      <UsersContent />
    </Suspense>
  )
}

function UsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [territories, setTerritories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterTerritory, setFilterTerritory] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [pendingUsers, setPendingUsers] = useState([])
  const [approvalLoading, setApprovalLoading] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    territory_id: '',
    branch_id: '',
    is_active: true
  })
  const [error, setError] = useState('')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'pending') {
      setActiveTab('pending')
    }

    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setCurrentUser(userData)

      if (userData.role === 'supreme_admin') {
        loadPendingApprovals()
      }

      loadData()
    }
  }, [router, searchParams])

  const loadData = async () => {
    setPageLoading(true)
    try {
      const [usersData, territoriesData, branchesData] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getTerritories().catch(() => []),
        api.getBranches().catch(() => []),
      ])
      setUsers(usersData)
      setTerritories(territoriesData)
      setBranches(branchesData)
    } catch (err) {
      // Silently fail
    } finally {
      setPageLoading(false)
    }
  }

  const loadPendingApprovals = async () => {
    try {
      const data = await api.getPendingApprovals()
      setPendingUsers(data)
    } catch (err) {
      // Silently fail
    }
  }

  const handleApprove = async (userId) => {
    setApprovalLoading(prev => ({ ...prev, [userId]: 'approving' }))
    try {
      await api.approveUser(userId)
      setPendingUsers(prev => prev.filter(u => u.id !== userId))
      loadData()
    } catch (err) {
      alert(err.message || 'Failed to approve user')
    } finally {
      setApprovalLoading(prev => ({ ...prev, [userId]: null }))
    }
  }

  const handleReject = async (userId) => {
    if (!confirm('Are you sure you want to reject this user? Their account will be deactivated.')) return
    setApprovalLoading(prev => ({ ...prev, [userId]: 'rejecting' }))
    try {
      await api.rejectUser(userId)
      setPendingUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      alert(err.message || 'Failed to reject user')
    } finally {
      setApprovalLoading(prev => ({ ...prev, [userId]: null }))
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = !filterRole || u.role === filterRole
    const matchesTerritory = !filterTerritory || u.territory_id?.toString() === filterTerritory
    return matchesSearch && matchesRole && matchesTerritory
  })

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleOpenModal = (user = null) => {
    setSelectedUser(user)
    if (user) {
      setFormData({
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        password: '',
        role: user.role,
        territory_id: user.territory_id?.toString() || '',
        branch_id: user.branch_id?.toString() || '',
        is_active: user.is_active
      })
    } else {
      const newPassword = generatePassword()
      setFormData({
        username: '',
        full_name: '',
        email: '',
        password: newPassword,
        role: currentUser?.role === 'admin' ? 'staff' : 'staff',
        territory_id: currentUser?.role === 'super_admin' ? currentUser.territory_id?.toString() : '',
        branch_id: '',
        is_active: true
      })
    }
    setError('')
    setShowPassword(false)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
    setFormData({ username: '', full_name: '', email: '', password: '', role: 'staff', territory_id: '', branch_id: '', is_active: true })
    setError('')
    setShowPassword(false)
  }

  const handleRoleChange = (role) => {
    let updates = { role }

    if (role === 'super_admin' || role === 'admin') {
      updates.branch_id = ''
    }

    setFormData({ ...formData, ...updates })
  }

  const handleBranchSelect = (branchId) => {
    const branch = branches.find(b => b.id.toString() === branchId)
    if (branch) {
      setFormData({
        ...formData,
        branch_id: branchId,
        territory_id: branch.territory_id?.toString() || formData.territory_id
      })
    } else {
      setFormData({ ...formData, branch_id: branchId })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.username.trim() || !formData.full_name.trim() || !formData.email.trim()) {
      setError('Please fill in all required fields')
      return
    }

    if (!selectedUser && !formData.password) {
      setError('Password is required for new users')
      return
    }

    if ((formData.role === 'super_admin' || formData.role === 'admin') && !formData.territory_id) {
      setError('Please select a territory')
      return
    }

    if (formData.role === 'staff' && !formData.branch_id) {
      setError('Please select a branch for Flavor Expert')
      return
    }

    setLoading(true)

    try {
      const apiData = {
        username: formData.username,
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        territory_id: formData.territory_id ? parseInt(formData.territory_id) : null,
        branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
        is_active: formData.is_active,
      }

      if (selectedUser) {
        const updated = await api.updateUser(selectedUser.id, apiData)
        setUsers(users.map(u => u.id === selectedUser.id ? updated : u))
      } else {
        apiData.password = formData.password
        const created = await api.createUser(apiData)
        setUsers([...users, created])
      }
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (user) => {
    setSelectedUser(user)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await api.deleteUser(selectedUser.id)
      setUsers(users.filter(u => u.id !== selectedUser.id))
      setIsDeleteModalOpen(false)
      setSelectedUser(null)
    } catch (err) {
      alert(err.message || 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (user) => {
    setSelectedUser(user)
    setNewPassword('')
    setIsResetPasswordModalOpen(true)
    try {
      const result = await api.resetUserPassword(user.id)
      setNewPassword(result.new_password)
    } catch (err) {
      alert(err.message || 'Failed to reset password')
      setIsResetPasswordModalOpen(false)
      setSelectedUser(null)
    }
  }

  const confirmResetPassword = () => {
    setIsResetPasswordModalOpen(false)
    setSelectedUser(null)
    setNewPassword('')
  }

  const toggleUserStatus = async (user) => {
    try {
      const updated = await api.updateUser(user.id, { is_active: !user.is_active })
      setUsers(users.map(u => u.id === user.id ? updated : u))
    } catch (err) {
      alert(err.message || 'Failed to update user status')
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter branches based on selected territory
  const filteredBranches = formData.territory_id
    ? branches.filter(b => b.territory_id?.toString() === formData.territory_id)
    : branches

  // Available roles based on current user
  const availableRoles = currentUser?.role === 'supreme_admin'
    ? roleOptions
    : currentUser?.role === 'super_admin'
      ? roleOptions.filter(r => r.value !== 'super_admin')
      : roleOptions.filter(r => r.value === 'staff')

  if (!currentUser) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-green-400" />
            Users
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage users and assign them to territories and branches
          </p>
        </div>
        {currentUser.role === 'supreme_admin' && (
          <Button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {/* Tabs - HQ only */}
      {currentUser.role === 'supreme_admin' && (
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-600/80 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Approval
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-500/30 text-amber-200">
                {pendingUsers.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Pending Approvals Section */}
      {activeTab === 'pending' && currentUser.role === 'supreme_admin' && (
        <div className="space-y-4">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No pending approvals</p>
              <p className="text-slate-500 text-sm mt-1">All user registrations have been reviewed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-medium text-sm">
                      {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {user.role === 'supreme_admin' ? 'HQ' : user.role === 'super_admin' ? 'TM' : user.role === 'admin' ? 'AM' : 'Staff'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(user.created_at).toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      disabled={!!approvalLoading[user.id]}
                      className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 h-auto"
                    >
                      {approvalLoading[user.id] === 'approving' ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={!!approvalLoading[user.id]}
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1.5 h-auto"
                    >
                      {approvalLoading[user.id] === 'rejecting' ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <X className="w-3 h-3 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters - only show on All Users tab */}
      {activeTab === 'all' && <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Shield className="w-4 h-4 text-green-400" />
            <span>
              {filterRole
                ? roleOptions.find(r => r.value === filterRole)?.label || 'All Roles'
                : 'All Roles'
              }
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showRoleDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
              <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setFilterRole('')
                    setShowRoleDropdown(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                    !filterRole ? 'text-green-300 bg-slate-700/50' : 'text-slate-300'
                  }`}
                >
                  All Roles
                </button>
                {roleOptions.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => {
                      setFilterRole(role.value)
                      setShowRoleDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                      filterRole === role.value ? 'text-green-300 bg-slate-700/50' : 'text-slate-300'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {currentUser.role === 'supreme_admin' && (
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
      </div>}

      {/* Users Table */}
      {activeTab === 'all' && (
        pageLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-400">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">User</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase hidden md:table-cell">Location</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase hidden lg:table-cell">Last Login</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-slate-800/30 transition-colors ${!user.is_active && 'opacity-60'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-medium text-sm">
                          {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.full_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500 font-mono">{user.username}</p>
                            <button
                              onClick={() => copyToClipboard(user.username, `username-${user.id}`)}
                              className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                            >
                              {copiedId === `username-${user.id}` ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                        {user.role === 'supreme_admin' ? 'HQ' : user.role === 'super_admin' ? 'TM' : user.role === 'admin' ? 'AM' : 'Staff'}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {user.territory_name && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Globe className="w-3 h-3 text-purple-400" />
                            {user.territory_name}
                          </div>
                        )}
                        {user.branch_name && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Building2 className="w-3 h-3 text-cyan-400" />
                            {user.branch_name}
                          </div>
                        )}
                        {!user.territory_name && !user.branch_name && (
                          <span className="text-xs text-slate-600">Not assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <p className="text-xs text-slate-400">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString('en-AE', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Never'
                        }
                      </p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {currentUser.role === 'supreme_admin' ? (
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.is_active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {user.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className={`inline-flex p-1.5 rounded-lg ${
                          user.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {currentUser.role === 'supreme_admin' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.role !== 'supreme_admin' && (
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'all' && !pageLoading && filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">No users found</p>
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
              {selectedUser ? 'Edit User' : 'Add New User'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300">Role *</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={selectedUser}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {(selectedUser ? allRoleOptions : availableRoles).map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {/* Territory - show for TM role or when HQ creates AM/Staff */}
              {(formData.role === 'super_admin' || ((formData.role === 'admin' || formData.role === 'staff') && currentUser.role === 'supreme_admin')) && (
                <div className="space-y-2">
                  <Label htmlFor="territory" className="text-slate-300">Territory *</Label>
                  <select
                    id="territory"
                    value={formData.territory_id}
                    onChange={(e) => setFormData({ ...formData, territory_id: e.target.value, branch_id: '' })}
                    disabled={currentUser.role !== 'supreme_admin'}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    <option value="">Select territory</option>
                    {territories.map((territory) => (
                      <option key={territory.id} value={territory.id.toString()}>{territory.name} ({territory.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Branch - show for Staff role */}
              {formData.role === 'staff' && (
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-slate-300">Branch *</Label>
                  <select
                    id="branch"
                    value={formData.branch_id}
                    onChange={(e) => handleBranchSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select branch</option>
                    {filteredBranches.map((branch) => (
                      <option key={branch.id} value={branch.id.toString()}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">Username *</Label>
                  <Input
                    id="username"
                    placeholder={formData.role === 'staff' ? 'e.g., staff_ahmed' : 'e.g., tm_dubai'}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-slate-300">Full Name *</Label>
                  <Input
                    id="full_name"
                    placeholder="e.g., Ahmed Hassan"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., user@br-retailflow.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {!selectedUser && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white font-mono pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, password: generatePassword() })}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                        title="Generate new password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Auto-generated password</p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.password, 'form-password')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedId === 'form-password' ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                />
                <Label htmlFor="is_active" className="text-slate-300">User is active</Label>
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
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedUser ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsResetPasswordModalOpen(false)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Key className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Reset Password</h2>
              <p className="text-slate-400 text-sm mb-4">
                Reset password for <span className="text-white font-medium">{selectedUser?.full_name}</span>?
              </p>

              <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-500 mb-2">New Password</p>
                {newPassword ? (
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-lg text-white font-mono">{newPassword}</code>
                    <button
                      onClick={() => copyToClipboard(newPassword, 'reset-password')}
                      className="p-1.5 rounded hover:bg-slate-600 transition-colors"
                    >
                      {copiedId === 'reset-password' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    <span className="text-slate-400 text-sm">Resetting password...</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-amber-400/70 mb-4">Copy this password and share it with the user. It cannot be retrieved later.</p>

              <Button
                onClick={confirmResetPassword}
                disabled={!newPassword}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white"
              >
                Done
              </Button>
            </div>
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
              <h2 className="text-lg font-semibold text-white mb-2">Delete User</h2>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedUser?.full_name}</span> ({selectedUser?.username})? This action cannot be undone.
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

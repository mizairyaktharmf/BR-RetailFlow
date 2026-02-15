"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Globe,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  Building2,
  Users,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react'
import api from '@/services/api'

export default function TerritoriesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [territories, setTerritories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedTerritory, setSelectedTerritory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', code: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)

      // Only HQ can access this page
      if (userData.role !== 'supreme_admin') {
        router.push('/dashboard')
        return
      }
    }

    // Load real data from API
    loadTerritories()
  }, [router])

  const loadTerritories = async () => {
    try {
      const data = await api.getTerritories()
      setTerritories(data)
    } catch (err) {
      // Silently fail
    }
  }

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenModal = (territory = null) => {
    setSelectedTerritory(territory)
    setFormData(territory ? { name: territory.name, code: territory.code } : { name: '', code: '' })
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTerritory(null)
    setFormData({ name: '', code: '' })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      if (selectedTerritory) {
        const updated = await api.updateTerritory(selectedTerritory.id, {
          name: formData.name,
          code: formData.code.toUpperCase()
        })
        setTerritories(territories.map(t => t.id === selectedTerritory.id ? updated : t))
      } else {
        const created = await api.createTerritory({
          name: formData.name,
          code: formData.code.toUpperCase()
        })
        setTerritories([...territories, created])
      }
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Failed to save territory')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (territory) => {
    setSelectedTerritory(territory)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await api.deleteTerritory(selectedTerritory.id)
      setTerritories(territories.filter(t => t.id !== selectedTerritory.id))
      setIsDeleteModalOpen(false)
      setSelectedTerritory(null)
    } catch (err) {
      alert(err.message || 'Failed to delete territory')
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.role !== 'supreme_admin') return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-purple-400" />
            Territories
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage all territories in the network
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Territory
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search territories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Territories Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTerritories.map((territory) => (
          <Card key={territory.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">{territory.name}</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">{territory.code}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenModal(territory)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(territory)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold text-white">{territory.areas_count || 0}</p>
                  <p className="text-[10px] text-slate-500">Areas</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
                    <Building2 className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold text-white">{territory.branches_count || 0}</p>
                  <p className="text-[10px] text-slate-500">Branches</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                    <Users className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold text-white">{territory.users_count || 0}</p>
                  <p className="text-[10px] text-slate-500">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTerritories.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">No territories found</p>
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
              {selectedTerritory ? 'Edit Territory' : 'Add New Territory'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Territory Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Dubai"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">Territory Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., DXB"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 uppercase"
                />
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
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedTerritory ? 'Update' : 'Create'
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
              <h2 className="text-lg font-semibold text-white mb-2">Delete Territory</h2>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedTerritory?.name}</span>? This action cannot be undone.
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

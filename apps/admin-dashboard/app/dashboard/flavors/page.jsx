"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  IceCream,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react'
import api from '@/services/api'

export default function FlavorsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [flavors, setFlavors] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedFlavor, setSelectedFlavor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [formData, setFormData] = useState({ name: '', code: '', category: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)

      if (userData.role !== 'supreme_admin') {
        router.push('/dashboard')
        return
      }
    }

    loadFlavors()
  }, [router])

  const loadFlavors = async () => {
    setPageLoading(true)
    try {
      const data = await api.getFlavors()
      setFlavors(data || [])
    } catch (err) {
      // Silently fail
    } finally {
      setPageLoading(false)
    }
  }

  const filteredFlavors = flavors.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenModal = (flavor = null) => {
    setSelectedFlavor(flavor)
    setFormData(flavor
      ? { name: flavor.name, code: flavor.code, category: flavor.category || '' }
      : { name: '', code: '', category: '' }
    )
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedFlavor(null)
    setFormData({ name: '', code: '', category: '' })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Name and Code are required')
      return
    }

    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        category: formData.category || null,
      }

      if (selectedFlavor) {
        const updated = await api.updateFlavor(selectedFlavor.id, payload)
        setFlavors(flavors.map(f => f.id === selectedFlavor.id ? updated : f))
      } else {
        const created = await api.createFlavor(payload)
        setFlavors([...flavors, created])
      }
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Failed to save flavor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (flavor) => {
    setSelectedFlavor(flavor)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      await api.deleteFlavor(selectedFlavor.id)
      setFlavors(flavors.filter(f => f.id !== selectedFlavor.id))
      setIsDeleteModalOpen(false)
      setSelectedFlavor(null)
    } catch (err) {
      alert(err.message || 'Failed to delete flavor')
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
            <IceCream className="w-6 h-6 text-pink-400" />
            Ice Cream Flavors
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage all ice cream flavors available across branches
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Flavor
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search flavors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <span className="text-slate-400 text-xs">Total</span>
          <p className="text-white font-semibold">{flavors.length}</p>
        </div>
        <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <span className="text-slate-400 text-xs">Active</span>
          <p className="text-green-400 font-semibold">{flavors.filter(f => f.is_active).length}</p>
        </div>
      </div>

      {/* Loading */}
      {pageLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : (
        /* Flavors Table */
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Flavor</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Code</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase hidden sm:table-cell">Category</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlavors.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12">
                        <IceCream className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                        <p className="text-slate-400">
                          {searchTerm ? 'No flavors match your search' : 'No flavors added yet'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredFlavors.map((flavor) => (
                      <tr key={flavor.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                              <IceCream className="w-4 h-4 text-pink-400" />
                            </div>
                            <span className="text-white font-medium">{flavor.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs font-mono">{flavor.code}</span>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <span className="text-slate-400 text-sm">{flavor.category || '—'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleOpenModal(flavor)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(flavor)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
              {selectedFlavor ? 'Edit Flavor' : 'Add New Flavor'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Flavor Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Vanilla"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">Flavor Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., VAN"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-300">Category (Optional)</Label>
                <Input
                  id="category"
                  placeholder="e.g., Classic, Seasonal, NSA"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
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
                  className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedFlavor ? 'Update' : 'Create'
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
              <h2 className="text-lg font-semibold text-white mb-2">Delete Flavor</h2>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{selectedFlavor?.name}</span>?
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

"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  ClipboardCheck, Plus, Loader2, X, Clock, Building2,
  Camera, Trash2, Check, MapPin, Timer, Users,
  ChevronLeft, ChevronRight, Image as ImageIcon
} from 'lucide-react'
import api from '@/services/api'

const formatTime = (isoStr) => {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const formatHours = (h) => {
  if (!h && h !== 0) return '-'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

const getTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const nowLocalInput = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BranchVisitsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [visits, setVisits] = useState([])
  const [branches, setBranches] = useState([])
  const [amUsers, setAmUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef(null)

  // View date (for browsing history)
  const [viewDate, setViewDate] = useState(getTodayStr())
  const [filterUser, setFilterUser] = useState('')

  // Form state — today only
  const [formBranch, setFormBranch] = useState('')
  const [formSwipeIn, setFormSwipeIn] = useState(nowLocalInput())
  const [formSwipeOut, setFormSwipeOut] = useState('')
  const [formPhoto, setFormPhoto] = useState(null)
  const [formPhotoPreview, setFormPhotoPreview] = useState(null)
  const [extracting, setExtracting] = useState(false)

  // Edit swipe out
  const [editId, setEditId] = useState(null)
  const [editSwipeOut, setEditSwipeOut] = useState('')

  // Photo modal
  const [viewPhoto, setViewPhoto] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      loadBranches()
      if (['supreme_admin', 'super_admin'].includes(userData.role)) {
        loadAMUsers()
      }
    }
  }, [])

  const loadVisits = async () => {
    setLoading(true)
    try {
      const filters = { date_from: viewDate, date_to: viewDate }
      if (filterUser) filters.user_id = filterUser
      const data = await api.getBranchVisits(filters)
      setVisits(data || [])
    } catch (err) {
      setVisits([])
    } finally {
      setLoading(false)
    }
  }

  const loadBranches = async () => {
    try { setBranches(await api.getBranches() || []) } catch { setBranches([]) }
  }

  const loadAMUsers = async () => {
    try { setAmUsers(await api.getUsers({ role: 'admin' }) || []) } catch { setAmUsers([]) }
  }

  useEffect(() => {
    if (user) loadVisits()
  }, [user, viewDate, filterUser])

  const changeDate = (offset) => {
    const d = new Date(viewDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setViewDate(newDate)
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 800
        let w = img.width, h = img.height
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize }
          else { w = (w / h) * maxSize; h = maxSize }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        setFormPhoto(base64)
        setFormPhotoPreview(base64)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)

    // Extract swipe times from photo using Gemini
    setExtracting(true)
    try {
      const result = await api.extractVisitTimes(file)
      if (result) {
        // Auto-fill swipe in time
        if (result.swipe_in) {
          const today = getTodayStr()
          const inTime = `${today}T${result.swipe_in}`
          setFormSwipeIn(inTime)
        }
        // Auto-fill swipe out time
        if (result.swipe_out) {
          const today = getTodayStr()
          const outTime = `${today}T${result.swipe_out}`
          setFormSwipeOut(outTime)
        }
      }
    } catch (err) {
      console.log('Time extraction failed, manual entry needed:', err.message)
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async () => {
    if (!formBranch) { alert('Please select a branch'); return }
    if (!formSwipeIn) { alert('Please set swipe in time'); return }
    setCreating(true)
    try {
      const today = getTodayStr()
      await api.createBranchVisit({
        branch_id: parseInt(formBranch),
        visit_date: today,
        swipe_in: new Date(formSwipeIn).toISOString(),
        swipe_out: formSwipeOut ? new Date(formSwipeOut).toISOString() : null,
        photo_url: formPhoto,
      })
      setShowForm(false)
      resetForm()
      setViewDate(today)
      loadVisits()
    } catch (err) {
      alert('Failed to log visit: ' + (err.message || 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormBranch('')
    setFormSwipeIn(nowLocalInput())
    setFormSwipeOut('')
    setFormPhoto(null)
    setFormPhotoPreview(null)
  }

  const handleSwipeOut = async (visitId) => {
    if (!editSwipeOut) return
    try {
      await api.updateBranchVisit(visitId, { swipe_out: new Date(editSwipeOut).toISOString() })
      setEditId(null); setEditSwipeOut('')
      loadVisits()
    } catch { alert('Failed to update') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this visit?')) return
    try { await api.deleteBranchVisit(id); loadVisits() } catch { alert('Failed to delete') }
  }

  const isManager = user && ['supreme_admin', 'super_admin'].includes(user.role)
  const isToday = viewDate === getTodayStr()

  // Group visits by user for the daily column view
  const groupedByUser = {}
  visits.forEach(v => {
    if (!groupedByUser[v.user_id]) {
      groupedByUser[v.user_id] = { user_name: v.user_name, visits: [], totalHours: 0 }
    }
    groupedByUser[v.user_id].visits.push(v)
    groupedByUser[v.user_id].totalHours += (v.hours_spent || 0)
  })

  const totalDayHours = visits.reduce((s, v) => s + (v.hours_spent || 0), 0)
  const uniqueBranches = [...new Set(visits.map(v => v.branch_name))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Branch Visits</h1>
            <p className="text-sm text-gray-400">Swipe In / Swipe Out Tracking</p>
          </div>
        </div>
        {isToday && (
          <Button onClick={() => { setShowForm(!showForm); if (!showForm) resetForm() }} className="bg-teal-500 hover:bg-teal-600 text-white">
            {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showForm ? 'Cancel' : 'Log Visit'}
          </Button>
        )}
      </div>

      {/* Log Visit Form — TODAY ONLY */}
      {showForm && (
        <Card className="bg-gray-800/50 border-teal-500/30">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Log Branch Visit — Today</h2>

            {/* Branch Select */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Select Branch</label>
              <select value={formBranch} onChange={e => setFormBranch(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2.5 text-sm">
                <option value="">Select branch you're visiting...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Photo — OPTIONAL, used for auto-extracting swipe times */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                POS Photo <span className="text-gray-500 text-xs">(optional — auto-reads swipe times)</span>
              </label>
              {formPhotoPreview ? (
                <div className="relative inline-block">
                  <img src={formPhotoPreview} alt="POS" className="h-40 rounded-xl border-2 border-teal-500/50 object-cover" />
                  <button onClick={() => { setFormPhoto(null); setFormPhotoPreview(null) }}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1">
                    <X className="h-3 w-3 text-white" />
                  </button>
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute bottom-1 right-1 bg-gray-800/80 rounded-lg px-2 py-1 text-xs text-white">
                    Retake
                  </button>
                  {extracting && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center">
                      <Loader2 className="h-6 w-6 text-teal-400 animate-spin mb-1" />
                      <span className="text-xs text-teal-300">Reading times...</span>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-teal-500/50 hover:text-teal-400 transition-all">
                  <Camera className="h-7 w-7" />
                  <span className="text-sm">Upload POS photo to auto-fill times</span>
                  <span className="text-xs text-gray-500">Or enter times manually below</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
            </div>

            {/* Swipe Times */}
            {extracting && (
              <div className="flex items-center gap-2 text-sm text-teal-400 bg-teal-500/10 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading swipe times from photo...
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-400">Swipe In</label>
                  <button onClick={() => setFormSwipeIn(nowLocalInput())} className="text-xs text-teal-400 hover:text-teal-300">Now</button>
                </div>
                <Input type="datetime-local" value={formSwipeIn} onChange={e => setFormSwipeIn(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white [color-scheme:dark]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-400">Swipe Out</label>
                  <button onClick={() => setFormSwipeOut(nowLocalInput())} className="text-xs text-teal-400 hover:text-teal-300">Now</button>
                </div>
                <Input type="datetime-local" value={formSwipeOut} onChange={e => setFormSwipeOut(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white [color-scheme:dark]" />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={creating || extracting} className="bg-teal-500 hover:bg-teal-600 text-white w-full h-11">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {creating ? 'Logging...' : extracting ? 'Reading photo...' : 'Submit Visit'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-3">
        <button onClick={() => changeDate(-1)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-white font-medium">{formatDisplayDate(viewDate)}</p>
          {isToday && <span className="text-xs text-teal-400">Today</span>}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday}
          className={`p-2 rounded-lg ${isToday ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* AM Filter for managers */}
      {isManager && (
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          className="bg-gray-800/50 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm w-full">
          <option value="">All Area Managers</option>
          {amUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      )}

      {/* Day Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <MapPin className="h-5 w-5 text-teal-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{visits.length}</p>
            <p className="text-xs text-gray-400">Visits</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <Timer className="h-5 w-5 text-teal-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{formatHours(totalDayHours)}</p>
            <p className="text-xs text-gray-400">Total Hours</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 text-center">
            <Building2 className="h-5 w-5 text-teal-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{uniqueBranches.length}</p>
            <p className="text-xs text-gray-400">Branches</p>
          </CardContent>
        </Card>
      </div>

      {/* Visit Cards — Grouped by AM */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
        </div>
      ) : visits.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center text-gray-400">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No visits on this day</p>
            {isToday && <p className="text-sm mt-1">Click "Log Visit" to record a branch visit</p>}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByUser).map(([userId, group]) => (
          <Card key={userId} className="bg-gray-800/50 border-gray-700 overflow-hidden">
            {/* AM Header */}
            <div className="bg-teal-500/10 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                <span className="text-white font-medium">{group.user_name}</span>
                <span className="text-xs text-gray-500">{group.visits.length} {group.visits.length === 1 ? 'visit' : 'visits'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-teal-400" />
                <span className="text-teal-400 font-bold text-lg">{formatHours(group.totalHours)}</span>
                <span className="text-xs text-gray-500">total</span>
              </div>
            </div>

            {/* Visit Rows */}
            <CardContent className="p-0">
              {group.visits.map((v, idx) => (
                <div key={v.id} className={`px-4 py-3 flex items-center gap-4 ${idx > 0 ? 'border-t border-gray-700/50' : ''} hover:bg-gray-700/20`}>
                  {/* Photo Thumbnail */}
                  <div className="flex-shrink-0">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt="Proof"
                        className="h-14 w-14 rounded-lg object-cover border border-gray-600 cursor-pointer hover:border-teal-500 transition-all"
                        onClick={() => setViewPhoto(v.photo_url)} />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-gray-700/50 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* Branch & Times */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-3.5 w-3.5 text-teal-400" />
                      <span className="text-white font-medium text-sm truncate">{v.branch_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-400">
                        <Clock className="h-3 w-3 inline mr-0.5" />In: {formatTime(v.swipe_in)}
                      </span>
                      {v.swipe_out ? (
                        <span className="text-red-400">
                          <Clock className="h-3 w-3 inline mr-0.5" />Out: {formatTime(v.swipe_out)}
                        </span>
                      ) : editId === v.id ? (
                        <span className="flex items-center gap-1">
                          <input type="datetime-local" value={editSwipeOut}
                            onChange={e => setEditSwipeOut(e.target.value)}
                            className="bg-gray-700 text-white text-[11px] rounded px-1 py-0.5 w-36 [color-scheme:dark]" />
                          <button onClick={() => handleSwipeOut(v.id)} className="text-green-400"><Check className="h-3 w-3" /></button>
                          <button onClick={() => setEditId(null)} className="text-red-400"><X className="h-3 w-3" /></button>
                        </span>
                      ) : isToday ? (
                        <button onClick={() => { setEditId(v.id); setEditSwipeOut(nowLocalInput()) }}
                          className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-[11px] hover:bg-orange-500/30">
                          Swipe Out
                        </button>
                      ) : (
                        <span className="text-gray-500">No swipe out</span>
                      )}
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${v.hours_spent ? 'text-teal-400' : 'text-gray-600'}`}>
                      {formatHours(v.hours_spent)}
                    </p>
                  </div>

                  {/* Delete */}
                  {(isToday || isManager) && (
                    <button onClick={() => handleDelete(v.id)} className="text-red-400/30 hover:text-red-400 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Photo Modal */}
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={viewPhoto} alt="Visit proof" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
            <button onClick={() => setViewPhoto(null)}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-2 text-white hover:bg-black/80">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

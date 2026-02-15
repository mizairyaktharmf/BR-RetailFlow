"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  User,
  Mail,
  Phone,
  Shield,
  Globe,
  MapPin,
  Building2,
  Key,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react'
import api from '@/services/api'

const roleLabels = {
  supreme_admin: 'HQ Admin',
  super_admin: 'Territory Manager (TM)',
  admin: 'Area Manager (AM)',
  staff: 'Flavor Expert',
}

const roleColors = {
  supreme_admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  super_admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  admin: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  staff: 'bg-green-500/20 text-green-300 border-green-500/30',
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const userData = await api.getCurrentUser()
      setUser(userData)
      setFullName(userData.full_name || '')
      setPhone(userData.phone || '')
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })

    if (!fullName.trim()) {
      setProfileMsg({ type: 'error', text: 'Full name is required' })
      return
    }

    setProfileSaving(true)
    try {
      const updated = await api.updateProfile({ full_name: fullName.trim(), phone: phone.trim() || null })
      setUser(updated)
      // Update localStorage so sidebar reflects changes
      const stored = localStorage.getItem('br_admin_user')
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.full_name = updated.full_name
        parsed.phone = updated.phone
        localStorage.setItem('br_admin_user', JSON.stringify(parsed))
      }
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg({ type: '', text: '' })

    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Current password is required' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setPasswordSaving(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'success', text: 'Password changed successfully' })
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password' })
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <User className="w-7 h-7 text-purple-400" />
            My Profile
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your account details and password</p>
        </div>
      </div>

      {/* User Info Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl">
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">{user?.full_name}</h2>
              <p className="text-slate-400 text-sm">@{user?.username}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${roleColors[user?.role] || 'bg-slate-600 text-slate-300'}`}>
                  <Shield className="w-3 h-3 inline mr-1" />
                  {roleLabels[user?.role] || user?.role}
                </span>
                {user?.territory_name && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {user.territory_name}
                  </span>
                )}
                {user?.area_name && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {user.area_name}
                  </span>
                )}
                {user?.branch_name && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {user.branch_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            Edit Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {profileMsg.text && (
              <Alert className={profileMsg.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}>
                <AlertDescription className={profileMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                  {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <AlertCircle className="w-4 h-4 inline mr-2" />}
                  {profileMsg.text}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Username</Label>
                <div className="relative">
                  <Input
                    value={user?.username || ''}
                    disabled
                    className="bg-slate-700/30 border-slate-600 text-slate-500 pl-9"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-slate-500">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Email</Label>
                <div className="relative">
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-slate-700/30 border-slate-600 text-slate-500 pl-9"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-slate-500">Contact HQ to change email</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., +971 50 123 4567"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pl-9"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={profileSaving}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {profileSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordMsg.text && (
              <Alert className={passwordMsg.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}>
                <AlertDescription className={passwordMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                  {passwordMsg.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <AlertCircle className="w-4 h-4 inline mr-2" />}
                  {passwordMsg.text}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-slate-300">Current Password *</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-slate-300">New Password *</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={passwordSaving}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {passwordSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Changing...</>
                ) : (
                  <><Key className="w-4 h-4 mr-2" /> Change Password</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

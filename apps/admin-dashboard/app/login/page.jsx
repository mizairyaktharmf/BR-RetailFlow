"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IceCream, Loader2, Eye, EyeOff, Shield, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api from '@/services/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.login(credentials.username, credentials.password)

      const allowedRoles = ['supreme_admin', 'super_admin', 'admin']
      if (!allowedRoles.includes(response.user.role)) {
        setError('Access denied. This dashboard is only for administrators.')
        api.clearToken()
        setLoading(false)
        return
      }

      localStorage.setItem('br_admin_token', localStorage.getItem('br_token'))
      localStorage.setItem('br_admin_user', JSON.stringify(response.user))

      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = (role) => {
    setDemoLoading(true)

    const demoUsers = {
      supreme_admin: {
        id: 1,
        email: 'hq@br-retailflow.com',
        username: 'hq_admin',
        full_name: 'HQ Administrator',
        role: 'supreme_admin',
        role_label: 'HQ',
        territory_id: null,
        area_id: null,
        branch_id: null,
      },
      super_admin: {
        id: 2,
        email: 'tm.dubai@br-retailflow.com',
        username: 'tm_dubai',
        full_name: 'Dubai Territory Manager',
        role: 'super_admin',
        role_label: 'TM',
        territory_id: 1,
        territory_name: 'Dubai',
        area_id: null,
        branch_id: null,
      },
      admin: {
        id: 3,
        email: 'am.karama@br-retailflow.com',
        username: 'am_karama',
        full_name: 'Karama Area Manager',
        role: 'admin',
        role_label: 'AM',
        territory_id: 1,
        territory_name: 'Dubai',
        area_id: 1,
        area_name: 'Karama',
        branch_id: null,
      },
    }

    const demoUser = demoUsers[role]
    localStorage.setItem('br_admin_user', JSON.stringify(demoUser))
    localStorage.setItem('br_admin_token', 'demo_admin_token')
    localStorage.setItem('br_demo_mode', 'true')

    setTimeout(() => {
      router.push('/dashboard')
    }, 800)
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-500"></div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 p-[2px] shadow-2xl">
            <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">BR-RetailFlow</h1>
          <p className="text-slate-400 text-sm">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800/50 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center text-white">Administrator Login</CardTitle>
            <CardDescription className="text-center text-slate-400">
              Manage territories, areas, branches & stewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  disabled={loading}
                  required
                  className="h-11 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    disabled={loading}
                    required
                    className="h-11 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Buttons */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center mb-3">Quick Demo Access</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin('supreme_admin')}
                  disabled={demoLoading}
                  className="bg-purple-500/10 border-purple-500/50 text-purple-300 hover:bg-purple-500/20 hover:text-white text-xs"
                >
                  <Play className="w-3 h-3 mr-1" />
                  HQ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin('super_admin')}
                  disabled={demoLoading}
                  className="bg-blue-500/10 border-blue-500/50 text-blue-300 hover:bg-blue-500/20 hover:text-white text-xs"
                >
                  <Play className="w-3 h-3 mr-1" />
                  TM
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin('admin')}
                  disabled={demoLoading}
                  className="bg-cyan-500/10 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:text-white text-xs"
                >
                  <Play className="w-3 h-3 mr-1" />
                  AM
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Info */}
        <div className="mt-6 max-w-md w-full">
          <div className="bg-slate-800/30 backdrop-blur rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-white text-sm font-medium mb-3">Admin Roles & Permissions</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">HQ</span>
                <span className="text-slate-400">Full access - Territories, Areas, Branches, All Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">TM</span>
                <span className="text-slate-400">Territory Manager - Areas, Branches, AMs & Stewards</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium">AM</span>
                <span className="text-slate-400">Area Manager - Branches & Stewards in area</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 text-center relative z-10">
        <p className="text-slate-600 text-xs">BR-RetailFlow Admin v1.0</p>
      </div>
    </div>
  )
}

"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, Shield, Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api from '@/services/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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

      // Check if user has admin role
      const allowedRoles = ['hq', 'tm', 'am', 'supreme_admin', 'super_admin', 'admin']
      if (!allowedRoles.includes(response.user.role)) {
        setError('Access denied. This dashboard is only for administrators.')
        api.clearToken()
        setLoading(false)
        return
      }

      // Store admin user data
      localStorage.setItem('admin_user', JSON.stringify(response.user))

      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-0 -right-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-500"></div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-[3px] shadow-2xl shadow-purple-500/30">
            <div className="w-full h-full rounded-3xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">BR-RetailFlow</h1>
          <p className="text-slate-400 text-lg">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-md shadow-2xl border-slate-700/50 bg-slate-800/60 backdrop-blur-xl">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to manage your ice cream empire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300 text-sm font-medium">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    disabled={loading}
                    required
                    className="h-12 pl-11 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    disabled={loading}
                    required
                    className="h-12 pl-11 pr-11 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500 focus:ring-pink-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Role Info */}
        <div className="mt-8 max-w-md w-full">
          <div className="bg-slate-800/30 backdrop-blur rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-white text-sm font-semibold mb-4 text-center">Admin Access Levels</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/20">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 font-bold text-xs border border-pink-500/30">HQ</span>
                <span className="text-slate-300 text-sm">Headquarters - Full system access</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/20">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 font-bold text-xs border border-blue-500/30">TM</span>
                <span className="text-slate-300 text-sm">Territory Manager - Manage territory</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/20">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">AM</span>
                <span className="text-slate-300 text-sm">Area Manager - Manage area branches</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center relative z-10">
        <p className="text-slate-500 text-sm">Baskin Robbins UAE - Ice Cream Inventory System</p>
      </div>
    </div>
  )
}

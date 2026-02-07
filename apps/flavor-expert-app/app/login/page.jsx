"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IceCream, Loader2, Eye, EyeOff, Store, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api from '@/services/api'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({
    branchId: '',
    password: '',
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.login(credentials.branchId, credentials.password)

      // Check if user is a flavor expert (staff role)
      if (response.user.role !== 'staff') {
        setError('This app is only for Flavor Experts. Please use the admin dashboard.')
        api.clearToken()
        setLoading(false)
        return
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Gradient Orbs */}
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute top-0 -right-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-500"></div>
        <div className="absolute bottom-20 right-20 w-60 h-60 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwYTEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-40"></div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 p-[2px] shadow-2xl shadow-purple-500/25">
              <div className="w-full h-full rounded-2xl bg-slate-900/90 backdrop-blur flex items-center justify-center">
                <IceCream className="w-12 h-12 text-white" />
              </div>
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            BR-RetailFlow
          </h1>
          <p className="text-slate-400 text-sm">
            Ice Cream Inventory Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/10 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center text-white font-semibold">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              Sign in with your branch credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="py-2 bg-red-500/20 border-red-500/50">
                  <AlertDescription className="text-sm text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="branchId" className="text-slate-200 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Branch ID
                </Label>
                <Input
                  id="branchId"
                  type="text"
                  placeholder="Enter your branch ID (e.g., BR-KRM-001)"
                  value={credentials.branchId}
                  onChange={(e) =>
                    setCredentials({ ...credentials, branchId: e.target.value })
                  }
                  disabled={loading}
                  required
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-400/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials({ ...credentials, password: e.target.value })
                    }
                    disabled={loading}
                    required
                    className="h-12 pr-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-400/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-purple-400 hover:to-pink-400 border-0 shadow-lg shadow-purple-500/25 transition-all duration-300"
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

            {/* Help text */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-slate-400">
                Having trouble logging in?
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Contact your Area Manager for assistance
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-8 max-w-md w-full">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              What is BR-RetailFlow?
            </h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">•</span>
                Track daily ice cream inventory levels
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">•</span>
                Record sales at designated time windows
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                Manage incoming stock from warehouse
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
                Help optimize inventory ordering
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center relative z-10">
        <p className="text-slate-500 text-xs">
          BR-RetailFlow v1.0 | Inventory Management System
        </p>
      </div>
    </div>
  )
}

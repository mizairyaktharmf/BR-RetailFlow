"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IceCream, Loader2, Eye, EyeOff } from 'lucide-react'
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
    username: '',
    password: '',
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.login(credentials.username, credentials.password)

      // Check if user is a steward (staff role)
      if (response.user.role !== 'staff') {
        setError('This app is only for branch stewards. Please use the admin dashboard.')
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo and Welcome */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <IceCream className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">BR-RetailFlow</h1>
          <p className="text-pink-100 text-sm">
            Baskin Robbins Inventory Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Steward Login</CardTitle>
            <CardDescription className="text-center">
              Enter your branch credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Branch ID / Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your branch ID"
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials({ ...credentials, username: e.target.value })
                  }
                  disabled={loading}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                className="w-full h-12 text-base"
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

            {/* Help text */}
            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Having trouble logging in?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your Area Manager for assistance
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-8 text-center max-w-sm">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">What is BR-RetailFlow?</h3>
            <p className="text-pink-100 text-sm leading-relaxed">
              This system helps you track daily ice cream inventory, record sales at specific times,
              and manage incoming stock from the warehouse. Your data helps the company make better
              ordering decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center">
        <p className="text-pink-200 text-xs">
          BR-RetailFlow v1.0 | Baskin Robbins UAE
        </p>
      </div>
    </div>
  )
}

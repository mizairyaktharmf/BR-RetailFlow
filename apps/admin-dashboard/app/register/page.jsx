"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, Eye, EyeOff, User, Mail, Phone, Lock, Award, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import api from '@/services/api'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [step, setStep] = useState(1) // 1 or 2
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: 'supreme_admin'
  })

  const handleNext = (e) => {
    e.preventDefault()
    setError('')

    // Validate step 1 fields
    if (!formData.full_name || !formData.email || !formData.username) {
      setError('Please fill in all required fields')
      return
    }

    setStep(2)
  }

  const handleBack = () => {
    setError('')
    setStep(1)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const data = await api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role
        }),
      })

      // Store verification code and show to user
      setVerificationCode(data.verification_code)
      setSuccess(true)

      // Redirect to verify page after 3 seconds
      setTimeout(() => {
        router.push(`/verify?email=${encodeURIComponent(formData.email)}`)
      }, 3000)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-[3px] shadow-2xl shadow-purple-500/30">
            <div className="w-full h-full rounded-3xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">BR-RetailFlow</h1>
          <p className="text-slate-400">Create Admin Account</p>
        </div>

        {/* Register Card */}
        <Card className="w-full max-w-md shadow-2xl border-slate-700/50 bg-slate-800/60 backdrop-blur-xl">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-xl text-white">Register New Admin</CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Step {step} of 2: {step === 1 ? 'Basic Information' : 'Account Setup'}
            </CardDescription>
            {/* Progress bar */}
            <div className="flex gap-2 mt-3">
              <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-slate-600'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-slate-600'}`}></div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={step === 1 ? handleNext : handleRegister} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {success && verificationCode && (
                <Alert className="bg-green-500/10 border-green-500/50 p-4">
                  <AlertDescription className="text-green-300 text-sm space-y-2">
                    <p className="font-semibold">Account created successfully!</p>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-green-500/30">
                      <p className="text-xs text-slate-400 mb-1">Your verification code:</p>
                      <p className="text-2xl font-bold text-white tracking-widest text-center">{verificationCode}</p>
                    </div>
                    <p className="text-xs">Save this code! Redirecting to verification page...</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* STEP 1: Basic Information */}
              {step === 1 && (
                <>
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-slate-300 text-sm">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    disabled={loading}
                    required
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                    required
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300 text-sm">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    disabled={loading}
                    required
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300 text-sm">Phone (Optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+971-XXX-XXX-XXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={loading}
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25"
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
                </>
              )}

              {/* STEP 2: Account Setup */}
              {step === 2 && (
                <>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Account Level
                </Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={loading}
                  className="h-10 w-full px-3 bg-slate-700/50 border border-slate-600 rounded-md text-white focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                >
                  <option value="supreme_admin" className="bg-slate-800">🏢 Supreme Admin (HQ) - Full System Access</option>
                  <option value="super_admin" className="bg-slate-800">🗺️ Super Admin (TM) - Territory Manager</option>
                  <option value="admin" className="bg-slate-800">📍 Admin (AM) - Area Manager</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={loading}
                    required
                    className="h-10 pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    disabled={loading}
                    required
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleBack}
                  className="h-10 text-sm font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 text-sm font-semibold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
                </>
              )}

              <div className="text-center mt-4">
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Already have an account? Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-4 text-center relative z-10">
        <p className="text-slate-500 text-sm">Baskin Robbins UAE - Ice Cream Inventory System</p>
      </div>
    </div>
  )
}

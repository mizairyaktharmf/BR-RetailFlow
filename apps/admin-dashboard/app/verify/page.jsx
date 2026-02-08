"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Loader2, Mail, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  useEffect(() => {
    // Get email from URL params if available
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('http://16.171.137.58:8000/api/v1/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          verification_code: verificationCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Verification failed')
      }

      // Store token and user data
      localStorage.setItem('admin_token', data.access_token)
      localStorage.setItem('admin_user', JSON.stringify(data.user))

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
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
          <p className="text-slate-400">Verify Your Account</p>
        </div>

        {/* Verify Card */}
        <Card className="w-full max-w-md shadow-2xl border-slate-700/50 bg-slate-800/60 backdrop-blur-xl">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-xl text-white">Email Verification</CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Enter the 6-digit code to verify your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                  <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-500/10 border-green-500/50 py-2">
                  <AlertDescription className="text-green-300 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Account verified successfully! Redirecting to dashboard...
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="h-10 pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300 text-sm">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  required
                  maxLength={6}
                  className="h-12 text-center text-2xl font-bold tracking-widest bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                />
                <p className="text-xs text-slate-400 text-center">
                  Check your registration confirmation for the code
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25"
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verify Account
                  </>
                )}
              </Button>

              <div className="text-center mt-4 space-y-2">
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors block">
                  Already verified? Sign in
                </Link>
                <Link href="/register" className="text-sm text-slate-400 hover:text-white transition-colors block">
                  Don't have an account? Register
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="mt-6 max-w-md">
          <div className="bg-slate-800/30 backdrop-blur rounded-lg p-4 border border-slate-700/50">
            <p className="text-slate-300 text-sm text-center">
              💡 The verification code expires in <strong>30 minutes</strong>
            </p>
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

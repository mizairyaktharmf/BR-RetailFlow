"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Globe,
  MapPin,
  Building2,
  Users,
  TrendingUp,
  Package,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

const roleLabels = {
  supreme_admin: 'HQ',
  super_admin: 'TM',
  admin: 'AM',
}

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    const demoMode = localStorage.getItem('br_demo_mode')

    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsDemo(demoMode === 'true')

    // Demo stats based on role
    if (demoMode === 'true' && storedUser) {
      const userData = JSON.parse(storedUser)
      if (userData.role === 'supreme_admin') {
        setStats({
          territories: 5,
          areas: 18,
          branches: 52,
          users: 156,
          activeToday: 48,
          inventorySubmitted: 45,
          salesSubmitted: 42,
        })
      } else if (userData.role === 'super_admin') {
        setStats({
          areas: 4,
          branches: 12,
          users: 36,
          activeToday: 10,
          inventorySubmitted: 10,
          salesSubmitted: 9,
        })
      } else {
        setStats({
          branches: 3,
          users: 9,
          activeToday: 3,
          inventorySubmitted: 3,
          salesSubmitted: 2,
        })
      }
    }
  }, [])

  if (!user) return null

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {user.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Here's what's happening in your {user.role === 'supreme_admin' ? 'network' : user.role === 'super_admin' ? 'territory' : 'area'} today.
          </p>
        </div>
        {isDemo && (
          <div className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            Demo Mode
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'supreme_admin' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium">Territories</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats?.territories || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {(user.role === 'supreme_admin' || user.role === 'super_admin') && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium">Areas</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats?.areas || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Branches</p>
                <p className="text-2xl font-bold text-white mt-1">{stats?.branches || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Users</p>
                <p className="text-2xl font-bold text-white mt-1">{stats?.users || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Activity */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Today's Activity</CardTitle>
            <CardDescription className="text-slate-400">Branch submission status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Inventory Submitted</p>
                  <p className="text-xs text-slate-400">Branches completed today</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{stats?.inventorySubmitted || 0}</p>
                <p className="text-xs text-slate-500">of {stats?.branches || 0}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Sales Reported</p>
                  <p className="text-xs text-slate-400">At least one window</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{stats?.salesSubmitted || 0}</p>
                <p className="text-xs text-slate-500">of {stats?.branches || 0}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Active Stewards</p>
                  <p className="text-xs text-slate-400">Logged in today</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{stats?.activeToday || 0}</p>
                <p className="text-xs text-slate-500">of {stats?.users || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-400">Common management tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.role === 'supreme_admin' && (
              <a
                href="/dashboard/territories"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Manage Territories</p>
                  <p className="text-xs text-slate-400">Add, edit, or remove territories</p>
                </div>
              </a>
            )}

            {(user.role === 'supreme_admin' || user.role === 'super_admin') && (
              <a
                href="/dashboard/areas"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Manage Areas</p>
                  <p className="text-xs text-slate-400">Add, edit, or remove areas</p>
                </div>
              </a>
            )}

            <a
              href="/dashboard/branches"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Manage Branches</p>
                <p className="text-xs text-slate-400">Add, edit, or remove branches</p>
              </div>
            </a>

            <a
              href="/dashboard/users"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Manage Users</p>
                <p className="text-xs text-slate-400">Add stewards and set credentials</p>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

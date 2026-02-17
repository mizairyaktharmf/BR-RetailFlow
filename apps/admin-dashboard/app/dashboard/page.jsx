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
  CheckCircle2,
  Cake,
  UserPlus,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/services/api'

const roleLabels = {
  supreme_admin: 'HQ',
  super_admin: 'TM',
  admin: 'AM',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [cakeAlerts, setCakeAlerts] = useState({ alerts: [], total_count: 0, critical_count: 0, warning_count: 0 })
  const [pendingApprovals, setPendingApprovals] = useState([])

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')

    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }

    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setStatsLoading(true)
    try {
      const storedUser = localStorage.getItem('br_admin_user')
      const userData = storedUser ? JSON.parse(storedUser) : null

      // Fetch real counts from API in parallel
      const [territoriesData, amData, branchesData, usersData] = await Promise.all([
        api.getTerritories().catch(() => []),
        api.getUsers({ role: 'admin' }).catch(() => []),
        api.getBranches().catch(() => []),
        api.getUsers().catch(() => []),
      ])

      setStats({
        territories: territoriesData.length,
        areaManagers: amData.length,
        branches: branchesData.length,
        users: usersData.length,
      })

      // Load cake low-stock alerts (TM and AM only — HQ does not see cake alerts)
      if (userData?.role === 'admin' || userData?.role === 'super_admin') {
        try {
          const cakeData = await api.getCakeLowStockAlerts()
          setCakeAlerts(cakeData)
        } catch (err) {
          // Silently fail
        }
      }

      // Load pending approvals (HQ only)
      if (userData?.role === 'supreme_admin') {
        try {
          const pending = await api.getPendingApprovals()
          setPendingApprovals(pending)
        } catch (err) {
          // Silently fail
        }
      }
    } catch (err) {
      // Silently fail
    } finally {
      setStatsLoading(false)
    }
  }

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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'supreme_admin' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium">Territories</p>
                  {statsLoading ? (
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin mt-2" />
                  ) : (
                    <p className="text-2xl font-bold text-white mt-1">{stats?.territories || 0}</p>
                  )}
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
                  <p className="text-slate-400 text-xs font-medium">Area Managers</p>
                  {statsLoading ? (
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin mt-2" />
                  ) : (
                    <p className="text-2xl font-bold text-white mt-1">{stats?.areaManagers || 0}</p>
                  )}
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
                {statsLoading ? (
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">{stats?.branches || 0}</p>
                )}
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
                {statsLoading ? (
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">{stats?.users || 0}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Banner */}
      {user.role === 'supreme_admin' && pendingApprovals.length > 0 && (
        <div
          className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"
          onClick={() => router.push('/dashboard/users?tab=pending')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">
                {pendingApprovals.length} Pending Account Approval{pendingApprovals.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                {pendingApprovals.slice(0, 3).map(u => `${u.full_name} (${u.role})`).join(' | ')}
                {pendingApprovals.length > 3 && ` +${pendingApprovals.length - 3} more`}
              </p>
            </div>
            <span className="text-xs text-amber-400">Review Now</span>
          </div>
        </div>
      )}

      {/* Cake Alerts Banner — TM and AM only */}
      {(user.role === 'admin' || user.role === 'super_admin') && cakeAlerts.total_count > 0 && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Cake className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">
                Low Cake Stock — {cakeAlerts.total_count} item{cakeAlerts.total_count > 1 ? 's' : ''}
                {cakeAlerts.critical_count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-500/30 text-red-200">
                    {cakeAlerts.critical_count} critical
                  </span>
                )}
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">Thresholds are set per-branch from the Flavor Expert app</p>
            </div>
          </div>
          <div className="space-y-1.5 ml-[52px]">
            {cakeAlerts.alerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{a.cake_name} <span className="text-slate-500">({a.branch_name})</span></span>
                <span className={a.current_quantity === 0 ? 'text-red-400 font-medium' : 'text-amber-400'}>{a.current_quantity} pcs</span>
              </div>
            ))}
            {cakeAlerts.total_count > 5 && (
              <p className="text-[11px] text-slate-500">+{cakeAlerts.total_count - 5} more alerts</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
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
                  <p className="text-sm font-medium text-white">Manage Area Managers</p>
                  <p className="text-xs text-slate-400">View area managers and assign branches</p>
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
                <p className="text-xs text-slate-400">Add flavor experts and set credentials</p>
              </div>
            </a>

            {user.role === 'supreme_admin' && (
            <a
              href="/dashboard/cake-products"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Cake className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Cake Products</p>
                <p className="text-xs text-slate-400">Manage cake products and defaults</p>
              </div>
            </a>
            )}
          </CardContent>
        </Card>

        {/* Overview Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">System Overview</CardTitle>
            <CardDescription className="text-slate-400">Current system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">API Status</p>
                  <p className="text-xs text-slate-400">Backend service</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300">Online</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Your Role</p>
                  <p className="text-xs text-slate-400">{
                    user.role === 'supreme_admin' ? 'HQ Admin' :
                    user.role === 'super_admin' ? 'Territory Manager' :
                    user.role === 'admin' ? 'Area Manager' : 'Staff'
                  }</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                {roleLabels[user.role] || user.role}
              </span>
            </div>

            {user.territory_name && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Territory</p>
                    <p className="text-xs text-slate-400">Your assigned territory</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                  {user.territory_name}
                </span>
              </div>
            )}

            {user.area_name && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Area</p>
                    <p className="text-xs text-slate-400">Your assigned area</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-500/20 text-cyan-300">
                  {user.area_name}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

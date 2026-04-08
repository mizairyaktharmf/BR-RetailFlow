"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Bell,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Cake,
  Building2,
  BellRing,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/services/api'

export default function CakeAlertsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [warningCount, setWarningCount] = useState(0)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('br_admin_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      loadAlerts()
    }
  }, [router])

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const data = await api.getCakeLowStockAlerts()
      setAlerts(data.alerts || [])
      setTotalCount(data.total_count || 0)
      setCriticalCount(data.critical_count || 0)
      setWarningCount(data.warning_count || 0)
    } catch (err) {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const handleNotifyNow = async () => {
    setNotifying(true)
    setNotifyResult(null)
    try {
      const res = await api.notifyLowStockNow()
      setNotifyResult({ success: true, message: res.message })
    } catch (err) {
      setNotifyResult({ success: false, message: 'Failed to send notifications' })
    } finally {
      setNotifying(false)
      setTimeout(() => setNotifyResult(null), 5000)
    }
  }

  const filteredAlerts = alerts.filter(a => {
    const q = searchTerm.toLowerCase()
    return (a.cake_name || '').toLowerCase().includes(q) ||
      (a.cake_code || '').toLowerCase().includes(q) ||
      (a.branch_name || '').toLowerCase().includes(q)
  })

  // Group by branch
  const grouped = {}
  filteredAlerts.forEach(a => {
    const key = a.branch_name || `Branch ${a.branch_id}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  })
  const branchNames = Object.keys(grouped).sort()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-400" />
            Cake Stock Alerts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Low stock alerts across all branches in your scope
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadAlerts} className="text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {totalCount > 0 && (
            <Button
              size="sm"
              onClick={handleNotifyNow}
              disabled={notifying}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {notifying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BellRing className="w-4 h-4 mr-1.5" />}
              {notifying ? 'Sending...' : 'Notify Branches Now'}
            </Button>
          )}
        </div>
      </div>
      {notifyResult && (
        <div className={`px-4 py-2 rounded-lg text-sm ${notifyResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {notifyResult.message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <span className="text-slate-400 text-xs">Total Alerts</span>
          <p className="text-2xl font-bold text-white">{totalCount}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <span className="text-red-400 text-xs">Critical (0 pcs)</span>
          <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <span className="text-amber-400 text-xs">Warning</span>
          <p className="text-2xl font-bold text-amber-400">{warningCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by branch, cake name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : totalCount === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">All Clear!</h2>
            <p className="text-slate-400">All branches have adequate cake stock levels.</p>
          </CardContent>
        </Card>
      ) : branchNames.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">No alerts match your search</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {branchNames.map(branchName => {
            const branchAlerts = grouped[branchName]
            const branchCritical = branchAlerts.filter(a => a.severity === 'critical').length

            return (
              <Card key={branchName} className="bg-slate-800/50 border-slate-700">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-white">{branchName}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {branchCritical > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-semibold">
                        {branchCritical} critical
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[11px] font-semibold">
                      {branchAlerts.length} alert{branchAlerts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700/50">
                    {branchAlerts.map((alert, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            alert.severity === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
                          }`}>
                            {alert.severity === 'critical'
                              ? <AlertTriangle className="w-4 h-4 text-red-400" />
                              : <Cake className="w-4 h-4 text-amber-400" />
                            }
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{alert.cake_name}</p>
                            <p className="text-slate-500 text-xs">{alert.cake_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className={`text-lg font-bold ${
                              alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {alert.current_quantity}
                            </p>
                            <p className="text-[10px] text-slate-500">of {alert.threshold} min</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase ${
                            alert.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Cake,
  AlertCircle,
  RefreshCw,
  Search,
  Building2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import api from '@/services/api'

export default function CakeAlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [warningCount, setWarningCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedBranches, setExpandedBranches] = useState({})
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadAlerts = async () => {
    try {
      setError(null)
      const data = await api.getCakeLowStockAlerts()
      setAlerts(data.alerts || [])
      setTotalCount(data.total_count || 0)
      setCriticalCount(data.critical_count || 0)
      setWarningCount(data.warning_count || 0)
    } catch (err) {
      setError('Failed to load cake alerts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()

    // Auto-refresh every 60 seconds
    let interval
    if (autoRefresh) {
      interval = setInterval(loadAlerts, 60000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // Group alerts by branch
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const key = `${alert.branch_id}-${alert.branch_name}`
    if (!acc[key]) {
      acc[key] = {
        branch_id: alert.branch_id,
        branch_name: alert.branch_name,
        items: [],
        criticalCount: 0,
        warningCount: 0,
      }
    }
    acc[key].items.push(alert)
    if (alert.severity === 'critical') {
      acc[key].criticalCount++
    } else {
      acc[key].warningCount++
    }
    return acc
  }, {})

  // Filter by search term
  const filteredBranches = Object.values(groupedAlerts).filter(branch =>
    branch.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.items.some(item =>
      item.cake_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cake_code.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const toggleBranch = (branchId) => {
    setExpandedBranches(prev => ({
      ...prev,
      [branchId]: !prev[branchId],
    }))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Cake className="w-7 h-7 text-orange-400" />
            Cake Stock Alerts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor low cake stock across all branches
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-600"
            />
            Auto-refresh
          </label>
          <Button
            onClick={loadAlerts}
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Total Alerts</p>
                <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 text-xs font-medium">Critical (0 pcs)</p>
                <p className="text-2xl font-bold text-red-300 mt-1">{criticalCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-400 text-xs font-medium">Warning</p>
                <p className="text-2xl font-bold text-amber-300 mt-1">{warningCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by branch or cake name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* No Alerts */}
      {totalCount === 0 && !error && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-12 text-center">
            <Cake className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">All Good!</h3>
            <p className="text-slate-400 text-sm">
              No low stock alerts at this time. All branches have sufficient cake stock.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alerts grouped by Branch */}
      {filteredBranches.length > 0 && (
        <div className="space-y-3">
          {filteredBranches.map((branch) => {
            const isExpanded = expandedBranches[branch.branch_id] !== false // Default expanded

            return (
              <Card key={branch.branch_id} className="bg-slate-800/50 border-slate-700 overflow-hidden">
                {/* Branch Header */}
                <button
                  onClick={() => toggleBranch(branch.branch_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{branch.branch_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {branch.criticalCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300">
                            {branch.criticalCount} critical
                          </span>
                        )}
                        {branch.warningCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300">
                            {branch.warningCount} warning
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{branch.items.length} alerts</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Cake Items */}
                {isExpanded && (
                  <div className="border-t border-slate-700">
                    <div className="divide-y divide-slate-700/50">
                      {branch.items.map((alert, idx) => (
                        <div
                          key={`${alert.cake_product_id}-${idx}`}
                          className={`flex items-center justify-between px-4 py-3 ${
                            alert.severity === 'critical' ? 'bg-red-500/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <div>
                              <p className="text-sm text-white">{alert.cake_name}</p>
                              <p className="text-[11px] text-slate-500">{alert.cake_code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${
                              alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {alert.current_quantity} pcs
                            </p>
                            <p className="text-[11px] text-slate-500">
                              threshold: {alert.threshold}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* No results from search */}
      {filteredBranches.length === 0 && totalCount > 0 && searchTerm && (
        <div className="text-center py-8 text-slate-400 text-sm">
          No alerts match "{searchTerm}"
        </div>
      )}
    </div>
  )
}

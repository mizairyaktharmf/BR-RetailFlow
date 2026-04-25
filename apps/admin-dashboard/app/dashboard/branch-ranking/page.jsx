"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, TrendingUp, TrendingDown, Users, Target, Loader2 } from 'lucide-react'
import api from '@/services/api'

export default function BranchRankingPage() {
  const [loading, setLoading] = useState(true)
  const [ranking, setRanking] = useState([])
  const [metric, setMetric] = useState('sales')
  const [period, setPeriod] = useState('this-month')

  useEffect(() => {
    loadRanking()
  }, [metric, period])

  const getDateRange = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const formatDate = (d) => d.toISOString().split('T')[0]

    switch (period) {
      case 'this-month':
        return { from: formatDate(firstDay), to: formatDate(today) }
      case 'last-month':
        const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0)
        return { from: formatDate(prevMonthFirst), to: formatDate(prevMonthLast) }
      case 'last-7':
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)
        return { from: formatDate(sevenDaysAgo), to: formatDate(today) }
      default:
        return { from: formatDate(firstDay), to: formatDate(today) }
    }
  }

  const loadRanking = async () => {
    setLoading(true)
    try {
      const { from, to } = getDateRange()
      const data = await api.getBranchRanking(from, to, metric)
      setRanking(data.ranking || [])
    } catch (err) {
      console.error('Failed to load branch ranking:', err)
      setRanking([])
    } finally {
      setLoading(false)
    }
  }

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  const getTrendColor = (change) => {
    if (change === null || change === undefined) return 'text-gray-400'
    return change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
  }

  const formatValue = () => {
    switch (metric) {
      case 'sales':
        return (v) => `${Math.round(v).toLocaleString()} AED`
      case 'gc':
        return (v) => v.toLocaleString()
      case 'atv':
        return (v) => `${v.toFixed(2)} AED`
      case 'budget_ach':
        return (v) => `${v.toFixed(1)}%`
      default:
        return (v) => v
    }
  }

  const stats = {
    totalNetworkSales: ranking.reduce((sum, b) => sum + b.total_sales, 0),
    totalGC: ranking.reduce((sum, b) => sum + b.total_gc, 0),
    topBranch: ranking[0],
    bottomBranch: ranking[ranking.length - 1],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Branch Ranking
        </h1>
        <p className="text-gray-400 mt-1">
          Leaderboard showing top and bottom performing branches
        </p>
      </div>

      {/* Period & Metric Selectors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase mb-2 block">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-7">Last 7 Days</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase mb-2 block">Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm"
          >
            <option value="sales">Total Sales</option>
            <option value="gc">Guest Count</option>
            <option value="atv">Avg. Ticket Value</option>
            <option value="budget_ach">Budget Achievement %</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-gray-400 text-xs uppercase mb-1">Network Sales</div>
            <div className="text-xl font-bold text-white">
              {(stats.totalNetworkSales / 1000).toFixed(1)}K AED
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-gray-400 text-xs uppercase mb-1">Total Guest Count</div>
            <div className="text-xl font-bold text-white">{stats.totalGC.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-gray-400 text-xs uppercase mb-1">Top Branch</div>
            <div className="text-lg font-bold text-green-400">
              {stats.topBranch?.branch_name || '—'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-gray-400 text-xs uppercase mb-1">Bottom Branch</div>
            <div className="text-lg font-bold text-red-400">
              {stats.bottomBranch?.branch_name || '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : ranking.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data available for this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ranking.map((branch) => {
                const medal = getMedalEmoji(branch.rank)
                const metricValue = metric === 'sales' ? branch.total_sales :
                                    metric === 'gc' ? branch.total_gc :
                                    metric === 'atv' ? branch.avg_atv :
                                    branch.budget_ach_pct

                const maxValue = Math.max(...ranking.map(b =>
                  metric === 'sales' ? b.total_sales :
                  metric === 'gc' ? b.total_gc :
                  metric === 'atv' ? b.avg_atv :
                  b.budget_ach_pct
                ))

                const barPercent = (metricValue / maxValue) * 100

                return (
                  <div key={branch.branch_id} className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
                    {/* Rank */}
                    <div className="w-12 flex-shrink-0">
                      {medal ? (
                        <span className="text-2xl">{medal}</span>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                          {branch.rank}
                        </div>
                      )}
                    </div>

                    {/* Branch Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{branch.branch_name}</div>
                      <div className="relative w-full h-2 bg-gray-600/50 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right w-32 flex-shrink-0">
                      <div className="text-lg font-bold text-white">
                        {formatValue()(metricValue)}
                      </div>
                      {metric === 'sales' && branch.change_vs_prev !== null && (
                        <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${getTrendColor(branch.change_vs_prev)}`}>
                          {branch.change_vs_prev > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : branch.change_vs_prev < 0 ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : null}
                          {Math.abs(branch.change_vs_prev).toFixed(1)}%
                        </div>
                      )}
                      {metric === 'budget_ach' && (
                        <div className="text-xs text-gray-400 mt-1">
                          Target: {(branch.budget_total / 1000).toFixed(0)}K
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

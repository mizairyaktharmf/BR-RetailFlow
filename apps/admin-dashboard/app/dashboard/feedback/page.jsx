"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  MessageSquare, Star, AlertCircle, ThumbsUp, Loader2, RefreshCw, Copy, Download, Check
} from 'lucide-react'
import api from '@/services/api'

const FLAVOR_EXPERT_URL = process.env.NEXT_PUBLIC_FLAVOR_EXPERT_URL || 'https://d3o9sr9mmvhxa.cloudfront.net'

const TYPE_CONFIG = {
  complaint: { label: 'Complaint', dot: '🔴', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  compliment: { label: 'Compliment', dot: '🟢', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  suggestion: { label: 'Suggestion', dot: '🟡', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
}

function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </span>
  )
}

function QRCard({ branch }) {
  const [copied, setCopied] = useState(false)
  const feedbackUrl = `${FLAVOR_EXPERT_URL}/feedback?branch=${branch.id}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(feedbackUrl)}`

  const copyLink = () => {
    navigator.clipboard.writeText(feedbackUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const a = document.createElement('a')
    a.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(feedbackUrl)}&format=png`
    a.download = `qr-feedback-${branch.name?.replace(/\s+/g, '-').toLowerCase() || branch.id}.png`
    a.click()
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700 flex flex-col items-center p-4 gap-3">
      <p className="text-xs font-semibold text-white text-center line-clamp-2">{branch.name || branch.branch_name}</p>
      <img
        src={qrSrc}
        alt={`QR for ${branch.name || branch.branch_name}`}
        className="w-[140px] h-[140px] rounded-lg bg-white p-1"
      />
      <div className="flex gap-2 w-full">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={downloadQR}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-purple-600 hover:bg-purple-700 text-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
    </Card>
  )
}

export default function FeedbackPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState([])
  const [stats, setStats] = useState(null)
  const [branches, setBranches] = useState([])
  const [filter, setFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'qr'

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) { router.push('/login'); return }
    loadAll()
  }, [router])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [feedbackData, statsData, branchesData] = await Promise.all([
        api.getFeedback({ limit: 50 }).catch(() => []),
        api.getFeedbackStats().catch(() => null),
        api.getBranches().catch(() => []),
      ])
      setFeedback(Array.isArray(feedbackData) ? feedbackData : [])
      setStats(statsData)
      setBranches(Array.isArray(branchesData) ? branchesData : [])
    } catch (err) {
      console.error('Failed to load feedback:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all' ? feedback : feedback.filter(f => f.feedback_type === filter)

  const avgRating = stats?.avg_rating ?? (feedback.length
    ? (feedback.reduce((s, f) => s + (f.rating || 0), 0) / feedback.length).toFixed(1)
    : 0)

  const complaintCount = stats?.complaints ?? feedback.filter(f => f.feedback_type === 'complaint').length
  const complimentCount = stats?.compliments ?? feedback.filter(f => f.feedback_type === 'compliment').length
  const totalCount = stats?.total ?? feedback.length

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Customer Feedback</h1>
            <p className="text-xs text-gray-500">QR-based feedback from all branches</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Total Feedback</p>
            <p className="text-2xl font-bold text-white">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-400 mb-1">Avg Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-yellow-400">{Number(avgRating).toFixed(1)}</p>
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-red-400 mb-1">Complaints</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-red-400">{complaintCount}</p>
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-green-400 mb-1">Compliments</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-green-400">{complimentCount}</p>
              <ThumbsUp className="h-5 w-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {[{ id: 'list', label: 'Feedback List' }, { id: 'qr', label: 'QR Codes' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* QR Codes Tab */}
      {activeTab === 'qr' && (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            Share or print these QR codes in-branch. Customers scan to leave feedback.
          </p>
          {branches.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No branches found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {branches.map(branch => (
                <QRCard key={branch.id} branch={branch} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All' },
              { id: 'complaint', label: '🔴 Complaints' },
              { id: 'compliment', label: '🟢 Compliments' },
              { id: 'suggestion', label: '🟡 Suggestions' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No feedback yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Branch</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Rating</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Type</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Message</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Customer</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const typeConf = TYPE_CONFIG[item.feedback_type] || TYPE_CONFIG.suggestion
                    return (
                      <tr
                        key={item.id || idx}
                        className={`border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/20' : ''} hover:bg-gray-700/30`}
                      >
                        <td className="p-3 text-sm text-white font-medium">
                          {item.branch_name || item.branch_id || '-'}
                        </td>
                        <td className="p-3">
                          <StarRating rating={item.rating || 0} />
                        </td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${typeConf.bg} ${typeConf.text} ${typeConf.border}`}>
                            {typeConf.dot} {typeConf.label}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-300 max-w-[260px]">
                          <span className="line-clamp-2" title={item.message}>{item.message || '-'}</span>
                        </td>
                        <td className="p-3 text-xs text-gray-400">
                          {item.customer_name || item.customer_phone || 'Anonymous'}
                        </td>
                        <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  MessageSquare, Star, AlertCircle, ThumbsUp, Loader2, RefreshCw,
  Copy, Download, Check, Mail, Phone, Users, FileSpreadsheet
} from 'lucide-react'
import api from '@/services/api'

const FLAVOR_EXPERT_URL = process.env.NEXT_PUBLIC_FLAVOR_EXPERT_URL || 'https://d3o9sr9mmvhxa.cloudfront.net'

const TYPE_CONFIG = {
  complaint:  { label: 'Complaint',  dot: '🔴', bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/30'    },
  compliment: { label: 'Compliment', dot: '🟢', bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/30'  },
  suggestion: { label: 'Suggestion', dot: '🟡', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
}

function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-3.5 w-3.5 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
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
      <img src={qrSrc} alt={`QR for ${branch.name || branch.branch_name}`} className="w-[140px] h-[140px] rounded-lg bg-white p-1" />
      <div className="flex gap-2 w-full">
        <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-purple-600 hover:bg-purple-700 text-white transition-colors">
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
    </Card>
  )
}

// ── Excel export helpers ────────────────────────────────────────────────────────

async function exportAllFeedbackExcel(feedback) {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default || xlsxModule

  const wb = XLSX.utils.book_new()

  // Sheet 1: All feedback with full details
  const allRows = feedback.map(f => ({
    'Date': f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '',
    'Branch': f.branch_name || f.branch_id,
    'Rating': f.rating,
    'Type': f.feedback_type,
    'Message': f.message || '',
    'Customer Name': f.customer_name || '',
    'Email': f.customer_email || '',
    'Phone': f.customer_phone || '',
  }))
  const wsAll = XLSX.utils.json_to_sheet(allRows)
  wsAll['!cols'] = [12, 20, 8, 12, 40, 20, 30, 18].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Feedback')

  // Sheet 2: Customer contact list (only rows with email or phone)
  const contactRows = feedback
    .filter(f => f.customer_email || f.customer_phone)
    .map(f => ({
      'Name': f.customer_name || '',
      'Email': f.customer_email || '',
      'Phone': f.customer_phone || '',
      'Branch': f.branch_name || f.branch_id,
      'Last Visit': f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '',
      'Rating': f.rating,
      'Type': f.feedback_type,
    }))
  const wsContacts = XLSX.utils.json_to_sheet(contactRows)
  wsContacts['!cols'] = [20, 30, 18, 20, 14, 8, 12].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, wsContacts, 'Customer Contacts')

  // One sheet per branch
  const byBranch = {}
  feedback.forEach(f => {
    const key = f.branch_name || `Branch_${f.branch_id}`
    if (!byBranch[key]) byBranch[key] = []
    byBranch[key].push(f)
  })
  Object.entries(byBranch).forEach(([branchName, rows]) => {
    const sheetRows = rows.map(f => ({
      'Date': f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '',
      'Rating': f.rating,
      'Type': f.feedback_type,
      'Message': f.message || '',
      'Customer Name': f.customer_name || '',
      'Email': f.customer_email || '',
      'Phone': f.customer_phone || '',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    ws['!cols'] = [12, 8, 12, 40, 20, 30, 18].map(w => ({ wch: w }))
    // Sheet name max 31 chars, strip invalid chars
    const safeName = branchName.replace(/[\\\/\*\?\[\]:]/g, '').substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `customer-feedback-${date}.xlsx`)
}

async function exportContactsExcel(contacts) {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default || xlsxModule

  const wb = XLSX.utils.book_new()
  const rows = contacts.map(f => ({
    'Name': f.customer_name || '',
    'Email': f.customer_email || '',
    'Phone': f.customer_phone || '',
    'Branch': f.branch_name || f.branch_id,
    'Last Visit': f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '',
    'Rating': f.rating,
    'Feedback Type': f.feedback_type,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [20, 30, 18, 20, 14, 8, 14].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Customer Contacts')
  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `customer-contacts-marketing-${date}.xlsx`)
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState([])
  const [stats, setStats] = useState(null)
  const [branches, setBranches] = useState([])
  const [filter, setFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'contacts' | 'qr'
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('br_admin_user')
    if (!userData) { router.push('/login'); return }
    loadAll()
  }, [router])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [feedbackData, statsData, branchesData] = await Promise.all([
        api.getFeedback({ limit: 500 }).catch(() => []),
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

  const handleExportAll = async () => {
    setExporting(true)
    try { await exportAllFeedbackExcel(feedback) } finally { setExporting(false) }
  }

  const handleExportContacts = async () => {
    setExporting(true)
    const withContact = feedback.filter(f => f.customer_email || f.customer_phone)
    try { await exportContactsExcel(withContact) } finally { setExporting(false) }
  }

  const filtered = filter === 'all' ? feedback : feedback.filter(f => f.feedback_type === filter)
  const contacts = feedback.filter(f => f.customer_email || f.customer_phone)

  const avgRating = stats?.avg_rating ?? (feedback.length
    ? (feedback.reduce((s, f) => s + (f.rating || 0), 0) / feedback.length).toFixed(1) : 0)
  const complaintCount   = stats?.complaints  ?? feedback.filter(f => f.feedback_type === 'complaint').length
  const complimentCount  = stats?.compliments ?? feedback.filter(f => f.feedback_type === 'compliment').length
  const totalCount       = stats?.total       ?? feedback.length

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Customer Feedback</h1>
            <p className="text-xs text-gray-500">QR-based feedback · {contacts.length} contacts collected</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportContacts}
            disabled={exporting || contacts.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Export Contacts
          </button>
          <button
            onClick={handleExportAll}
            disabled={exporting || feedback.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button onClick={loadAll} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
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
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-purple-400 mb-1">Contacts Collected</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-purple-400">{contacts.length}</p>
              <Users className="h-5 w-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { id: 'list',     label: 'Feedback List' },
          { id: 'contacts', label: `Contacts (${contacts.length})` },
          { id: 'qr',       label: 'QR Codes' },
        ].map(tab => (
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

      {/* ── QR Codes Tab ── */}
      {activeTab === 'qr' && (
        <div>
          <p className="text-xs text-gray-500 mb-4">Share or print these QR codes in-branch. Customers scan to leave feedback.</p>
          {branches.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No branches found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {branches.map(branch => <QRCard key={branch.id} branch={branch} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Contacts Tab ── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-400">
              {contacts.length} customers shared their contact details. Use for marketing campaigns and exclusive offers.
            </p>
            <button
              onClick={handleExportContacts}
              disabled={exporting || contacts.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting...' : 'Download as Excel'}
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No customer contacts yet</p>
              <p className="text-xs mt-1">Customers who share their email or phone will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Name</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Email</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Phone</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Branch</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Rating</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((item, idx) => (
                    <tr key={item.id || idx} className={`border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/20' : ''} hover:bg-gray-700/30`}>
                      <td className="p-3 text-sm text-white font-medium">{item.customer_name || <span className="text-gray-500">—</span>}</td>
                      <td className="p-3 text-sm text-blue-400">
                        {item.customer_email
                          ? <a href={`mailto:${item.customer_email}`} className="flex items-center gap-1 hover:underline">
                              <Mail className="h-3.5 w-3.5 shrink-0" />{item.customer_email}
                            </a>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="p-3 text-sm text-green-400">
                        {item.customer_phone
                          ? <a href={`tel:${item.customer_phone}`} className="flex items-center gap-1 hover:underline">
                              <Phone className="h-3.5 w-3.5 shrink-0" />{item.customer_phone}
                            </a>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="p-3 text-xs text-gray-300">{item.branch_name || item.branch_id}</td>
                      <td className="p-3"><StarRating rating={item.rating || 0} /></td>
                      <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Feedback List Tab ── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all',        label: 'All' },
              { id: 'complaint',  label: '🔴 Complaints'  },
              { id: 'compliment', label: '🟢 Compliments' },
              { id: 'suggestion', label: '🟡 Suggestions' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.id ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Email / Phone</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const typeConf = TYPE_CONFIG[item.feedback_type] || TYPE_CONFIG.suggestion
                    return (
                      <tr key={item.id || idx} className={`border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/20' : ''} hover:bg-gray-700/30`}>
                        <td className="p-3 text-sm text-white font-medium">{item.branch_name || item.branch_id || '—'}</td>
                        <td className="p-3"><StarRating rating={item.rating || 0} /></td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${typeConf.bg} ${typeConf.text} ${typeConf.border}`}>
                            {typeConf.dot} {typeConf.label}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-300 max-w-[240px]">
                          <span className="line-clamp-2" title={item.message}>{item.message || '—'}</span>
                        </td>
                        <td className="p-3 text-xs text-gray-400">{item.customer_name || 'Anonymous'}</td>
                        <td className="p-3 text-xs space-y-0.5">
                          {item.customer_email && (
                            <div className="flex items-center gap-1 text-blue-400">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{item.customer_email}</span>
                            </div>
                          )}
                          {item.customer_phone && (
                            <div className="flex items-center gap-1 text-green-400">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{item.customer_phone}</span>
                            </div>
                          )}
                          {!item.customer_email && !item.customer_phone && (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
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

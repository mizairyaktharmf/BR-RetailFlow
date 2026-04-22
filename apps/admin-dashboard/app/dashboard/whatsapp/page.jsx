"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageCircle, Wifi, WifiOff, QrCode, Send, Plus, Trash2,
  Loader2, CheckCircle2, AlertCircle, RefreshCw, LogOut, Phone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/services/api'

const ALERT_TYPES = [
  { id: 'sales', label: 'Sales Reports', emoji: '📊' },
  { id: 'budget', label: 'Budget Alerts', emoji: '⚠️' },
  { id: 'stock', label: 'Low Stock', emoji: '🚨' },
  { id: 'expiry', label: 'Expiry Alerts', emoji: '⏰' },
  { id: 'daily_brief', label: 'Daily Brief', emoji: '🌙' },
]

export default function WhatsAppPage() {
  const router = useRouter()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [branches, setBranches] = useState([])
  const [configs, setConfigs] = useState([])
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [savingBranch, setSavingBranch] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    loadAll()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [st, br, cfg] = await Promise.all([
        api.getWhatsAppStatus(),
        api.getBranches(),
        api.getWhatsAppRecipients(),
      ])
      setStatus(st)
      setBranches(Array.isArray(br) ? br : [])
      setConfigs(Array.isArray(cfg) ? cfg : [])

      // Poll QR until connected
      if (st?.status === 'qr_ready' || st?.status === 'connecting') {
        startPolling()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const st = await api.getWhatsAppStatus()
        setStatus(st)
        if (st?.status === 'connected') {
          clearInterval(pollRef.current)
        }
      } catch {}
    }, 3000)
  }

  const refresh = async () => {
    setRefreshing(true)
    const st = await api.getWhatsAppStatus().catch(() => null)
    setStatus(st)
    setRefreshing(false)
    if (st?.status === 'qr_ready' || st?.status === 'connecting') startPolling()
  }

  const handleLogout = async () => {
    if (!confirm('Disconnect WhatsApp? You will need to scan QR again.')) return
    await api.logoutWhatsApp().catch(() => {})
    await refresh()
  }

  const sendTest = async () => {
    if (!testPhone) return
    setTestSending(true)
    try {
      await api.sendWhatsAppTest(testPhone, testMsg || undefined)
      alert('✅ Test message sent!')
      setTestPhone('')
      setTestMsg('')
    } catch (e) {
      alert('Failed: ' + e.message)
    } finally {
      setTestSending(false)
    }
  }

  const getConfig = (branchId) => {
    return configs.find(c => c.branch_id === branchId) || {
      branch_id: branchId, phone_numbers: [], alert_types: ['sales', 'budget', 'stock', 'expiry']
    }
  }

  const updateConfig = (branchId, field, value) => {
    setConfigs(prev => {
      const existing = prev.find(c => c.branch_id === branchId)
      if (existing) {
        return prev.map(c => c.branch_id === branchId ? { ...c, [field]: value } : c)
      }
      return [...prev, { branch_id: branchId, phone_numbers: [], alert_types: ['sales', 'budget', 'stock', 'expiry'], [field]: value }]
    })
  }

  const toggleAlertType = (branchId, alertId) => {
    const cfg = getConfig(branchId)
    const types = cfg.alert_types || []
    const updated = types.includes(alertId) ? types.filter(t => t !== alertId) : [...types, alertId]
    updateConfig(branchId, 'alert_types', updated)
  }

  const addPhone = (branchId) => {
    const phone = prompt('Enter phone number (with country code, e.g. 971501234567):')
    if (!phone?.trim()) return
    const cfg = getConfig(branchId)
    const phones = [...(cfg.phone_numbers || []), phone.trim()]
    updateConfig(branchId, 'phone_numbers', phones)
  }

  const removePhone = (branchId, idx) => {
    const cfg = getConfig(branchId)
    const phones = cfg.phone_numbers.filter((_, i) => i !== idx)
    updateConfig(branchId, 'phone_numbers', phones)
  }

  const saveConfig = async (branchId) => {
    setSavingBranch(branchId)
    try {
      const cfg = getConfig(branchId)
      await api.saveWhatsAppRecipients({
        branch_id: branchId,
        phone_numbers: cfg.phone_numbers || [],
        alert_types: cfg.alert_types || [],
      })
      alert('✅ Saved!')
    } catch (e) {
      alert('Failed: ' + e.message)
    } finally {
      setSavingBranch(null)
    }
  }

  const statusColor = {
    connected: 'text-green-600 bg-green-50 border-green-200',
    qr_ready: 'text-orange-600 bg-orange-50 border-orange-200',
    connecting: 'text-blue-600 bg-blue-50 border-blue-200',
    disconnected: 'text-red-600 bg-red-50 border-red-200',
    service_unavailable: 'text-gray-600 bg-gray-50 border-gray-200',
  }[status?.status] || 'text-gray-600 bg-gray-50 border-gray-200'

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-green-500" />
    </div>
  )

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">WhatsApp Alerts</h1>
          <p className="text-sm text-gray-500">Configure automated WhatsApp notifications</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`rounded-xl border p-4 ${statusColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status?.connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            <div>
              <p className="font-semibold capitalize">{status?.status?.replace(/_/g, ' ') || 'Unknown'}</p>
              <p className="text-xs opacity-70">
                {status?.connected ? 'WhatsApp is active and sending alerts' : 'Scan QR code to connect'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </Button>
            {status?.connected && (
              <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50">
                <LogOut className="w-3.5 h-3.5 mr-1" />Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {status?.qr && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Scan with WhatsApp on your phone:</p>
            <div className="bg-white p-3 rounded-xl border-2 border-green-300 shadow">
              <img src={status.qr} alt="WhatsApp QR Code" className="w-52 h-52" />
            </div>
            <p className="text-xs opacity-70">Open WhatsApp → Settings → Linked Devices → Link a device</p>
          </div>
        )}

        {(status?.status === 'connecting') && !status?.qr && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to WhatsApp... QR code loading</span>
          </div>
        )}
      </div>

      {/* Test Message */}
      {status?.connected && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Send className="w-4 h-4 text-green-500" />Test Message
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder="Phone number (e.g. 971501234567)"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={sendTest} disabled={testSending || !testPhone} className="h-9 bg-green-500 hover:bg-green-600 text-xs px-4">
              {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Test'}
            </Button>
          </div>
          <Input
            placeholder="Custom message (optional)"
            value={testMsg}
            onChange={e => setTestMsg(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      )}

      {/* Branch Configurations */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800">Alert Recipients per Branch</h2>
        {branches.map(branch => {
          const cfg = getConfig(branch.id)
          return (
            <div key={branch.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">{branch.name}</h3>
                <Button
                  size="sm"
                  onClick={() => saveConfig(branch.id)}
                  disabled={savingBranch === branch.id}
                  className="h-8 text-xs bg-green-500 hover:bg-green-600"
                >
                  {savingBranch === branch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Save
                </Button>
              </div>

              {/* Phone Numbers */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Phone Numbers</p>
                <div className="space-y-1.5">
                  {(cfg.phone_numbers || []).map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 font-mono">+{phone}</span>
                      <button onClick={() => removePhone(branch.id, idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addPhone(branch.id)}
                    className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />Add number
                  </button>
                </div>
              </div>

              {/* Alert Types */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Alert Types</p>
                <div className="flex flex-wrap gap-2">
                  {ALERT_TYPES.map(at => {
                    const active = (cfg.alert_types || []).includes(at.id)
                    return (
                      <button
                        key={at.id}
                        onClick={() => toggleAlertType(branch.id, at.id)}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                          active ? 'bg-green-100 border-green-400 text-green-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        {at.emoji} {at.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

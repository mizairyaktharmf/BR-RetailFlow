"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, CalendarClock, Loader2, Save, CheckCircle2,
  Package, Calendar, MessageSquare, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/services/api'

export default function ExpiryResponsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>}>
      <ExpiryResponseContent />
    </Suspense>
  )
}

function ExpiryResponseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('id')

  const [detail, setDetail] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [branchId, setBranchId] = useState(null)
  const [branchName, setBranchName] = useState('')
  const [branchStatus, setBranchStatus] = useState('pending')

  useEffect(() => {
    if (!requestId) return
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const user = JSON.parse(userData)
    setBranchId(user.branch_id)
    const branchData = localStorage.getItem('br_branch')
    if (branchData) {
      const branch = JSON.parse(branchData)
      setBranchName(branch.name || user.branch_name || 'My Branch')
    } else {
      setBranchName(user.branch_name || 'My Branch')
    }
    loadData(user.branch_id)
  }, [requestId])

  const loadData = async (bid) => {
    setLoading(true)
    try {
      const [detailData, existingResponses] = await Promise.all([
        api.getExpiryRequestDetail(requestId),
        api.getExpiryResponses(requestId),
      ])
      setDetail(detailData)

      // Find this branch's status
      if (detailData?.branches) {
        const myBranch = detailData.branches.find(b => b.branch_id === bid)
        if (myBranch) setBranchStatus(myBranch.status)
      }

      const prefilled = {}
      if (existingResponses && existingResponses.length > 0) {
        existingResponses.forEach(r => {
          prefilled[r.expiry_request_item_id] = {
            quantity: r.quantity ?? '',
            expiry_date: r.expiry_date || '',
            notes: r.notes || '',
          }
        })
      }

      if (detailData?.items) {
        detailData.items.forEach(item => {
          if (!prefilled[item.id]) {
            prefilled[item.id] = { quantity: '', expiry_date: '', notes: '' }
          }
        })
      }

      setResponses(prefilled)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateResponse = (itemId, field, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  const handleSubmit = async () => {
    if (!detail?.items?.length) return

    setSubmitting(true)
    try {
      const responseItems = detail.items.map(item => ({
        expiry_request_item_id: item.id,
        quantity: responses[item.id]?.quantity !== '' ? parseInt(responses[item.id]?.quantity) || 0 : null,
        expiry_date: responses[item.id]?.expiry_date || null,
        notes: responses[item.id]?.notes || null,
      }))

      await api.submitExpiryResponses({
        expiry_request_id: parseInt(requestId),
        responses: responseItems,
      })

      setSubmitted(true)
      setTimeout(() => {
        router.push('/expiry')
      }, 1500)
    } catch (err) {
      alert('Failed to submit: ' + (err.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!requestId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">No request ID provided</p>
        <Button variant="ghost" onClick={() => router.push('/expiry')} className="text-purple-500">Go Back</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Request not found</p>
        <Button variant="ghost" onClick={() => router.back()} className="text-purple-500">Go Back</Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">Submitted!</h2>
        <p className="text-sm text-gray-500">Your expiry data has been sent to your manager</p>
      </div>
    )
  }

  const filledCount = detail.items.filter(item => {
    const r = responses[item.id]
    return r && (r.quantity !== '' && r.quantity !== null && r.quantity !== undefined)
  }).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white safe-area-top">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/expiry')} className="p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <CalendarClock className="h-5 w-5" />
            <div className="flex-1">
              <h1 className="text-lg font-bold">{detail.title}</h1>
              <p className="text-xs text-purple-100">
                {detail.items.length} products | From: {detail.created_by_name}
              </p>
            </div>
            <div className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
              branchStatus !== 'pending' ? 'bg-green-400/20 text-green-200' : 'bg-white/20 text-white'
            }`}>
              {branchStatus !== 'pending' ? 'Submitted' : 'Pending'}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      {detail.notes && (
        <div className="mx-4 mt-4 bg-purple-50 border border-purple-200 rounded-xl p-3">
          <p className="text-sm text-purple-800">
            <MessageSquare className="h-4 w-4 inline mr-1" />
            {detail.notes}
          </p>
        </div>
      )}

      {/* Branch Name & Status */}
      <div className="mx-4 mt-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{branchName}</h2>
        <span className="text-xs text-gray-500">{filledCount}/{detail.items.length} filled</span>
      </div>

      {/* Excel-like Table */}
      <div className="mx-4 mt-3 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-2.5 text-[11px] font-semibold text-gray-500 w-[30px]">#</th>
              <th className="text-left p-2.5 text-[11px] font-semibold text-gray-500">Product</th>
              <th className="text-center p-2.5 text-[11px] font-semibold text-orange-500 w-[80px]">Exp. Date</th>
              <th className="text-center p-2.5 text-[11px] font-semibold text-purple-600 w-[65px]">QTY</th>
              <th className="text-center p-2.5 text-[11px] font-semibold text-purple-600 w-[100px]">EXP</th>
              <th className="text-center p-2.5 text-[11px] font-semibold text-purple-600 w-[100px]">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item, idx) => (
              <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} border-b border-gray-100`}>
                <td className="p-2 text-xs text-gray-400 text-center">{idx + 1}</td>
                <td className="p-2">
                  <span className="text-sm font-medium text-gray-900">{item.product_name}</span>
                </td>
                <td className="p-2 text-center">
                  <span className="text-xs text-orange-600">{item.expiry_date || '-'}</span>
                </td>
                <td className="p-1.5">
                  <input
                    type="number"
                    min="0"
                    value={responses[item.id]?.quantity ?? ''}
                    onChange={e => updateResponse(item.id, 'quantity', e.target.value)}
                    placeholder="0"
                    className="w-full text-center text-sm border border-gray-200 rounded-lg px-1 py-1.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="date"
                    value={responses[item.id]?.expiry_date || ''}
                    onChange={e => updateResponse(item.id, 'expiry_date', e.target.value)}
                    className="w-full text-[11px] border border-gray-200 rounded-lg px-1 py-1.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={responses[item.id]?.notes || ''}
                    onChange={e => updateResponse(item.id, 'notes', e.target.value)}
                    placeholder="..."
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Submit Expiry Report ({filledCount}/{detail.items.length})
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

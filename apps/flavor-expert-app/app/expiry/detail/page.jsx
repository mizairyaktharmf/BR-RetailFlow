"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, CalendarClock, Loader2, Save, CheckCircle2,
  Package, Calendar, MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/services/api'

export default function ExpiryResponsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('id')

  const [detail, setDetail] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [branchId, setBranchId] = useState(null)

  useEffect(() => {
    if (!requestId) return
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    const user = JSON.parse(userData)
    setBranchId(user.branch_id)
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
            <div>
              <h1 className="text-lg font-bold">{detail.title}</h1>
              <p className="text-xs text-purple-100">
                {detail.items.length} products | From: {detail.created_by_name}
              </p>
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

      {/* Product Items Form */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-gray-500">
          Enter the quantity and expiry date for each product in your branch:
        </p>

        {detail.items.map((item, idx) => (
          <Card key={item.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-purple-100 rounded-lg p-1.5">
                  <Package className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">{idx + 1}.</span>
                <h3 className="font-medium text-gray-900 flex-1">{item.product_name}</h3>
              </div>
              {item.expiry_date && (
                <p className="text-xs text-orange-600 mb-3 ml-10">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Manager set expiry: {item.expiry_date}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    value={responses[item.id]?.quantity ?? ''}
                    onChange={e => updateResponse(item.id, 'quantity', e.target.value)}
                    placeholder="0"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                  <Input
                    type="date"
                    value={responses[item.id]?.expiry_date || ''}
                    onChange={e => updateResponse(item.id, 'expiry_date', e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="mt-2">
                <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                <Input
                  value={responses[item.id]?.notes || ''}
                  onChange={e => updateResponse(item.id, 'notes', e.target.value)}
                  placeholder="Any additional info..."
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>
        ))}
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
              Submit Expiry Report
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

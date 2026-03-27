"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarClock, Loader2, CheckCircle2, Clock,
  ChevronRight, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/services/api'

export default function ExpiryListPage() {
  const router = useRouter()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem('br_user')
    if (!userData) {
      router.push('/login')
      return
    }
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await api.getBranchExpiryRequests()
      setRequests(data || [])
    } catch (err) {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const pendingCount = requests.filter(r => r.branch_status === 'pending').length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white safe-area-top">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <CalendarClock className="h-5 w-5" />
            <div>
              <h1 className="text-lg font-bold">Expiry Tracking</h1>
              <p className="text-xs text-purple-100">Report near-expiry items for your branch</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Pending Alert */}
        {pendingCount > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-purple-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800">
                {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
              </p>
              <p className="text-xs text-purple-600">Please respond to expiry check requests from your manager</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <CalendarClock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No active expiry requests</p>
            <p className="text-xs text-gray-400 mt-1">Your manager will send requests when needed</p>
          </div>
        ) : (
          requests.map(req => (
            <Card
              key={req.id}
              className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => router.push(`/expiry/detail?id=${req.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{req.title}</h3>
                      {req.branch_status === 'pending' ? (
                        <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          PENDING
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" />
                          {req.branch_status === 'updated' ? 'UPDATED' : 'SUBMITTED'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {req.item_count} products to check
                      <span className="mx-1.5">|</span>
                      From: {req.created_by_name}
                    </p>
                    {req.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">{req.notes}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Star, CheckCircle2, IceCream, ChevronDown } from 'lucide-react'
import api from '@/services/api'

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <FeedbackContent />
    </Suspense>
  )
}

const FEEDBACK_TYPES = [
  { value: 'compliment', emoji: '😊', label: 'Compliment' },
  { value: 'complaint',  emoji: '😞', label: 'Complaint'  },
  { value: 'suggestion', emoji: '💡', label: 'Suggestion' },
]

const STAR_LABELS = ['', 'Very Poor', 'Poor', 'Good', 'Very Good', 'Excellent']

function FeedbackContent() {
  const searchParams = useSearchParams()
  const branchId = searchParams.get('branch')

  // Branch + staff state
  const [branchName, setBranchName]     = useState('')
  const [staffList, setStaffList]       = useState([])
  const [branchLoading, setBranchLoading] = useState(true)
  const [branchError, setBranchError]   = useState(false)

  // Form state
  const [rating, setRating]             = useState(0)
  const [hoverRating, setHoverRating]   = useState(0)
  const [feedbackType, setFeedbackType] = useState('')
  const [message, setMessage]           = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [servedByUserId, setServedByUserId] = useState('')

  // Submission state
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState('')

  // Load branch info + staff list on mount
  useEffect(() => {
    if (!branchId) {
      setBranchError(true)
      setBranchLoading(false)
      return
    }

    const load = async () => {
      try {
        const data = await api.getFeedbackBranchInfo(branchId)
        setBranchName(data.branch_name || '')
        setStaffList(data.staff || [])
      } catch (err) {
        console.error('branch-info error:', err)
        setBranchError(true)
      } finally {
        setBranchLoading(false)
      }
    }

    load()
  }, [branchId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!rating) {
      setSubmitError('Please select a star rating before submitting.')
      return
    }
    if (!feedbackType) {
      setSubmitError('Please choose a feedback type before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const selectedStaff = staffList.find(s => String(s.id) === String(servedByUserId))
      await api.submitFeedback({
        branch_id:          parseInt(branchId, 10),
        rating,
        feedback_type:      feedbackType,
        message:            message.trim() || null,
        customer_name:      customerName.trim() || null,
        customer_email:     customerEmail.trim() || null,
        customer_phone:     customerPhone.trim() || null,
        served_by_user_id:  servedByUserId ? parseInt(servedByUserId, 10) : null,
        served_by_name:     selectedStaff?.full_name || null,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (branchLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // ── Invalid QR ────────────────────────────────────────────────────────────
  if (branchError || !branchId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <span className="text-4xl">❌</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid QR Code</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          This QR code is not valid or has expired. Please scan the QR code at your nearest BR Baskin-Robbins branch.
        </p>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header branchName={branchName} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 shadow-lg">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Thank you for your feedback!</h2>
          <p className="text-gray-500 text-base max-w-xs leading-relaxed">
            Your opinion helps us improve and serve you better.
          </p>
          <div className="flex gap-1 mt-6">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`w-7 h-7 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
          </div>
          <p className="mt-8 text-xs text-gray-400">BR Baskin-Robbins &bull; {branchName}</p>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header branchName={branchName} />

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-5 space-y-5 pb-10">

          {/* ── Who served you? ─────────────────────────────────────────── */}
          {staffList.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-3">
                Who served you today?{' '}
                <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </h2>
              <div className="relative">
                <select
                  value={servedByUserId}
                  onChange={e => setServedByUserId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                >
                  <option value="">Select a Flavor Expert...</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </section>
          )}

          {/* ── Star Rating ──────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-1 text-center">
              How would you rate your experience?
            </h2>
            <p className="text-xs text-gray-400 text-center mb-5">Tap a star to rate</p>
            <div className="flex justify-center gap-2" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map(star => {
                const active = (hoverRating || rating) >= star
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    className="p-1 focus:outline-none transition-transform active:scale-90"
                  >
                    <Star className={`w-12 h-12 transition-colors duration-150 ${active ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm' : 'text-gray-200 fill-gray-200'}`} />
                  </button>
                )
              })}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm font-medium text-purple-600 mt-3">
                {STAR_LABELS[rating]}
              </p>
            )}
          </section>

          {/* ── Feedback Type ────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4 text-center">
              What type of feedback is this?
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {FEEDBACK_TYPES.map(({ value, emoji, label }) => {
                const selected = feedbackType === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackType(value)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl py-4 px-2 border-2 transition-all duration-150 active:scale-95 focus:outline-none ${
                      selected ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <span className="text-3xl leading-none">{emoji}</span>
                    <span className={`text-xs font-semibold ${selected ? 'text-purple-700' : 'text-gray-600'}`}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Message ──────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              Tell us more{' '}
              <span className="text-gray-400 font-normal text-sm">(optional)</span>
            </h2>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none transition"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{message.length}/1000</p>
          </section>

          {/* ── Contact Details ───────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-1">
                Your name{' '}
                <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </h2>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-1">
                Email address{' '}
                <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </h2>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="your@email.com"
                maxLength={200}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-1">
                Phone number{' '}
                <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </h2>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+971 50 000 0000"
                maxLength={30}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
              />
            </div>

            <p className="text-xs text-gray-400 pt-1">
              Share your contact details to receive exclusive offers and promotions from BR Baskin-Robbins.
            </p>
          </section>

          {/* ── Error ────────────────────────────────────────────────────── */}
          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600 text-center">{submitError}</p>
            </div>
          )}

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 active:from-purple-700 active:to-purple-800 text-white font-semibold text-base shadow-lg shadow-purple-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
            ) : (
              'Submit Feedback'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 pb-2">
            Contact details are optional and only used to send you exclusive offers.
          </p>
        </form>
      </div>
    </div>
  )
}

function Header({ branchName }) {
  return (
    <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-purple-500 px-5 pt-10 pb-8 text-white shadow-lg">
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
          <IceCream className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-white/90 uppercase">
          BR Baskin-Robbins
        </span>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight leading-tight">Share Your Experience</h1>
        {branchName && (
          <p className="mt-1.5 text-purple-200 text-sm font-medium">{branchName}</p>
        )}
      </div>
    </div>
  )
}

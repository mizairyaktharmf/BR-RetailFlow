"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center text-white">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-[2px] shadow-2xl">
          <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">BR-RetailFlow</h1>
        <p className="text-slate-400">Loading Admin Dashboard...</p>
      </div>
    </div>
  )
}

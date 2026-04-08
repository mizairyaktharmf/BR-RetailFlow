"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardError({ error, reset }) {
  const router = useRouter()

  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'rgba(239,68,68,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        fontSize: 32,
      }}>
        ⚠️
      </div>
      <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
        Page Error
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px', maxWidth: 320, lineHeight: 1.6 }}>
        This page crashed. Your data is safe — try reloading.
      </p>
      <p style={{ color: '#475569', fontSize: 12, margin: '0 0 28px', maxWidth: 320 }}>
        {error?.message || 'Unknown error'}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reload Page
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            color: '#cbd5e1',
            fontWeight: 600,
            fontSize: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CalendarClock, ArrowLeft, Loader2, Lock, RefreshCw,
  CheckCircle2, Clock, Download, FileSpreadsheet, FileText
} from 'lucide-react'
import api from '@/services/api'

export default function ExpiryRequestDetailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('id')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (requestId) loadDetail()
  }, [requestId])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const detail = await api.getExpiryRequestDetail(requestId)
      setData(detail)
    } catch (err) {
      console.error('Failed to load detail:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (!confirm('Close this request? Branches will no longer be able to respond.')) return
    try {
      await api.closeExpiryRequest(requestId)
      loadDetail()
    } catch (err) {
      alert('Failed to close request')
    }
  }

  const exportExcel = async () => {
    if (!data) return
    const XLSX = (await import('xlsx')).default
    const { items, branches, responses } = data

    // Row 1: merged branch headers
    // Row 2: sub-headers (QTY / EXP / NOTES per branch)
    // Row 3+: data

    const headerRow1 = ['#', 'Product', 'Exp. Date (Manager)']
    const headerRow2 = ['', '', '']
    branches.forEach(b => {
      headerRow1.push(b.branch_name, '', '')
      headerRow2.push('QTY', 'EXP', 'NOTES')
    })

    const dataRows = items.map((item, idx) => {
      const row = [idx + 1, item.product_name, item.expiry_date || '']
      branches.forEach(b => {
        const resp = responses?.[String(b.branch_id)]?.[String(item.id)]
        row.push(
          resp?.quantity ?? '',
          resp?.expiry_date ?? '',
          resp?.notes ?? ''
        )
      })
      return row
    })

    const aoa = [headerRow1, headerRow2, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Merge branch name cells across QTY/EXP/NOTES
    ws['!merges'] = []
    branches.forEach((_, i) => {
      const startCol = 3 + i * 3
      ws['!merges'].push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 2 } })
    })

    // Column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 30 },  // Product
      { wch: 16 },  // Exp Date
      ...branches.flatMap(() => [{ wch: 10 }, { wch: 14 }, { wch: 20 }]),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expiry Responses')
    XLSX.writeFile(wb, `expiry-${data.title.replace(/\s+/g, '-')}.xlsx`)
  }

  const exportPDF = async () => {
    if (!data) return
    const { items, branches, responses } = data

    const jsPDF = (await import('jspdf')).default
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Dark background
    doc.setFillColor(17, 24, 39)
    doc.rect(0, 0, 297, 210, 'F')

    // Title
    doc.setTextColor(167, 139, 250)
    doc.setFontSize(14)
    doc.text(data.title, 14, 15)

    doc.setTextColor(156, 163, 175)
    doc.setFontSize(9)
    doc.text(
      `Expiry Tracking Report — ${data.status === 'open' ? 'Open' : 'Closed'}   |   Created: ${new Date(data.created_at).toLocaleDateString()}   |   By: ${data.created_by_name}`,
      14, 22
    )

    // Build table columns: #, Product, Exp Date, then per branch: QTY / EXP / NOTES
    const head1 = ['#', 'Product', 'Exp. Date']
    branches.forEach(b => { head1.push(b.branch_name, '', '') })

    const head2 = ['', '', '']
    branches.forEach(() => { head2.push('QTY', 'EXP', 'NOTES') })

    const body = items.map((item, idx) => {
      const row = [idx + 1, item.product_name, item.expiry_date || '-']
      branches.forEach(b => {
        const resp = responses?.[String(b.branch_id)]?.[String(item.id)]
        row.push(
          resp?.quantity != null ? resp.quantity : '-',
          resp?.expiry_date || '-',
          resp?.notes || '-'
        )
      })
      return row
    })

    const colWidths = [8, 48, 20, ...branches.flatMap(() => [14, 20, 28])]

    doc.autoTable({
      head: [head1, head2],
      body,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81], textColor: [209, 213, 219], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fillColor: [31, 41, 55], textColor: [209, 213, 219], fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [37, 49, 65] },
      columnStyles: Object.fromEntries(colWidths.map((w, i) => [i, { cellWidth: w }])),
      didParseCell: (hookData) => {
        // Red QTY if > 0
        if (hookData.section === 'body') {
          const colIdx = hookData.column.index
          // QTY columns start at index 3, then every 3rd: 3, 6, 9...
          if (colIdx >= 3 && (colIdx - 3) % 3 === 0) {
            const val = parseFloat(hookData.cell.raw)
            if (!isNaN(val) && val > 0) {
              hookData.cell.styles.textColor = [248, 113, 113]
              hookData.cell.styles.fontStyle = 'bold'
            }
          }
          // Exp date column (index 2) in orange
          if (colIdx === 2 && hookData.cell.raw !== '-') {
            hookData.cell.styles.textColor = [251, 146, 60]
          }
        }
      },
    })

    // Branch status summary
    const finalY = (doc.lastAutoTable?.finalY || 170) + 6
    if (finalY < 195) {
      doc.setFontSize(8)
      doc.setTextColor(156, 163, 175)
      doc.text('Branch Status Summary:', 14, finalY)
      let xOff = 14
      branches.forEach(b => {
        const branchResps = responses?.[String(b.branch_id)] || {}
        const totalQty = Object.values(branchResps).reduce((s, r) => s + (r.quantity || 0), 0)
        const isSubmitted = b.status === 'submitted' || b.status === 'updated'
        doc.setTextColor(isSubmitted ? 74 : 107, isSubmitted ? 222 : 114, isSubmitted ? 128 : 128)
        doc.text(`${b.branch_name}: ${isSubmitted ? `${totalQty} items` : 'Pending'}`, xOff, finalY + 6)
        xOff += 60
        if (xOff > 260) xOff = 14
      })
    }

    doc.save(`expiry-${data.title.replace(/\s+/g, '-')}.pdf`)
  }

  const downloadTemplate = async () => {
    try {
      const blob = await api.getExpiryTemplate(requestId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.template_filename || `expiry-template-${requestId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('No template file uploaded for this request')
    }
  }

  if (!requestId) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>No request ID provided</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard/expiry-tracking')} className="mt-4 text-orange-400">Go Back</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Request not found</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4 text-orange-400">Go Back</Button>
      </div>
    )
  }

  const { items, branches, responses } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/expiry-tracking')} className="text-gray-400">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CalendarClock className="h-6 w-6 text-orange-400" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{data.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                data.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {data.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
            {data.notes && <p className="text-sm text-gray-400">{data.notes}</p>}
            <p className="text-xs text-gray-500">Created by {data.created_by_name} on {new Date(data.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadDetail} className="text-gray-400" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {data.has_template && (
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-blue-400 hover:text-blue-300" title="Download uploaded template">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Template
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={exportExcel} className="text-green-400 hover:text-green-300" title="Export Excel">
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="ghost" size="sm" onClick={exportPDF} className="text-purple-400 hover:text-purple-300" title="Export PDF">
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          {data.status === 'open' && (
            <Button size="sm" onClick={handleClose} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              <Lock className="h-4 w-4 mr-1" /> Close
            </Button>
          )}
        </div>
      </div>

      {/* Branch Status Pills */}
      <div className="flex gap-2 flex-wrap">
        {branches.map(branch => (
          <div
            key={branch.branch_id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${
              branch.status === 'submitted' || branch.status === 'updated'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600'
            }`}
          >
            {branch.status === 'pending' ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {branch.branch_name}
          </div>
        ))}
      </div>

      {/* Excel-like Grid */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-700/80">
                  <th className="text-left p-2.5 text-xs font-medium text-gray-400 border-b border-r border-gray-600 sticky left-0 bg-gray-700/95 z-10 min-w-[40px]">
                    #
                  </th>
                  <th className="text-left p-2.5 text-xs font-medium text-gray-400 border-b border-r border-gray-600 sticky left-[40px] bg-gray-700/95 z-10 min-w-[200px]">
                    Product
                  </th>
                  <th className="text-center p-2.5 text-xs font-medium text-orange-400 border-b border-r border-gray-600 min-w-[100px]">
                    Exp. Date
                  </th>
                  {branches.map(branch => (
                    <th key={branch.branch_id} colSpan={3} className="text-center p-2 text-xs font-medium border-b border-r border-gray-600 min-w-[240px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={branch.status !== 'pending' ? 'text-green-400' : 'text-gray-400'}>
                          {branch.branch_name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          branch.status !== 'pending' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/50 text-gray-500'
                        }`}>
                          {branch.status}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-700/60">
                  <th className="border-b border-r border-gray-600 sticky left-0 bg-gray-700/90 z-10"></th>
                  <th className="border-b border-r border-gray-600 sticky left-[40px] bg-gray-700/90 z-10"></th>
                  <th className="border-b border-r border-gray-600"></th>
                  {branches.map(branch => (
                    <React.Fragment key={`sub-${branch.branch_id}`}>
                      <th className="text-center p-1.5 text-[10px] text-gray-500 border-b border-r border-gray-700/50 font-normal">QTY</th>
                      <th className="text-center p-1.5 text-[10px] text-gray-500 border-b border-r border-gray-700/50 font-normal">EXP</th>
                      <th className="text-center p-1.5 text-[10px] text-gray-500 border-b border-r border-gray-600 font-normal">NOTES</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/10'} hover:bg-gray-700/30`}>
                    <td className="p-2 text-xs text-gray-500 text-center border-r border-gray-700/50 sticky left-0 bg-gray-800/90 z-10">
                      {idx + 1}
                    </td>
                    <td className="p-2 text-sm text-white font-medium border-r border-gray-700/50 sticky left-[40px] bg-gray-800/90 z-10">
                      {item.product_name}
                    </td>
                    <td className="p-2 text-center text-xs text-orange-400 border-r border-gray-700/50">
                      {item.expiry_date || '-'}
                    </td>
                    {branches.map(branch => {
                      const resp = responses?.[String(branch.branch_id)]?.[String(item.id)]
                      return (
                        <React.Fragment key={`${item.id}-${branch.branch_id}`}>
                          <td className="p-2 text-center border-r border-gray-700/50">
                            {resp ? (
                              <span className={`text-sm font-bold ${resp.quantity > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {resp.quantity ?? '-'}
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center text-[11px] text-gray-400 border-r border-gray-700/50">
                            {resp?.expiry_date || '-'}
                          </td>
                          <td className="p-2 text-center text-[11px] text-gray-500 border-r border-gray-600 max-w-[100px] truncate" title={resp?.notes}>
                            {resp?.notes || '-'}
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {items.length > 0 && branches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {branches.map(branch => {
            const branchResponses = responses?.[String(branch.branch_id)] || {}
            const totalQty = Object.values(branchResponses).reduce((s, r) => s + (r.quantity || 0), 0)
            const itemsWithExpiry = Object.values(branchResponses).filter(r => r.quantity > 0).length

            return (
              <Card key={branch.branch_id} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{branch.branch_name}</span>
                    {branch.status !== 'pending' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  {branch.status !== 'pending' ? (
                    <div className="text-xs text-gray-400">
                      <span className={totalQty > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                        {totalQty} near-expiry items
                      </span>
                      <span className="mx-1">|</span>
                      <span>{itemsWithExpiry}/{items.length} products</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Waiting...</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import {
  FileCheck,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Search,
  ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

function getSignedStatus(contract) {
  if (contract.signedPdfPath) return { label: 'Unterzeichnet', variant: 'success' }
  return { label: 'Ausstehend', variant: 'warning' }
}

function getRenewalStatus(contract) {
  if (!contract.renewalReminder) return null
  const rem = new Date(contract.renewalReminder)
  const now = new Date()
  const diffDays = (rem - now) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return { label: 'Verlängerung überfällig', variant: 'danger' }
  if (diffDays <= 30) return { label: `Verlängerung in ${Math.round(diffDays)}d`, variant: 'warning' }
  return null
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/contracts')
      setContracts(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Verträge konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  const filtered = contracts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.accountName || '').toLowerCase().includes(q) ||
      (c.proposal?.title || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verträge</h1>
          <p className="text-sm text-gray-500 mt-1">{contracts.length} Verträge insgesamt</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Verträge durchsuchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="Keine Verträge gefunden"
          description="Verträge werden erstellt, wenn Angebote angenommen werden."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Angebot</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Wert</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Laufzeit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Verlängerung</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const signedStatus = getSignedStatus(c)
                const renewalStatus = getRenewalStatus(c)
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900">{c.accountName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {c.proposal?.title || '—'}
                      {c.proposal?.version && (
                        <span className="ml-1 text-xs text-gray-400">v{c.proposal.version}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {c.value != null ? formatCurrency(c.value) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {c.startDate ? formatDate(c.startDate) : '—'}
                          {' – '}
                          {c.endDate ? formatDate(c.endDate) : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={signedStatus.variant}>{signedStatus.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {renewalStatus ? (
                        <Badge variant={renewalStatus.variant}>{renewalStatus.label}</Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Öffnen <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

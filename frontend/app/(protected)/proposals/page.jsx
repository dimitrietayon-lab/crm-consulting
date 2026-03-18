'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Search,
  Trash2,
  Eye,
  FileText,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'

const STATUS_CONFIG = {
  Draft: { variant: 'gray', label: 'Entwurf' },
  Sent: { variant: 'blue', label: 'Gesendet' },
  'Under Review': { variant: 'yellow', label: 'In Prüfung' },
  Accepted: { variant: 'green', label: 'Angenommen' },
  Rejected: { variant: 'red', label: 'Abgelehnt' },
}

const STATUS_STEPS = ['Draft', 'Sent', 'Under Review', 'Accepted']

function StatusStepper({ currentStatus }) {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus)
  const isRejected = currentStatus === 'Rejected'

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, index) => {
        const stepConfig = STATUS_CONFIG[step]
        const isActive = index === currentIndex
        const isDone = !isRejected && index < currentIndex
        const isPending = isRejected ? true : index > currentIndex

        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                isDone
                  ? 'bg-green-500'
                  : isActive
                  ? isRejected
                    ? 'bg-red-500'
                    : 'bg-blue-600'
                  : 'bg-gray-300'
              }`}
            />
            {index < STATUS_STEPS.length - 1 && (
              <div
                className={`w-4 h-0.5 ${
                  isDone ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
      {isRejected && (
        <span className="ml-1 text-xs text-red-500 font-medium">✕</span>
      )}
    </div>
  )
}

export default function ProposalsPage() {
  const router = useRouter()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get('/proposals')
      setProposals(Array.isArray(data) ? data : data.proposals || [])
    } catch (err) {
      toast.error('Angebote konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCounts = proposals.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/proposals/${deleteTarget.id}`)
      toast.success('Angebot gelöscht.')
      setDeleteTarget(null)
      fetchProposals()
    } catch (err) {
      toast.error('Angebot konnte nicht gelöscht werden.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Angebote</h1>
          <p className="text-sm text-gray-500 mt-1">
            {proposals.length} Angebote insgesamt
          </p>
        </div>
        <Link
          href="/proposals/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Angebot
        </Link>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() =>
              setStatusFilter(statusFilter === status ? 'all' : status)
            }
            className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              statusFilter === status
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-gray-200 shadow-sm'
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">
              {statusCounts[status] || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">{config.label}</p>
          </button>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Angebote durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle Status</option>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <option key={status} value={status}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : filteredProposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Keine Angebote gefunden"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Passen Sie die Suchkriterien an.'
              : 'Erstellen Sie Ihr erstes Angebot.'
          }
          action={
            !searchQuery && statusFilter === 'all' ? (
              <Link
                href="/proposals/new"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Erstes Angebot erstellen
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Titel
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Account
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Version
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Gesamtbetrag
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Autor
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Erstellt
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProposals.map((proposal) => {
                const config = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.Draft
                return (
                  <tr
                    key={proposal.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">
                          {proposal.title}
                        </p>
                        <StatusStepper currentStatus={proposal.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {proposal.accountName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      v{proposal.version || 1}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(proposal.totalAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {proposal.authorName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(proposal.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/proposals/${proposal.id}`)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Anzeigen"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {proposal.status === 'Draft' && (
                          <button
                            onClick={() => setDeleteTarget(proposal)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Angebot löschen"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Möchten Sie das Angebot{' '}
            <span className="font-semibold text-gray-900">
              "{deleteTarget?.title}"
            </span>{' '}
            wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {deleteLoading ? 'Wird gelöscht...' : 'Löschen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

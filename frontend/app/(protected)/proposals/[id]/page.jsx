'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Printer,
  Building2,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileCheck,
  User,
  Calendar,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import api from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatDate, formatCurrency, formatDateTime } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'

const STATUS_CONFIG = {
  Draft: { variant: 'gray', label: 'Entwurf' },
  Sent: { variant: 'blue', label: 'Gesendet' },
  'Under Review': { variant: 'yellow', label: 'In Prüfung' },
  Accepted: { variant: 'green', label: 'Angenommen' },
  Rejected: { variant: 'red', label: 'Abgelehnt' },
}

function TimelineItem({ icon: Icon, color, title, date, description }) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 p-1.5 rounded-full ${color} shrink-0`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
        {date && (
          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(date)}</p>
        )}
      </div>
    </div>
  )
}

export default function ProposalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const proposalId = params?.id

  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const fetchProposal = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get(`/proposals/${proposalId}`)
      setProposal(data)
    } catch (err) {
      toast.error('Angebot konnte nicht geladen werden.')
      router.push('/proposals')
    } finally {
      setLoading(false)
    }
  }, [proposalId, router])

  useEffect(() => {
    if (proposalId) fetchProposal()
  }, [fetchProposal, proposalId])

  const handleSend = async () => {
    setActionLoading(true)
    try {
      await api.post(`/proposals/${proposalId}/send`, {})
      toast.success('Angebot gesendet.')
      fetchProposal()
    } catch (err) {
      toast.error('Aktion fehlgeschlagen.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAccept = async () => {
    setActionLoading(true)
    try {
      await api.post(`/proposals/${proposalId}/accept`, {})
      toast.success('Angebot angenommen.')
      fetchProposal()
    } catch (err) {
      toast.error('Aktion fehlgeschlagen.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    try {
      await api.post(`/proposals/${proposalId}/reject`, {})
      toast.success('Angebot abgelehnt.')
      setShowRejectModal(false)
      fetchProposal()
    } catch (err) {
      toast.error('Aktion fehlgeschlagen.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    setActionLoading(true)
    try {
      const newProposal = await api.post(`/proposals/${proposalId}/version`, {})
      toast.success(`Version ${newProposal.version} erstellt.`)
      router.push(`/proposals/${newProposal.id}`)
    } catch (err) {
      toast.error('Neue Version konnte nicht erstellt werden.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      await api.post(`/proposals/${proposalId}/approve`, {})
      toast.success('Angebot genehmigt.')
      fetchProposal()
    } catch (err) {
      toast.error('Genehmigung fehlgeschlagen.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.delete(`/proposals/${proposalId}`)
      toast.success('Angebot gelöscht.')
      router.push('/proposals')
    } catch (err) {
      toast.error('Angebot konnte nicht gelöscht werden.')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePDFExport = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${base}/proposals/${proposal.id}/pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('PDF konnte nicht generiert werden')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Angebot-${proposal.id.slice(-8).toUpperCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF heruntergeladen')
    } catch {
      toast.error('PDF konnte nicht generiert werden')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (!proposal) return null

  const statusConfig = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.Draft
  const lineItems = proposal.lineItems || []
  const totalAmount = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
  const versions = proposal.versions || []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/proposals')}
            className="mt-1 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {proposal.title}
              </h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Version {proposal.version || 1}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <span>{proposal.account?.name}</span>
              {proposal.createdAt && (
                <>
                  <span>·</span>
                  <span>{formatDate(proposal.createdAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {proposal.status === 'Draft' && (
            <>
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Senden
              </button>
              <button
                onClick={() => router.push(`/proposals/new?edit=${proposalId}`)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                Bearbeiten
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Löschen
              </button>
            </>
          )}
          {proposal.status === 'Sent' && (
            <>
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Akzeptieren
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Ablehnen
              </button>
            </>
          )}
          {proposal.status === 'Accepted' && proposal.contractId && (
            <button
              onClick={() => router.push(`/contracts/${proposal.contractId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FileCheck className="w-4 h-4" />
              Vertrag anzeigen
            </button>
          )}
          {proposal.status !== 'Draft' && (
            <button
              onClick={handleCreateVersion}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              Neue Version
            </button>
          )}
          <button
            onClick={handlePDFExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Cover Text */}
          {proposal.coverText && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Anschreiben
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {proposal.coverText}
              </p>
            </div>
          )}

          {/* Scope of Work */}
          {proposal.scopeOfWork && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Leistungsumfang
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {proposal.scopeOfWork}
              </p>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Leistungspositionen
            </h2>
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Keine Positionen vorhanden.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-3 font-medium text-gray-600">
                      Beschreibung
                    </th>
                    <th className="text-right pb-3 font-medium text-gray-600 w-20">
                      Menge
                    </th>
                    <th className="text-left pb-3 font-medium text-gray-600 w-24 pl-4">
                      Einheit
                    </th>
                    <th className="text-right pb-3 font-medium text-gray-600 w-32">
                      Einzelpreis
                    </th>
                    <th className="text-right pb-3 font-medium text-gray-600 w-32">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 text-gray-900">{item.description}</td>
                      <td className="py-3 text-right text-gray-600">
                        {item.quantity}
                      </td>
                      <td className="py-3 pl-4 text-gray-600">{item.unit}</td>
                      <td className="py-3 text-right text-gray-600">
                        {formatCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={4} className="pt-4 text-right font-semibold text-gray-900">
                      Gesamtbetrag
                    </td>
                    <td className="pt-4 text-right">
                      <span className="text-2xl font-bold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Approval Status */}
          {proposal.requiresApproval && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Genehmigung (Angebot &gt; 50.000 €)
              </h2>
              {proposal.approvedById ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Genehmigt{proposal.approvedAt ? ` am ${formatDate(proposal.approvedAt)}` : ''}
                  </span>
                </div>
              ) : proposal.status === 'Rejected' ? (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Abgelehnt</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-medium">
                      Genehmigung ausstehend
                    </span>
                  </div>
                  {['Under Review', 'Sent'].includes(proposal.status) && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Genehmigen
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <ThumbsDown className="w-4 h-4" />
                        Ablehnen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Version History */}
          {versions.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Versionsverlauf
              </h2>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id || v.version}
                    className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-900">
                      Version {v.version}
                    </span>
                    <span className="text-gray-500">{formatDate(v.createdAt)}</span>
                    <span className="text-gray-600">
                      {v.createdBy?.name || v.author?.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Account Info */}
          {proposal.account && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Account
              </h3>
              <p className="font-medium text-gray-900">{proposal.account.name}</p>
              {proposal.account.industry && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {proposal.account.industry}
                </p>
              )}
              {proposal.account.location && (
                <p className="text-xs text-gray-500">{proposal.account.location}</p>
              )}
            </div>
          )}

          {/* Contract Info */}
          {proposal.status === 'Accepted' && proposal.contract && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-600" />
                Vertrag
              </h3>
              <p className="text-sm font-medium text-gray-900">
                {proposal.contract.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(proposal.contract.startDate)} –{' '}
                {formatDate(proposal.contract.endDate)}
              </p>
              <button
                onClick={() =>
                  router.push(`/contracts/${proposal.contract.id}`)
                }
                className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Vertrag öffnen <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Author Info */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Erstellt von
            </h3>
            <p className="text-sm text-gray-900">
              {proposal.authorName || '—'}
            </p>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Zeitverlauf
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-0">
                <TimelineItem
                  icon={FileText}
                  color="bg-gray-500"
                  title="Erstellt"
                  date={proposal.createdAt}
                  description={`von ${proposal.authorName || '—'}`}
                />
                {proposal.sentAt && (
                  <TimelineItem
                    icon={Send}
                    color="bg-blue-500"
                    title="Gesendet"
                    date={proposal.sentAt}
                  />
                )}
                {proposal.acceptedAt && (
                  <TimelineItem
                    icon={CheckCircle}
                    color="bg-green-500"
                    title="Angenommen"
                    date={proposal.acceptedAt}
                  />
                )}
                {proposal.rejectedAt && (
                  <TimelineItem
                    icon={XCircle}
                    color="bg-red-500"
                    title="Abgelehnt"
                    date={proposal.rejectedAt}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Angebot ablehnen"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Möchten Sie das Angebot{' '}
            <span className="font-semibold">"{proposal.title}"</span> wirklich
            ablehnen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Wird verarbeitet...' : 'Ablehnen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Angebot löschen"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Möchten Sie das Angebot{' '}
            <span className="font-semibold">"{proposal.title}"</span> wirklich
            löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Wird gelöscht...' : 'Löschen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

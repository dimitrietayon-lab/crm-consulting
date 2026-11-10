'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronLeft, Send, CheckCircle2, XCircle, RotateCcw, Search, FileDown, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

const PACKAGE_LABELS = { compact: 'Compact', standard: 'Standard', premium: 'Premium' }
const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']

const STATUS_STYLES = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired:  'bg-yellow-100 text-yellow-700',
}
const STATUS_LABELS = {
  draft: 'Entwurf', sent: 'Versendet', accepted: 'Angenommen', rejected: 'Abgelehnt', expired: 'Abgelaufen',
}

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function displayState(offer) {
  if (offer.status === 'sent' && offer.validUntil) {
    const valid = new Date(offer.validUntil)
    if (!Number.isNaN(valid.getTime()) && valid.getTime() < Date.now()) return 'expired'
  }
  return offer.status || 'draft'
}

export default function SprintOffersPage() {
  const router = useRouter()
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/sprint-offers')
      setOffers(Array.isArray(data) ? data : data?.data || [])
    } catch {
      toast.error('Fehler beim Laden der Angebote')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return offers
      .map((o) => ({ ...o, state: displayState(o) }))
      .filter((o) => !statusFilter || o.state === statusFilter)
      .filter((o) => {
        if (!q) return true
        const name = o.sprintTarget?.companyName || ''
        return name.toLowerCase().includes(q) || (o.offerNumber || '').toLowerCase().includes(q)
      })
  }, [offers, statusFilter, search])

  const stats = useMemo(() => {
    const total = offers.length
    const value = offers.reduce((s, o) => s + (o.value || 0), 0)
    const accepted = offers.filter((o) => displayState(o) === 'accepted')
    const pending = offers.filter((o) => displayState(o) === 'sent')
    const avgDays = pending.length
      ? Math.round(
          pending.reduce((s, o) => s + (Date.now() - new Date(o.sentAt || o.createdAt).getTime()) / 86400000, 0) /
            pending.length
        )
      : 0
    return {
      total,
      value,
      acceptedCount: accepted.length,
      acceptedValue: accepted.reduce((s, o) => s + (o.value || 0), 0),
      pendingCount: pending.length,
      avgDays,
    }
  }, [offers])

  async function runAction(offer, action, body, successMessage) {
    setBusyId(offer.id)
    try {
      await api.post(`/sprint-offers/${offer.id}/${action}`, body || {})
      toast.success(successMessage)
      await fetchOffers()
    } catch (err) {
      toast.error(err.message || 'Aktion fehlgeschlagen')
    } finally {
      setBusyId(null)
    }
  }

  async function downloadPdf(offer) {
    try {
      await api.download(`/sprint-offers/${offer.id}/pdf`, `Angebot-${offer.offerNumber}.pdf`)
    } catch (err) {
      toast.error(err.message || 'PDF-Download fehlgeschlagen')
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Angebote</h1>
            <p className="text-sm text-gray-500">Angebote, Positionen, Status und Gültigkeit</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/sprint-targets/offers/new')}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <Plus className="w-4 h-4" /> Neues Angebot
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Angebote', value: stats.total, cls: 'text-gray-900' },
          { label: 'Volumen', value: formatCurrency(stats.value), cls: 'text-gray-900' },
          { label: 'Angenommen', value: `${stats.acceptedCount} · ${formatCurrency(stats.acceptedValue)}`, cls: 'text-green-700' },
          { label: 'Ausstehend', value: `${stats.pendingCount} · Ø ${stats.avgDays} Tage`, cls: 'text-yellow-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-base font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unternehmen oder Nummer suchen …"
            className="w-64 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
          <option value="">Alle Status</option>
          <option value="draft">Entwurf</option>
          <option value="sent">Versendet</option>
          <option value="accepted">Angenommen</option>
          <option value="rejected">Abgelehnt</option>
          <option value="expired">Abgelaufen</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Keine Angebote gefunden. Lege über „Neues Angebot“ das erste an.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['Nummer', 'Unternehmen', 'Paket', 'Erstellt', 'Gültig bis', 'Status', 'Betrag', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => router.push(`/sprint-targets/offers/${o.id}`)}
                      className="text-sm font-mono font-medium text-gray-900 hover:text-violet-700"
                    >
                      {o.offerNumber}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium text-gray-900">{o.sprintTarget?.companyName || '—'}</p>
                    <p className="text-xs text-gray-500">{o.sprintTarget?.segment}</p>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 capitalize">{PACKAGE_LABELS[o.package] || o.package || '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(o.sentAt || o.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{o.validUntil ? formatDate(o.validUntil) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.state]}`}>
                      {STATUS_LABELS[o.state]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">{o.value ? formatCurrency(o.value) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/sprint-targets/offers/${o.id}`)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Details"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadPdf(o)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="PDF herunterladen"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      {(o.state === 'draft' || o.state === 'expired') && (
                        <button
                          disabled={busyId === o.id}
                          onClick={() => runAction(o, o.state === 'expired' ? 'extend' : 'send', {}, o.state === 'expired' ? 'Angebot verlängert' : 'Angebot versendet')}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-40"
                          title={o.state === 'expired' ? 'Verlängern' : 'Versenden'}
                        >
                          {o.state === 'expired' ? <RotateCcw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}
                      {o.state === 'sent' && (
                        <>
                          <button
                            disabled={busyId === o.id}
                            onClick={() => runAction(o, 'accept', {}, 'Angebot angenommen')}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-40" title="Angenommen"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRejecting(o)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Abgelehnt"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RejectModal
        offer={rejecting}
        onClose={() => setRejecting(null)}
        onSaved={() => {
          setRejecting(null)
          fetchOffers()
        }}
      />
    </div>
  )
}

function RejectModal({ offer, onClose, onSaved }) {
  const [lossReason, setLossReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLossReason('') }, [offer])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!lossReason) { toast.error('Bitte Verlustgrund wählen'); return }
    setSaving(true)
    try {
      await api.post(`/sprint-offers/${offer.id}/reject`, { lossReason })
      toast.success('Als abgelehnt erfasst')
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  if (!offer) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Angebot ablehnen</h2>
          <p className="text-sm text-gray-500 mb-4">
            {offer.offerNumber} · {offer.sprintTarget?.companyName}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={CLS_LABEL}>Verlustgrund *</label>
              <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className={CLS_INPUT} required>
                <option value="">-- wählen --</option>
                {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Speichern...' : 'Ablehnen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

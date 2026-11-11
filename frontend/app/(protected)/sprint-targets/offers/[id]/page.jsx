'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ChevronLeft, Send, CheckCircle2, XCircle, RotateCcw, FileDown, Plus, Trash2, Save, Pencil, Trash,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { getSprintSettings } from '@/lib/sprintSettings'

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

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function displayState(offer) {
  if (offer.status === 'sent' && offer.validUntil) {
    const valid = new Date(offer.validUntil)
    if (!Number.isNaN(valid.getTime()) && valid.getTime() < Date.now()) return 'expired'
  }
  return offer.status || 'draft'
}

function lineTotal(item) {
  const q = Number(item.quantity) || 0
  const p = Number(item.unitPrice) || 0
  return Math.round(q * p * 100) / 100
}

export default function SprintOfferDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id

  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)

  const packages = useMemo(() => {
    const list = getSprintSettings().packages
    return Array.isArray(list) ? list : []
  }, [])
  const packageLabel = (key) => packages.find((p) => p.key === key)?.label || key || '—'

  const fetchOffer = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/sprint-offers/${id}`)
      setOffer(data)
    } catch (err) {
      toast.error(err.message || 'Angebot konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchOffer()
  }, [id, fetchOffer])

  function startEdit() {
    setDraft({
      package: offer.package || packages[0]?.key || '',
      validUntil: offer.validUntil ? offer.validUntil.slice(0, 10) : '',
      notes: offer.notes || '',
      items: (offer.items || []).map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    })
    setEditing(true)
  }

  function updateDraftItem(index, patch) {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const draftTotal = useMemo(
    () => (draft?.items || []).reduce((sum, item) => sum + lineTotal(item), 0),
    [draft]
  )

  async function saveDraft(e) {
    e.preventDefault()
    const cleaned = (draft.items || [])
      .filter((item) => String(item.description || '').trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      }))
    if (!cleaned.length) { toast.error('Mindestens eine Position angeben'); return }

    setSaving(true)
    try {
      const updated = await api.put(`/sprint-offers/${id}`, {
        package: draft.package,
        validUntil: draft.validUntil || null,
        notes: draft.notes || null,
        items: cleaned,
      })
      setOffer(updated)
      setEditing(false)
      toast.success('Angebot gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function runAction(action, body, message) {
    setBusy(true)
    try {
      await api.post(`/sprint-offers/${id}/${action}`, body || {})
      toast.success(message)
      await fetchOffer()
    } catch (err) {
      toast.error(err.message || 'Aktion fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (typeof window !== 'undefined' && !window.confirm('Angebot wirklich löschen?')) return
    setBusy(true)
    try {
      await api.delete(`/sprint-offers/${id}`)
      toast.success('Angebot gelöscht')
      router.push('/proposals?tab=akquise')
    } catch (err) {
      toast.error(err.message || 'Löschen fehlgeschlagen')
      setBusy(false)
    }
  }

  async function downloadPdf() {
    try {
      await api.download(`/sprint-offers/${id}/pdf`, `Angebot-${offer.offerNumber}.pdf`)
    } catch (err) {
      toast.error(err.message || 'PDF-Download fehlgeschlagen')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!offer) {
    return <div className="text-center py-16 text-sm text-gray-500">Angebot nicht gefunden.</div>
  }

  const state = displayState(offer)

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/proposals?tab=akquise')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Angebote
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-mono font-bold text-gray-900">{offer.offerNumber}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[state]}`}>
                {STATUS_LABELS[state]}
              </span>
            </div>
            <button
              onClick={() => router.push(`/sprint-targets/${offer.sprintTarget?.id}`)}
              className="text-sm text-gray-500 hover:text-blue-700"
            >
              {offer.sprintTarget?.companyName}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          {(state === 'draft' || state === 'expired') && (
            <button
              disabled={busy}
              onClick={() => runAction(state === 'expired' ? 'extend' : 'send', {}, state === 'expired' ? 'Angebot verlängert' : 'Angebot versendet')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {state === 'expired' ? <RotateCcw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {state === 'expired' ? 'Verlängern' : 'Versenden'}
            </button>
          )}
          {state === 'sent' && (
            <>
              <button
                disabled={busy}
                onClick={() => runAction('accept', {}, 'Angebot angenommen')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Angenommen
              </button>
              <button
                onClick={() => setRejecting(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                <XCircle className="w-4 h-4" /> Abgelehnt
              </button>
            </>
          )}
          {!editing && (
            <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">
              <Pencil className="w-4 h-4" /> Bearbeiten
            </button>
          )}
          <button onClick={handleDelete} disabled={busy} className="p-2 text-red-600 border border-gray-300 rounded-md hover:bg-red-50 disabled:opacity-50" title="Löschen">
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Paket', value: packageLabel(offer.package) },
          { label: 'Betrag', value: formatCurrency(offer.value) },
          { label: 'Gültig bis', value: offer.validUntil ? formatDate(offer.validUntil) : '—' },
          { label: 'Versendet', value: offer.sentAt ? formatDateTime(offer.sentAt) : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-base font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {editing ? (
        <form onSubmit={saveDraft} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Paket</label>
                <select value={draft.package} onChange={(e) => setDraft({ ...draft, package: e.target.value })} className={CLS_INPUT}>
                  {!draft.package && <option value="">-- kein Paket --</option>}
                  {packages.map((p) => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Gültig bis</label>
                <input type="date" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Hinweise</label>
              <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={CLS_INPUT} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Positionen</h2>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: '' }] }))}
                className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
              >
                <Plus className="w-4 h-4" /> Position
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <div className="col-span-6">Beschreibung</div>
                <div className="col-span-2">Menge</div>
                <div className="col-span-2">Einzelpreis</div>
                <div className="col-span-2 text-right">Summe</div>
              </div>
              {draft.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={(e) => updateDraftItem(index, { description: e.target.value })}
                    className={`${CLS_INPUT} col-span-6`}
                  />
                  <input
                    type="number" min="1" step="1"
                    value={item.quantity}
                    onChange={(e) => updateDraftItem(index, { quantity: e.target.value })}
                    className={`${CLS_INPUT} col-span-2`}
                  />
                  <input
                    type="number" min="0" step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateDraftItem(index, { unitPrice: e.target.value })}
                    className={`${CLS_INPUT} col-span-2`}
                  />
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-800">{formatCurrency(lineTotal(item))}</span>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, items: prev.items.length === 1 ? [{ description: '', quantity: 1, unitPrice: '' }] : prev.items.filter((_, i) => i !== index) }))}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 mt-3 border-t border-gray-100">
              <div className="text-right">
                <p className="text-xs text-gray-500">Gesamtsumme</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(draftTotal)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['Pos.', 'Beschreibung', 'Menge', 'Einzelpreis', 'Summe'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(offer.items || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Keine Positionen erfasst.</td>
                </tr>
              ) : (
                offer.items.map((item) => (
                  <tr key={item.id || item.position} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-500">{item.position}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">{item.description}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-gray-600">Gesamtsumme</td>
                <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{formatCurrency(offer.value)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Erstellt</p>
          <p className="text-gray-900">{formatDateTime(offer.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Angenommen</p>
          <p className="text-gray-900">{offer.acceptedAt ? formatDateTime(offer.acceptedAt) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Abgelehnt</p>
          <p className="text-gray-900">{offer.rejectedAt ? formatDateTime(offer.rejectedAt) : '—'}</p>
        </div>
        {offer.notes && (
          <div className="md:col-span-3">
            <p className="text-xs text-gray-500">Hinweise</p>
            <p className="text-gray-900 whitespace-pre-wrap">{offer.notes}</p>
          </div>
        )}
      </div>

      {rejecting && (
        <RejectModal
          offer={offer}
          onClose={() => setRejecting(false)}
          onSaved={() => {
            setRejecting(false)
            fetchOffer()
          }}
        />
      )}
    </div>
  )
}

function RejectModal({ offer, onClose, onSaved }) {
  const [lossReason, setLossReason] = useState('')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Angebot ablehnen</h2>
          <p className="text-sm text-gray-500 mb-4">{offer.offerNumber} · {offer.sprintTarget?.companyName}</p>
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

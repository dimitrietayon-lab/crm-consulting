'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, X, Plus, Trash2, ChevronDown,
  Activity, Users, CheckSquare, TrendingUp, DollarSign,
  Calendar, Check, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate, formatCurrency, getInitials, timeAgo } from '@/lib/utils'

const STAGES = ['First Contact', 'Needs Analysis', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']

const STAGE_STYLES = {
  'First Contact': 'bg-slate-100 text-slate-700 border-slate-200',
  'Needs Analysis': 'bg-blue-100 text-blue-700 border-blue-200',
  'Proposal Sent': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Negotiation: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Won: 'bg-green-100 text-green-700 border-green-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
}

const ACTIVITY_TYPES = ['Meeting', 'Call', 'Email', 'Demo', 'Workshop', 'Proposal', 'Negotiation', 'Note', 'Other']
const LOSS_REASONS = [
  'Preis zu hoch',
  'Kompetitor gewonnen',
  'Kein Budget',
  'Kein Bedarf',
  'Timing',
  'Kein Feedback',
  'Anderer Grund',
]

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'activities', label: 'Aktivitäten' },
  { id: 'contacts', label: 'Kontakte' },
  { id: 'tasks', label: 'Aufgaben' },
]

// ── Edit Deal Modal ───────────────────────────────────────────────────────────
function EditDealModal({ isOpen, onClose, deal, onSaved, accounts, users }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const SERVICE_TYPES = [
    'Strategy Consulting', 'Risk Management', 'IT Consulting',
    'Regulatory Compliance', 'Audit Support', 'Change Management',
    'Process Optimization', 'Data Analytics', 'Other',
  ]
  const SOURCES = ['Referral', 'Event', 'Inbound', 'Outbound', 'Other']

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || '',
        accountId: deal.accountId || '',
        serviceType: deal.serviceType || '',
        value: deal.value ?? '',
        probability: deal.probability ?? 20,
        expectedClose: deal.expectedClose?.split('T')[0] || '',
        source: deal.source || '',
        assignedToId: deal.assignedToId || '',
        stage: deal.stage || 'First Contact',
        notes: deal.notes || '',
        lossReason: deal.lossReason || '',
      })
    }
  }, [deal])

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        value: form.value !== '' ? Number(form.value) : null,
        probability: form.probability !== '' ? Number(form.probability) : null,
        accountId: form.accountId || null,
        assignedToId: form.assignedToId || null,
        expectedClose: form.expectedClose || null,
      }
      const updated = await api.put(`/deals/${deal.id}`, payload)
      toast.success('Deal gespeichert')
      onSaved(updated)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Deal bearbeiten</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={CLS_LABEL}>Titel *</label>
              <input type="text" required value={form.title || ''} onChange={(e) => set('title', e.target.value)} className={CLS_INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Account</label>
                <select value={form.accountId || ''} onChange={(e) => set('accountId', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Kein Account --</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Service-Typ</label>
                <select value={form.serviceType || ''} onChange={(e) => set('serviceType', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Phase</label>
                <select value={form.stage || ''} onChange={(e) => set('stage', e.target.value)} className={CLS_INPUT}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Quelle</label>
                <select value={form.source || ''} onChange={(e) => set('source', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Deal-Wert (€)</label>
                <input type="number" min="0" value={form.value ?? ''} onChange={(e) => set('value', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Erwarteter Abschluss</label>
                <input type="date" value={form.expectedClose || ''} onChange={(e) => set('expectedClose', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Wahrscheinlichkeit: {form.probability}%</label>
              <input
                type="range" min="0" max="100" step="5"
                value={form.probability ?? 20}
                onChange={(e) => set('probability', Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Zuständiger Consultant</label>
              <select value={form.assignedToId || ''} onChange={(e) => set('assignedToId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Keiner --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {form.stage === 'Lost' && (
              <div>
                <label className={CLS_LABEL}>Verlustgrund</label>
                <select value={form.lossReason || ''} onChange={(e) => set('lossReason', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={CLS_LABEL}>Notizen</label>
              <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={3} className={`${CLS_INPUT} resize-none`} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ deal, users, onUpdate }) {
  const [probability, setProbability] = useState(deal.probability ?? 0)
  const [lossReason, setLossReason] = useState(deal.lossReason || '')
  const [savingProbability, setSavingProbability] = useState(false)
  const [savingLoss, setSavingLoss] = useState(false)

  useEffect(() => {
    setProbability(deal.probability ?? 0)
    setLossReason(deal.lossReason || '')
  }, [deal])

  async function saveProbability() {
    setSavingProbability(true)
    try {
      const updated = await api.put(`/deals/${deal.id}`, { probability: Number(probability) })
      onUpdate(updated)
      toast.success('Wahrscheinlichkeit gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSavingProbability(false)
    }
  }

  async function saveLossReason() {
    setSavingLoss(true)
    try {
      const updated = await api.put(`/deals/${deal.id}`, { lossReason })
      onUpdate(updated)
      toast.success('Verlustgrund gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSavingLoss(false)
    }
  }

  const weightedValue = (Number(deal.value) || 0) * ((Number(probability) || 0) / 100)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Deal info */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Deal-Details</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Account</dt>
              <dd className="text-sm font-medium text-gray-900">
                {deal.account ? (
                  <Link href={`/accounts/${deal.accountId}`} className="text-blue-600 hover:underline">
                    {deal.account.companyName}
                  </Link>
                ) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Service-Typ</dt>
              <dd className="text-sm font-medium text-gray-900">{deal.serviceType || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Deal-Wert</dt>
              <dd className="text-sm font-bold text-gray-900">{formatCurrency(deal.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Gewichteter Wert</dt>
              <dd className="text-sm font-semibold text-blue-600">{formatCurrency(weightedValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Erwarteter Abschluss</dt>
              <dd className="text-sm text-gray-900">{formatDate(deal.expectedClose)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Quelle</dt>
              <dd className="text-sm text-gray-900">{deal.source || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Zuständiger Consultant</dt>
              <dd className="text-sm text-gray-900">
                {deal.assignedTo?.name || '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Probability slider */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Abschlusswahrscheinlichkeit
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-2xl font-bold text-blue-600 w-16 text-right">{probability}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  probability >= 70 ? 'bg-green-500' : probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${probability}%` }}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveProbability}
                disabled={savingProbability || probability === (deal.probability ?? 0)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingProbability ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>

        {/* Loss reason (only if Lost) */}
        {deal.stage === 'Lost' && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-5">
            <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Verlustgrund
            </h3>
            <select
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              className={CLS_INPUT}
            >
              <option value="">-- Bitte wählen --</option>
              {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex justify-end mt-2">
              <button
                onClick={saveLossReason}
                disabled={savingLoss}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {savingLoss ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Notizen</h3>
        {deal.notes ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{deal.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Keine Notizen vorhanden</p>
        )}
      </div>
    </div>
  )
}

// ── Activities Tab ────────────────────────────────────────────────────────────
function ActivitiesTab({ dealId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    type: 'Meeting',
    date: new Date().toISOString().split('T')[0],
    duration: '',
    summary: '',
    nextSteps: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/deals/${dealId}/activities`)
      .then((d) => setActivities(Array.isArray(d) ? d : (d?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dealId])

  async function addActivity(e) {
    e.preventDefault()
    if (!form.summary.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/deals/${dealId}/activities`, {
        ...form,
        duration: form.duration ? Number(form.duration) : null,
      })
      setActivities((prev) => [created, ...prev])
      setForm({ type: 'Meeting', date: new Date().toISOString().split('T')[0], duration: '', summary: '', nextSteps: '' })
      setShowAdd(false)
      toast.success('Aktivität hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  const ACTIVITY_ICON_COLORS = {
    Meeting: 'bg-blue-100 text-blue-600',
    Call: 'bg-green-100 text-green-600',
    Email: 'bg-purple-100 text-purple-600',
    Demo: 'bg-orange-100 text-orange-600',
    Proposal: 'bg-indigo-100 text-indigo-600',
    Note: 'bg-gray-100 text-gray-600',
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Aktivität erfassen
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addActivity} className="bg-white rounded-lg border border-blue-200 shadow-sm p-5 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900">Neue Aktivität</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={CLS_LABEL}>Typ</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={CLS_INPUT}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Datum</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Dauer (Min.)</label>
              <input type="number" min="0" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} className={CLS_INPUT} placeholder="60" />
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Zusammenfassung *</label>
            <textarea
              required
              value={form.summary}
              onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
              rows={3}
              className={`${CLS_INPUT} resize-none`}
              placeholder="Was wurde besprochen?"
            />
          </div>
          <div>
            <label className={CLS_LABEL}>Nächste Schritte</label>
            <input type="text" value={form.nextSteps} onChange={(e) => setForm((p) => ({ ...p, nextSteps: e.target.value }))} className={CLS_INPUT} placeholder="Offene To-Dos..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Abbrechen</button>
          </div>
        </form>
      )}

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Aktivitäten erfasst</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-7 top-0 bottom-0 w-px bg-gray-200" />
          <div className="space-y-3">
            {activities.map((act) => {
              const iconCls = ACTIVITY_ICON_COLORS[act.type] || 'bg-gray-100 text-gray-600'
              return (
                <div key={act.id} className="relative flex gap-4 pl-0">
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${iconCls}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${iconCls}`}>{act.type}</span>
                      <span className="text-xs text-gray-400">{formatDate(act.date)}</span>
                      {act.duration && (
                        <span className="text-xs text-gray-400">{act.duration} Min.</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900">{act.summary}</p>
                    {act.nextSteps && (
                      <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1">
                        <span className="font-medium shrink-0">Nächste Schritte:</span>
                        {act.nextSteps}
                      </p>
                    )}
                    {act.user && (
                      <p className="text-xs text-gray-400 mt-1.5">{act.user.name}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────
function ContactsTab({ dealId, allContacts }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.get(`/deals/${dealId}/contacts`)
      .then((d) => setContacts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dealId])

  const linkedIds = new Set(contacts.map((c) => c.contactId || c.contact?.id))

  const available = (allContacts || []).filter((c) => {
    if (linkedIds.has(c.id)) return false
    if (!search.trim()) return true
    return c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  })

  async function addContact(contactId) {
    setAdding(true)
    try {
      const created = await api.post(`/deals/${dealId}/contacts`, { contactId })
      setContacts((prev) => [...prev, created])
      setSearch('')
      toast.success('Kontakt zugewiesen')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setAdding(false)
    }
  }

  async function removeContact(linkId, contactId) {
    try {
      await api.delete(`/deals/${dealId}/contacts/${contactId}`)
      setContacts((prev) => prev.filter((c) => c.id !== linkId))
      toast.success('Kontakt entfernt')
    } catch {
      toast.error('Fehler beim Entfernen')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Kontakt zuweisen
        </button>
      </div>

      {showPicker && (
        <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Kontakt suchen & zuweisen</h4>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name oder E-Mail suchen..."
            className={CLS_INPUT}
            autoFocus
          />
          {available.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Keine weiteren Kontakte gefunden</p>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-200">
              {available.slice(0, 20).map((c) => (
                <button
                  key={c.id}
                  disabled={adding}
                  onClick={() => addContact(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {getInitials(c.name || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.title || c.email || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { setShowPicker(false); setSearch('') }} className="text-xs text-gray-400 hover:text-gray-600">Schließen</button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Kontakte zugewiesen</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {contacts.map((c) => {
            const name = c.contact?.name || '—'
            const contactId = c.contact?.id || c.contactId
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 group">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.contact?.title || c.contact?.email || ''}</p>
                </div>
                {c.role && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.role}</span>
                )}
                <button
                  onClick={() => removeContact(c.id, contactId)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  title="Kontakt entfernen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PRIORITIES = ['Low', 'Medium', 'High']
const PRIORITY_STYLES = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-red-100 text-red-700',
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────
function TasksTab({ dealId, users }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Medium', assignedToId: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/deals/${dealId}/tasks`)
      .then((d) => setTasks(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dealId])

  function setF(field, val) { setForm((p) => ({ ...p, [field]: val })) }

  async function addTask(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/deals/${dealId}/tasks`, {
        title: form.title,
        description: form.description || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        assignedToId: form.assignedToId || null,
      })
      setTasks((prev) => [...prev, created])
      setForm({ title: '', description: '', dueDate: '', priority: 'Medium', assignedToId: '' })
      setShowForm(false)
      toast.success('Aufgabe erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task) {
    try {
      const updated = await api.put(`/deals/${dealId}/tasks/${task.id}`, { completed: !task.completed })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Aufgabe erstellen
        </button>
      </div>

      {showForm && (
        <form onSubmit={addTask} className="bg-white rounded-lg border border-blue-200 shadow-sm p-5 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Neue Aufgabe</h4>
          <div>
            <label className={CLS_LABEL}>Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setF('title', e.target.value)}
              className={CLS_INPUT}
              placeholder="Was muss erledigt werden?"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={CLS_LABEL}>Priorität</label>
              <select value={form.priority} onChange={(e) => setF('priority', e.target.value)} className={CLS_INPUT}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Fällig am</label>
              <input type="date" value={form.dueDate} onChange={(e) => setF('dueDate', e.target.value)} className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Zuständig</label>
              <select value={form.assignedToId} onChange={(e) => setF('assignedToId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Keiner --</option>
                {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => setF('description', e.target.value)}
              rows={2}
              className={`${CLS_INPUT} resize-none`}
              placeholder="Details zur Aufgabe..."
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Erstellen...' : 'Erstellen'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Abbrechen</button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Aufgaben</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50">
              <button
                onClick={() => toggleTask(task)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {task.completed && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {task.priority && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] || 'bg-gray-100 text-gray-600'}`}>
                      {task.priority}
                    </span>
                  )}
                  {task.assignedTo && (
                    <span className="text-xs text-gray-400">{task.assignedTo.name}</span>
                  )}
                  {task.dueDate && (
                    <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEdit, setShowEdit] = useState(false)
  const [stageDropdown, setStageDropdown] = useState(false)
  const [savingStage, setSavingStage] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [d, a, u, c] = await Promise.all([
        api.get(`/deals/${id}`),
        api.get('/accounts'),
        api.get('/users'),
        api.get('/contacts'),
      ])
      setDeal(d)
      setAccounts(Array.isArray(a) ? a : (a?.data || []))
      setUsers(Array.isArray(u) ? u : (u?.data || []))
      setContacts(Array.isArray(c) ? c : (c?.data || []))
    } catch {
      toast.error('Fehler beim Laden des Deals')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function changeStage(newStage) {
    setSavingStage(true)
    setStageDropdown(false)
    try {
      const updated = await api.put(`/deals/${id}`, { stage: newStage })
      setDeal(updated)
      toast.success(`Phase: ${newStage}`)
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSavingStage(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Deal wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Deal nicht gefunden.</p>
        <button onClick={() => router.push('/pipeline')} className="mt-4 text-blue-600 hover:underline text-sm">
          Zurück zur Pipeline
        </button>
      </div>
    )
  }

  const stageStyle = STAGE_STYLES[deal.stage] || 'bg-gray-100 text-gray-600 border-gray-200'
  const weightedValue = (Number(deal.value) || 0) * ((Number(deal.probability) || 0) / 100)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/pipeline')}
              className="mt-0.5 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <div className="relative">
                  <button
                    onClick={() => setStageDropdown((v) => !v)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border cursor-pointer hover:opacity-80 transition-opacity ${stageStyle}`}
                    disabled={savingStage}
                  >
                    {deal.stage}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {stageDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] overflow-hidden">
                      {STAGES.map((s) => (
                        <button
                          key={s}
                          onClick={() => changeStage(s)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${s === deal.stage ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {deal.stage === 'Lost' && (
                  <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    <AlertTriangle className="w-3 h-3" />
                    {deal.lossReason || 'Grund nicht angegeben'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
              {deal.account && (
                <Link href={`/accounts/${deal.accountId}`} className="text-sm text-blue-600 hover:underline mt-0.5 inline-block">
                  {deal.account.companyName}
                </Link>
              )}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="font-bold text-gray-900">{formatCurrency(deal.value)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{deal.probability ?? 0}% → </span>
                  <span className="font-semibold text-blue-600">{formatCurrency(weightedValue)}</span>
                </div>
                {deal.expectedClose && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(deal.expectedClose)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            <Edit2 className="w-4 h-4" /> Bearbeiten
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-200 px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex-shrink-0 px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'overview' && (
            <OverviewTab deal={deal} users={users} onUpdate={setDeal} />
          )}
          {activeTab === 'activities' && <ActivitiesTab dealId={id} />}
          {activeTab === 'contacts' && <ContactsTab dealId={id} allContacts={contacts} />}
          {activeTab === 'tasks' && <TasksTab dealId={id} users={users} />}
        </div>
      </div>

      <EditDealModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        deal={deal}
        onSaved={setDeal}
        accounts={accounts}
        users={users}
      />

      {stageDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setStageDropdown(false)} />
      )}
    </div>
  )
}

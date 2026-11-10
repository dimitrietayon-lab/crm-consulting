'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Phone, ArrowRight, Brain, FileText, Edit2, Save, X, Plus, AlertTriangle, RotateCcw, UserCheck, ClipboardCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import ActivityLogModal from '@/components/sprint/ActivityLogModal'
import StatusPicker from '@/components/sprint/StatusPicker'
import {
  BRANCHEN, BUNDESLAENDER, CONTACT_SOURCES, CONSENT_SOURCES, SPRINT_PHASES,
  LOST_STATUSES, ACTIVE_STATUSES, WON_STATUSES, phaseForStatus, statusLabel, STATUS_BADGE,
} from '@/lib/sprintOptions'

const PACKAGES = ['compact', 'standard', 'premium']

const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function ActivityTypeIcon({ type }) {
  const map = {
    Call: '📞', Meeting: '🤝', Email: '✉️', LinkedIn: '🔗', Note: '📝', Task: '✅',
  }
  return <span className="text-base">{map[type] || '📌'}</span>
}

function QualifyModal({ isOpen, target, targetId, onClose, onSaved }) {
  const today = () => new Date().toISOString().slice(0, 10)
  const [handoverDate, setHandoverDate] = useState(today())
  const [firstMeetingDate, setFirstMeetingDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setHandoverDate(target?.handoverDate ? target.handoverDate.split('T')[0] : today())
      setFirstMeetingDate(target?.firstMeetingDate ? target.firstMeetingDate.split('T')[0] : '')
      setNote('')
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!handoverDate) { toast.error('Übergabedatum erforderlich'); return }
    setSaving(true)
    try {
      const payload = {
        handoverDate,
        firstMeetingDate: firstMeetingDate || null,
      }
      // Status nur vorwärts setzen: Qualifizierung abgeschlossen → Übergabe an EM
      const advanced = [...ACTIVE_STATUSES, ...WON_STATUSES, ...LOST_STATUSES].includes(target?.status)
      if (!advanced) payload.status = 'Übergabe an Engagement Manager'

      const updated = await api.put(`/sprint-targets/${targetId}`, payload)
      const activity = await api.post(`/sprint-targets/${targetId}/activities`, {
        type: 'Meeting',
        date: new Date().toISOString(),
        summary: 'Qualifizierung abgeschlossen – Übergabe an Engagement Manager',
        nextSteps: note.trim() || null,
      })
      toast.success('Qualifiziert und übergeben')
      onSaved(updated, activity)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler bei der Übergabe')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Qualifizieren &amp; übergeben</h2>
              <p className="text-sm text-gray-500">{target?.companyName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Übergabedatum <span className="text-red-500">*</span></label>
                <input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className={CLS_INPUT} required />
              </div>
              <div>
                <label className={CLS_LABEL}>Erstgespräch</label>
                <input type="date" value={firstMeetingDate} onChange={(e) => setFirstMeetingDate(e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Nächster Schritt</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Erstgespräch am 05.11. vereinbaren"
              />
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700">
              Übergabe wird als Aktivität protokolliert; der Status wechselt auf „Übergabe an Engagement Manager“, sofern er nicht weiter ist.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Speichern...' : 'Übergeben'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SprintTargetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showQualify, setShowQualify] = useState(false)

  const fetchTarget = useCallback(async () => {
    setLoading(true)
    try {
      const [t, acts] = await Promise.all([
        api.get(`/sprint-targets/${id}`),
        api.get(`/sprint-targets/${id}/activities`),
      ])
      setTarget(t)
      setForm(t)
      setActivities(Array.isArray(acts) ? acts : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTarget() }, [fetchTarget])

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.numberOfEmployees !== undefined) {
        const digits = String(payload.numberOfEmployees ?? '').replace(/[^\d]/g, '')
        payload.numberOfEmployees = digits ? Number(digits) : null
      }
      if (payload.selfTestScore !== undefined) {
        const digits = String(payload.selfTestScore ?? '').replace(/[^\d]/g, '')
        payload.selfTestScore = digits ? Math.min(100, Number(digits)) : null
      }
      const updated = await api.put(`/sprint-targets/${id}`, payload)
      setTarget(updated)
      setForm(updated)
      setEditing(false)
      toast.success('Gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function resetCallAttempts() {
    try {
      await api.put(`/sprint-targets/${id}`, { callAttempts: 0 })
      setTarget((p) => ({ ...p, callAttempts: 0 }))
      setForm((p) => ({ ...p, callAttempts: 0 }))
      toast.success('Anrufzähler zurückgesetzt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Zurücksetzen')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  if (!target) {
    return <div className="text-gray-500 p-8">Zielkunde nicht gefunden.</div>
  }

  const blocked = target.status === 'kein Interesse'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/sprint-targets')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{target.companyName}</h1>
            <p className="text-sm text-gray-500">{target.segment}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setForm(target) }}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" /> Bearbeiten
            </button>
          )}
        </div>
      </div>

      {blocked && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Kontaktsperre · DSGVO Art. 21</p>
            <p className="text-sm text-red-900">
              Dieser Zielkunde hat der Kontaktaufnahme widersprochen („kein Interesse“) und steht auf der Sperrliste.
              Anrufe, E-Mails, LinkedIn-Nachrichten und Angebote sind gesperrt; die Daten dürfen nur noch zu
              Dokumentationszwecken verarbeitet werden.
            </p>
          </div>
        </div>
      )}

      {/* Hero-Kennzahlen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Status', value: statusLabel(target.status), hint: `Prio ${target.priority}` },
          { label: 'Angebotswert', value: target.offerValue ? formatCurrency(target.offerValue) : '—', hint: target.offerPackage || 'kein Paket' },
          { label: 'Anrufe', value: `${target.callAttempts || 0} / 3`, hint: (target.callAttempts || 0) >= 3 ? 'Limit erreicht' : 'im Rahmen' },
          { label: 'Letzte Aktivität', value: activities[0] ? formatDate(activities[0].date) : '—', hint: `${activities.length} Einträge` },
        ].map(({ label, value, hint }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-base font-bold text-gray-900 capitalize truncate">{value}</p>
            <p className="text-[11px] text-gray-400 truncate">{hint}</p>
          </div>
        ))}
      </div>

      {/* Phasen-Stepper */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {SPRINT_PHASES.map((phase, idx) => {
            const currentPhase = phaseForStatus(target.status)
            const currentIdx = currentPhase ? SPRINT_PHASES.findIndex((p) => p.key === currentPhase.key) : -1
            const done = currentIdx >= 0 && idx < currentIdx
            const active = phase.key === currentPhase?.key
            return (
              <div
                key={phase.key}
                className="flex items-center gap-1"
                title={phase.statuses.map(statusLabel).join(' · ')}
              >
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                  active ? 'bg-violet-600 text-white border-violet-600'
                  : done ? 'bg-violet-50 text-violet-700 border-violet-100'
                  : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}>
                  {phase.label}
                </span>
                {idx < SPRINT_PHASES.length - 1 && <span className="w-4 h-px bg-gray-200" />}
              </div>
            )
          })}
          <p className="ml-auto pl-4 text-xs text-gray-500 whitespace-nowrap">
            Status: <span className="font-medium text-gray-800">{statusLabel(target.status)}</span>
          </p>
        </div>
      </div>

      {/* Nächster Schritt */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <ArrowRight className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Nächster Schritt</p>
          <p className="text-sm text-blue-900">
            {activities.find((a) => a.nextSteps)?.nextSteps
              || target.notes
              || 'Noch kein nächster Schritt hinterlegt – Aktivität protokollieren.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: data cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status + Stammdaten */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Stammdaten</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Status</label>
                {editing ? (
                  <>
                    <StatusPicker value={form.status || ''} onChange={(v) => set('status', v)} />
                    {target.status === 'kein Interesse' && form.status !== 'kein Interesse' && (
                      <p className="mt-1 text-[11px] text-amber-700 leading-snug">
                        Der Statuswechsel hebt den Sperrvermerk auf. Das ist nur zulässig, wenn eine neue
                        Rechtsgrundlage vorliegt (z. B. erneute Einwilligung des Kontakts).
                      </p>
                    )}
                  </>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[target.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {statusLabel(target.status)}
                  </span>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Priorität</label>
                {editing ? (
                  <select value={form.priority || '2'} onChange={(e) => set('priority', e.target.value)} className={CLS_INPUT}>
                    <option value="1">1 – Hoch</option>
                    <option value="2">2 – Mittel</option>
                    <option value="3">3 – Niedrig</option>
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">Prio {target.priority}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Branche</label>
                {editing ? (
                  <select value={form.segment || ''} onChange={(e) => set('segment', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- bitte wählen --</option>
                    {BRANCHEN.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.segment || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Bundesland</label>
                {editing ? (
                  <select value={form.bundesland || ''} onChange={(e) => set('bundesland', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keins --</option>
                    {BUNDESLAENDER.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.bundesland || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Mitarbeiter</label>
                {editing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.numberOfEmployees ?? ''}
                    onChange={(e) => set('numberOfEmployees', e.target.value)}
                    className={CLS_INPUT}
                    placeholder="z.B. 250"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{target.numberOfEmployees || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Quelle</label>
                {editing ? (
                  <select value={form.contactSource || ''} onChange={(e) => set('contactSource', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keine --</option>
                    {CONTACT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.contactSource || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Ponturo-Beziehung</label>
                {editing ? (
                  <input value={form.ponturoRelationship || ''} onChange={(e) => set('ponturoRelationship', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{target.ponturoRelationship || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Paket</label>
                {editing ? (
                  <select value={form.package || ''} onChange={(e) => set('package', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keins --</option>
                    {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900 capitalize">{target.package || '—'}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className={CLS_LABEL}>Adresse</label>
              {editing ? (
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <input
                      value={form.street || ''}
                      onChange={(e) => set('street', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="Straße & Hausnummer"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      value={form.postalCode || ''}
                      onChange={(e) => set('postalCode', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="PLZ"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      value={form.location || ''}
                      onChange={(e) => set('location', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="Ort"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-900">
                  {[target.street, [target.postalCode, target.location].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              )}
            </div>
            {editing && (
              <div className="mt-4">
                <label className={CLS_LABEL}>Notizen</label>
                <textarea
                  value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  className={`${CLS_INPUT} resize-none`}
                />
              </div>
            )}
            {!editing && target.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className={CLS_LABEL}>Notizen</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{target.notes}</p>
              </div>
            )}
          </div>

          {/* Sprint Tracking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Sprint-Tracking</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Ansprechpartner</label>
                {editing ? (
                  <input value={form.contactName || ''} onChange={(e) => set('contactName', e.target.value)} className={CLS_INPUT} placeholder="Name" />
                ) : (
                  <p className="text-sm text-gray-900">{target.contactName || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Titel / Position</label>
                {editing ? (
                  <input value={form.contactTitle || ''} onChange={(e) => set('contactTitle', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{target.contactTitle || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>LinkedIn</label>
                {editing ? (
                  <input value={form.contactLinkedIn || ''} onChange={(e) => set('contactLinkedIn', e.target.value)} className={CLS_INPUT} placeholder="linkedin.com/in/..." />
                ) : target.contactLinkedIn ? (
                  <a href={target.contactLinkedIn} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                    {target.contactLinkedIn}
                  </a>
                ) : (
                  <p className="text-sm text-gray-900">—</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Anrufversuche</label>
                <div className="flex items-center gap-2 mt-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      onClick={() => editing && set('callAttempts', i + 1 === target.callAttempts ? i : i + 1)}
                      className={`w-4 h-4 rounded-full cursor-pointer border-2 transition-colors ${
                        i < (editing ? form.callAttempts : target.callAttempts)
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-gray-500">{editing ? form.callAttempts : target.callAttempts} / 3</span>
                </div>
              </div>
              <div>
                <label className={CLS_LABEL}>Anruf-Trigger (UWG)</label>
                {editing ? (
                  <input value={form.callTrigger || ''} onChange={(e) => set('callTrigger', e.target.value)} className={CLS_INPUT} placeholder="z.B. Neueinstellung, Expansion..." />
                ) : (
                  <p className="text-sm text-gray-900">{target.callTrigger || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>E-Mail erlaubt</label>
                {editing ? (
                  <select value={form.emailAllowed === null || form.emailAllowed === undefined ? '' : String(form.emailAllowed)} onChange={(e) => set('emailAllowed', e.target.value === '' ? null : e.target.value === 'true')} className={CLS_INPUT}>
                    <option value="">nicht gefragt</option>
                    <option value="true">Ja</option>
                    <option value="false">Nein</option>
                  </select>
                ) : (
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    target.emailAllowed === true ? 'bg-green-100 text-green-700'
                    : target.emailAllowed === false ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {target.emailAllowed === true ? 'Ja' : target.emailAllowed === false ? 'Nein' : 'nicht gefragt'}
                  </span>
                )}
              </div>
              {!editing && target.callAttempts >= 3 && (
                <div className="col-span-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-2 text-xs text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Drei Anrufversuche erreicht – weitere Anrufe nur mit neuem Anlass.
                  </div>
                  <button
                    onClick={resetCallAttempts}
                    className="flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Datenschutz & Einwilligungen */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Datenschutz &amp; Einwilligungen</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Datenschutzhinweise übermittelt am</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.privacyNoticeAt ? String(form.privacyNoticeAt).split('T')[0] : ''}
                    onChange={(e) => set('privacyNoticeAt', e.target.value)}
                    className={CLS_INPUT}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.privacyNoticeAt) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                {editing ? (
                  <select value={form.privacyNoticeSource || ''} onChange={(e) => set('privacyNoticeSource', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keiner --</option>
                    {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.privacyNoticeSource || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Einwilligung E-Mail: erteilt am</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.emailConsentAt ? String(form.emailConsentAt).split('T')[0] : ''}
                    onChange={(e) => set('emailConsentAt', e.target.value)}
                    className={CLS_INPUT}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.emailConsentAt) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                {editing ? (
                  <select value={form.emailConsentSource || ''} onChange={(e) => set('emailConsentSource', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keiner --</option>
                    {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.emailConsentSource || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>E-Mail-Einwilligung widerrufen am</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.emailConsentRevokedAt ? String(form.emailConsentRevokedAt).split('T')[0] : ''}
                    onChange={(e) => set('emailConsentRevokedAt', e.target.value)}
                    className={CLS_INPUT}
                  />
                ) : (
                  <p className={`text-sm ${target.emailConsentRevokedAt ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                    {formatDate(target.emailConsentRevokedAt) || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Einwilligung Telefon: erteilt am</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.callConsentAt ? String(form.callConsentAt).split('T')[0] : ''}
                    onChange={(e) => set('callConsentAt', e.target.value)}
                    className={CLS_INPUT}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.callConsentAt) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                {editing ? (
                  <select value={form.callConsentSource || ''} onChange={(e) => set('callConsentSource', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keiner --</option>
                    {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.callConsentSource || '—'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Selbsttest */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Selbsttest</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Score (0–100)</label>
                {editing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.selfTestScore ?? ''}
                    onChange={(e) => set('selfTestScore', e.target.value)}
                    className={CLS_INPUT}
                    placeholder="z.B. 68"
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {target.selfTestScore !== null && target.selfTestScore !== undefined ? `${target.selfTestScore} / 100` : '—'}
                  </p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Datum</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.selfTestDate ? String(form.selfTestDate).split('T')[0] : ''}
                    onChange={(e) => set('selfTestDate', e.target.value)}
                    className={CLS_INPUT}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.selfTestDate) || '—'}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className={CLS_LABEL}>Link zum Ergebnis</label>
                {editing ? (
                  <input
                    value={form.selfTestLink || ''}
                    onChange={(e) => set('selfTestLink', e.target.value)}
                    className={CLS_INPUT}
                    placeholder="https://..."
                  />
                ) : target.selfTestLink ? (
                  <a href={target.selfTestLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                    {target.selfTestLink}
                  </a>
                ) : (
                  <p className="text-sm text-gray-900">—</p>
                )}
              </div>
            </div>
            {!editing && target.selfTestScore == null && !target.selfTestDate && !target.selfTestLink && (
              <p className="mt-3 text-xs text-gray-400">Noch keine Selbsttest-Ergebnisse erfasst.</p>
            )}
          </div>

          {/* Prozessfortschritt */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Prozessfortschritt</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Übergabe EM</label>
                {editing ? (
                  <input type="date" value={form.handoverDate ? form.handoverDate.split('T')[0] : ''} onChange={(e) => set('handoverDate', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.handoverDate) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Erstgespräch</label>
                {editing ? (
                  <input type="date" value={form.firstMeetingDate ? form.firstMeetingDate.split('T')[0] : ''} onChange={(e) => set('firstMeetingDate', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.firstMeetingDate) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Angebot-Paket</label>
                {editing ? (
                  <select value={form.offerPackage || ''} onChange={(e) => set('offerPackage', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keins --</option>
                    {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900 capitalize">{target.offerPackage || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Angebotswert (€)</label>
                {editing ? (
                  <input type="number" value={form.offerValue || ''} onChange={(e) => set('offerValue', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{target.offerValue ? formatCurrency(target.offerValue) : '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Angebotsdatum</label>
                {editing ? (
                  <input type="date" value={form.offerDate ? form.offerDate.split('T')[0] : ''} onChange={(e) => set('offerDate', e.target.value)} className={CLS_INPUT} />
                ) : (
                  <p className="text-sm text-gray-900">{formatDate(target.offerDate) || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>BAFA-Status</label>
                {editing ? (
                  <select value={form.bafaStatus || ''} onChange={(e) => set('bafaStatus', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keiner --</option>
                    {['nicht beantragt', 'beantragt', 'bewilligt', 'abgelehnt', 'ausgezahlt'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.bafaStatus || '—'}</p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Ergebnis</label>
                {editing ? (
                  <select value={form.result || ''} onChange={(e) => set('result', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- offen --</option>
                    <option value="gewonnen">Gewonnen</option>
                    <option value="verloren">Verloren</option>
                  </select>
                ) : (
                  <p className={`text-sm capitalize ${target.result === 'gewonnen' ? 'text-green-700 font-medium' : target.result === 'verloren' ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                    {target.result || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className={CLS_LABEL}>Verlustgrund</label>
                {editing ? (
                  <select value={form.lossReason || ''} onChange={(e) => set('lossReason', e.target.value)} className={CLS_INPUT}>
                    <option value="">-- keiner --</option>
                    {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{target.lossReason || '—'}</p>
                )}
              </div>
            </div>
            {editing && LOST_STATUSES.includes(form.status) && !form.lossReason && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Bei Status „{form.status}“ ist ein Verlustgrund erforderlich.
              </div>
            )}
          </div>
        </div>

        {/* Right: actions + activities */}
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Aktionen</h2>
            <div className="space-y-2">
              <button
                onClick={() => setShowQualify(true)}
                disabled={blocked}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21)' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <UserCheck className="w-4 h-4 text-violet-500" /> Qualifizieren &amp; übergeben
              </button>
              <button
                onClick={() => setShowLogModal(true)}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21) – nur interne Notizen erlaubt' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-4 h-4 text-blue-500" /> Aktivität protokollieren
                {blocked && <span className="ml-auto text-[10px] font-medium text-red-600">nur Notiz</span>}
              </button>
              <button
                onClick={() => router.push(`/sprint-targets/${id}/assessment`)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Brain className="w-4 h-4 text-violet-500" /> KI-Assessment
              </button>
              <button
                onClick={() => router.push(`/sprint-targets/${id}/proposals`)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-green-500" /> Projektvorschläge
              </button>
              <button
                onClick={() => router.push(`/sprint-targets/offers/new?target=${id}`)}
                disabled={blocked}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21)' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <FileText className="w-4 h-4 text-violet-500" /> Angebot anlegen
              </button>
              <button
                onClick={() => router.push(`/sprint-targets/${id}/handover`)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ClipboardCheck className="w-4 h-4 text-blue-500" /> Übergabe-Checkliste
              </button>
            </div>
          </div>

          {/* Assessments summary */}
          {target.assessments && target.assessments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">KI-Assessments</h2>
              {target.assessments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => router.push(`/sprint-targets/${id}/assessment`)}
                  className="w-full text-left flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">Version {a.version}</p>
                    <p className="text-xs text-gray-500">{formatDate(a.createdAt)}</p>
                  </div>
                  {a.totalScore != null && (
                    <span className={`text-sm font-bold ${
                      a.totalScore >= 4 ? 'text-green-600' : a.totalScore >= 2.5 ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                      {a.totalScore.toFixed(1)} / 5
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Activity timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Aktivitäten</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/sprint-targets/activities')}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Alle
                </button>
                <button
                  onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Neu
                </button>
              </div>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Noch keine Aktivitäten</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      <ActivityTypeIcon type={a.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">{a.type}</span>
                        <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
                      </div>
                      {a.summary && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{a.summary}</p>}
                      {a.nextSteps && (
                        <p className="text-xs text-blue-600 mt-0.5">→ {a.nextSteps}</p>
                      )}
                      {a.createdBy?.name && (
                        <p className="text-xs text-gray-400 mt-0.5">{a.createdBy.name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QualifyModal
        isOpen={showQualify}
        target={target}
        targetId={id}
        onClose={() => setShowQualify(false)}
        onSaved={(updated, activity) => {
          setTarget((p) => ({ ...p, ...updated }))
          setForm((p) => ({ ...p, ...updated }))
          setActivities((prev) => [activity, ...prev])
        }}
      />

      <ActivityLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onLogged={(a) => {
          setActivities((prev) => [a, ...prev])
          if (typeof a.callAttempts === 'number') {
            setTarget((p) => (p ? { ...p, callAttempts: a.callAttempts } : p))
            setForm((p) => ({ ...p, callAttempts: a.callAttempts }))
          }
        }}
        targetId={id}
        target={target}
        callAttempts={target.callAttempts || 0}
        contactBlocked={blocked}
      />
    </div>
  )
}

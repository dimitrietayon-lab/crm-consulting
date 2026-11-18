'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import {
  BRANCHEN, BUNDESLAENDER, CONTACT_SOURCES, CONSENT_SOURCES, CALL_TRIGGERS,
} from '@/lib/acquisitionOptions'
import { usePipelineFor } from '@/lib/usePipeline'
import { statusLabel, statusBadge } from '@/lib/pipelineLogic'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']
const BAFA_STATUSES = ['nicht beantragt', 'beantragt', 'bewilligt', 'abgelehnt', 'ausgezahlt']

const dateValue = (v) => (v ? String(v).split('T')[0] : '')

export default function SprintTargetEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const pipeline = usePipelineFor(target)
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({})
  const [campaigns, setCampaigns] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/acquisition-campaigns').catch(() => []),
      api.get('/acquisition-pipeline/list').catch(() => []),
    ]).then(([c, w]) => {
      setCampaigns(Array.isArray(c) ? c : [])
      setWorkflows(Array.isArray(w) ? w : [])
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, contactList] = await Promise.all([
        api.get(`/acquisition/${id}`),
        api.get(`/acquisition-contacts?acquisitionTargetId=${id}`).catch(() => []),
      ])
      setTarget(t)
      setContacts(Array.isArray(contactList) ? contactList : [])
      setForm({
        ...t,
        privacyNoticeAt: dateValue(t.privacyNoticeAt),
        emailConsentAt: dateValue(t.emailConsentAt),
        emailConsentRevokedAt: dateValue(t.emailConsentRevokedAt),
        callConsentAt: dateValue(t.callConsentAt),
        selfTestDate: dateValue(t.selfTestDate),
        handoverDate: dateValue(t.handoverDate),
        firstMeetingDate: dateValue(t.firstMeetingDate),
        offerDate: dateValue(t.offerDate),
        numberOfEmployees: t.numberOfEmployees ?? '',
        selfTestScore: t.selfTestScore ?? '',
        offerValue: t.offerValue ?? '',
      })
    } catch (err) {
      toast.error(err.message || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function selectContact(name) {
    const contact = contacts.find((c) => c.name === name)
    setForm((prev) => ({
      ...prev,
      contactName: name,
      contactTitle: contact?.role ?? prev.contactTitle,
      contactEmail: contact?.email ?? prev.contactEmail,
      contactLinkedIn: contact?.linkedin ?? prev.contactLinkedIn,
    }))
  }

  async function handleSave() {
    if (!String(form.companyName || '').trim()) { toast.error('Unternehmensname erforderlich'); return }
    if (!form.segment) { toast.error('Branche erforderlich'); return }
    setSaving(true)
    try {
      const payload = { ...form }
      // Status wird ausschließlich über den Akquise-Prozess auf der Detailseite geändert
      delete payload.status
      payload.campaignId = form.campaignId || null
      payload.pipelineId = form.pipelineId || null

      payload.numberOfEmployees = form.numberOfEmployees === '' || form.numberOfEmployees === null
        ? null
        : Number(String(form.numberOfEmployees).replace(/[^\d]/g, '') || 0) || null
      payload.selfTestScore = form.selfTestScore === '' || form.selfTestScore === null
        ? null
        : Math.min(100, Math.max(0, Number(String(form.selfTestScore).replace(/[^\d]/g, '')) || 0))
      payload.offerValue = form.offerValue === '' || form.offerValue === null ? null : Number(form.offerValue)

      await api.put(`/acquisition/${id}`, payload)
      toast.success('Zielkunde gespeichert')
      router.push(`/akquise/${id}`)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!target) {
    return <div className="text-gray-500 p-8">Zielkunde nicht gefunden.</div>
  }

  const contactOptions = contacts.map((c) => ({
    value: c.name,
    label: c.role ? `${c.name} · ${c.role}` : c.name,
  }))
  if (form.contactName && !contacts.some((c) => c.name === form.contactName)) {
    contactOptions.unshift({ value: form.contactName, label: `${form.contactName} (aktuell)` })
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => router.push(`/akquise/${id}`)}
            className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            aria-label="Zurück"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">Zielkunde bearbeiten</h1>
            <p className="text-sm text-gray-500 truncate">{target.companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/akquise/${id}`)}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Status (nur Anzeige) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className={CLS_LABEL}>Status</label>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(target.status, pipeline)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {statusLabel(target.status, pipeline)}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 max-w-sm leading-snug">
            Der Status wird ausschließlich im Akquise-Prozess auf der Detailseite geändert – nicht hier.
          </p>
        </div>
      </div>

      {/* Kampagne & Workflow */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Kampagne &amp; Workflow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Kampagne</label>
            <select value={form.campaignId || ''} onChange={(e) => set('campaignId', e.target.value)} className={CLS_INPUT}>
              <option value="">-- Standard --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">Bestimmt Workflow, Dienstleistung und Paket.</p>
          </div>
          <div>
            <label className={CLS_LABEL}>Workflow (Override)</label>
            <select value={form.pipelineId || ''} onChange={(e) => set('pipelineId', e.target.value)} className={CLS_INPUT}>
              <option value="">-- Workflow der Kampagne --</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Standard)' : ''}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">Optional: eigenen Workflow für diesen Zielkunden erzwingen.</p>
          </div>
        </div>
      </div>

      {/* Unternehmen & Adresse */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Unternehmen &amp; Adresse</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={CLS_LABEL}>Unternehmen <span className="text-red-500">*</span></label>
            <input type="text" value={form.companyName || ''} onChange={(e) => set('companyName', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
            <select value={form.segment || ''} onChange={(e) => set('segment', e.target.value)} className={CLS_INPUT}>
              <option value="">-- bitte wählen --</option>
              {BRANCHEN.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Bundesland</label>
            <select value={form.bundesland || ''} onChange={(e) => set('bundesland', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keins --</option>
              {BUNDESLAENDER.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Straße &amp; Hausnummer</label>
            <input value={form.street || ''} onChange={(e) => set('street', e.target.value)} className={CLS_INPUT} placeholder="Straße & Hausnummer" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={CLS_LABEL}>PLZ</label>
              <input
                value={form.postalCode || ''}
                onChange={(e) => set('postalCode', e.target.value)}
                className={CLS_INPUT}
                placeholder="PLZ"
                inputMode="numeric"
              />
            </div>
            <div className="col-span-2">
              <label className={CLS_LABEL}>Ort</label>
              <input value={form.location || ''} onChange={(e) => set('location', e.target.value)} className={CLS_INPUT} placeholder="Ort" />
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Mitarbeiter</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.numberOfEmployees ?? ''}
              onChange={(e) => set('numberOfEmployees', e.target.value)}
              className={CLS_INPUT}
              placeholder="z.B. 250"
            />
          </div>
          <div>
            <label className={CLS_LABEL}>Priorität</label>
            <select value={form.priority || '2'} onChange={(e) => set('priority', e.target.value)} className={CLS_INPUT}>
              <option value="1">1 – Hoch</option>
              <option value="2">2 – Mittel</option>
              <option value="3">3 – Niedrig</option>
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Quelle</label>
            <select value={form.contactSource || ''} onChange={(e) => set('contactSource', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keine --</option>
              {CONTACT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Ponturo-Beziehung</label>
            <input value={form.ponturoRelationship || ''} onChange={(e) => set('ponturoRelationship', e.target.value)} className={CLS_INPUT} />
          </div>
        </div>
        <div className="mt-4">
          <label className={CLS_LABEL}>Notizen</label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className={`${CLS_INPUT} resize-none`}
            placeholder="Interne Notizen zum Zielkunden"
          />
        </div>
      </div>

      {/* Akquise-Tracking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Akquise-Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Ansprechpartner</label>
            {contactOptions.length > 0 ? (
              <select value={form.contactName || ''} onChange={(e) => selectContact(e.target.value)} className={CLS_INPUT}>
                <option value="">-- Ansprechpartner wählen --</option>
                {contactOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input value={form.contactName || ''} onChange={(e) => set('contactName', e.target.value)} className={CLS_INPUT} placeholder="Name" />
            )}
          </div>
          <div>
            <label className={CLS_LABEL}>Titel / Position</label>
            <input value={form.contactTitle || ''} onChange={(e) => set('contactTitle', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>E-Mail</label>
            <input type="email" value={form.contactEmail || ''} onChange={(e) => set('contactEmail', e.target.value)} className={CLS_INPUT} placeholder="name@unternehmen.de" />
          </div>
          <div>
            <label className={CLS_LABEL}>LinkedIn</label>
            <input value={form.contactLinkedIn || ''} onChange={(e) => set('contactLinkedIn', e.target.value)} className={CLS_INPUT} placeholder="linkedin.com/in/..." />
          </div>
          <div>
            <label className={CLS_LABEL}>Anrufversuche</label>
            <div className="flex items-center gap-2 mt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  onClick={() => set('callAttempts', i + 1 === Number(form.callAttempts) ? i : i + 1)}
                  className={`w-4 h-4 rounded-full cursor-pointer border-2 transition-colors ${
                    i < Number(form.callAttempts || 0) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                  }`}
                />
              ))}
              <span className="text-sm text-gray-500">{Number(form.callAttempts || 0)} / 3</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">UWG § 7: maximal drei Anrufversuche pro Zielkunde.</p>
          </div>
          <div>
            <label className={CLS_LABEL}>Anruf-Trigger (UWG)</label>
            <select value={form.callTrigger || ''} onChange={(e) => set('callTrigger', e.target.value)} className={CLS_INPUT}>
              <option value="">-- Anlass wählen --</option>
              {form.callTrigger && !CALL_TRIGGERS.includes(form.callTrigger) && (
                <option value={form.callTrigger}>{form.callTrigger} (aktuell)</option>
              )}
              {CALL_TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>E-Mail erlaubt</label>
            <select
              value={form.emailAllowed === null || form.emailAllowed === undefined ? '' : String(form.emailAllowed)}
              onChange={(e) => set('emailAllowed', e.target.value === '' ? null : e.target.value === 'true')}
              className={CLS_INPUT}
            >
              <option value="">nicht gefragt</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datenschutz & Einwilligungen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Datenschutz &amp; Einwilligungen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Datenschutzhinweise übermittelt am</label>
            <input type="date" value={form.privacyNoticeAt || ''} onChange={(e) => set('privacyNoticeAt', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Weg</label>
            <select value={form.privacyNoticeSource || ''} onChange={(e) => set('privacyNoticeSource', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keiner --</option>
              {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Einwilligung E-Mail: erteilt am</label>
            <input type="date" value={form.emailConsentAt || ''} onChange={(e) => set('emailConsentAt', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Weg</label>
            <select value={form.emailConsentSource || ''} onChange={(e) => set('emailConsentSource', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keiner --</option>
              {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>E-Mail-Einwilligung widerrufen am</label>
            <input type="date" value={form.emailConsentRevokedAt || ''} onChange={(e) => set('emailConsentRevokedAt', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Einwilligung Telefon: erteilt am</label>
            <input type="date" value={form.callConsentAt || ''} onChange={(e) => set('callConsentAt', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Weg</label>
            <select value={form.callConsentSource || ''} onChange={(e) => set('callConsentSource', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keiner --</option>
              {CONSENT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Selbsttest */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Selbsttest</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Score (0–100)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.selfTestScore ?? ''}
              onChange={(e) => set('selfTestScore', e.target.value)}
              className={CLS_INPUT}
              placeholder="z.B. 68"
            />
          </div>
          <div>
            <label className={CLS_LABEL}>Datum</label>
            <input type="date" value={form.selfTestDate || ''} onChange={(e) => set('selfTestDate', e.target.value)} className={CLS_INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={CLS_LABEL}>Link zum Ergebnis</label>
            <input value={form.selfTestLink || ''} onChange={(e) => set('selfTestLink', e.target.value)} className={CLS_INPUT} placeholder="https://..." />
          </div>
        </div>
      </div>

      {/* Prozess & Angebot */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Prozess &amp; Angebot</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Übergabe EM</label>
            <input type="date" value={form.handoverDate || ''} onChange={(e) => set('handoverDate', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Erstgespräch</label>
            <input type="date" value={form.firstMeetingDate || ''} onChange={(e) => set('firstMeetingDate', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Angebotswert (€)</label>
            <input type="number" value={form.offerValue ?? ''} onChange={(e) => set('offerValue', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Angebotsdatum</label>
            <input type="date" value={form.offerDate || ''} onChange={(e) => set('offerDate', e.target.value)} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Förderstatus</label>
            <select value={form.bafaStatus || ''} onChange={(e) => set('bafaStatus', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keiner --</option>
              {BAFA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Ergebnis</label>
            <select value={form.result || ''} onChange={(e) => set('result', e.target.value)} className={CLS_INPUT}>
              <option value="">-- offen --</option>
              <option value="gewonnen">Gewonnen</option>
              <option value="verloren">Verloren</option>
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>Verlustgrund</label>
            <select value={form.lossReason || ''} onChange={(e) => set('lossReason', e.target.value)} className={CLS_INPUT}>
              <option value="">-- keiner --</option>
              {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Fuß */}
      <div className="flex justify-end gap-2 pb-6">
        <button
          onClick={() => router.push(`/akquise/${id}`)}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

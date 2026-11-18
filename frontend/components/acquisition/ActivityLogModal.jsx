'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Linkedin, Mail, Phone, StickyNote, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-600 mb-1'

const TYPES = [
  { key: 'Call', label: 'Anruf', Icon: Phone },
  { key: 'Meeting', label: 'Meeting', Icon: Users },
  { key: 'Email', label: 'E-Mail', Icon: Mail },
  { key: 'LinkedIn', label: 'LinkedIn', Icon: Linkedin },
  { key: 'Note', label: 'Notiz', Icon: StickyNote },
]

// Felder je Aktivitätstyp – steuert Sichtbarkeit, Labels und Platzhalter
const TYPE_CONFIG = {
  Call: {
    duration: true,
    dateLabel: 'Zeitpunkt des Anrufs',
    summaryLabel: 'Gesprächsnotiz',
    summaryPlaceholder: 'Ergebnis des Anrufs, Erreichbarkeit, Vereinbarungen …',
    summaryRows: 4,
    hint: 'Anruf: Zeitpunkt, Dauer und Gesprächsergebnis erfassen.',
  },
  Meeting: {
    duration: true,
    dateLabel: 'Zeitpunkt des Meetings',
    summaryLabel: 'Besprechungsnotiz',
    summaryPlaceholder: 'Teilnehmer, Inhalte, Ergebnisse, offene Punkte …',
    summaryRows: 4,
    hint: 'Meeting: Zeitpunkt, Dauer, Teilnehmer und Ergebnisse dokumentieren.',
  },
  Email: {
    duration: false,
    dateLabel: 'Versandzeitpunkt',
    summaryLabel: 'Inhalt der E-Mail',
    summaryPlaceholder: 'Betreff und Inhalt der versendeten E-Mail …',
    summaryRows: 5,
    hint: 'E-Mail: Inhalt der versendeten E-Mail festhalten und Rückmeldung nachhalten.',
  },
  LinkedIn: {
    duration: false,
    dateLabel: 'Versandzeitpunkt',
    summaryLabel: 'Nachricht',
    summaryPlaceholder: 'Inhalt der LinkedIn-Nachricht …',
    summaryRows: 4,
    hint: 'LinkedIn: Inhalt der gesendeten Nachricht dokumentieren.',
  },
  Note: {
    duration: false,
    dateLabel: 'Datum',
    summaryLabel: 'Notiz',
    summaryPlaceholder: 'Interne Notiz zum Zielkunden …',
    summaryRows: 4,
    hint: 'Interne Notiz – nur für das Team sichtbar.',
  },
}

// Aktivitätstyp → Kanal (wird bei der Aktivität mitgespeichert)
const CHANNEL_FOR_TYPE = { Call: 'Telefon', Email: 'E-Mail', LinkedIn: 'LinkedIn' }

const nowLocal = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Normalisiert einen Terminwert (ISO, Date oder „YYYY-MM-DD[THH:mm]“) auf das
// lokale Format von <input type="datetime-local">.
const toLocalInput = (value) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DEFAULT_FORM = { type: 'Call', date: '', summary: '', duration: '', nextSteps: '' }

/**
 * Gemeinsames Modal zum Protokollieren einer Sprint-Aktivität.
 * targetId gesetzt → Detailseite; sonst über `targets` einen Zielkunden auswählen.
 * `defaultType` belegt den Aktivitätstyp vor (z. B. aus dem Akquise-Prozess).
 */
export default function ActivityLogModal({
  isOpen,
  onClose,
  onLogged,
  targetId = null,
  target = null,
  callAttempts = 0,
  targets = [],
  contactBlocked = false,
  defaultType = null,
  defaultSummary = '',
  stepLabel = null,
  infoNote = null,
  fieldOverrides = null,
  appointmentDate = null,
}) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [selectedTargetId, setSelectedTargetId] = useState(targetId || '')
  const [saving, setSaving] = useState(false)
  const [documentFile, setDocumentFile] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const initialType = contactBlocked ? 'Note' : defaultType || DEFAULT_FORM.type
    const appt = toLocalInput(appointmentDate)
    setForm({
      ...DEFAULT_FORM,
      type: initialType,
      // Bei einem Meeting den erfassten Termin übernehmen, sonst „jetzt“.
      date: initialType === 'Meeting' && appt ? appt : nowLocal(),
      summary: defaultSummary || '',
      nextSteps: '',
    })
    setSelectedTargetId(targetId || '')
    setDocumentFile(null)
  }, [isOpen, targetId, contactBlocked, defaultType, defaultSummary, appointmentDate])

  // Esc schließt das Modal
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const activeTargetId = targetId || selectedTargetId
  const selectedTarget = targets.find((t) => t.id === activeTargetId) || (target?.id === activeTargetId ? target : null)
  const channel = CHANNEL_FOR_TYPE[form.type] || null
  const effectiveCallAttempts = targetId ? callAttempts : selectedTarget?.callAttempts ?? 0
  const callLimitReached = form.type === 'Call' && effectiveCallAttempts >= 3
  // Felder je Aktivitätstyp – optional durch schrittspezifische Overrides ergänzt
  const typeConfig = { ...(TYPE_CONFIG[form.type] || TYPE_CONFIG.Note), ...(fieldOverrides || {}) }
  // Typ, den der Schritt eigentlich vorsieht – für die Erklärung bei DSGVO-Sperre
  const intendedTypeLabel = defaultType && defaultType !== 'Note'
    ? (TYPES.find((t) => t.key === defaultType)?.label || defaultType)
    : null

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Typ wechseln und nicht passende Felder zurücksetzen
  function setType(key) {
    const next = TYPE_CONFIG[key] || TYPE_CONFIG.Note
    const appt = toLocalInput(appointmentDate)
    setForm((prev) => ({
      ...prev,
      type: key,
      // Meeting-Zeitpunkt mit dem erfassten Termin synchronisieren
      ...(key === 'Meeting' && appt ? { date: appt } : {}),
      ...(next.duration ? {} : { duration: '' }),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!activeTargetId) {
      toast.error('Bitte einen Zielkunden wählen')
      return
    }
    if (contactBlocked && form.type !== 'Note') {
      toast.error('Kontaktsperre (DSGVO Art. 21): nur interne Notizen erlaubt')
      return
    }
    if (callLimitReached) {
      toast.error('Maximal drei Anrufversuche pro Zielkunde erreicht')
      return
    }
    setSaving(true)
    try {
      const activity = await api.post(`/acquisition/${activeTargetId}/activities`, {
        type: form.type,
        summary: form.summary || null,
        nextSteps: form.nextSteps || null,
        duration: form.duration ? Number(form.duration) : null,
        channel: channel || null,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      })
      // Optionales Dokument zur protokollierten Aktivität hochladen
      let document = null
      if (documentFile) {
        try {
          const fd = new FormData()
          fd.append('file', documentFile)
          fd.append('name', documentFile.name)
          fd.append('category', 'General')
          fd.append('acquisitionTargetId', activeTargetId)
          document = await api.upload('/documents/upload', fd)
        } catch {
          toast.error('Aktivität gespeichert – Dokument-Upload fehlgeschlagen')
        }
      }
      // Beim Schritt-Abschluss bestätigt die StepPage den Statuswechsel selbst.
      if (!stepLabel) toast.success('Aktivität gespeichert')
      onLogged?.(activity, activeTargetId, document)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 overflow-hidden">
          {/* Kopf */}
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">Aktivität protokollieren</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {selectedTarget?.companyName || 'Zielkunde'}{selectedTarget?.contactName ? ` · ${selectedTarget.contactName}` : ''}
                </p>
                {stepLabel && (
                  <p className="text-[11px] font-medium text-blue-700 mt-1">
                    Nächster Schritt: {stepLabel} · wird nach dem Speichern gesetzt
                  </p>
                )}
                {infoNote && (
                  <p className="text-[11px] text-gray-500 mt-0.5">{infoNote}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label="Schließen">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {!targetId && (
                <div>
                  <label className={CLS_LABEL}>Zielkunde <span className="text-red-500">*</span></label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className={CLS_INPUT}
                    required
                  >
                    <option value="">-- Bitte wählen --</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>{t.companyName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Typ */}
              <div>
                <label className={CLS_LABEL}>Typ</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {TYPES.map(({ key, label, Icon }) => {
                    const active = form.type === key
                    const disabled = contactBlocked && key !== 'Note'
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setType(key)}
                        className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : disabled
                              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    )
                  })}
                </div>
                {contactBlocked ? (
                  <p className="mt-1.5 text-[11px] text-red-600">
                    {intendedTypeLabel
                      ? `Für diesen Schritt ist „${intendedTypeLabel}“ vorgesehen – der Zielkunde ist aber gesperrt (DSGVO Art. 21). Es kann nur eine interne Notiz erfasst werden.`
                      : 'Kontaktsperre (DSGVO Art. 21) – nur interne Notizen erlaubt.'}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-gray-500">{typeConfig.hint}</p>
                )}
              </div>

              {/* Zeit + Dauer (Dauer nur bei Anruf/Meeting) */}
              <div className={`grid grid-cols-1 ${typeConfig.duration ? 'sm:grid-cols-2' : ''} gap-4`}>
                <div>
                  <label className={CLS_LABEL}>{typeConfig.dateLabel}</label>
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    className={CLS_INPUT}
                  />
                </div>
                {typeConfig.duration && (
                  <div>
                    <label className={CLS_LABEL}>Dauer (min)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.duration}
                      onChange={(e) => set('duration', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="optional"
                    />
                  </div>
                )}
              </div>

              {callLimitReached && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Drei Anrufversuche erreicht. Weitere Anrufe sind nach UWG § 7 nicht zulässig –
                    bitte den Zähler am Zielkunden zurücksetzen, falls ein neuer Anlass vorliegt.
                  </span>
                </div>
              )}

              <div>
                <label className={CLS_LABEL}>{typeConfig.summaryLabel}</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => set('summary', e.target.value)}
                  rows={typeConfig.summaryRows}
                  className={`${CLS_INPUT} resize-none`}
                  placeholder={typeConfig.summaryPlaceholder}
                />
              </div>

              <div>
                <label className={CLS_LABEL}>Nächste Schritte (optional)</label>
                <textarea
                  value={form.nextSteps}
                  onChange={(e) => set('nextSteps', e.target.value)}
                  rows={2}
                  className={`${CLS_INPUT} resize-none`}
                  placeholder="Vereinbarte Folgeaktion, Wiedervorlage, offene Punkte …"
                />
              </div>

              <div>
                <label className={CLS_LABEL}>Dokument (optional)</label>
                <input
                  type="file"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {documentFile
                    ? `Wird gespeichert und dem Zielkunden zugeordnet: ${documentFile.name}`
                    : 'Optional: Datei zur Aktivität ablegen (z. B. Gesprächsnotiz, Angebot, Protokoll).'}
                </p>
              </div>
            </div>

            {/* Fuß */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
              <p className="text-[11px] text-gray-400">Esc zum Schließen</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || callLimitReached}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern…' : stepLabel ? 'Speichern & weiter' : 'Aktivität speichern'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const DEFAULT_FORM = { type: 'Call', summary: '', nextSteps: '', duration: '' }

// Aktivitätstyp → Kanal der Outreach-Vorlagen
const CHANNEL_FOR_TYPE = { Call: 'Telefon', Email: 'E-Mail', LinkedIn: 'LinkedIn' }

// Platzhalter in Vorlagen: {unternehmen}, {ansprechpartner}, {segment}, {ort}, {datum}
function fillTemplate(text, context) {
  return String(text || '').replace(/\{(unternehmen|ansprechpartner|segment|ort|datum)\}/gi, (match, key) => {
    switch (key.toLowerCase()) {
      case 'unternehmen': return context.companyName || ''
      case 'ansprechpartner': return context.contactName || ''
      case 'segment': return context.segment || ''
      case 'ort': return context.location || context.bundesland || ''
      case 'datum': return context.date || ''
      default: return match
    }
  })
}

/**
 * Gemeinsames Modal zum Protokollieren einer Sprint-Aktivität.
 * targetId gesetzt → Detailseite; sonst über `targets` einen Zielkunden auswählen.
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
}) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [selectedTargetId, setSelectedTargetId] = useState(targetId || '')
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({ ...DEFAULT_FORM, type: contactBlocked ? 'Note' : DEFAULT_FORM.type })
    setSelectedTargetId(targetId || '')
    setTemplateId('')
    api.get('/sprint-outreach/templates?active=true')
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
  }, [isOpen, targetId, contactBlocked])

  const activeTargetId = targetId || selectedTargetId
  const selectedTarget = targets.find((t) => t.id === activeTargetId) || (target?.id === activeTargetId ? target : null)
  const channel = CHANNEL_FOR_TYPE[form.type] || null
  const availableTemplates = templates.filter((t) => !channel || t.channel === channel)
  const effectiveCallAttempts =
    targetId ? callAttempts : selectedTarget?.callAttempts ?? 0
  const callLimitReached = form.type === 'Call' && effectiveCallAttempts >= 3

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function applyTemplate(id) {
    setTemplateId(id)
    if (!id) return
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    const context = {
      companyName: selectedTarget?.companyName || '',
      contactName: selectedTarget?.contactName || '',
      segment: selectedTarget?.segment || '',
      location: selectedTarget?.location || '',
      bundesland: selectedTarget?.bundesland || '',
      date: new Date().toLocaleDateString('de-DE'),
    }
    const body = fillTemplate(tpl.body, context)
    const subject = tpl.subject ? fillTemplate(tpl.subject, context) : ''
    setForm((prev) => ({
      ...prev,
      summary: subject ? `Betreff: ${subject}\n\n${body}` : body,
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
      const activity = await api.post(`/sprint-targets/${activeTargetId}/activities`, {
        type: form.type,
        summary: form.summary || null,
        nextSteps: form.nextSteps || null,
        duration: form.duration ? Number(form.duration) : null,
        channel: channel || null,
        outreachTemplateId: templateId || null,
        date: new Date().toISOString(),
      })
      if (templateId) {
        api.post(`/sprint-outreach/templates/${templateId}/use`).catch(() => {})
      }
      toast.success('Aktivität gespeichert')
      onLogged?.(activity, activeTargetId)
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
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Aktivität protokollieren</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!targetId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zielkunde <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className={CLS_INPUT}
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.companyName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                {contactBlocked ? (
                  <>
                    <select value="Note" onChange={() => {}} className={CLS_INPUT} disabled>
                      <option value="Note">Notiz</option>
                    </select>
                    <p className="mt-1 text-[11px] text-red-600">
                      Kontaktsperre (DSGVO Art. 21) – nur interne Notizen erlaubt.
                    </p>
                  </>
                ) : (
                  <select value={form.type} onChange={(e) => set('type', e.target.value)} className={CLS_INPUT}>
                    <option value="Call">Anruf</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Email">E-Mail</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Note">Notiz</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dauer (min)</label>
                <input
                  type="number"
                  min="0"
                  value={form.duration}
                  onChange={(e) => set('duration', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="optional"
                />
              </div>
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
            {availableTemplates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vorlage</label>
                <select
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className={CLS_INPUT}
                >
                  <option value="">— keine Vorlage —</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Vorlage füllt die Zusammenfassung und ersetzt {`{unternehmen}`}, {`{ansprechpartner}`}, {`{segment}`}.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zusammenfassung</label>
              <textarea
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                rows={3}
                className={`${CLS_INPUT} resize-none`}
                placeholder="Was wurde besprochen?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Schritte</label>
              <input
                type="text"
                value={form.nextSteps}
                onChange={(e) => set('nextSteps', e.target.value)}
                className={CLS_INPUT}
                placeholder="Was ist als nächstes zu tun?"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || callLimitReached}
                className="px-5 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronLeft, Loader2, Lock, Sparkles, Trophy, CircleSlash, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import ActivityLogModal from '@/components/acquisition/ActivityLogModal'
import StepGuide from '@/components/acquisition/StepGuide'
import AiModal from '@/components/acquisition/AiModal'
import { exitState } from '@/lib/acquisitionGuide'
import { usePipelineFor } from '@/lib/usePipeline'
import {
  isStatusSelectable, nextUnlockedStatus, processProgress, statusLabel, stepBySlug,
  isBlockStatus, statusBadge,
} from '@/lib/pipelineLogic'

const CLS_FIELD =
  'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

const AI_ACTIONS = [
  { kind: 'research',  label: 'Unternehmen recherchieren' },
  { kind: 'email',     label: 'E-Mail-Entwurf' },
  { kind: 'summary',   label: 'Notiz zusammenfassen' },
  { kind: 'nextsteps', label: 'Nächste Schritte vorschlagen' },
]

// Nur die KI-Funktionen anbieten, die inhaltlich zum Schritt passen.
function aiKindsForStep(step) {
  if (!step) return []
  const { stageKey, status } = step
  switch (stageKey) {
    case 'lead':
      // Vor dem Erstkontakt recherchieren, ab „vernetzt“ E-Mail, nach Kontakt zusammenfassen.
      if (status === 'offen' || status === 'recherchiert') return ['research', 'nextsteps']
      if (status === 'vernetzt') return ['email', 'nextsteps']
      return ['summary', 'email', 'nextsteps']
    case 'qualifizierung':
      // Vor dem Gespräch Termin-/E-Mail-Entwurf, danach Zusammenfassung.
      if (status === 'Qualifizierungsgespräch') return ['email', 'nextsteps']
      return ['summary', 'nextsteps', 'email']
    case 'erstgespraech':
      return ['summary', 'nextsteps', 'email']
    case 'angebot':
      // Das Angebot selbst entsteht im Angebots-Flow – hier nur Zusammenfassung/Follow-up.
      if (status === 'Angebot in Vorbereitung') return ['summary', 'nextsteps']
      return ['email', 'summary', 'nextsteps']
    case 'abschluss':
      // Bei Verlust/kein Interesse nur interne Zusammenfassung (DSGVO: kein Outreach).
      if (status === 'Verlust' || status === 'kein Interesse') return ['summary']
      return ['summary', 'nextsteps']
    default:
      return ['research', 'email', 'summary', 'nextsteps']
  }
}

function aiActionsForStep(step) {
  const allowed = new Set(aiKindsForStep(step))
  return AI_ACTIONS.filter((a) => allowed.has(a.kind))
}

// Termin-Felder (immer `firstMeetingDate`) bekommen zusätzlich ein Uhrzeit-Feld.
const APPOINTMENT_FIELDS = new Set(['firstMeetingDate'])
const isAppointmentField = (f) => f?.type === 'date' && APPOINTMENT_FIELDS.has(f.payload)

// Felder, die im vorherigen (Planungs-)Schritt bereits gesetzt wurden und hier
// nur noch angezeigt, nicht erneut abgefragt werden sollen. Nur der Termin ist
// redundant – Angebotswerte können sich zwischen den Schritten ändern und
// bleiben deshalb editierbar. Schritte ohne Eintrag fragen ihre Felder ab.
const LOCKED_FIELDS_BY_STATUS = {
  'Qualifizierungsgespräch durchgeführt': ['firstMeetingDate'], // Termin kam aus „planen“
  'Erstgespräch durchgeführt': ['firstMeetingDate'],            // Termin kam aus „planen“
}

// Eine Seite je Akquise-Schritt. „Speichern & weiter“ protokolliert genau eine
// Aktivität und setzt anschließend den Status (PUT mit activityLogged=true,
// damit der Server nicht zusätzlich automatisch protokolliert).
export default function StepPage({ targetId, slug }) {
  const router = useRouter()

  const [target, setTarget] = useState(null)
  const pipeline = usePipelineFor(target)
  const step = stepBySlug(slug, pipeline)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [pendingLog, setPendingLog] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [aiKind, setAiKind] = useState(null)

  const fetchTarget = useCallback(async () => {
    setLoading(true)
    try {
      const [t, acts] = await Promise.all([
        api.get(`/acquisition/${targetId}`),
        api.get(`/acquisition/${targetId}/activities`).catch(() => []),
      ])
      setTarget(t)
      setActivities(Array.isArray(acts) ? acts : [])
    } catch {
      toast.error('Fehler beim Laden des Zielkunden')
    } finally {
      setLoading(false)
    }
  }, [targetId])

  useEffect(() => { fetchTarget() }, [fetchTarget])
  useEffect(() => { setValues({}) }, [slug])

  // Esc schließt den Exit-Kriterien-Bestätigungsdialog
  useEffect(() => {
    if (!showExitConfirm) return
    const onKey = (e) => { if (e.key === 'Escape') setShowExitConfirm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showExitConfirm])

  const current = target?.status || (pipeline.steps[0]?.status ?? 'offen')
  const isCurrent = step && current === step.status
  const unlocked = step ? isStatusSelectable(current, step.status, pipeline) : false
  const progress = step ? processProgress(step.status, pipeline) : null
  const blocked = isBlockStatus(current, pipeline) || target?.blocklisted === true

  const fields = step?.requiredFields || []
  const lockedFields = LOCKED_FIELDS_BY_STATUS[step?.status] || []
  const hasTargetValue = (payload) => {
    const v = target?.[payload]
    return v !== undefined && v !== null && v !== ''
  }
  // Gesperrt = in früherem Schritt erfasst und dort bereits gespeichert.
  const isFieldLocked = (f) => lockedFields.includes(f.payload) && hasTargetValue(f.payload)

  const plannedDate = useMemo(() => {
    const dateField = fields.find((f) => f.type === 'date')
    if (!dateField) return ''
    const entered = values[dateField.payload]
    if (entered) {
      const time = values[`${dateField.payload}__time`]
      return time ? `${formatDate(entered)} · ${time} Uhr` : formatDate(entered)
    }
    // Termin wurde bereits in einem früheren Schritt gespeichert.
    return isFieldLocked(dateField) ? formatDateTime(target[dateField.payload]) : ''
  }, [fields, values, target])

  // Termin-Zeitpunkt für die Meeting-Aktivität: aus dem Formular (Datum + Uhrzeit)
  // oder – bei bereits geplanten Terminen – aus dem gespeicherten Zielkunden.
  const appointmentValue = useMemo(() => {
    const date = values.firstMeetingDate
    const time = values['firstMeetingDate__time']
    if (date) return time ? `${date}T${time}` : date
    return target?.firstMeetingDate || null
  }, [values, target])

  // Felder aus dem Formular fließen in die Prüfung der Exit-Kriterien ein,
  // damit z. B. ein noch nicht gespeicherter Angebotswert zählt.
  const effectiveTarget = useMemo(() => {
    const merged = { ...(target || {}) }
    for (const f of fields) {
      const raw = values[f.payload]
      if (raw !== undefined && raw !== '') {
        merged[f.payload] = f.type === 'number' ? Number(raw) : raw
      }
    }
    return merged
  }, [target, fields, values])

  const guideState = step
    ? exitState(step, {
      target: effectiveTarget,
      activities,
      checks: target?.stepChecks || {},
      pendingActivityType: step.activityType,
    })
    : null

  function setValue(payload, value) {
    setValues((v) => ({ ...v, [payload]: value }))
  }

  async function toggleCheck(status, key) {
    if (!target) return
    const checks = JSON.parse(JSON.stringify(target.stepChecks || {}))
    const forStatus = { ...(checks[status] || {}) }
    if (forStatus[key]) delete forStatus[key]
    else forStatus[key] = true
    if (Object.keys(forStatus).length) checks[status] = forStatus
    else delete checks[status]
    setTarget((prev) => (prev ? { ...prev, stepChecks: checks } : prev))
    try {
      await api.put(`/acquisition/${targetId}`, { stepChecks: checks })
    } catch {
      toast.error('Konnte Prüfstatus nicht speichern')
      fetchTarget()
    }
  }

  function validate() {
    for (const f of fields) {
      const raw = values[f.payload]
      if (f.required && (raw === undefined || raw === '')) {
        toast.error(`Bitte „${f.label}“ ausfüllen`)
        return false
      }
    }
    return true
  }

  function openLog() {
    if (!step || !unlocked) return
    if (!validate()) return
    // Offene Exit-Kriterien: erst im Dialog bestätigen lassen.
    if (guideState && !guideState.complete) {
      setShowExitConfirm(true)
      return
    }
    proceedLog()
  }

  function proceedLog() {
    setShowExitConfirm(false)
    setPendingLog(true)
    setShowLog(true)
  }

  async function finalize() {
    if (!step) return
    const payload = {}
    for (const f of fields) {
      const raw = values[f.payload]
      if (raw === undefined || raw === '') continue
      if (isAppointmentField(f)) {
        const time = values[`${f.payload}__time`]
        payload[f.payload] = time ? `${raw}T${time}` : raw
      } else {
        payload[f.payload] = f.type === 'number' ? Number(raw) : raw
      }
    }
    setSaving(true)
    try {
      await api.put(`/acquisition/${targetId}`, {
        status: step.status,
        ...payload,
        activityLogged: true,
      })
      toast.success(`Status: ${statusLabel(step.status, pipeline)}`)
      const next = nextUnlockedStatus(step.status, pipeline)
      const nextStep = next ? pipeline.byStatus.get(next) : null
      if (nextStep?.slug) {
        router.push(`/akquise/${targetId}/prozess/${nextStep.slug}`)
      } else {
        router.push(`/akquise/${targetId}/prozess`)
      }
    } catch (err) {
      toast.error(err.message || 'Statuswechsel fehlgeschlagen')
    } finally {
      setSaving(false)
      setPendingLog(false)
      setShowLog(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (!target || !step) {
    return <div className="text-gray-500 p-8">Schritt nicht gefunden.</div>
  }

  const isWon = step.isWon
  const isLost = step.isLost
  const accent = isWon ? 'green' : isLost ? 'red' : 'blue'
  const primaryLabel = isLost ? 'Abschluss erfassen' : isWon ? 'Abschluss protokollieren' : 'Speichern & weiter'

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button
          onClick={() => router.push(`/akquise/${targetId}/prozess`)}
          className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Prozess
        </button>
        <span className="text-gray-300">/</span>
        <span className="truncate text-gray-700">{target.companyName}</span>
      </div>

      {/* Kopf */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(current, pipeline)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {statusLabel(current, pipeline)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
              {statusLabel(step.status, pipeline)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{step.title || step.label}</h1>
          {step.description && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Phase</p>
          <p className="text-sm font-semibold text-gray-700">{progress?.stage?.label || '—'}</p>
          <p className="text-[11px] text-gray-400 tabular-nums">{progress?.percent ?? 0} %</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Inhalt links */}
        <div className="lg:col-span-2 space-y-4">
      {blocked && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Kontaktsperre (DSGVO Art. 21) – dieser Zielkunde ist gesperrt. Nur interne Dokumentation ist erlaubt.
        </div>
      )}

      {/* Sperre */}
      {!unlocked && !isCurrent ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-400 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Schritt noch gesperrt</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Dieser Schritt ist erst freigeschaltet, wenn die vorherigen Schritte der Pipeline abgeschlossen sind.
            </p>
            <button
              onClick={() => router.push(`/akquise/${targetId}/prozess`)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Zur Prozess-Übersicht
            </button>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border p-5 ${isLost ? 'border-red-200 bg-red-50/40' : isWon ? 'border-green-200 bg-green-50/40' : 'border-blue-200 bg-blue-50/40'}`}>
          <div className="flex items-center gap-2 mb-3">
            {isWon ? <Trophy className="w-4 h-4 text-green-600" />
              : isLost ? <CircleSlash className="w-4 h-4 text-red-500" />
                : <ArrowRight className="w-4 h-4 text-blue-600" />}
            <p className={`text-xs font-semibold uppercase tracking-wide ${isLost ? 'text-red-700' : isWon ? 'text-green-700' : 'text-blue-700'}`}>
              {isCurrent ? 'Aktueller Schritt' : 'Nächster Schritt'}
            </p>
            <span className="ml-auto text-[11px] text-gray-500">Aktivität: {step.activityType}</span>
          </div>

          {fields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.payload}>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={values[f.payload] ?? ''} onChange={(e) => setValue(f.payload, e.target.value)} className={CLS_FIELD}>
                      <option value="">-- wählen --</option>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : isFieldLocked(f) ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                      <span className="text-sm text-gray-900 tabular-nums">{formatDateTime(target[f.payload])}</span>
                      <span className="text-[11px] text-gray-400">aus Terminvereinbarung</span>
                    </div>
                  ) : isAppointmentField(f) ? (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={values[f.payload] ?? ''}
                        onChange={(e) => setValue(f.payload, e.target.value)}
                        className={CLS_FIELD}
                        aria-label="Datum"
                      />
                      <input
                        type="time"
                        value={values[`${f.payload}__time`] ?? ''}
                        onChange={(e) => setValue(`${f.payload}__time`, e.target.value)}
                        className={`${CLS_FIELD} w-28 shrink-0`}
                        aria-label="Uhrzeit"
                      />
                    </div>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'date'}
                      value={values[f.payload] ?? ''}
                      onChange={(e) => setValue(f.payload, e.target.value)}
                      className={CLS_FIELD}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={openLog}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                isLost ? 'bg-red-600 hover:bg-red-700' : isWon ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {primaryLabel}
            </button>
            <button
              onClick={() => router.push(`/akquise/${targetId}/prozess`)}
              className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Es wird genau eine Aktivität protokolliert und der Status auf „{statusLabel(step.status, pipeline)}“ gesetzt.
          </p>
        </div>
      )}

      <StepGuide step={step} guideState={guideState} onToggle={toggleCheck} />
        </div>

        {/* KI-Assistent rechts */}
        <div className="lg:col-span-1 lg:sticky lg:top-4">
      <div className="bg-gradient-to-b from-indigo-50/60 to-white rounded-xl border border-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">KI-Assistent</h3>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-indigo-600">Entwurf · prüfen</span>
        </div>
        <p className="text-xs text-gray-600 mb-3">Entwürfe und Analysen auf Basis der Zielkundendaten.</p>
        <div className="grid grid-cols-1 gap-2">
          {aiActionsForStep(step).map((a) => (
            <button key={a.kind} type="button" onClick={() => setAiKind(a.kind)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> {a.label}
            </button>
          ))}
        </div>
      </div>
        </div>
      </div>

      {showExitConfirm && guideState && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowExitConfirm(false)} />
            <div role="dialog" aria-modal="true" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
              <div className="flex items-start gap-3 px-6 pt-5 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">Exit-Kriterien unvollständig</h2>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {guideState.total - guideState.met} von {guideState.total} Exit-Kriterien noch offen.
                    Trotzdem mit „{statusLabel(step.status, pipeline)}“ fortfahren?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={proceedLog}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Trotzdem fortfahren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AiModal
        open={!!aiKind}
        kind={aiKind}
        targetId={targetId}
        companyName={target.companyName}
        onClose={() => setAiKind(null)}
      />

      <ActivityLogModal
        isOpen={showLog}
        onClose={() => { setShowLog(false); setPendingLog(false) }}
        defaultType={step.activityType}
        defaultSummary={
          pendingLog
            ? current === step.status
              ? `Aktivität zu „${statusLabel(step.status, pipeline)}“`
              : `Statuswechsel: ${statusLabel(current, pipeline)} → ${statusLabel(step.status, pipeline)}`
            : ''
        }
        stepLabel={statusLabel(step.status, pipeline)}
        infoNote={plannedDate ? `Geplanter Termin: ${plannedDate}` : null}
        appointmentDate={appointmentValue}
        onLogged={() => { if (pendingLog) finalize() }}
        targetId={targetId}
        target={target}
        callAttempts={target.callAttempts || 0}
        contactBlocked={blocked}
      />
    </div>
  )
}

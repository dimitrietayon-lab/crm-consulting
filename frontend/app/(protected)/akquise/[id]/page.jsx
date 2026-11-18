'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Phone, Brain, FileText, Edit2, Plus, AlertTriangle, RotateCcw, UserCheck, ClipboardCheck, ShieldAlert, Building2, ArrowRight, Users, Mail, Linkedin, StickyNote, CheckSquare, Activity, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import ActivityLogModal from '@/components/acquisition/ActivityLogModal'
import QualifyModal from '@/components/acquisition/QualifyModal'
import StageStrip from '@/components/acquisition/StageStrip'
import AiModal from '@/components/acquisition/AiModal'
import { usePipelineFor } from '@/lib/usePipeline'
import {
  isStatusSelectable as isStatusSelectableIn,
  statusLabel as statusLabelIn,
  isBlockStatus,
  statusBadge,
  flagStatuses,
} from '@/lib/pipelineLogic'

const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const ACTIVITY_META = {
  Call: { label: 'Anruf', Icon: Phone, cls: 'bg-blue-50 text-blue-600' },
  Meeting: { label: 'Meeting', Icon: Users, cls: 'bg-amber-50 text-amber-600' },
  Email: { label: 'E-Mail', Icon: Mail, cls: 'bg-cyan-50 text-cyan-600' },
  LinkedIn: { label: 'LinkedIn', Icon: Linkedin, cls: 'bg-indigo-50 text-indigo-600' },
  Note: { label: 'Notiz', Icon: StickyNote, cls: 'bg-gray-100 text-gray-500' },
  Task: { label: 'Aufgabe', Icon: CheckSquare, cls: 'bg-green-50 text-green-600' },
}
const activityMeta = (type) =>
  ACTIVITY_META[type] || { label: type || 'Aktivität', Icon: Activity, cls: 'bg-gray-100 text-gray-500' }

export default function SprintTargetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const pipeline = usePipelineFor(target)
  const statusLabel = (s) => statusLabelIn(s, pipeline)
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [docs, setDocs] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogModal, setShowLogModal] = useState(false)
  const [aiKind, setAiKind] = useState(null)
  const [logDefaultType, setLogDefaultType] = useState(null)
  const [showQualify, setShowQualify] = useState(false)
  const [qualifyAdvance, setQualifyAdvance] = useState(null)

  const fetchTarget = useCallback(async () => {
    setLoading(true)
    try {
      const [t, acts, taskList, docList, contactList] = await Promise.all([
        api.get(`/acquisition/${id}`),
        api.get(`/acquisition/${id}/activities`),
        api.get(`/tasks?acquisitionTargetId=${id}`).catch(() => []),
        api.get(`/documents?acquisitionTargetId=${id}`).catch(() => []),
        api.get(`/acquisition-contacts?acquisitionTargetId=${id}`).catch(() => []),
      ])
      setTarget(t)
      setActivities(Array.isArray(acts) ? acts : [])
      setTasks(Array.isArray(taskList) ? taskList : taskList.tasks || [])
      setDocs(Array.isArray(docList) ? docList : [])
      setContacts(Array.isArray(contactList) ? contactList : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTarget() }, [fetchTarget])

  async function resetCallAttempts() {
    try {
      await api.put(`/acquisition/${id}`, { callAttempts: 0 })
      setTarget((p) => ({ ...p, callAttempts: 0 }))
      toast.success('Anrufzähler zurückgesetzt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Zurücksetzen')
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

  const blocked = isBlockStatus(target.status, pipeline) || target.blocklisted === true

  // Standard-Aktivitätstyp fürs Protokoll: passend zum aktuellen Pipeline-Schritt.
  // Bei erreichtem Anruflimit fällt „Call" auf „Note" zurück.
  function defaultLogType() {
    const stepType = pipeline.byStatus?.get(target.status)?.activityType || 'Call'
    if (stepType === 'Call' && (target.callAttempts || 0) >= 3) return 'Note'
    return stepType
  }

  // Kontaktdaten des Ansprechpartners (aus den Zielkunden-Kontakten)
  const readContact = contacts.find((c) => c.name === target.contactName) || null

  // Prozess-Freischaltung: Aktionen erst, wenn die nötige Phase erreicht ist
  const canQualify = isStatusSelectableIn(target.status, 'Qualifizierungsgespräch', pipeline)
  const canOffer = isStatusSelectableIn(target.status, 'Angebot in Vorbereitung', pipeline)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/akquise')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{target.companyName}</h1>
            <p className="text-sm text-gray-500">{target.segment}</p>
            {target.account && (
              <button
                onClick={() => router.push(`/accounts/${target.account.id}`)}
                className="mt-0.5 flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
              >
                <Building2 className="w-3.5 h-3.5" /> {target.account.companyName}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/akquise/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Edit2 className="w-4 h-4" /> Bearbeiten
          </button>
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
          { label: 'Angebotswert', value: target.offerValue ? formatCurrency(target.offerValue) : '—', hint: target.offerDate ? formatDate(target.offerDate) : 'kein Angebot' },
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

      {/* Akquise-Prozess: Stufen-Leiste + Schritte */}
      <StageStrip target={target} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: data cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status + Stammdaten */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Stammdaten</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Status</label>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(target.status, pipeline)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel(target.status)}
                </span>
                <p className="mt-1 text-[11px] text-gray-500 leading-snug">
                  Status wird im Akquise-Prozess geändert.
                </p>
              </div>
              <div>
                <label className={CLS_LABEL}>Priorität</label>
                <p className="text-sm text-gray-900">Prio {target.priority}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Branche</label>
                <p className="text-sm text-gray-900">{target.segment || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Bundesland</label>
                <p className="text-sm text-gray-900">{target.bundesland || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Mitarbeiter</label>
                <p className="text-sm text-gray-900">{target.numberOfEmployees || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Quelle</label>
                <p className="text-sm text-gray-900">{target.contactSource || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Ponturo-Beziehung</label>
                <p className="text-sm text-gray-900">{target.ponturoRelationship || '—'}</p>
              </div>
            </div>
            <div className="mt-4">
              <label className={CLS_LABEL}>Adresse</label>
              <p className="text-sm text-gray-900">
                {[target.street, [target.postalCode, target.location].filter(Boolean).join(' ')]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>
            {target.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className={CLS_LABEL}>Notizen</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{target.notes}</p>
              </div>
            )}
          </div>

          {/* Akquise Tracking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Akquise-Tracking</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Ansprechpartner</label>
                <div>
                  <p className="text-sm text-gray-900">{target.contactName || '—'}</p>
                  {readContact?.phone && <p className="text-xs text-gray-500 mt-0.5">{readContact.phone}</p>}
                  {readContact?.email && <p className="text-xs text-gray-500">{readContact.email}</p>}
                </div>
              </div>
              <div>
                <label className={CLS_LABEL}>Titel / Position</label>
                <p className="text-sm text-gray-900">{target.contactTitle || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>LinkedIn</label>
                {target.contactLinkedIn ? (
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
                      className={`w-4 h-4 rounded-full border-2 ${
                        i < (target.callAttempts || 0)
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-gray-500">{target.callAttempts || 0} / 3</span>
                </div>
              </div>
              <div>
                <label className={CLS_LABEL}>Anruf-Trigger (UWG)</label>
                <p className="text-sm text-gray-900">{target.callTrigger || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>E-Mail erlaubt</label>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  target.emailAllowed === true ? 'bg-green-100 text-green-700'
                  : target.emailAllowed === false ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {target.emailAllowed === true ? 'Ja' : target.emailAllowed === false ? 'Nein' : 'nicht gefragt'}
                </span>
              </div>
              {target.callAttempts >= 3 && (
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
                <p className="text-sm text-gray-900">{formatDate(target.privacyNoticeAt) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                <p className="text-sm text-gray-900">{target.privacyNoticeSource || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Einwilligung E-Mail: erteilt am</label>
                <p className="text-sm text-gray-900">{formatDate(target.emailConsentAt) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                <p className="text-sm text-gray-900">{target.emailConsentSource || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>E-Mail-Einwilligung widerrufen am</label>
                <p className={`text-sm ${target.emailConsentRevokedAt ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                  {formatDate(target.emailConsentRevokedAt) || '—'}
                </p>
              </div>
              <div>
                <label className={CLS_LABEL}>Einwilligung Telefon: erteilt am</label>
                <p className="text-sm text-gray-900">{formatDate(target.callConsentAt) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Weg</label>
                <p className="text-sm text-gray-900">{target.callConsentSource || '—'}</p>
              </div>
            </div>
          </div>

          {/* Selbsttest */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Selbsttest</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Score (0–100)</label>
                <p className="text-sm text-gray-900">
                  {target.selfTestScore !== null && target.selfTestScore !== undefined ? `${target.selfTestScore} / 100` : '—'}
                </p>
              </div>
              <div>
                <label className={CLS_LABEL}>Datum</label>
                <p className="text-sm text-gray-900">{formatDate(target.selfTestDate) || '—'}</p>
              </div>
              <div className="col-span-2">
                <label className={CLS_LABEL}>Link zum Ergebnis</label>
                {target.selfTestLink ? (
                  <a href={target.selfTestLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                    {target.selfTestLink}
                  </a>
                ) : (
                  <p className="text-sm text-gray-900">—</p>
                )}
              </div>
            </div>
            {target.selfTestScore == null && !target.selfTestDate && !target.selfTestLink && (
              <p className="mt-3 text-xs text-gray-400">Noch keine Selbsttest-Ergebnisse erfasst.</p>
            )}
          </div>

          {/* Prozessfortschritt */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Prozessfortschritt</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Übergabe EM</label>
                <p className="text-sm text-gray-900">{formatDate(target.handoverDate) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Erstgespräch</label>
                <p className="text-sm text-gray-900">{formatDate(target.firstMeetingDate) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Angebotswert (€)</label>
                <p className="text-sm text-gray-900">{target.offerValue ? formatCurrency(target.offerValue) : '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Angebotsdatum</label>
                <p className="text-sm text-gray-900">{formatDate(target.offerDate) || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Förderstatus</label>
                <p className="text-sm text-gray-900">{target.bafaStatus || '—'}</p>
              </div>
              <div>
                <label className={CLS_LABEL}>Ergebnis</label>
                <p className={`text-sm capitalize ${target.result === 'gewonnen' ? 'text-green-700 font-medium' : target.result === 'verloren' ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                  {target.result || '—'}
                </p>
              </div>
              <div>
                <label className={CLS_LABEL}>Verlustgrund</label>
                <p className="text-sm text-gray-900">{target.lossReason || '—'}</p>
              </div>
            </div>
            {flagStatuses(pipeline, 'lost').includes(target.status) && !target.lossReason && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Bei Status „{statusLabel(target.status)}“ ist ein Verlustgrund erforderlich.
              </div>
            )}
          </div>

          {/* Aufgaben & Dokumente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Aufgaben</h2>
                <button onClick={() => router.push('/tasks?onlySprint=true')} className="text-xs font-medium text-blue-700 hover:text-blue-900">Alle</button>
              </div>
              {tasks.filter((t) => !['Done', 'Cancelled'].includes(t.status)).length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Keine offenen Aufgaben.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {tasks.filter((t) => !['Done', 'Cancelled'].includes(t.status)).slice(0, 5).map((t) => {
                    const overdue = t.dueDate && new Date(t.dueDate) < new Date().setHours(0, 0, 0, 0)
                    return (
                      <li key={t.id} className="py-2">
                        <p className="text-sm text-gray-900 truncate">{t.title}</p>
                        <p className={`text-[11px] ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                          {t.dueDate ? `fällig ${formatDate(t.dueDate)}` : 'ohne Fälligkeit'} · {t.assignedTo?.name || 'unzugewiesen'}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Dokumente</h2>
                <button onClick={() => router.push('/documents?onlySprint=true')} className="text-xs font-medium text-blue-700 hover:text-blue-900">Alle</button>
              </div>
              {docs.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Keine Dokumente hinterlegt.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {docs.slice(0, 5).map((d) => (
                    <li key={d.id} className="py-2 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-900 truncate flex-1">{d.name}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{formatDate(d.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions + activities */}
        <div className="space-y-4">
          {/* KI-Assistent */}
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
              <button onClick={() => setAiKind('research')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Unternehmen recherchieren
              </button>
              <button onClick={() => setAiKind('email')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> E-Mail-Entwurf
              </button>
              <button onClick={() => setAiKind('summary')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Aktivitäten zusammenfassen
              </button>
              <button onClick={() => setAiKind('nextsteps')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Nächsten Schritt vorschlagen
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Aktionen</h2>
            <div className="space-y-2">
              <button
                onClick={() => { setQualifyAdvance(null); setShowQualify(true) }}
                disabled={blocked || !canQualify}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21)' : !canQualify ? 'Erst Lead-Gewinnung abschließen (Status „kontaktiert“)' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <UserCheck className="w-4 h-4 text-blue-500" /> Qualifizieren &amp; übergeben
              </button>
              <button
                onClick={() => { setLogDefaultType(defaultLogType()); setShowLogModal(true) }}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21) – nur interne Notizen erlaubt' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-4 h-4 text-blue-500" /> Aktivität protokollieren
                {blocked && <span className="ml-auto text-[10px] font-medium text-red-600">nur Notiz</span>}
              </button>

              <button
                onClick={() => router.push(`/akquise/${id}/assessment`)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Brain className="w-4 h-4 text-blue-500" /> KI-Assessment
              </button>
              <button
                onClick={() => router.push(`/akquise/${id}/proposals`)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-green-500" /> Projektvorschläge
              </button>
              <button
                onClick={() => router.push(`/akquise/offers/new?target=${id}`)}
                disabled={blocked || !canOffer}
                title={blocked ? 'Kontaktsperre (DSGVO Art. 21)' : !canOffer ? 'Erst Erstgespräch abschließen (Status „Fragebogen geschickt“)' : undefined}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <FileText className="w-4 h-4 text-blue-500" /> Angebot anlegen
              </button>
              <button
                onClick={() => router.push(`/akquise/${id}/handover`)}
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
                  onClick={() => router.push(`/akquise/${id}/assessment`)}
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Aktivitäten</h2>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{activities.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/activities?onlySprint=true')}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Alle
                </button>
                <button
                  onClick={() => { setLogDefaultType(defaultLogType()); setShowLogModal(true) }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Aktivität
                </button>
              </div>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Noch keine Aktivitäten</p>
            ) : (
              <ul className="relative space-y-3">
                {activities.length > 1 && (
                  <span className="absolute left-4 top-3 bottom-3 w-px bg-gray-100" aria-hidden="true" />
                )}
                {activities.map((a) => {
                  const meta = activityMeta(a.type)
                  const Icon = meta.Icon
                  return (
                    <li key={a.id} className="relative flex gap-3">
                      <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.cls}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800">{meta.label}</span>
                          <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                            {formatDate(a.date)}{a.duration ? ` · ${a.duration} min` : ''}
                          </span>
                        </div>
                        {a.summary && <p className="text-sm text-gray-600 mt-0.5 line-clamp-3 whitespace-pre-line">{a.summary}</p>}
                        {a.nextSteps && (
                          <p className="mt-1 text-xs text-blue-700 flex items-start gap-1">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{a.nextSteps}</span>
                          </p>
                        )}
                        {a.createdBy?.name && <p className="text-[11px] text-gray-400 mt-0.5">{a.createdBy.name}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <QualifyModal
        isOpen={showQualify}
        target={target}
        targetId={id}
        advanceTo={qualifyAdvance}
        onClose={() => { setShowQualify(false); setQualifyAdvance(null) }}
        onSaved={(updated, activity) => {
          setTarget((p) => ({ ...p, ...updated }))
          setActivities((prev) => [activity, ...prev])
        }}
      />

      <AiModal
        open={!!aiKind}
        kind={aiKind}
        targetId={id}
        companyName={target.companyName}
        onClose={() => setAiKind(null)}
      />

      <ActivityLogModal
        isOpen={showLogModal}
        onClose={() => { setShowLogModal(false); setLogDefaultType(null) }}
        defaultType={logDefaultType}
        onLogged={(a, _targetId, document) => {
          setActivities((prev) => [a, ...prev])
          if (document) setDocs((prev) => [document, ...prev])
          if (typeof a.callAttempts === 'number') {
            setTarget((p) => (p ? { ...p, callAttempts: a.callAttempts } : p))
          }
        }}
        targetId={id}
        target={target}
        callAttempts={target.callAttempts || 0}
        contactBlocked={blocked}
        appointmentDate={target.firstMeetingDate || null}
      />
    </div>
  )
}

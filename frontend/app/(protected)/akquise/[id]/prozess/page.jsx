'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ShieldAlert, Plus, Phone, Users, Mail, Linkedin, StickyNote, CheckSquare, Activity, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import ActivityLogModal from '@/components/acquisition/ActivityLogModal'
import PhaseFlow from '@/components/acquisition/PhaseFlow'
import QualifyModal from '@/components/acquisition/QualifyModal'
import { usePipelineFor } from '@/lib/usePipeline'
import { statusLabel as statusLabelIn, isBlockStatus, statusBadge } from '@/lib/pipelineLogic'

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

// Übersicht des Akquise-Prozesses: jeder Schritt öffnet seine eigene Seite
// (`/akquise/[id]/prozess/[slug]`), dort wird gespeichert und protokolliert.
export default function SprintTargetProzessPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const pipeline = usePipelineFor(target)
  const statusLabel = (s) => statusLabelIn(s, pipeline)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogModal, setShowLogModal] = useState(false)
  const [logDefaultType, setLogDefaultType] = useState(null)
  const [showQualify, setShowQualify] = useState(false)

  const fetchTarget = useCallback(async () => {
    setLoading(true)
    try {
      const [t, acts] = await Promise.all([
        api.get(`/acquisition/${id}`),
        api.get(`/acquisition/${id}/activities`).catch(() => []),
      ])
      setTarget(t)
      setActivities(Array.isArray(acts) ? acts : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTarget() }, [fetchTarget])

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

  // Standard-Aktivitätstyp passend zum aktuellen Pipeline-Schritt.
  function defaultLogType() {
    const t = pipeline.byStatus?.get(target.status)?.activityType || 'Call'
    return t === 'Call' && (target.callAttempts || 0) >= 3 ? 'Note' : t
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/akquise/${id}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{target.companyName}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(target.status, pipeline)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {statusLabel(target.status)}
              </span>
            </div>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Interaktiver Akquise-Prozess */}
        <div className="lg:col-span-2">
          <PhaseFlow
            target={target}
            onHandover={() => { setShowQualify(true) }}
            onLogActivity={(type) => { setLogDefaultType(type || defaultLogType()); setShowLogModal(true) }}
          />
        </div>

        {/* Aktivitäten-Verlauf */}
        <div className="space-y-4">
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
              <ul className="relative space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
        advanceTo="Übergabe an Engagement Manager"
        onClose={() => { setShowQualify(false) }}
        onSaved={(updated, activity) => {
          setTarget((p) => ({ ...p, ...updated }))
          if (activity) setActivities((prev) => [activity, ...prev])
        }}
      />

      <ActivityLogModal
        isOpen={showLogModal}
        onClose={() => { setShowLogModal(false); setLogDefaultType(null) }}
        defaultType={logDefaultType}
        onLogged={(a) => {
          if (a) setActivities((prev) => [a, ...prev])
          if (typeof a?.callAttempts === 'number') {
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

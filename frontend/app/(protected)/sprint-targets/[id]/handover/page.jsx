'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle2, Circle, Save, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

const CHECKLIST_LABELS = {
  zielkunde: 'Zielkunde & Kontaktakte vollständig',
  assessment: 'KI-Assessment abgeschlossen',
  angebot: 'Angebot angenommen & Vertrag geklärt',
  termine: 'Kickoff- und Workshop-Termine vereinbart',
  ansprechpartner: 'Ansprechpartner & Eskalation benannt',
  datenzugang: 'Datenzugang & Tooling geklärt',
}

const FORMATS = [
  { value: 'vor-ort', label: 'Vor Ort' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function emptyChecklist(points) {
  const result = {}
  for (const key of points) result[key] = false
  return result
}

export default function SprintHandoverPage() {
  const params = useParams()
  const router = useRouter()
  const targetId = params?.id

  const [target, setTarget] = useState(null)
  const [points, setPoints] = useState(Object.keys(CHECKLIST_LABELS))
  const [checklist, setChecklist] = useState({})
  const [handover, setHandover] = useState(null)
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    kickoffDate: '',
    firstWorkshopDate: '',
    format: '',
    participants: '',
    emUserId: '',
    notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const applyHandover = useCallback((data, pointKeys) => {
    setHandover(data)
    setChecklist(data?.checklist && typeof data.checklist === 'object' ? data.checklist : emptyChecklist(pointKeys))
    setForm({
      kickoffDate: data?.kickoffDate ? data.kickoffDate.slice(0, 10) : '',
      firstWorkshopDate: data?.firstWorkshopDate ? data.firstWorkshopDate.slice(0, 10) : '',
      format: data?.format || '',
      participants: data?.participants || '',
      emUserId: data?.emUserId || '',
      notes: data?.notes || '',
    })
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [data, userList] = await Promise.all([
        api.get(`/sprint-handover/${targetId}`),
        api.get('/users').catch(() => []),
      ])
      setTarget(data.target)
      setPoints(data.checklistPoints || Object.keys(CHECKLIST_LABELS))
      applyHandover(data.handover, data.checklistPoints || Object.keys(CHECKLIST_LABELS))
      setUsers(Array.isArray(userList) ? userList : [])
    } catch (err) {
      toast.error(err.message || 'Übergabe konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [targetId, applyHandover])

  useEffect(() => {
    if (targetId) fetchAll()
  }, [targetId, fetchAll])

  const done = useMemo(() => points.filter((key) => checklist[key]).length, [points, checklist])
  const confirmed = Boolean(handover?.confirmedAt)

  async function togglePoint(key) {
    const next = { ...checklist, [key]: !checklist[key] }
    setChecklist(next)
    try {
      const res = await api.put(`/sprint-handover/${targetId}`, { checklist: next })
      setHandover((prev) => ({ ...(prev || {}), ...res.handover }))
    } catch (err) {
      setChecklist(checklist)
      toast.error(err.message || 'Checkliste konnte nicht gespeichert werden')
    }
  }

  async function saveDetails(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put(`/sprint-handover/${targetId}`, {
        kickoffDate: form.kickoffDate || null,
        firstWorkshopDate: form.firstWorkshopDate || null,
        format: form.format || null,
        participants: form.participants || null,
        emUserId: form.emUserId || null,
        notes: form.notes || null,
      })
      setHandover((prev) => ({ ...(prev || {}), ...res.handover }))
      toast.success('Übergabe gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function confirmHandover() {
    setConfirming(true)
    try {
      const res = await api.post(`/sprint-handover/${targetId}/confirm`, {})
      setHandover((prev) => ({ ...(prev || {}), ...res.handover }))
      toast.success('Übergabe bestätigt')
    } catch (err) {
      toast.error(err.message || 'Bestätigung fehlgeschlagen')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!target) {
    return <div className="text-center py-16 text-sm text-gray-500">Zielkunde nicht gefunden.</div>
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/sprint-targets/${targetId}`)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Übergabe</h1>
          <p className="text-sm text-gray-500">{target.companyName}</p>
        </div>
      </div>

      {confirmed && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">Übergabe bestätigt</p>
            <p className="text-xs text-green-700">
              {handover.confirmedBy || '—'} · {formatDateTime(handover.confirmedAt)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">6-Punkte-Checkliste</h2>
          <span className={`text-sm font-bold ${done === points.length ? 'text-green-600' : 'text-gray-700'}`}>
            {done} / {points.length}
          </span>
        </div>

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${points.length ? (done / points.length) * 100 : 0}%` }}
          />
        </div>

        <ul className="space-y-2">
          {points.map((key) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => togglePoint(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  checklist[key] ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {checklist[key]
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  : <Circle className="w-5 h-5 text-gray-300 shrink-0" />}
                <span className={`text-sm ${checklist[key] ? 'text-green-900 font-medium' : 'text-gray-700'}`}>
                  {CHECKLIST_LABELS[key] || key}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={saveDetails} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Termine & Rahmen</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={CLS_LABEL}>Kickoff-Termin</label>
            <input type="date" value={form.kickoffDate} onChange={(e) => setForm({ ...form, kickoffDate: e.target.value })} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Erster Workshop</label>
            <input type="date" value={form.firstWorkshopDate} onChange={(e) => setForm({ ...form, firstWorkshopDate: e.target.value })} className={CLS_INPUT} />
          </div>
          <div>
            <label className={CLS_LABEL}>Format</label>
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className={CLS_INPUT}>
              <option value="">-- wählen --</option>
              {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={CLS_LABEL}>Teilnehmer</label>
            <input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} className={CLS_INPUT} placeholder="Namen, Rollen" />
          </div>
          <div>
            <label className={CLS_LABEL}>Projektleitung (EM)</label>
            <select value={form.emUserId} onChange={(e) => setForm({ ...form, emUserId: e.target.value })} className={CLS_INPUT}>
              <option value="">-- nicht zugewiesen --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={CLS_LABEL}>Hinweise</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={CLS_INPUT}
            placeholder="Offene Punkte, Risiken, Absprachen"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">
            {confirmed ? 'Übergabe bereits bestätigt.' : 'Bestätigung erst bei vollständiger Checkliste möglich.'}
          </p>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
            </button>
            {!confirmed && (
              <button
                type="button"
                onClick={confirmHandover}
                disabled={done < points.length || confirming}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={done < points.length ? 'Checkliste noch unvollständig' : 'Übergabe bestätigen'}
              >
                <ShieldCheck className="w-4 h-4" /> {confirming ? 'Bestätigen...' : 'Übergabe bestätigen'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

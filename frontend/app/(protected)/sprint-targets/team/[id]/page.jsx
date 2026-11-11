'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, X, Plus, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getSprintSettings } from '@/lib/sprintSettings'
import {
  TEAM_ROLES, resolveRoles, requiredRolesFor, STATUS_BADGE, PRIORITY_LABEL, PRIORITY_DOT,
  initials, colorFor, utilState,
} from '@/lib/sprintTeam'
import { LOST_STATUSES } from '@/lib/sprintOptions'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

export default function TeamMemberPage() {
  const { id } = useParams()
  const router = useRouter()
  const [members, setMembers] = useState([])
  const [targets, setTargets] = useState([])
  const [roles, setRoles] = useState(TEAM_ROLES)
  const [packageRoles, setPackageRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [capacity, setCapacity] = useState(10)
  const [newTargetId, setNewTargetId] = useState('')
  const [newRole, setNewRole] = useState('lead')
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseRole, setReleaseRole] = useState('')
  const [releaseBusy, setReleaseBusy] = useState(false)

  useEffect(() => {
    setCapacity(getSprintSettings().teamCapacity || 10)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/sprint-targets/team/overview')
      setMembers(Array.isArray(data.members) ? data.members : [])
      setTargets(Array.isArray(data.targets) ? data.targets : [])
      setRoles(resolveRoles(data.roles))
      setPackageRoles(Array.isArray(data.packageRoles) ? data.packageRoles : [])
    } catch {
      toast.error('Fehler beim Laden des Teammitglieds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const member = members.find((m) => m.id === id)

  const newTarget = targets.find((t) => t.id === newTargetId)
  const availableRoles = newTarget
    ? requiredRolesFor(newTarget, roles, packageRoles).map((r) => ({ key: r.role, label: r.label }))
    : roles

  const myTargets = useMemo(
    () => targets.filter((t) => (t.assignments || []).some((a) => a.userId === id)),
    [targets, id]
  )

  const summary = useMemo(() => {
    const offers = myTargets.filter((t) => t.offerValue != null || t.offerDate != null).length
    const assessments = myTargets.reduce((a, t) => a + (t._count?.assessments || 0), 0)
    const segments = [...new Set(myTargets.map((t) => t.segment).filter(Boolean))]
    const count = myTargets.length
    const util = capacity > 0 ? Math.round((count / capacity) * 100) : 0
    return { count, offers, assessments, segments, util, state: utilState(util) }
  }, [myTargets, capacity])

  async function removeAssignment(target, assignment) {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? { ...t, assignments: (t.assignments || []).filter((a) => a.id !== assignment.id) }
          : t
      )
    )
    try {
      await api.delete(`/sprint-targets/team/assign/${assignment.id}`)
      toast.success('Zuweisung entfernt')
    } catch (err) {
      setTargets((prev) =>
        prev.map((t) =>
          t.id === target.id
            ? { ...t, assignments: [...(t.assignments || []), assignment] }
            : t
        )
      )
      toast.error(err.message || 'Fehler beim Entfernen')
    }
  }

  const assignedByRole = useMemo(() => {
    const counts = {}
    for (const t of myTargets) {
      for (const a of t.assignments || []) {
        if (a.userId !== id) continue
        counts[a.role] = (counts[a.role] || 0) + 1
      }
    }
    return counts
  }, [myTargets, id])

  async function releaseAssignments() {
    const label = releaseRole
      ? `alle Zuweisungen in der Rolle „${roles.find((r) => r.key === releaseRole)?.label || releaseRole}"`
      : 'alle Zuweisungen'
    if (typeof window !== 'undefined' && !window.confirm(`${member?.name || 'Mitglied'} von ${label} entlasten?`)) return
    setReleaseBusy(true)
    try {
      const res = await api.post('/sprint-targets/team/release', {
        userId: id,
        ...(releaseRole ? { role: releaseRole } : {}),
      })
      setReleaseOpen(false)
      setReleaseRole('')
      await fetchData()
      toast.success(res.released ? `${res.released} Zuweisung(en) freigegeben` : 'Keine Zuweisungen gefunden')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Entlasten')
    } finally {
      setReleaseBusy(false)
    }
  }

  async function assignNew() {
    if (!newTargetId) {
      toast.error('Bitte einen Zielkunden wählen')
      return
    }
    const target = targets.find((t) => t.id === newTargetId)
    const role = roles.find((r) => r.key === newRole)
    if (!target || !role) return

    try {
      const created = await api.post('/sprint-targets/team/assign', {
        targetId: target.id,
        userId: id,
        role: newRole,
      })
      setTargets((prev) =>
        prev.map((t) => {
          if (t.id !== target.id) return t
          const exists = (t.assignments || []).some(
            (a) => a.userId === id && a.role === newRole
          )
          if (exists) return t
          return { ...t, assignments: [...(t.assignments || []), created] }
        })
      )
      setNewTargetId('')
      toast.success('Zielkunde zugewiesen')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Zuweisen')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500 mb-4">Teammitglied nicht gefunden.</p>
        <button onClick={() => router.push('/sprint-targets/team')} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
          Zur Team-Übersicht
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets/team')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Team
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
            <p className="text-sm text-gray-500">{member.email}</p>
          </div>
        </div>
        <button
          onClick={() => { setReleaseRole(''); setReleaseOpen(true) }}
          disabled={summary.count === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          <UserMinus className="w-4 h-4" /> Entlasten
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ backgroundColor: colorFor(member.id) }}>
            {initials(member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{member.name}</p>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {member.portalRole?.name || member.role || '—'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{member.email}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            summary.util > 100 ? 'bg-red-50 text-red-700'
            : summary.util >= 85 ? 'bg-amber-50 text-amber-700'
            : 'bg-green-50 text-green-700'
          }`}>
            {summary.state.label}
          </span>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Auslastung ({summary.count} von {capacity} Kunden)</span>
            <span className={`font-semibold ${summary.state.text}`}>{summary.util} %</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${summary.state.bar}`} style={{ width: `${Math.min(100, summary.util)}%` }} />
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Kunden</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Angebote</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.offers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Assessments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.assessments}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Auslastung</p>
          <p className={`text-2xl font-bold mt-1 ${summary.state.text}`}>{summary.util} %</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Assignments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Zugewiesene Zielkunden</h2>
          </div>
          {myTargets.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Noch keine Zuweisungen. Nutze das Formular rechts, um einen Zielkunden zuzuweisen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Zielkunde', 'Status', 'Priorität', 'Rolle(n)'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myTargets.map((t) => (
                    <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => router.push(`/sprint-targets/${t.id}`)}
                          className="text-left hover:underline"
                        >
                          <p className="font-medium text-gray-900 truncate max-w-[220px]">{t.companyName}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[220px]">{t.segment}</p>
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-gray-700 text-xs">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority] || 'bg-gray-300'}`} />
                          {PRIORITY_LABEL[t.priority] || t.priority || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {(t.assignments || []).filter((a) => a.userId === id).map((a) => {
                            const role = roles.find((r) => r.key === a.role)
                            return (
                              <span key={a.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs">
                                {role?.label || a.role}
                                <button
                                  onClick={() => removeAssignment(t, a)}
                                  className="p-0.5 rounded-full hover:bg-blue-100"
                                  title="Zuweisung entfernen"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* New assignment + segments */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Zielkunde zuweisen</h2>
            <div className="space-y-3">
              <div>
                <label className={CLS_LABEL}>Zielkunde</label>
                <select
                  value={newTargetId}
                  onChange={(e) => {
                    const value = e.target.value
                    setNewTargetId(value)
                    const picked = targets.find((t) => t.id === value)
                    const allowed = picked
                      ? requiredRolesFor(picked, roles, packageRoles)
                      : []
                    if (allowed.length && !allowed.some((r) => r.role === newRole)) {
                      setNewRole(allowed[0].role)
                    }
                  }}
                  className={CLS_INPUT}
                >
                  <option value="">— bitte wählen —</option>
                  {targets.filter((t) => !LOST_STATUSES.includes(t.status)).map((t) => (
                    <option key={t.id} value={t.id}>{t.companyName} · {t.status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Rolle</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={CLS_INPUT}>
                  {availableRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <button
                onClick={assignNew}
                disabled={!newTargetId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Zuweisen
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Schwerpunkte</h2>
            {summary.segments.length ? (
              <div className="flex flex-wrap gap-1.5">
                {summary.segments.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Keine Zuordnungen</p>
            )}
          </div>
        </div>
      </div>

      {releaseOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReleaseOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Entlasten</h2>
                <button onClick={() => setReleaseOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Zuweisungen von {member.name} freigeben. Die Zielkunden bleiben erhalten, nur die Zuordnung entfällt.
              </p>
              <div>
                <label className={CLS_LABEL}>Umfang</label>
                <select value={releaseRole} onChange={(e) => setReleaseRole(e.target.value)} className={CLS_INPUT}>
                  <option value="">Alle Rollen ({summary.count} Zuweisungen)</option>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label} ({assignedByRole[r.key] || 0})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setReleaseOpen(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
                <button
                  onClick={releaseAssignments}
                  disabled={releaseBusy || (releaseRole ? !assignedByRole[releaseRole] : summary.count === 0)}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {releaseBusy ? 'Freigeben…' : 'Entlasten'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

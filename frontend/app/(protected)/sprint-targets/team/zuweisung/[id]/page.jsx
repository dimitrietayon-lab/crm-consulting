'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ExternalLink, AlertTriangle, Plus, X, Search, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getSprintSettings } from '@/lib/sprintSettings'
import {
  TEAM_ROLES, resolveRoles, requiredRolesFor, SPRINT_PACKAGE_LABELS,
  STATUS_BADGE, PRIORITY_LABEL, PRIORITY_DOT,
  assignmentsForRole, initials, colorFor, utilState,
} from '@/lib/sprintTeam'
import { LOST_STATUSES } from '@/lib/sprintOptions'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const TABS = [
  { key: 'zuweisung', label: 'Zuweisung' },
  { key: 'einstellung', label: 'Einstellung' },
]

export default function CustomerAssignmentPage() {
  const { id } = useParams()
  const router = useRouter()
  const [members, setMembers] = useState([])
  const [targets, setTargets] = useState([])
  const [roles, setRoles] = useState(TEAM_ROLES)
  const [packageRoles, setPackageRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [capacity, setCapacity] = useState(10)
  const [tab, setTab] = useState('zuweisung')
  const [pickerRole, setPickerRole] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [editRoles, setEditRoles] = useState([])
  const [savingRoles, setSavingRoles] = useState(false)

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
      toast.error('Fehler beim Laden der Zuweisungen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const target = targets.find((t) => t.id === id)
  const assignments = target?.assignments || []
  const locked = LOST_STATUSES.includes(target?.status)

  // Rollenbedarf des Kunden (kundenspezifisch → Paket → alle Rollen)
  const requiredRoles = useMemo(
    () => (target ? requiredRolesFor(target, roles, packageRoles) : []),
    [target, roles, packageRoles]
  )

  // Auslastung je Mitarbeiter (unique Kunden)
  const memberStats = useMemo(() => {
    const byMember = {}
    for (const t of targets) {
      const userIds = [...new Set((t.assignments || []).map((a) => a.userId).filter(Boolean))]
      for (const uid of userIds) byMember[uid] = (byMember[uid] || 0) + 1
    }
    return members.map((m) => {
      const count = byMember[m.id] || 0
      const util = capacity > 0 ? Math.round((count / capacity) * 100) : 0
      return { ...m, count, util, state: utilState(util) }
    })
  }, [members, targets, capacity])

  const statsById = useMemo(
    () => Object.fromEntries(memberStats.map((m) => [m.id, m])),
    [memberStats]
  )

  async function assign(role, member) {
    try {
      const created = await api.post('/sprint-targets/team/assign', {
        targetId: id,
        userId: member.id,
        role,
      })
      setTargets((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                assignments: [
                  ...(t.assignments || []).filter(
                    (a) => !(a.userId === member.id && a.role === role)
                  ),
                  created,
                ],
              }
            : t
        )
      )
      toast.success(`${member.name} zugewiesen`)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Zuweisen')
    }
  }

  async function remove(assignment) {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === id
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
          t.id === id
            ? { ...t, assignments: [...(t.assignments || []), assignment] }
            : t
        )
      )
      toast.error(err.message || 'Fehler beim Entfernen')
    }
  }

  function openPicker(roleKey) {
    setPickerRole(roleKey)
    setPickerSearch('')
  }

  // ─── Einstellungen (Rollenbedarf des Kunden) ───
  function openSettings() {
    setEditRoles(requiredRoles.map((r) => ({ role: r.role, headcount: r.headcount })))
    setTab('einstellung')
  }

  function applyPackageDefaults() {
    const fromPkg = packageRoles.filter(
      (p) => p.package === target?.package && roles.some((r) => r.key === p.role)
    )
    setEditRoles(
      fromPkg.length
        ? fromPkg.map((p) => ({ role: p.role, headcount: p.headcount }))
        : roles.map((r) => ({ role: r.key, headcount: 1 }))
    )
  }

  function toggleEditRole(roleKey, on) {
    setEditRoles((prev) => {
      if (on) {
        return prev.some((r) => r.role === roleKey)
          ? prev
          : [...prev, { role: roleKey, headcount: 1 }]
      }
      return prev.filter((r) => r.role !== roleKey)
    })
  }

  function setEditHeadcount(roleKey, value) {
    const n = Math.max(1, Number(value) || 1)
    setEditRoles((prev) =>
      prev.map((r) => (r.role === roleKey ? { ...r, headcount: n } : r))
    )
  }

  async function saveRoles() {
    setSavingRoles(true)
    try {
      const saved = await api.put(`/sprint-targets/team/roles/${id}`, { roles: editRoles })
      setTargets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, roleRequirements: saved } : t))
      )
      toast.success('Rollen gespeichert')
      setTab('zuweisung')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSavingRoles(false)
    }
  }

  const pickerRoleObj = roles.find((r) => r.key === pickerRole) || null
  const pickerCandidates = useMemo(() => {
    if (!pickerRole) return []
    const q = pickerSearch.trim().toLowerCase()
    return memberStats
      .filter((m) => !assignments.some((a) => a.role === pickerRole && a.userId === m.id))
      .filter((m) => {
        if (!q) return true
        return (
          String(m.name || '').toLowerCase().includes(q) ||
          String(m.email || '').toLowerCase().includes(q)
        )
      })
  }, [pickerRole, pickerSearch, memberStats, assignments])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500 mb-4">Zielkunde nicht gefunden.</p>
        <button onClick={() => router.push('/sprint-targets/team')} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
          Zur Team-Übersicht
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/sprint-targets/team')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
          <ChevronLeft className="w-4 h-4" /> Team &amp; Zuweisung
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{target.companyName}</h1>
          <p className="text-sm text-gray-500 truncate">
            {target.segment || '—'}
            {target.package ? ` · Paket ${SPRINT_PACKAGE_LABELS[target.package] || target.package}` : ' · kein Paket'}
          </p>
        </div>
      </div>

      {/* Customer card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[target.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {target.status}
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 text-xs">
              <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[target.priority] || 'bg-gray-300'}`} />
              {PRIORITY_LABEL[target.priority] || target.priority || '—'}
            </span>
            <span className="text-xs text-gray-400">· {assignments.length} Zuweisung(en)</span>
          </div>
          <button
            onClick={() => router.push(`/sprint-targets/${target.id}`)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            Zielkunde öffnen <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {locked && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Status „{target.status}“ – diesem Kunden können keine Mitarbeiter mehr zugewiesen werden.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('zuweisung')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
            tab === 'zuweisung'
              ? 'border-violet-600 text-violet-700 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Zuweisung
        </button>
        <button
          onClick={openSettings}
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
            tab === 'einstellung'
              ? 'border-violet-600 text-violet-700 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Einstellung
        </button>
      </div>

      {tab === 'zuweisung' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {requiredRoles.length === 0 ? (
            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Für diesen Kunden sind keine Rollen hinterlegt. Lege sie im Tab „Einstellung“ fest.
            </div>
          ) : (
            requiredRoles.map((req) => {
              const role = roles.find((r) => r.key === req.role) || { key: req.role, label: req.label }
              const assigned = assignmentsForRole(target, role.key)
              const complete = assigned.length >= req.headcount
              return (
                <div key={role.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">{role.label}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      complete ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {assigned.length} / {req.headcount}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    {assigned.length === 0 ? (
                      <p className="text-xs text-gray-400 px-1 py-2">Noch keine Mitarbeiter zugewiesen.</p>
                    ) : (
                      assigned.map((a) => {
                        const member = statsById[a.userId]
                        if (!member) return null
                        return (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-gray-100 p-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: colorFor(member.id) }}>
                              {initials(member.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.portalRole?.name || member.role || '—'} · {member.count} Kunden
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${member.state.bar}`} style={{ width: `${Math.min(100, member.util)}%` }} />
                                </div>
                                <span className={`text-[11px] font-semibold ${member.state.text}`}>{member.util} %</span>
                              </div>
                            </div>
                            <button
                              onClick={() => remove(a)}
                              className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
                              title="Zuweisung entfernen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })
                    )}

                    {!locked && (
                      <button
                        onClick={() => openPicker(role.key)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 border border-dashed border-violet-300 rounded-lg hover:bg-violet-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Mitarbeiter zuweisen
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'einstellung' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Rollen für diesen Kunden</h2>
              <p className="text-xs text-gray-500 mt-1">
                {target.package
                  ? `Standard aus Paket „${SPRINT_PACKAGE_LABELS[target.package] || target.package}“ – hier je Kunde anpassbar.`
                  : 'Kein Paket zugeordnet – Rollen manuell festlegen.'}
              </p>
            </div>
            <button
              onClick={applyPackageDefaults}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 whitespace-nowrap"
            >
              Aus Paket übernehmen
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-w-md">
            {roles.map((role) => {
              const entry = editRoles.find((r) => r.role === role.key)
              return (
                <div key={role.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`role-${role.key}`}
                    checked={Boolean(entry)}
                    onChange={(e) => toggleEditRole(role.key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor={`role-${role.key}`} className="flex-1 text-sm text-gray-700 cursor-pointer">
                    {role.label}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={entry?.headcount || 1}
                    disabled={!entry}
                    onChange={(e) => setEditHeadcount(role.key, e.target.value)}
                    className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Umfang (Anzahl Mitarbeiter)"
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setTab('zuweisung')} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
            <button
              onClick={saveRoles}
              disabled={savingRoles}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingRoles ? 'Speichern...' : 'Rollen speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Mitarbeiter-Picker */}
      {pickerRoleObj && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPickerRole(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-gray-900">{pickerRoleObj.label} zuweisen</h2>
                <button onClick={() => setPickerRole(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Mitarbeiter auswählen – Mehrfachzuweisung möglich.</p>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Mitarbeiter suchen..."
                  className={`${CLS_INPUT} pl-9`}
                  autoFocus
                />
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
                {pickerCandidates.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">
                    {members.length === 0 ? 'Keine Benutzer vorhanden.' : 'Keine weiteren Mitarbeiter verfügbar.'}
                  </p>
                ) : (
                  pickerCandidates.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { assign(pickerRoleObj.key, m); setPickerRole(null) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: colorFor(m.id) }}>
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {m.portalRole?.name || m.role || '—'} · {m.count} Kunden
                        </p>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${m.state.text}`}>{m.util} %</span>
                      <Plus className="w-4 h-4 text-violet-600 shrink-0" />
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button onClick={() => setPickerRole(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

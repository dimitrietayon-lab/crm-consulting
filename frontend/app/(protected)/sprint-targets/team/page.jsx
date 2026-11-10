'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, X, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getSprintSettings } from '@/lib/sprintSettings'
import {
  TEAM_ROLES, resolveRoles, requiredRolesFor, STATUS_BADGE, PRIORITY_LABEL, PRIORITY_DOT,
  initials, colorFor, utilState,
} from '@/lib/sprintTeam'
import { LOST_STATUSES } from '@/lib/sprintOptions'

const TABS = [
  { key: 'team', label: 'Team & Kapazität' },
  { key: 'zuweisung', label: 'Kundenzuweisung' },
]

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

export default function SprintTeamPage() {
  const router = useRouter()
  const [members, setMembers] = useState([])
  const [targets, setTargets] = useState([])
  const [roles, setRoles] = useState(TEAM_ROLES)
  const [packageRoles, setPackageRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('team')
  const [openOnly, setOpenOnly] = useState(false)
  const [capacity, setCapacity] = useState(10)
  const [bulk, setBulk] = useState(null) // { role, userId }
  const [portalRoles, setPortalRoles] = useState([])
  const [creating, setCreating] = useState(null) // { name, email, password, portalRoleId }
  const [creatingBusy, setCreatingBusy] = useState(false)

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
      toast.error('Fehler beim Laden des Teams')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    let active = true
    api.get('/admin/roles')
      .then((rows) => { if (active) setPortalRoles(Array.isArray(rows) ? rows : []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function createMember() {
    if (!creating) return
    if (!creating.name?.trim() || !creating.email?.trim() || !creating.password) {
      toast.error('Name, E-Mail und Passwort sind erforderlich')
      return
    }
    setCreatingBusy(true)
    try {
      await api.post('/sprint-targets/team/members', {
        name: creating.name.trim(),
        email: creating.email.trim(),
        password: creating.password,
        portalRoleId: creating.portalRoleId || null,
      })
      setCreating(null)
      await fetchData()
      toast.success('Teammitglied angelegt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Anlegen')
    } finally {
      setCreatingBusy(false)
    }
  }

  const stats = useMemo(() => {
    const byMember = {}
    for (const t of targets) {
      const ids = [...new Set((t.assignments || []).map((a) => a.userId).filter(Boolean))]
      const hasOffer = t.offerValue != null || t.offerDate != null
      for (const id of ids) {
        const s = byMember[id] || (byMember[id] = { count: 0, offers: 0, assessments: 0 })
        s.count++
        if (hasOffer) s.offers++
        s.assessments += t._count?.assessments || 0
      }
    }

    const rows = members.map((m) => {
      const s = byMember[m.id] || { count: 0, offers: 0, assessments: 0 }
      const util = capacity > 0 ? Math.round((s.count / capacity) * 100) : 0
      return { ...m, ...s, util, state: utilState(util) }
    })

    const covered = targets.filter((t) => (t.assignments || []).length > 0).length
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.util, 0) / rows.length) : 0
    const over = rows.filter((r) => r.util > 100)
    return { rows, covered, avg, over }
  }, [members, targets, capacity])

  const memberById = useMemo(
    () => Object.fromEntries(stats.rows.map((m) => [m.id, m])),
    [stats.rows]
  )

  async function saveBulk() {
    if (!bulk?.userId) {
      toast.error('Bitte ein Mitglied wählen')
      return
    }
    try {
      const res = await api.post('/sprint-targets/team/bulk-assign', {
        role: bulk.role,
        userId: bulk.userId,
      })
      setBulk(null)
      await fetchData()
      toast.success(
        res.updated ? `${res.updated} offene Zuweisung(en) übergeben` : 'Keine offenen Zuweisungen in dieser Rolle'
      )
    } catch (err) {
      toast.error(err.message || 'Fehler beim Zuweisen')
    }
  }

  // Abgeschlossene Zielkunden (Verlust / kein Interesse) sind nicht zuweisbar
  const assignableTargets = targets.filter((t) => !LOST_STATUSES.includes(t.status))
  const visibleTargets = openOnly
    ? assignableTargets.filter((t) => {
        const assignedRoles = new Set((t.assignments || []).map((a) => a.role))
        return requiredRolesFor(t, roles, packageRoles).some((r) => !assignedRoles.has(r.role))
      })
    : assignableTargets

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Team &amp; Zuweisung</h1>
            <p className="text-sm text-gray-500">
              {stats.rows.length} Mitglieder · {stats.covered} betreute Zielkunden · Kapazität {capacity} Kunden je Mitglied
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreating({ name: '', email: '', password: '', portalRoleId: '' })}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700"
        >
          <UserPlus className="w-4 h-4" /> Mitglied anlegen
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-violet-600 text-violet-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Mitglieder</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.rows.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Sprint-Team</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Betreute Zielkunden</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.covered}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.rows.length ? `Ø ${(stats.covered / stats.rows.length).toFixed(1)} je Berater` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Ø Auslastung</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.avg} %</p>
              <p className="text-xs text-gray-400 mt-0.5">Zielkorridor 60–85 %</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Engpass</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.over.length}</p>
              <p className={`text-xs mt-0.5 ${stats.over.length ? 'text-red-500' : 'text-gray-400'}`}>
                {stats.over.length
                  ? stats.over.map((m) => `${m.name} ${m.util} %`).join(', ')
                  : 'Keine Überlastung'}
              </p>
            </div>
          </div>

          {/* Member list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {stats.rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                Keine Benutzer gefunden. Benutzer werden in der Administration verwaltet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Mitglied', 'Rolle', 'Kunden', 'Kapazität', 'Angebote', 'Assessments', 'Auslastung', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.rows.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/sprint-targets/team/${m.id}`)}
                      className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: colorFor(m.id) }}>
                            {initials(m.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500 truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{m.portalRole?.name || m.role || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{m.count}</td>
                      <td className="px-4 py-2.5 text-gray-600">{capacity}</td>
                      <td className="px-4 py-2.5 text-gray-600">{m.offers}</td>
                      <td className="px-4 py-2.5 text-gray-600">{m.assessments}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${m.state.bar}`} style={{ width: `${Math.min(100, m.util)}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${m.state.text}`}>{m.util} %</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.util > 100 ? 'bg-red-50 text-red-700'
                          : m.util >= 85 ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                        }`}>
                          {m.state.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Kapazitäts-Hinweis */}
          <div className={`rounded-xl border p-4 text-sm ${stats.over.length ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
            <div className="flex items-start gap-2">
              {stats.over.length ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
              <div>
                {stats.over.length ? (
                  <>
                    <p className="font-semibold">Engpass: {stats.over.map((m) => `${m.name} (${m.util} %)`).join(', ')}</p>
                    <p className="mt-1">
                      Geringste Auslastung hat{' '}
                      {[...stats.rows].sort((a, b) => a.util - b.util)[0]?.name || '—'}. Öffne das Mitglied und gib eine Zuweisung ab.
                    </p>
                  </>
                ) : (
                  <p className="font-semibold">Alle Berater im Zielkorridor. Keine Zuweisung muss verschoben werden.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'zuweisung' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Kundenzuweisung</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenOnly((v) => !v)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    openOnly ? 'bg-violet-50 border-violet-200 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Nur offene Zuweisungen
                </button>
                <button
                  onClick={() => setBulk({ role: 'lead', userId: members[0]?.id || '' })}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Massenbearbeitung
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Zielkunde', 'Status', 'Priorität', 'Zugewiesenes Team', ''].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTargets.map((t) => {
                    const assignments = t.assignments || []
                    const userIds = [...new Set(assignments.map((a) => a.userId))].filter((uid) => memberById[uid])
                    const reqRoles = requiredRolesFor(t, roles, packageRoles)
                    const filledRoles = reqRoles.filter((r) => assignments.some((a) => a.role === r.role)).length
                    const roleLabelsFor = (uid) =>
                      assignments
                        .filter((a) => a.userId === uid)
                        .map((a) => roles.find((r) => r.key === a.role)?.label || a.role)
                        .join(', ')
                    return (
                      <tr
                        key={t.id}
                        onClick={() => router.push(`/sprint-targets/team/zuweisung/${t.id}`)}
                        className="border-t border-gray-50 hover:bg-gray-50/60 cursor-pointer"
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 truncate max-w-[220px]">{t.companyName}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[220px]">{t.segment}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-gray-700 text-xs">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority] || 'bg-gray-300'}`} />
                            {PRIORITY_LABEL[t.priority] || t.priority || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {userIds.length ? (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-1.5">
                                {userIds.map((uid) => {
                                  const member = memberById[uid]
                                  return (
                                    <div
                                      key={uid}
                                      title={`${member.name}: ${roleLabelsFor(uid)}`}
                                      className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
                                      style={{ backgroundColor: colorFor(member.id) }}
                                    >
                                      {initials(member.name)}
                                    </div>
                                  )
                                })}
                              </div>
                              <span className="text-xs text-gray-500">{filledRoles} / {reqRoles.length} Rollen</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Nicht zugewiesen</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      </tr>
                    )
                  })}
                  {visibleTargets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">
                        {openOnly ? 'Keine offenen Zuweisungen.' : 'Keine Zielkunden vorhanden.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Mitglied anlegen */}
      {creating && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreating(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Mitglied anlegen</h2>
                <button onClick={() => setCreating(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={CLS_LABEL}>Name</label>
                  <input value={creating.name} onChange={(e) => setCreating((p) => ({ ...p, name: e.target.value }))} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>E-Mail</label>
                  <input type="email" value={creating.email} onChange={(e) => setCreating((p) => ({ ...p, email: e.target.value }))} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Rolle</label>
                  <select value={creating.portalRoleId} onChange={(e) => setCreating((p) => ({ ...p, portalRoleId: e.target.value }))} className={CLS_INPUT}>
                    <option value="">— keine Zuordnung —</option>
                    {portalRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Passwort</label>
                  <input type="password" value={creating.password} onChange={(e) => setCreating((p) => ({ ...p, password: e.target.value }))} className={CLS_INPUT} placeholder="mindestens 6 Zeichen" />
                  <p className="text-xs text-gray-400 mt-1">Mitglied kann sich damit anmelden; Passwort später in der Administration ändern.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setCreating(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
                <button onClick={createMember} disabled={creatingBusy} className="px-4 py-2 text-sm text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50">
                  {creatingBusy ? 'Anlegen…' : 'Anlegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Massenbearbeitung */}
      {bulk && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBulk(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Massenbearbeitung</h2>
                <button onClick={() => setBulk(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Alle offenen Zuweisungen einer Rolle in einem Schritt vergeben.</p>
              <div className="space-y-3">
                <div>
                  <label className={CLS_LABEL}>Rolle</label>
                  <select value={bulk.role} onChange={(e) => setBulk((p) => ({ ...p, role: e.target.value }))} className={CLS_INPUT}>
                    {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Mitglied</label>
                  <select value={bulk.userId} onChange={(e) => setBulk((p) => ({ ...p, userId: e.target.value }))} className={CLS_INPUT}>
                    <option value="">— bitte wählen —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setBulk(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
                <button onClick={saveBulk} className="px-4 py-2 text-sm text-white bg-violet-600 rounded-md hover:bg-violet-700">Übergeben</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

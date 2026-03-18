'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Briefcase, UserCheck, Loader2,
  Plus, X, Building2, Shield, ChevronDown, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { getUser } from '@/lib/auth'

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Active:    'bg-green-100 text-green-700',
  Completed: 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-red-100 text-red-700',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}

// ─── CC Badge ─────────────────────────────────────────────────────────────────
function CCBadge({ name }) {
  if (!name) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
      <Building2 className="w-3 h-3" />
      {name}
    </span>
  )
}

// ─── Create Team Modal ─────────────────────────────────────────────────────────
function CreateTeamModal({ ccs, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', competenceCenterId: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      await api.post('/teams', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        competenceCenterId: form.competenceCenterId || undefined,
      })
      toast.success('Team erstellt')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Neues Team erstellen</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Projektteam Alpha"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beschreibung</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          {ccs && ccs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Competence Center</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                value={form.competenceCenterId}
                onChange={(e) => setForm({ ...form, competenceCenterId: e.target.value })}
              >
                <option value="">— Kein CC —</option>
                {ccs.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Team erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Member Dropdown ───────────────────────────────────────────────────────
function AddMemberDropdown({ teamId, subordinates, currentMembers, onAdded }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(null)

  const currentMemberIds = new Set(currentMembers.map((m) => m.user.id))
  const available = subordinates.filter((s) => !currentMemberIds.has(s.id))

  if (available.length === 0) return (
    <span className="text-xs text-slate-400 italic">Alle Mitarbeiter bereits im Team</span>
  )

  async function addMember(userId, name) {
    setAdding(userId)
    try {
      await api.post(`/teams/${teamId}/members`, { userId })
      toast.success(`${name} hinzugefügt`)
      onAdded()
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setAdding(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Mitarbeiter hinzufügen
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-52 max-h-56 overflow-y-auto">
            {available.map((s) => (
              <button
                key={s.id}
                onClick={() => addMember(s.id, s.name)}
                disabled={adding === s.id}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-blue-50 text-left text-sm transition-colors"
              >
                {adding === s.id
                  ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  : <Avatar name={s.name} size="sm" />
                }
                <span className="text-slate-800">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Assign to Project Modal (for managers) ────────────────────────────────────
function AssignProjectModal({ subordinate, onClose, onAssigned }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    api.get('/projects').then(setProjects).catch(() => setProjects([])).finally(() => setLoading(false))
  }, [])

  async function assign(projectId, projectName) {
    setSaving(projectId)
    try {
      await api.post('/teams/assign-project', { userId: subordinate.id, projectId })
      toast.success(`${subordinate.name} wurde "${projectName}" zugeordnet`)
      onAssigned()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Projekt zuordnen</h2>
            <p className="text-sm text-slate-500">{subordinate.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}
          {!loading && projects.length === 0 && (
            <p className="text-center text-slate-400 py-8">Keine Projekte verfügbar</p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => assign(p.id, p.name)}
              disabled={saving === p.id}
              className="flex items-center justify-between w-full p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
            >
              <div>
                <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                <p className="text-xs text-slate-500">{p.account?.companyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                {saving === p.id
                  ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  : <Plus className="w-4 h-4 text-slate-400" />
                }
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MeinBereichPage() {
  const currentUser = getUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(null)
  const [createTeamModal, setCreateTeamModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const overview = await api.get('/teams/overview')
      setData(overview)
    } catch (err) {
      toast.error('Daten konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function removeMember(teamId, userId, userName) {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      toast.success(`${userName} entfernt`)
      load()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Entfernen')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!data) return null

  const { user, teams, projects, subordinates, ledTeams = [], ccs = [] } = data
  const isManager = subordinates && subordinates.length > 0

  // Merge led teams into "Meine Teams" (deduplicate by id)
  const memberTeamIds = new Set(teams.map((t) => t.id))
  const allMyTeams = [
    ...teams,
    ...ledTeams
      .filter((t) => !memberTeamIds.has(t.id))
      .map((t) => ({ ...t, leader: user })), // current user is the leader
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {assignModal && (
        <AssignProjectModal
          subordinate={assignModal}
          onClose={() => setAssignModal(null)}
          onAssigned={load}
        />
      )}
      {createTeamModal && (
        <CreateTeamModal
          ccs={ccs}
          onClose={() => setCreateTeamModal(false)}
          onCreated={load}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mein Bereich</h1>
          <p className="text-slate-500 text-sm mt-1">Übersicht über Ihre Teams, Projekte und Mitarbeiter</p>
        </div>
        {isManager && (
          <button
            onClick={() => setCreateTeamModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Team erstellen
          </button>
        )}
      </div>

      {/* Manager card */}
      {user?.manager && (
        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <UserCheck className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Ihr Vorgesetzter</p>
            <div className="flex items-center gap-2 mt-1">
              <Avatar name={user.manager.name} size="sm" />
              <span className="font-semibold text-slate-900">{user.manager.name}</span>
              <span className="text-slate-400 text-sm">{user.manager.email}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Teams (as member) */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Meine Teams</h2>
            <span className="ml-auto text-xs text-slate-400">{allMyTeams.length} Team{allMyTeams.length !== 1 ? 's' : ''}</span>
          </div>

          {allMyTeams.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">Kein Team zugewiesen</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {allMyTeams.map((team) => {
                const others = team.members?.filter((m) => m.user.id !== currentUser?.id) || []
                return (
                  <div key={team.id} className="px-5 py-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{team.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {team.competenceCenter && <CCBadge name={team.competenceCenter.name} />}
                          {team.leader && (
                            <span className="text-xs text-slate-500">
                              Lead: <span className="font-medium text-slate-700">{team.leader.name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {others.length === 0 ? (
                      <p className="text-xs text-slate-400">Keine weiteren Mitglieder</p>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {others.map((m) => (
                          <div key={m.user.id} className="flex items-center gap-3">
                            <Avatar name={m.user.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{m.user.name}</p>
                              <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* My Projects */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Briefcase className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-slate-900">Meine Projekte</h2>
            <span className="ml-auto text-xs text-slate-400">{projects.length} Projekt{projects.length !== 1 ? 'e' : ''}</span>
          </div>

          {projects.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">Keinem Projekt zugewiesen</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      {p.account && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <p className="text-xs text-slate-500 truncate">{p.account.companyName}</p>
                        </div>
                      )}
                      {p.memberRole && (
                        <p className="text-xs text-slate-400 mt-0.5">Rolle: {p.memberRole}</p>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.leadConsultant && (
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar name={p.leadConsultant.name} size="sm" />
                      <span className="text-xs text-slate-500">Lead: {p.leadConsultant.name}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Teams I lead */}
      {ledTeams.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Shield className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-slate-900">Teams als Leiter</h2>
            <span className="ml-auto text-xs text-slate-400">{ledTeams.length} Team{ledTeams.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {ledTeams.map((team) => (
              <div key={team.id} className="px-5 py-4">
                <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-800">{team.name}</p>
                    {team.competenceCenter && (
                      <div className="mt-1">
                        <CCBadge name={team.competenceCenter.name} />
                      </div>
                    )}
                  </div>
                  {isManager && subordinates.length > 0 && (
                    <AddMemberDropdown
                      teamId={team.id}
                      subordinates={subordinates}
                      currentMembers={team.members || []}
                      onAdded={load}
                    />
                  )}
                </div>

                {team.members && team.members.length === 0 ? (
                  <p className="text-xs text-slate-400">Noch keine Mitglieder</p>
                ) : (
                  <div className="space-y-2">
                    {(team.members || []).map((m) => (
                      <div key={m.user.id} className="flex items-center gap-3 group">
                        <Avatar name={m.user.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{m.user.name}</p>
                          <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setAssignModal(m.user)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Projekt zuordnen"
                          >
                            <Briefcase className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeMember(team.id, m.user.id, m.user.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Mitglied entfernen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manager: subordinates section */}
      {isManager && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <UserCheck className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-slate-900">Vorgesetzer von</h2>
            <span className="ml-auto text-xs text-slate-400">{subordinates.length} Mitarbeiter</span>
          </div>

          <div className="divide-y divide-slate-100">
            {subordinates.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar name={sub.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{sub.name}</p>
                    <p className="text-sm text-slate-500">{sub.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sub.teamMemberships?.map((tm) => (
                        <span key={tm.team.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {tm.team.name}
                        </span>
                      ))}
                      {sub.projectMembers?.map((pm) => (
                        <span key={pm.project.id} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          {pm.project.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAssignModal(sub)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 shrink-0 ml-4"
                >
                  <Briefcase className="w-4 h-4" />
                  Projekt
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

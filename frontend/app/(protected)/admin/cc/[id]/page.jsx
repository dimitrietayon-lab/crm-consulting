'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, Edit2, Trash2, Plus, X, Loader2, Save,
  Users, UserCheck, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { getUser } from '@/lib/auth'

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}

// ─── CC Edit Modal ─────────────────────────────────────────────────────────────
function CCEditModal({ cc, allUsers, onClose, onSaved }) {
  const [form, setForm] = useState({ name: cc.name, description: cc.description || '', headId: cc.headId || '' })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      await api.put(`/admin/ccs/${cc.id}`, form)
      toast.success('CC aktualisiert')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Competence Center bearbeiten</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Beschreibung</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">CC-Leiter</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.headId}
              onChange={(e) => setForm({ ...form, headId: e.target.value })}
            >
              <option value="">— kein Leiter —</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Team Form Modal (create/edit) ────────────────────────────────────────────
function TeamFormModal({ team, ccId, allUsers, onClose, onSaved }) {
  const isEdit = !!team
  const [form, setForm] = useState({
    name: team?.name || '',
    description: team?.description || '',
    leaderId: team?.leaderId || '',
  })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/teams/${team.id}`, { ...form, competenceCenterId: ccId })
        toast.success('Team aktualisiert')
      } else {
        await api.post('/teams', { ...form, competenceCenterId: ccId })
        toast.success('Team erstellt')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Team bearbeiten' : 'Neues Team'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Beschreibung</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Team-Leiter</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.leaderId}
              onChange={(e) => setForm({ ...form, leaderId: e.target.value })}
            >
              <option value="">— kein Leiter —</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CCDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [cc, setCC] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editCC, setEditCC] = useState(false)
  const [teamModal, setTeamModal] = useState(null) // null | 'create' | team-object
  const [addingMemberTo, setAddingMemberTo] = useState(null)
  const [addUserId, setAddUserId] = useState('')
  const user = getUser()

  const load = useCallback(async () => {
    try {
      const [ccData, usersData] = await Promise.all([
        api.get(`/admin/ccs/${id}`),
        api.get('/admin/users'),
      ])
      setCC(ccData)
      setAllUsers(usersData)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function deleteTeam(teamId, teamName) {
    if (!confirm(`Team "${teamName}" wirklich löschen?`)) return
    try {
      await api.delete(`/teams/${teamId}`)
      toast.success('Team gelöscht')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function addMember(teamId) {
    if (!addUserId) return toast.error('Bitte Mitarbeiter auswählen')
    try {
      await api.post(`/teams/${teamId}/members`, { userId: addUserId })
      toast.success('Mitglied hinzugefügt')
      setAddingMemberTo(null)
      setAddUserId('')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function removeMember(teamId, userId, userName) {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      toast.success(`${userName} entfernt`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500">Kein Zugriff</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!cc) return <div className="p-6 text-slate-400">CC nicht gefunden</div>

  const totalMembers = cc.teams?.reduce((sum, t) => sum + (t.members?.length || 0), 0) || 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {editCC && (
        <CCEditModal cc={cc} allUsers={allUsers} onClose={() => setEditCC(false)} onSaved={load} />
      )}
      {teamModal && (
        <TeamFormModal
          team={teamModal === 'create' ? null : teamModal}
          ccId={cc.id}
          allUsers={allUsers}
          onClose={() => setTeamModal(null)}
          onSaved={load}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Administration
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 font-medium">{cc.name}</span>
      </div>

      {/* CC Header Card */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{cc.name}</h1>
              {cc.description && <p className="text-slate-600 mt-1 text-sm">{cc.description}</p>}
              {cc.head ? (
                <div className="flex items-center gap-2 mt-2">
                  <UserCheck className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-slate-600">
                    Leiter: <span className="font-semibold">{cc.head.name}</span>
                  </span>
                  <span className="text-xs text-slate-400">{cc.head.email}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-2 italic">Kein Leiter zugewiesen</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditCC(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors shrink-0"
          >
            <Edit2 className="w-4 h-4" />
            Bearbeiten
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-orange-200 flex items-center gap-6 text-sm text-slate-500">
          <span><strong className="text-slate-700">{cc.teams?.length || 0}</strong> Teams</span>
          <span><strong className="text-slate-700">{totalMembers}</strong> Mitglieder gesamt</span>
        </div>
      </div>

      {/* Teams Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
        <button
          onClick={() => setTeamModal('create')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Team
        </button>
      </div>

      {cc.teams?.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Noch keine Teams</p>
          <p className="text-slate-400 text-sm mb-4">Erstellen Sie das erste Team für dieses CC</p>
          <button
            onClick={() => setTeamModal('create')}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + Team erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cc.teams?.map((team) => {
            const memberIds = new Set(team.members?.map((m) => m.user.id) || [])
            const available = allUsers.filter((u) => !memberIds.has(u.id))
            return (
              <div key={team.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Team header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-slate-900">{team.name}</h3>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                        {team.members?.length || 0} Mitglieder
                      </span>
                    </div>
                    {team.description && (
                      <p className="text-xs text-slate-500 mt-0.5 ml-6">{team.description}</p>
                    )}
                    {team.leader && (
                      <p className="text-xs text-slate-400 mt-0.5 ml-6">
                        Leiter: <span className="font-medium text-slate-600">{team.leader.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTeamModal(team)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Team bearbeiten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTeam(team.id, team.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Team löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Members */}
                <div className="p-5">
                  {team.members?.length === 0 ? (
                    <p className="text-sm text-slate-400 italic mb-3">Keine Mitglieder</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {team.members?.map((m) => (
                        <div key={m.user.id} className="flex items-center gap-3 group">
                          <Avatar name={m.user.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{m.user.name}</p>
                            <p className="text-xs text-slate-400">{m.user.email}</p>
                          </div>
                          <button
                            onClick={() => removeMember(team.id, m.user.id, m.user.name)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Mitglied entfernen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member row */}
                  {addingMemberTo === team.id ? (
                    <div className="flex gap-2 mt-2">
                      <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Mitarbeiter auswählen…</option>
                        {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <button
                        onClick={() => addMember(team.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                      >
                        Hinzufügen
                      </button>
                      <button
                        onClick={() => { setAddingMemberTo(null); setAddUserId('') }}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingMemberTo(team.id); setAddUserId('') }}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Mitarbeiter hinzufügen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

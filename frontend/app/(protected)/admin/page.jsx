'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Shield, Grid, Plus, Edit2, Trash2, Check, X, Loader2, Save, ChevronDown, ChevronRight, UsersRound, Building, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { getUser } from '@/lib/auth'

const TABS = [
  { key: 'users',   label: 'Benutzer',       icon: Users },
  { key: 'depts',   label: 'Competence Center', icon: Building },
  { key: 'teams',   label: 'Teams',           icon: UsersRound },
  { key: 'roles',   label: 'Rollen',          icon: Shield },
  { key: 'matrix',  label: 'Berechtigungen',  icon: Grid },
]

const EMPTY_USER_FORM = { name: '', email: '', password: '', role: 'consultant', portalRoleId: '', managerId: '' }

// ─── User Form Modal ────────────────────────────────────────────────────────────
function UserFormModal({ editUser, roles, allUsers, onClose, onSaved, ccs = [] }) {
  const isEdit = !!editUser
  const [form, setForm] = useState(
    isEdit
      ? { name: editUser.name, email: editUser.email, password: '', role: editUser.role, portalRoleId: editUser.portalRoleId || '', managerId: editUser.managerId || '', competenceCenterId: editUser.competenceCenterId || '' }
      : { ...EMPTY_USER_FORM, competenceCenterId: '' }
  )
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name und E-Mail erforderlich')
    if (!isEdit && !form.password.trim()) return toast.error('Passwort erforderlich')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        role: form.role,
        portalRoleId: form.portalRoleId || null,
        managerId: form.managerId || null,
        competenceCenterId: form.competenceCenterId || null,
        ...(form.password.trim() && { password: form.password }),
      }
      if (!isEdit) {
        payload.email = form.email
        await api.post('/admin/users', payload)
        toast.success('Mitarbeiter erstellt')
      } else {
        await api.put(`/admin/users/${editUser.id}`, payload)
        toast.success('Mitarbeiter aktualisiert')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Filter out the user being edited from manager dropdown
  const managerOptions = allUsers.filter((u) => !isEdit || u.id !== editUser.id)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
              <input
                required value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Max Mustermann"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">E-Mail *</label>
              <input
                required type="email" value={form.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={isEdit}
                placeholder="max@firma.de"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Passwort {isEdit && <span className="text-slate-400">(leer lassen = unverändert)</span>}
            </label>
            <input
              type="password" value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={isEdit ? '••••••••' : 'Mindestens 6 Zeichen'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">System-Rolle</label>
              <select
                value={form.role} onChange={(e) => set('role', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Portal-Rolle</label>
              <select
                value={form.portalRoleId} onChange={(e) => set('portalRoleId', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— keine Rolle —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Competence Center</label>
            <select
              value={form.competenceCenterId}
              onChange={(e) => set('competenceCenterId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— kein CC —</option>
              {ccs.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Vorgesetzter</label>
            <select
              value={form.managerId} onChange={(e) => set('managerId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— kein Vorgesetzter (Geschäftsführer) —</option>
              {managerOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Speichern' : 'Erstellen'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ roles, ccs = [] }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | user-object

  const load = useCallback(async () => {
    setLoading(true)
    try { setUsers(await api.get('/admin/users')) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteUser(u) {
    if (!confirm(`Mitarbeiter "${u.name}" wirklich löschen?`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      toast.success('Mitarbeiter gelöscht')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>

  return (
    <div>
      {modal && (
        <UserFormModal
          editUser={modal === 'create' ? null : modal}
          roles={roles}
          allUsers={users}
          ccs={ccs}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Mitarbeiter ({users.length})</h3>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neuer Mitarbeiter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Vorgesetzter</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">System-Rolle</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Portal-Rolle</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {u.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {u.manager
                    ? <span className="text-sm text-slate-700">{u.manager.name}</span>
                    : <span className="text-xs text-slate-400">Geschäftsführer</span>
                  }
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 capitalize">
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {u.portalRole ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                      {u.portalRole.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">— keine —</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setModal(u)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="Bearbeiten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Teams Tab ─────────────────────────────────────────────────────────────────
function TeamsTab({ allUsers, ccs }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTeam, setEditTeam] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', leaderId: '', competenceCenterId: '' })
  const [saving, setSaving] = useState(false)
  const [addingTo, setAddingTo] = useState(null) // teamId
  const [addUserId, setAddUserId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setTeams(await api.get('/teams')) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditTeam(null)
    setForm({ name: '', description: '', leaderId: '', competenceCenterId: '' })
    setShowForm(true)
  }

  function openEdit(team) {
    setEditTeam(team)
    setForm({ name: team.name, description: team.description || '', leaderId: team.leaderId || '', competenceCenterId: team.competenceCenterId || '' })
    setShowForm(true)
  }

  async function saveTeam() {
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      if (editTeam) {
        await api.put(`/teams/${editTeam.id}`, form)
        toast.success('Team aktualisiert')
      } else {
        await api.post('/teams', form)
        toast.success('Team erstellt')
      }
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTeam(id) {
    if (!confirm('Team wirklich löschen?')) return
    try {
      await api.delete(`/teams/${id}`)
      toast.success('Team gelöscht')
      load()
    } catch (err) { toast.error(err.message) }
  }

  async function addMember(teamId) {
    if (!addUserId) return toast.error('Bitte Mitarbeiter auswählen')
    try {
      await api.post(`/teams/${teamId}/members`, { userId: addUserId })
      toast.success('Mitglied hinzugefügt')
      setAddingTo(null)
      setAddUserId('')
      load()
    } catch (err) { toast.error(err.message) }
  }

  async function removeMember(teamId, userId) {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      toast.success('Mitglied entfernt')
      load()
    } catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Teams ({teams.length})</h3>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Neues Team
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-800 mb-3">{editTeam ? 'Team bearbeiten' : 'Neues Team'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="z.B. Banken-Team" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Beschreibung</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Competence Center</label>
              <select value={form.competenceCenterId} onChange={(e) => setForm({ ...form, competenceCenterId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— kein CC —</option>
                {ccs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Team-Leiter</label>
              <select value={form.leaderId} onChange={(e) => setForm({ ...form, leaderId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— kein Leiter —</option>
                {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveTeam} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Abbrechen</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {teams.map((team) => {
          const memberIds = new Set(team.members?.map((m) => m.user.id) || [])
          const available = allUsers.filter((u) => !memberIds.has(u.id))
          return (
            <div key={team.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Team header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{team.name}</p>
                    {team.competenceCenter && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {team.competenceCenter.name}
                      </span>
                    )}
                  </div>
                  {team.description && <p className="text-xs text-slate-500">{team.description}</p>}
                  {team.leader && <p className="text-xs text-slate-400 mt-0.5">Leiter: {team.leader.name}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(team)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTeam(team.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="p-4">
                {team.members?.length === 0 && <p className="text-sm text-slate-400 mb-3">Keine Mitglieder</p>}
                <div className="flex flex-wrap gap-2 mb-3">
                  {team.members?.map((m) => (
                    <div key={m.user.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {m.user.name?.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-slate-700">{m.user.name}</span>
                      <button onClick={() => removeMember(team.id, m.user.id)} className="text-slate-300 hover:text-red-500 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add member */}
                {addingTo === team.id ? (
                  <div className="flex gap-2">
                    <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Mitarbeiter auswählen…</option>
                      {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button onClick={() => addMember(team.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      Hinzufügen
                    </button>
                    <button onClick={() => { setAddingTo(null); setAddUserId('') }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(team.id); setAddUserId('') }}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
                    <Plus className="w-4 h-4" /> Mitarbeiter hinzufügen
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Departments Tab ──────────────────────────────────────────────────────────
function CCTab({ allUsers, onCCsChange }) {
  const router = useRouter()
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDept, setEditDept] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', headId: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/ccs')
      setDepts(data)
      onCCsChange?.(data)
    } finally { setLoading(false) }
  }, [onCCsChange])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditDept(null); setForm({ name: '', description: '', headId: '' }); setShowForm(true) }
  function openEdit(d) { setEditDept(d); setForm({ name: d.name, description: d.description || '', headId: d.headId || '' }); setShowForm(true) }

  async function save() {
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      if (editDept) {
        await api.put(`/admin/ccs/${editDept.id}`, form)
        toast.success('CC aktualisiert')
      } else {
        await api.post('/admin/ccs', form)
        toast.success('CC erstellt')
      }
      setShowForm(false)
      load()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Competence Center wirklich löschen? Teams werden dabei nicht gelöscht.')) return
    try { await api.delete(`/admin/ccs/${id}`); toast.success('CC gelöscht'); load() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Competence Centers ({depts.length})</h3>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Neues CC
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <h4 className="font-medium text-orange-800 mb-3">{editDept ? 'CC bearbeiten' : 'Neues CC'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="z.B. IT & Beratung" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Beschreibung</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CC-Leiter</label>
              <select value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">— kein Leiter —</option>
                {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Abbrechen</button>
          </div>
        </div>
      )}

      {depts.length === 0 && !showForm && (
        <p className="text-center text-slate-400 py-10">Noch keine Competence Centers angelegt</p>
      )}

      <div className="space-y-4">
        {depts.map((d) => (
          <div key={d.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50">
              <div>
                <p className="font-semibold text-slate-900">{d.name}</p>
                {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                {d.head && <p className="text-xs text-slate-400 mt-0.5">Leiter: <span className="font-medium">{d.head.name}</span></p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{d.teams?.length || 0} Teams</span>
                <button
                  onClick={() => router.push(`/admin/cc/${d.id}`)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                  title="Details öffnen"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Details
                </button>
                <button onClick={() => openEdit(d)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-orange-100 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => del(d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {d.teams && d.teams.length > 0 && (
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {d.teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-700">
                    <UsersRound className="w-3.5 h-3.5 text-slate-400" />
                    {t.name}
                    <span className="text-xs text-slate-400 ml-0.5">({t.members?.length || 0})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Roles Tab ─────────────────────────────────────────────────────────────────
function RolesTab({ roles, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim()) return toast.error('Name erforderlich')
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/admin/roles/${editId}`, form)
        toast.success('Rolle aktualisiert')
      } else {
        await api.post('/admin/roles', form)
        toast.success('Rolle erstellt')
      }
      setShowForm(false)
      setEditId(null)
      setForm({ name: '', description: '' })
      onRefresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRole(id) {
    if (!confirm('Rolle wirklich löschen?')) return
    try {
      await api.delete(`/admin/roles/${id}`)
      toast.success('Rolle gelöscht')
      onRefresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function startEdit(role) {
    setEditId(role.id)
    setForm({ name: role.name, description: role.description || '' })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Rollen ({roles.length})</h3>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', description: '' }) }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neue Rolle
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-800 mb-3">{editId ? 'Rolle bearbeiten' : 'Neue Rolle'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Finance Manager"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Beschreibung</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{role.name}</p>
                {role.isSystem && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">System</span>
                )}
              </div>
              {role.description && <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>}
              <p className="text-xs text-slate-400 mt-1">
                {role._count?.users || 0} Benutzer · {role._count?.permissions || 0} Berechtigungen
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(role)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <Edit2 className="w-4 h-4" />
              </button>
              {!role.isSystem && (
                <button onClick={() => deleteRole(role.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Permission Matrix Tab ─────────────────────────────────────────────────────
function MatrixTab({ roles }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [modules, setModules] = useState([])
  const [permMap, setPermMap] = useState({})
  const [expanded, setExpanded] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadPerms(roleId) {
    setLoading(true)
    try {
      const data = await api.get(`/admin/roles/${roleId}/permissions`)
      setModules(data.modules)
      setPermMap(data.permMap)
      // Expand all modules
      const exp = {}
      data.modules.forEach((m) => { exp[m.id] = true })
      setExpanded(exp)
      setDirty(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function selectRole(role) {
    setSelectedRole(role)
    loadPerms(role.id)
  }

  function toggle(featureId, field) {
    setPermMap((prev) => {
      const cur = prev[featureId] || { canView: false, canCreate: false, canEdit: false, canDelete: false }
      const next = { ...cur, [field]: !cur[field] }
      // If canView is unchecked, remove all other perms
      if (field === 'canView' && !next.canView) {
        next.canCreate = false; next.canEdit = false; next.canDelete = false
      }
      return { ...prev, [featureId]: next }
    })
    setDirty(true)
  }

  async function saveMatrix() {
    setSaving(true)
    try {
      const permissions = []
      modules.forEach((mod) => {
        mod.features.forEach((feat) => {
          const p = permMap[feat.id] || {}
          if (p.canView || p.canCreate || p.canEdit || p.canDelete || p.canApprove) {
            permissions.push({ featureId: feat.id, ...p })
          }
        })
      })
      await api.put(`/admin/roles/${selectedRole.id}/permissions`, { permissions })
      toast.success('Berechtigungen gespeichert')
      setDirty(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const PERMS = [
    { key: 'canView',   label: 'Lesen' },
    { key: 'canCreate', label: 'Erstellen' },
    { key: 'canEdit',   label: 'Bearbeiten' },
    { key: 'canDelete', label: 'Löschen' },
  ]

  return (
    <div>
      {/* Role selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-slate-600 block mb-2">Rolle auswählen</label>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRole(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedRole?.id === r.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {!selectedRole && (
        <div className="text-center py-12 text-slate-400">Bitte eine Rolle auswählen</div>
      )}

      {selectedRole && loading && (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      )}

      {selectedRole && !loading && (
        <>
          {/* Save button */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">Berechtigungen für: {selectedRole.name}</h3>
            {dirty && (
              <button
                onClick={saveMatrix}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            )}
          </div>

          {/* Matrix */}
          <div className="space-y-3">
            {modules.map((mod) => {
              const isApprovalModule = mod.key === 'genehmigungen'
              return (
              <div key={mod.id} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Module header */}
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [mod.id]: !p[mod.id] }))}
                  className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 hover:bg-slate-100"
                >
                  <span className="font-semibold text-slate-800">{mod.name}</span>
                  {expanded[mod.id]
                    ? <ChevronDown className="w-4 h-4 text-slate-500" />
                    : <ChevronRight className="w-4 h-4 text-slate-500" />
                  }
                </button>

                {expanded[mod.id] && (
                  <div className="divide-y divide-slate-100">
                    {isApprovalModule ? (
                      <>
                        {/* Header row — approval module */}
                        <div className="grid grid-cols-2 px-4 py-2 bg-white text-xs font-medium text-slate-500">
                          <div>Antragsart</div>
                          <div className="text-center">Genehmigen</div>
                        </div>
                        {mod.features.map((feat) => {
                          const p = permMap[feat.id] || {}
                          return (
                            <div key={feat.id} className="grid grid-cols-2 px-4 py-2.5 hover:bg-slate-50 items-center">
                              <div className="text-sm font-medium text-slate-700">{feat.name}</div>
                              <div className="flex justify-center">
                                <button
                                  onClick={() => toggle(feat.id, 'canApprove')}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                    p.canApprove
                                      ? 'bg-green-600 text-white'
                                      : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  {p.canApprove ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <>
                        {/* Header row — standard module */}
                        <div className="grid grid-cols-5 px-4 py-2 bg-white text-xs font-medium text-slate-500">
                          <div className="col-span-1">Funktion</div>
                          {PERMS.map((p) => (
                            <div key={p.key} className="text-center">{p.label}</div>
                          ))}
                        </div>
                        {mod.features.map((feat) => {
                          const p = permMap[feat.id] || {}
                          return (
                            <div key={feat.id} className="grid grid-cols-5 px-4 py-2.5 hover:bg-slate-50 items-center">
                              <div className="text-sm font-medium text-slate-700">{feat.name}</div>
                              {PERMS.map(({ key }) => (
                                <div key={key} className="flex justify-center">
                                  <button
                                    onClick={() => toggle(feat.id, key)}
                                    disabled={key !== 'canView' && !p.canView}
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                      p[key]
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                                  >
                                    {p[key] ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const [roles, setRoles] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [ccs, setCcs] = useState([])
  const user = getUser()

  const loadRoles = useCallback(async () => {
    try { setRoles(await api.get('/admin/roles')) } catch {}
  }, [])

  const loadUsers = useCallback(async () => {
    try { setAllUsers(await api.get('/admin/users')) } catch {}
  }, [])

  useEffect(() => { loadRoles(); loadUsers() }, [loadRoles, loadUsers])

  // Only allow admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center p-8">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600">Kein Zugriff</h2>
        <p className="text-slate-400 mt-2">Diese Seite ist nur für Administratoren zugänglich.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
        <p className="text-slate-500 text-sm mt-1">Benutzer, Rollen und Berechtigungen verwalten</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === key
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px bg-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {tab === 'users'  && <UsersTab roles={roles} ccs={ccs} />}
        {tab === 'depts'  && <CCTab allUsers={allUsers} onCCsChange={setCcs} />}
        {tab === 'teams'  && <TeamsTab allUsers={allUsers} ccs={ccs} />}
        {tab === 'roles'  && <RolesTab roles={roles} onRefresh={loadRoles} />}
        {tab === 'matrix' && <MatrixTab roles={roles} />}
      </div>
    </div>
  )
}

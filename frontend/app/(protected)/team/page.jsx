'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, X, Trash2, Search, Briefcase, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getInitials } from '@/lib/utils'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const PROJECT_STATUSES = ['Offer', 'Active', 'On Hold', 'Completed', 'Lost']

const STATUS_STYLES = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Offer: 'bg-blue-100 text-blue-700 border-blue-200',
  'On Hold': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#ca8a04', '#dc2626']
function colorFor(value) {
  const s = String(value || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status || '—'}
    </span>
  )
}

// Team-Zuweisung für bestehende Kundenprojekte (gewonnene Kunden).
// Die Mitglieder werden je Projekt über /api/projects/:id/members verwaltet.
export default function TeamPage() {
  const router = useRouter()
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [addForm, setAddForm] = useState({ userId: '', role: '' })
  const [saving, setSaving] = useState(false)

  const loadProjects = useCallback(async () => {
    try {
      const rows = await api.get('/projects')
      setProjects(Array.isArray(rows) ? rows : [])
    } catch {
      toast.error('Projekte konnten nicht geladen werden')
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [, u] = await Promise.all([
          loadProjects(),
          api.get('/users').catch(() => []),
        ])
        if (active) setUsers(Array.isArray(u) ? u : [])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [loadProjects])

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) || null,
    [projects, selectedId]
  )

  const stats = useMemo(() => {
    const assignedIds = new Set()
    for (const p of projects) {
      for (const m of p.members || []) {
        const uid = m.userId || m.user?.id
        if (uid) assignedIds.add(uid)
      }
    }
    const withoutTeam = projects.filter((p) => (p.members || []).length === 0).length
    return { total: projects.length, members: assignedIds.size, withoutTeam }
  }, [projects])

  const visibleProjects = useMemo(() => {
    const term = q.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (!term) return true
      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.account?.companyName || '').toLowerCase().includes(term)
      )
    })
  }, [projects, q, statusFilter])

  function openManage(project) {
    setSelectedId(project.id)
    setAddForm({ userId: '', role: '' })
  }

  function closeManage() {
    setSelectedId(null)
    setAddForm({ userId: '', role: '' })
  }

  async function addMember(e) {
    e.preventDefault()
    if (!selected) return
    if (!addForm.userId) {
      toast.error('Bitte ein Teammitglied wählen')
      return
    }
    setSaving(true)
    try {
      await api.post(`/projects/${selected.id}/members`, {
        userId: addForm.userId,
        role: addForm.role.trim() || null,
      })
      await loadProjects()
      setAddForm({ userId: '', role: '' })
      toast.success('Teammitglied zugewiesen')
    } catch (err) {
      toast.error(err.message || 'Zuweisung fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(userId) {
    if (!selected) return
    if (!window.confirm('Teammitglied aus diesem Projekt entfernen?')) return
    try {
      await api.delete(`/projects/${selected.id}/members/${userId}`)
      await loadProjects()
      toast.success('Teammitglied entfernt')
    } catch (err) {
      toast.error(err.message || 'Entfernen fehlgeschlagen')
    }
  }

  const assignedUserIds = new Set((selected?.members || []).map((m) => m.userId || m.user?.id))
  const assignableUsers = users.filter((u) => !assignedUserIds.has(u.id))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 group-data-[collapsed=true]/sidebar:max-w-none">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-1">
          Teammitglieder bestehenden Kundenprojekten zuordnen.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Projekte</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bestehende Kunden</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Zugewiesene Mitglieder</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.members}</p>
          <p className="text-xs text-gray-400 mt-0.5">Eindeutige Personen in Projekten</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Projekte ohne Team</p>
          <p className={`text-2xl font-bold mt-1 ${stats.withoutTeam ? 'text-amber-600' : 'text-gray-900'}`}>{stats.withoutTeam}</p>
          <p className="text-xs text-gray-400 mt-0.5">Noch keine Zuweisung</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Projekt oder Kunde suchen…"
            className={`${CLS_INPUT} pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${CLS_INPUT} w-auto`}>
          <option value="">Alle Status</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Projektliste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            {projects.length === 0 ? 'Noch keine Kundenprojekte vorhanden.' : 'Keine Projekte für den Filter.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-2.5">Projekt</th>
                <th className="px-4 py-2.5">Kunde</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-4 py-2.5 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((p) => {
                const members = p.members || []
                const unique = [...new Set(members.map((m) => m.userId || m.user?.id))].filter(Boolean)
                return (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="font-medium text-gray-900 text-left hover:text-blue-700"
                      >
                        {p.name}
                      </button>
                      {p.projectType && <p className="text-xs text-gray-400">{p.projectType}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{p.account?.companyName || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5">
                      {unique.length ? (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {unique.slice(0, 5).map((uid) => {
                              const member = members.find((m) => (m.userId || m.user?.id) === uid)
                              const name = member?.user?.name || '—'
                              return (
                                <div
                                  key={uid}
                                  title={name}
                                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{ backgroundColor: colorFor(uid) }}
                                >
                                  {getInitials(name)}
                                </div>
                              )
                            })}
                          </div>
                          <span className="text-xs text-gray-500">{unique.length}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Nicht zugewiesen</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openManage(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
                      >
                        <Users className="w-3.5 h-3.5" /> Team verwalten
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Team verwalten */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeManage} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{selected.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <Briefcase className="w-3 h-3" /> {selected.account?.companyName || 'Kein Kunde'}
                  </p>
                </div>
                <button type="button" onClick={closeManage} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Aktuelles Team */}
              <div>
                <p className={CLS_LABEL}>Projektteam ({selected.members?.length || 0})</p>
                {(selected.members?.length || 0) === 0 ? (
                  <p className="text-sm text-gray-400 py-3">Noch keine Teammitglieder zugewiesen.</p>
                ) : (
                  <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg">
                    {selected.members.map((m) => {
                      const uid = m.userId || m.user?.id
                      const name = m.user?.name || 'Unbekannt'
                      return (
                        <div key={m.id || uid} className="flex items-center gap-2.5 px-3 py-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: colorFor(uid) }}
                          >
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                            <p className="text-xs text-gray-500 truncate">{m.role || 'ohne Rolle'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMember(uid)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Entfernen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Mitglied hinzufügen */}
              <form onSubmit={addMember} className="space-y-3 pt-1 border-t border-gray-100">
                <p className={`${CLS_LABEL} pt-2`}>Mitglied hinzufügen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={CLS_LABEL}>Person *</label>
                    <select
                      value={addForm.userId}
                      onChange={(e) => setAddForm((p) => ({ ...p, userId: e.target.value }))}
                      className={CLS_INPUT}
                      disabled={assignableUsers.length === 0}
                    >
                      <option value="">{assignableUsers.length === 0 ? '— alle bereits zugewiesen —' : '— bitte wählen —'}</option>
                      {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Rolle</label>
                    <input
                      value={addForm.role}
                      onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
                      className={CLS_INPUT}
                      placeholder="z. B. Senior Consultant"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeManage}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Schließen
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !addForm.userId}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

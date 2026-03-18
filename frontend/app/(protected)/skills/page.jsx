'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { GraduationCap, Plus, X, Sparkles, Users, ChevronDown, Bot, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { getUser } from '@/lib/auth'

const TABS = [
  { id: 'matrix', label: 'Skill-Matrix' },
  { id: 'staffing', label: 'Staffing-Matching' },
]

const LEVEL_LABELS = { 1: 'Grundl.', 2: 'Kenntn.', 3: 'Erfahren', 4: 'Fortg.', 5: 'Experte' }
const LEVEL_COLORS = {
  0: 'bg-gray-100 text-gray-400',
  1: 'bg-blue-50 text-blue-500',
  2: 'bg-blue-100 text-blue-600',
  3: 'bg-blue-200 text-blue-700',
  4: 'bg-violet-200 text-violet-700',
  5: 'bg-violet-300 text-violet-900',
}

// ─── Skill Matrix ─────────────────────────────────────────────────────────────

function SkillCell({ level, onClick }) {
  return (
    <td className="px-2 py-2 text-center">
      <button
        onClick={onClick}
        className={`inline-flex items-center justify-center w-16 h-7 rounded text-xs font-medium transition-all hover:opacity-80 ${LEVEL_COLORS[level || 0]}`}
        title={LEVEL_LABELS[level] || 'Nicht vorhanden — klicken zum Hinzufügen'}
      >
        {level ? LEVEL_LABELS[level] : '—'}
      </button>
    </td>
  )
}

function AddSkillAreaModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const area = await api.post('/skills/areas', { name: name.trim(), category: category.trim() || undefined })
      onAdd(area)
      toast.success('Skill-Bereich hinzugefügt')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Skill-Bereich hinzufügen</h3>
        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            placeholder="Name (z.B. Basel IV, IFRS 17...)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Kategorie (optional, z.B. Regulierung)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Abbrechen</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Hinzufügen</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditLevelModal({ user, area, current, onClose, onSave }) {
  const [level, setLevel] = useState(current || 1)
  const [yearsExp, setYearsExp] = useState('')

  async function submit() {
    try {
      const skill = await api.post(`/skills/users/${user.id}`, { skillAreaId: area.id, level, yearsExp: yearsExp ? parseFloat(yearsExp) : undefined })
      onSave(skill)
      onClose()
    } catch {
      toast.error('Fehler beim Speichern')
    }
  }

  async function remove() {
    try {
      await api.delete(`/skills/users/${user.id}/${area.id}`)
      onSave(null)
      onClose()
    } catch {
      toast.error('Fehler beim Entfernen')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-1">{area.name}</h3>
        <p className="text-sm text-gray-500 mb-4">{user.name}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Level</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${level === l ? LEVEL_COLORS[l] + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-gray-100 text-gray-500'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{LEVEL_LABELS[level]}</p>
          </div>
          <input
            type="number"
            placeholder="Jahre Erfahrung (optional)"
            value={yearsExp}
            onChange={(e) => setYearsExp(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <div className="flex justify-between mt-4">
          {current ? (
            <button onClick={remove} className="text-sm text-red-500 hover:underline">Entfernen</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Abbrechen</button>
            <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkillMatrixTab() {
  const [matrix, setMatrix] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null) // { user, area, current }
  const currentUser = getUser()

  useEffect(() => {
    api.get('/skills/matrix')
      .then(setMatrix)
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  function getLevel(user, areaId) {
    return user.skills.find((s) => s.skillAreaId === areaId)?.level || 0
  }

  function handleSave(user, area, result) {
    setMatrix((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id !== user.id) return u
        const filtered = u.skills.filter((s) => s.skillAreaId !== area.id)
        return { ...u, skills: result ? [...filtered, { ...result, skillAreaId: area.id }] : filtered }
      }),
    }))
  }

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>
  if (!matrix) return null

  const { users, areas } = matrix

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{users.length} Berater · {areas.length} Skill-Bereiche</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
        >
          <Plus size={14} />
          Skill-Bereich
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50 border-r border-gray-200 whitespace-nowrap">
                Berater
              </th>
              {areas.map((area) => (
                <th key={area.id} className="px-2 py-3 text-xs font-semibold text-gray-600 text-center whitespace-nowrap">
                  <div>{area.name}</div>
                  {area.category && <div className="text-gray-400 font-normal">{area.category}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-200 whitespace-nowrap">
                  {user.name}
                  <span className="ml-1 text-xs text-gray-400">{user.role}</span>
                </td>
                {areas.map((area) => (
                  <SkillCell
                    key={area.id}
                    level={getLevel(user, area.id)}
                    onClick={() => setEditing({ user, area, current: getLevel(user, area.id) || null })}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddSkillAreaModal
          onClose={() => setShowAdd(false)}
          onAdd={(area) => setMatrix((prev) => ({ ...prev, areas: [...prev.areas, area] }))}
        />
      )}

      {editing && (
        <EditLevelModal
          user={editing.user}
          area={editing.area}
          current={editing.current}
          onClose={() => setEditing(null)}
          onSave={(result) => handleSave(editing.user, editing.area, result)}
        />
      )}
    </div>
  )
}

// ─── Staffing Matching ────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10">{score}%</span>
    </div>
  )
}

function StaffingTab() {
  const [projects,        setProjects]        = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [brief,           setBrief]           = useState('')
  const [aiRunning,       setAiRunning]        = useState(false)
  const [aiResult,        setAiResult]         = useState(null)  // { summary, requiredSkills, rankings }
  const [loadingMatch,    setLoadingMatch]     = useState(false)
  const [savedMatches,    setSavedMatches]     = useState(null)  // legacy algorithmic results

  useEffect(() => {
    api.get('/projects')
      .then((data) => setProjects(data?.projects || data || []))
      .catch(() => {})
  }, [])

  async function runAiMatch() {
    if (!brief.trim()) { toast.error('Bitte einen Projekt-Brief eingeben'); return }
    setAiRunning(true)
    setAiResult(null)
    setSavedMatches(null)
    try {
      const data = await api.post('/skills/ai-match', {
        brief,
        projectId: selectedProject || undefined,
      })
      setAiResult(data)
      toast.success('KI-Analyse abgeschlossen')
    } catch (err) {
      toast.error(err.message || 'Fehler beim KI-Matching')
    } finally {
      setAiRunning(false)
    }
  }

  async function loadSavedMatch() {
    if (!selectedProject) return
    setLoadingMatch(true)
    try {
      const data = await api.get(`/skills/match/${selectedProject}`)
      setSavedMatches(data.matches || [])
      setAiResult(null)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoadingMatch(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Input card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Projekt-Brief analysieren</h3>
          {selectedProject && (
            <button
              onClick={loadSavedMatch}
              disabled={loadingMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Users size={12} />
              {loadingMatch ? 'Laden…' : 'Gespeichertes Matching'}
            </button>
          )}
        </div>

        <select
          value={selectedProject}
          onChange={(e) => { setSelectedProject(e.target.value); setSavedMatches(null) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none w-full max-w-xs"
        >
          <option value="">Projekt wählen (optional)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <textarea
          placeholder="Projekt-Brief / Anforderungsbeschreibung einfügen…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />

        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400">KI analysiert den Brief und gleicht mit allen Berater-Skills ab</p>
          <button
            onClick={runAiMatch}
            disabled={aiRunning || !brief.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Bot size={15} className={aiRunning ? 'animate-pulse' : ''} />
            {aiRunning ? 'KI analysiert…' : 'KI-Matching starten'}
          </button>
        </div>
      </div>

      {/* AI Result */}
      {aiResult && (
        <div className="space-y-4">
          {/* Summary + required skills */}
          {aiResult.summary && (
            <div className="flex gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
              <Info size={16} className="text-violet-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-violet-800">{aiResult.summary}</p>
                {aiResult.requiredSkills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiResult.requiredSkills.map((r, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.importance === 'required' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.skillName} <span className="opacity-60">L{r.level}</span>
                        {r.importance === 'required' && <span className="text-red-500 font-bold">*</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rankings */}
          <h4 className="font-semibold text-gray-900 text-sm">
            KI-Empfehlungen ({aiResult.rankings?.length || 0} Berater)
          </h4>
          {!aiResult.rankings?.length ? (
            <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
              Keine passenden Berater gefunden
            </div>
          ) : (
            <div className="space-y-3">
              {aiResult.rankings.map((r, i) => (
                <div
                  key={r.userId || i}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        <p className="font-semibold text-gray-900">{r.name}</p>
                      </div>
                    </div>
                    <ScoreBar score={r.score} />
                  </div>

                  {r.recommendation && (
                    <p className="text-xs text-gray-600 leading-relaxed">{r.recommendation}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {r.strengths?.map((s, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                        <CheckCircle size={10} /> {s}
                      </span>
                    ))}
                    {r.gaps?.map((g, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-200">
                        <AlertCircle size={10} /> {g}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legacy saved matches */}
      {savedMatches && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm">Gespeichertes Matching</h4>
          {savedMatches.length === 0 ? (
            <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
              Keine passenden Berater gefunden
            </div>
          ) : (
            savedMatches.map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.user.role}</p>
                  </div>
                  <span className="text-xs text-gray-500">{m.score} Punkte</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.matched.map((s, j) => (
                    <span key={j} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      {s.skill} (L{s.level})
                    </span>
                  ))}
                  {m.missing.map((s, j) => (
                    <span key={j} className="text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded">
                      {s} fehlt
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [activeTab, setActiveTab] = useState('matrix')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
          <GraduationCap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Berater Skill-Matching</h1>
          <p className="text-sm text-gray-500">Skill-Profile, Kompetenzmatrix und KI-gestütztes Staffing</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'matrix' && <SkillMatrixTab />}
      {activeTab === 'staffing' && <StaffingTab />}
    </div>
  )
}

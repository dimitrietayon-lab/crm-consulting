'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Star,
  ArrowLeft,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Save,
  TrendingUp,
  Users,
  BarChart2,
  ListChecks,
  MessageSquare,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import Modal from '@/components/ui/Modal'

const TABS = [
  { id: 'goals', label: 'Strategische Ziele', icon: Star },
  { id: 'stakeholders', label: 'Stakeholder', icon: Users },
  { id: 'revenue', label: 'Umsatzhistorie', icon: BarChart2 },
  { id: 'opportunities', label: 'Opportunities', icon: TrendingUp },
  { id: 'actions', label: 'Aktionsplan', icon: ListChecks },
  { id: 'nps', label: 'NPS-Historie', icon: MessageSquare },
]

const CONTACT_ROLE_COLORS = {
  Champion: 'bg-green-100 text-green-800',
  'Decision Maker': 'bg-blue-100 text-blue-800',
  Blocker: 'bg-red-100 text-red-800',
  Influencer: 'bg-amber-100 text-amber-800',
  Sponsor: 'bg-purple-100 text-purple-800',
}

export default function KeyAccountDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [account, setAccount] = useState(null)
  const [plan, setPlan] = useState(null)
  const [npsHistory, setNpsHistory] = useState([])
  const [deals, setDeals] = useState([])
  const [projects, setProjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('goals')

  // Plan edit state
  const [goals, setGoals] = useState('')
  const [positioning, setPositioning] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)

  // Action form
  const [newAction, setNewAction] = useState({ description: '', ownerId: '', dueDate: '' })
  const [addingAction, setAddingAction] = useState(false)

  // NPS modal
  const [npsOpen, setNpsOpen] = useState(false)
  const [npsScore, setNpsScore] = useState(8)
  const [npsComment, setNpsComment] = useState('')
  const [savingNps, setSavingNps] = useState(false)

  const load = useCallback(async () => {
    try {
      const [accData, planData, npsData, dealsData, projectsData, usersData] = await Promise.all([
        api.get(`/accounts/${id}`),
        api.get(`/key-accounts/${id}/plan`),
        api.get(`/key-accounts/${id}/nps`),
        api.get(`/deals?accountId=${id}`),
        api.get(`/projects?accountId=${id}`),
        api.get('/users'),
      ])
      const acc = accData?.account || accData
      setAccount(acc)
      setPlan(planData)
      setGoals(planData?.strategicGoals || '')
      setPositioning(planData?.ourPositioning || '')
      setNpsHistory(Array.isArray(npsData) ? npsData : [])
      setDeals(dealsData?.deals || dealsData || [])
      setProjects(projectsData?.projects || projectsData || [])
      // Contacts come nested in account contacts relation
      const ctcts = acc?.contacts || []
      setContacts(Array.isArray(ctcts) ? ctcts : [])
      setUsers(usersData?.users || usersData || [])
    } catch (err) {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function savePlan() {
    setSavingPlan(true)
    try {
      const updated = await api.put(`/key-accounts/${id}/plan`, { strategicGoals: goals, ourPositioning: positioning })
      setPlan((p) => ({ ...p, ...updated }))
      toast.success('Gespeichert')
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setSavingPlan(false)
    }
  }

  async function addAction(e) {
    e.preventDefault()
    if (!newAction.description.trim()) return
    setAddingAction(true)
    try {
      const action = await api.post(`/key-accounts/${id}/plan/actions`, {
        description: newAction.description,
        ownerId: newAction.ownerId || null,
        dueDate: newAction.dueDate || null,
      })
      setPlan((p) => ({ ...p, actions: [...(p.actions || []), action] }))
      setNewAction({ description: '', ownerId: '', dueDate: '' })
    } catch {
      toast.error('Fehler')
    } finally {
      setAddingAction(false)
    }
  }

  async function toggleAction(action) {
    try {
      const updated = await api.put(`/key-accounts/${id}/plan/actions/${action.id}`, { done: !action.done })
      setPlan((p) => ({ ...p, actions: p.actions.map((a) => a.id === action.id ? { ...a, done: updated.done } : a) }))
    } catch { toast.error('Fehler') }
  }

  async function deleteAction(actionId) {
    try {
      await api.delete(`/key-accounts/${id}/plan/actions/${actionId}`)
      setPlan((p) => ({ ...p, actions: p.actions.filter((a) => a.id !== actionId) }))
    } catch { toast.error('Fehler') }
  }

  async function submitNps() {
    setSavingNps(true)
    try {
      const entry = await api.post(`/key-accounts/${id}/nps`, { score: npsScore, comment: npsComment })
      setNpsHistory((prev) => [...prev, entry])
      setNpsOpen(false)
      setNpsComment('')
      setNpsScore(8)
      toast.success('NPS erfasst')
    } catch { toast.error('Fehler') } finally { setSavingNps(false) }
  }

  // Build revenue chart data (won deals by year)
  const revenueByYear = {}
  for (const deal of deals) {
    if (deal.stage === 'Won' && deal.value) {
      const year = new Date(deal.updatedAt || deal.createdAt).getFullYear()
      revenueByYear[year] = (revenueByYear[year] || 0) + deal.value
    }
  }
  const revenueData = Object.entries(revenueByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, value]) => ({ year, value }))

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!account) {
    return <div className="p-6 text-gray-500">Account nicht gefunden</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/key-accounts')} className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
          <Star size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{account.companyName}</h1>
          <p className="text-sm text-gray-500">{account.institutionType} · Account-Plan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Strategische Ziele */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <label className="block text-sm font-semibold text-gray-800">Strategische Ziele</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Was sind unsere strategischen Ziele für diesen Account?"
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <label className="block text-sm font-semibold text-gray-800">Unsere Positionierung</label>
            <textarea
              value={positioning}
              onChange={(e) => setPositioning(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Wie positionieren wir uns bei diesem Account?"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={savePlan}
              disabled={savingPlan}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              <Save size={15} />
              {savingPlan ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Stakeholder */}
      {activeTab === 'stakeholders' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Titel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Abteilung</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rolle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Keine Kontakte verknüpft</td></tr>
              ) : contacts.map((c) => {
                const contact = c.contact || c
                const dealRole = c.role || null
                return (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{contact.name}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.department || '—'}</td>
                    <td className="px-4 py-3">
                      {dealRole && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CONTACT_ROLE_COLORS[dealRole] || 'bg-gray-100 text-gray-600'}`}>
                          {dealRole}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Umsatzhistorie */}
      {activeTab === 'revenue' && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Gewonnene Deals nach Jahr</h3>
          {revenueData.length === 0 ? (
            <div className="py-12 text-center text-gray-400">Keine abgeschlossenen Deals</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Opportunities */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Aktive Deals</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Titel</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Stage</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Wert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.filter((d) => !['Won', 'Lost'].includes(d.stage)).length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Keine aktiven Deals</td></tr>
                  ) : deals.filter((d) => !['Won', 'Lost'].includes(d.stage)).map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.title}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">{d.stage}</span></td>
                      <td className="px-4 py-3 text-right text-gray-700">{d.value ? formatCurrency(d.value) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Aktive Projekte</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Projekt</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ende</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projects.filter((p) => p.status === 'Active').length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Keine aktiven Projekte</td></tr>
                  ) : projects.filter((p) => p.status === 'Active').map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">{p.status}</span></td>
                      <td className="px-4 py-3 text-gray-600">{p.endDate ? formatDate(p.endDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Aktionsplan */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <form onSubmit={addAction} className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Neue Aufgabe</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={newAction.description}
                onChange={(e) => setNewAction((a) => ({ ...a, description: e.target.value }))}
                placeholder="Beschreibung *"
                className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              <select
                value={newAction.ownerId}
                onChange={(e) => setNewAction((a) => ({ ...a, ownerId: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Kein Verantwortlicher</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newAction.dueDate}
                  onChange={(e) => setNewAction((a) => ({ ...a, dueDate: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={addingAction}
                  className="px-4 py-2 bg-amber-500 text-white text-sm rounded-md hover:bg-amber-600 disabled:opacity-50"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {(plan?.actions || []).length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">Keine Aufgaben</div>
            ) : (plan?.actions || []).map((action) => (
              <div key={action.id} className="flex items-center gap-3 px-4 py-3 group">
                <button onClick={() => toggleAction(action)} className="shrink-0">
                  {action.done
                    ? <CheckCircle2 size={20} className="text-green-500" />
                    : <Circle size={20} className="text-gray-300 hover:text-amber-400 transition-colors" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${action.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{action.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {action.owner && <span className="text-xs text-gray-400">{action.owner.name}</span>}
                    {action.dueDate && <span className="text-xs text-gray-400">{formatDate(action.dueDate)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteAction(action.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: NPS-Historie */}
      {activeTab === 'nps' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setNpsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus size={15} /> NPS erfassen
            </button>
          </div>

          {npsHistory.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 py-12 text-center text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-3 text-gray-200" />
              <p>Keine NPS-Daten vorhanden</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">NPS-Verlauf</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={npsHistory.map((n) => ({ ...n, dateLabel: new Date(n.date).toLocaleDateString('de-DE') }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {[...npsHistory].reverse().map((n) => (
                  <div key={n.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                      n.score >= 8 ? 'bg-green-100 text-green-700' :
                      n.score >= 6 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{n.score}</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">{new Date(n.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      {n.comment && <p className="text-sm text-gray-700">{n.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NPS Modal */}
      <Modal isOpen={npsOpen} onClose={() => setNpsOpen(false)} title="NPS erfassen">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Score (0–10)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                value={npsScore}
                onChange={(e) => setNpsScore(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold ${
                npsScore >= 8 ? 'bg-green-100 text-green-700' :
                npsScore >= 6 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{npsScore}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar (optional)</label>
            <textarea
              value={npsComment}
              onChange={(e) => setNpsComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setNpsOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
            <button onClick={submitNps} disabled={savingNps} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {savingNps ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

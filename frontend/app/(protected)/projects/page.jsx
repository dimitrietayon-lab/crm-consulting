'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Briefcase, Trash2, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'

const PROJECT_TYPES = ['Strategy', 'Regulation', 'IT', 'Risk', 'Audit', 'Other']
const PROJECT_STATUSES = ['Offer', 'Active', 'On Hold', 'Completed', 'Lost']
const BILLING_MODELS = ['Fixed Price', 'Time & Material', 'Retainer']

const STATUS_STYLES = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Offer: 'bg-blue-100 text-blue-700 border-blue-200',
  'On Hold': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
}

const TYPE_STYLES = {
  Strategy: 'bg-purple-100 text-purple-700 border-purple-200',
  Regulation: 'bg-orange-100 text-orange-700 border-orange-200',
  IT: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Risk: 'bg-red-100 text-red-700 border-red-200',
  Audit: 'bg-amber-100 text-amber-700 border-amber-200',
  Other: 'bg-gray-100 text-gray-600 border-gray-200',
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  )
}

function TypeBadge({ type }) {
  const cls = TYPE_STYLES[type] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type}
    </span>
  )
}

function BudgetBar({ planned, actual }) {
  if (!planned || planned === 0) return <span className="text-xs text-gray-400">—</span>
  const pct = Math.min((actual / planned) * 100, 100)
  const color =
    pct < 75 ? 'bg-green-500' : pct < 90 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full min-w-[100px]">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{formatCurrency(actual || 0)}</span>
        <span className="text-gray-400">{Math.round(pct)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-0.5">von {formatCurrency(planned)}</div>
    </div>
  )
}

const LABEL_INPUT = 'block text-sm font-medium text-gray-700 mb-1'
const CLS_INPUT =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function CreateProjectModal({ isOpen, onClose, onCreated, accounts, users, ccs }) {
  const [form, setForm] = useState({
    name: '',
    accountId: '',
    projectType: '',
    status: 'Active',
    startDate: '',
    endDate: '',
    budgetPlanned: '',
    billingModel: '',
    leadConsultantId: '',
    competenceCenterId: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Projektname ist erforderlich')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        budgetPlanned: form.budgetPlanned ? Number(form.budgetPlanned) : null,
        accountId: form.accountId || null,
        leadConsultantId: form.leadConsultantId || null,
        competenceCenterId: form.competenceCenterId || null,
      }
      const created = await api.post('/projects', payload)
      toast.success('Projekt erstellt')
      onCreated(created)
      onClose()
      setForm({
        name: '', accountId: '', projectType: '', status: 'Active',
        startDate: '', endDate: '', budgetPlanned: '', billingModel: '',
        leadConsultantId: '', competenceCenterId: '', description: '',
      })
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Neues Projekt</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={LABEL_INPUT}>Projektname <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Solvency II Projekt 2025"
              />
            </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_INPUT}>Account</label>
              <select value={form.accountId} onChange={(e) => set('accountId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Kein Account --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_INPUT}>Projekttyp</label>
              <select value={form.projectType} onChange={(e) => set('projectType', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Bitte wählen --</option>
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL_INPUT}>Competence Center</label>
            <select value={form.competenceCenterId} onChange={(e) => set('competenceCenterId', e.target.value)} className={CLS_INPUT}>
              <option value="">-- Kein CC --</option>
              {(ccs || []).map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_INPUT}>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className={CLS_INPUT}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_INPUT}>Abrechnungsmodell</label>
                <select value={form.billingModel} onChange={(e) => set('billingModel', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {BILLING_MODELS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_INPUT}>Startdatum</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={LABEL_INPUT}>Enddatum</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={CLS_INPUT}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_INPUT}>Budget geplant (€)</label>
                <input
                  type="number"
                  min="0"
                  value={form.budgetPlanned}
                  onChange={(e) => set('budgetPlanned', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="z.B. 150000"
                />
              </div>
              <div>
                <label className={LABEL_INPUT}>Lead Consultant</label>
                <select value={form.leadConsultantId} onChange={(e) => set('leadConsultantId', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Keiner --</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL_INPUT}>Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className={`${CLS_INPUT} resize-none`}
                placeholder="Kurze Projektbeschreibung..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Erstellen...' : 'Projekt erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState([])
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [ccs, setCcs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')
  const [filterCcId, setFilterCcId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, a, u, centers] = await Promise.all([
        api.get('/projects'),
        api.get('/accounts'),
        api.get('/users'),
        api.get('/admin/ccs'),
      ])
      setProjects(Array.isArray(p) ? p : (p?.data || []))
      setAccounts(Array.isArray(a) ? a : (a?.data || []))
      setUsers(Array.isArray(u) ? u : (u?.data || []))
      setCcs(Array.isArray(centers) ? centers : (centers?.data || []))
    } catch (err) {
      toast.error('Fehler beim Laden der Projekte')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(q) ||
      p.account?.companyName?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || p.status === filterStatus
    const matchType = !filterType || p.projectType === filterType
    const matchAccount = !filterAccountId || String(p.accountId) === String(filterAccountId)
    const matchCc = !filterCcId || String(p.competenceCenter?.id) === String(filterCcId)
    return matchSearch && matchStatus && matchType && matchAccount && matchCc
  })

  const stats = {
    Active: projects.filter((p) => p.status === 'Active').length,
    Offer: projects.filter((p) => p.status === 'Offer').length,
    Completed: projects.filter((p) => p.status === 'Completed').length,
    'On Hold': projects.filter((p) => p.status === 'On Hold').length,
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Projekt wirklich löschen?')) return
    setDeletingId(id)
    try {
      await api.delete(`/projects/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast.success('Projekt gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
            <p className="text-sm text-gray-500">{projects.length} Projekte insgesamt</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Projekt
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Aktiv', key: 'Active', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Angebot', key: 'Offer', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Abgeschlossen', key: 'Completed', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: 'On Hold', key: 'On Hold', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
        ].map(({ label, key, color, bg, border }) => (
          <div key={key} className={`bg-white rounded-lg border ${border} shadow-sm p-4`}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{stats[key]}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Projektname, Account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Alle Status</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Alle Typen</option>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Alle Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
          </select>
          <select
            value={filterCcId}
            onChange={(e) => setFilterCcId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Alle Competence Center</option>
            {ccs.map((cc) => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
          </select>
          {(search || filterStatus || filterType || filterAccountId) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterType(''); setFilterAccountId(''); setFilterCcId('') }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-500">Wird geladen...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Keine Projekte gefunden</p>
            <p className="text-sm text-gray-400 mt-1">
              {projects.length === 0
                ? 'Erstellen Sie Ihr erstes Projekt.'
                : 'Versuchen Sie, die Filter anzupassen.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Projekt</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Account</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">CC</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Typ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Lead</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Laufzeit</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-[160px]">Budget</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {project.name}
                      </p>
                      {project.billingModel && (
                        <p className="text-xs text-gray-400 mt-0.5">{project.billingModel}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.account?.companyName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.competenceCenter?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {project.projectType ? <TypeBadge type={project.projectType} /> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3">
                      {project.leadConsultant ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                            {getInitials(project.leadConsultant.name)}
                          </div>
                          <span className="text-gray-700 text-xs">{project.leadConsultant.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {project.startDate ? formatDate(project.startDate) : '—'}
                      {' – '}
                      {project.endDate ? formatDate(project.endDate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BudgetBar
                        planned={project.budgetPlanned}
                        actual={project.budgetActual || 0}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          disabled={deletingId === project.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(newProject) => setProjects((prev) => [newProject, ...prev])}
        accounts={accounts}
        users={users}
        ccs={ccs}
      />
    </div>
  )
}

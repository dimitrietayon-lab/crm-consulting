'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { DC, TRIGGER_INFO, DOMAIN_CONFIG, TEMPLATES } from '@/lib/workflow-config'
import toast from 'react-hot-toast'
import {
  Zap, Plus, Play, Trash2, Edit2, CheckCircle, XCircle, Clock,
  X, Loader2, ToggleLeft, ToggleRight,
  AlertCircle, Activity, Copy, Search,
  Filter, Calendar, ArrowRight, CheckCircle2, SkipForward,
  RefreshCw, Timer, Layers,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'

function fmtDuration(start, end) {
  if (!end) return '–'
  const ms = new Date(end) - new Date(start)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(date) {
  if (!date) return '–'
  const diff = Date.now() - new Date(date)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  return `vor ${Math.floor(h / 24)} Tagen`
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const router = useRouter()
  const [tab, setTab] = useState('workflows')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl">
              <Zap className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Workflow-Automatisierung</h1>
              <p className="text-xs text-gray-400">Prozesse automatisch ausführen, wenn Bedingungen erfüllt sind</p>
            </div>
          </div>
          <Link href="/workflows/new"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm">
            <Plus className="w-4 h-4" /> Neuer Workflow
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {[
            { key:'workflows', label:'Workflows', icon:Layers },
            { key:'monitoring', label:'Monitoring', icon:Activity },
            { key:'vorlagen', label:'Vorlagen', icon:Copy },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === key ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'workflows' && <WorkflowsTab onEdit={(wf) => router.push(`/workflows/${wf.id}/edit`)} />}
        {tab === 'monitoring' && <MonitoringTab />}
        {tab === 'vorlagen' && <VorlagenTab />}
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.get('/workflows/stats').then(setStats).catch(() => {}) }, [])

  const cards = [
    { label:'Workflows gesamt', value: stats?.total ?? '–', icon: Layers,    color:'text-violet-600', bg:'bg-violet-50' },
    { label:'Aktiv',            value: stats?.active ?? '–', icon: ToggleRight, color:'text-green-600',  bg:'bg-green-50'  },
    { label:'Erfolgsrate',      value: stats ? `${stats.successRate}%` : '–', icon: CheckCircle2, color:'text-blue-600', bg:'bg-blue-50' },
    { label:'Läufe gesamt',     value: stats?.totalRuns ?? '–', icon: RefreshCw, color:'text-amber-600', bg:'bg-amber-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────
function WorkflowsTab({ onEdit }) {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    try { setWorkflows(await api.get('/workflows')) }
    catch {} finally { setLoading(false) }
  }

  async function toggleActive(wf) {
    try {
      const updated = await api.put(`/workflows/${wf.id}`, { isActive: !wf.isActive })
      setWorkflows(p => p.map(w => w.id === wf.id ? { ...w, isActive: updated.isActive } : w))
    } catch { toast.error('Fehler') }
  }

  async function runWorkflow(wf) {
    setRunning(r => ({ ...r, [wf.id]: true }))
    try {
      const res = await api.post(`/workflows/${wf.id}/run`, {})
      setRunResult({ workflow: wf, result: res.result, run: res.run })
      toast.success('Workflow ausgeführt')
      load()
    } catch (err) { toast.error(err.message || 'Ausführung fehlgeschlagen') }
    setRunning(r => ({ ...r, [wf.id]: false }))
  }

  async function duplicate(wf) {
    try {
      const payload = {
        name: `${wf.name} (Kopie)`, description: wf.description, domain: wf.domain,
        trigger: wf.trigger, triggerConfig: wf.triggerConfig, conditions: wf.conditions, actions: wf.actions,
      }
      await api.post('/workflows', payload)
      toast.success('Dupliziert')
      load()
    } catch { toast.error('Fehler') }
  }

  async function deleteWorkflow(id) {
    if (!confirm('Workflow löschen?')) return
    try { await api.delete(`/workflows/${id}`); setWorkflows(p => p.filter(w => w.id !== id)); toast.success('Gelöscht') }
    catch { toast.error('Fehler') }
  }

  const filtered = workflows.filter(wf => {
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDomain !== 'all' && wf.domain !== filterDomain) return false
    if (filterStatus === 'active' && !wf.isActive) return false
    if (filterStatus === 'inactive' && wf.isActive) return false
    return true
  })

  return (
    <div>
      <StatsBar />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Workflow suchen…"
            className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
            className="text-sm outline-none bg-transparent">
            <option value="all">Alle Domänen</option>
            {Object.entries(DC).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {[['all','Alle'],['active','Aktiv'],['inactive','Inaktiv']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors
                ${filterStatus === v ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 ml-auto">{filtered.length} von {workflows.length}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <Zap className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">Keine Workflows gefunden</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Erstelle deinen ersten automatisierten Workflow</p>
          <Link href="/workflows/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Neuer Workflow
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(wf => (
            <WorkflowCard key={wf.id} wf={wf}
              onToggle={() => toggleActive(wf)}
              onRun={() => runWorkflow(wf)}
              onEdit={() => onEdit(wf)}
              onDuplicate={() => duplicate(wf)}
              onDelete={() => deleteWorkflow(wf.id)}
              running={running[wf.id]}
            />
          ))}
        </div>
      )}

      {runResult && <RunResultModal result={runResult} onClose={() => setRunResult(null)} />}
    </div>
  )
}

// ─── Workflow Card ────────────────────────────────────────────────────────────
function WorkflowCard({ wf, onToggle, onRun, onEdit, onDuplicate, onDelete, running }) {
  const domain = DC[wf.domain] || DC.general
  const domainCfg = DOMAIN_CONFIG[wf.domain] || DOMAIN_CONFIG.general
  const DomainIcon = domain.icon
  const triggerInfo = TRIGGER_INFO[wf.trigger] || { label: wf.trigger, icon: '▶', desc: '' }
  const actionsArray = Array.isArray(wf.actions) ? wf.actions : []
  const conditionsArray = Array.isArray(wf.conditions) ? wf.conditions : []
  const recentRuns = Array.isArray(wf.runs) ? wf.runs : []
  const isAutomatic = wf.trigger !== 'manual'

  return (
    <div className={`bg-white rounded-2xl border-2 flex flex-col transition-all hover:shadow-md
      ${wf.isActive ? domain.border : 'border-gray-100'}`}>

      {/* Card header */}
      <div className={`px-4 pt-4 pb-3 rounded-t-xl ${wf.isActive ? domain.bg.replace('100','50') : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg ${domain.bg} shrink-0 mt-0.5`}>
              <DomainIcon className={`w-3.5 h-3.5 ${domain.text}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{wf.name}</h3>
                {isAutomatic && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs rounded-full font-medium">
                    <Zap className="w-2.5 h-2.5" />Auto
                  </span>
                )}
              </div>
              {wf.description && <p className="text-xs text-gray-500 truncate mt-0.5">{wf.description}</p>}
            </div>
          </div>
          <button onClick={onToggle} className="shrink-0 mt-0.5" title={wf.isActive ? 'Deaktivieren' : 'Aktivieren'}>
            {wf.isActive
              ? <ToggleRight className="w-7 h-7 text-violet-600" />
              : <ToggleLeft className="w-7 h-7 text-gray-300" />}
          </button>
        </div>
      </div>

      {/* Mini-flow diagram */}
      <div className="px-4 py-3 flex items-center gap-1.5 flex-wrap border-b border-gray-100 overflow-hidden">
        {/* Trigger node */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${domain.bg} ${domain.text}`}>
          <span>{triggerInfo.icon}</span>
          <span>{triggerInfo.label}</span>
        </div>

        {conditionsArray.length > 0 && (
          <>
            <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-orange-50 text-orange-600">
              <AlertCircle className="w-3 h-3" />
              <span>{conditionsArray.length} Bed.</span>
            </div>
          </>
        )}

        {actionsArray.slice(0, 2).map((a, i) => {
          const allActions = [...(domainCfg.actions || []), ...DOMAIN_CONFIG.general.actions]
          const def = allActions.find(x => x.type === a.type)
          return (
            <span key={i} className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${domain.bg} ${domain.text}`}>
                {def?.label?.split(' ')[0] || a.type}
              </span>
            </span>
          )
        })}
        {actionsArray.length > 2 && (
          <span className="text-xs text-gray-400">+{actionsArray.length - 2}</span>
        )}
      </div>

      {/* Meta info */}
      <div className="px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-gray-400">
          {isAutomatic ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {triggerInfo.desc}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {timeAgo(wf.lastRunAt)}
            </span>
          )}
          {wf._count?.runs > 0 && (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              {wf._count.runs}×
            </span>
          )}
        </div>

        {/* Run history dots */}
        {recentRuns.length > 0 && (
          <div className="flex items-center gap-1">
            {recentRuns.slice(0, 5).map((r, i) => (
              <div key={i} title={r.status}
                className={`w-2 h-2 rounded-full ${
                  r.status === 'success' ? 'bg-green-400' :
                  r.status === 'failed'  ? 'bg-red-400'   :
                  r.status === 'skipped' ? 'bg-yellow-400' : 'bg-gray-300'
                }`} />
            ))}
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-3 pb-3 flex items-center gap-1.5 mt-auto">
        <button onClick={onRun} disabled={!wf.isActive || running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Ausführen
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button onClick={onDuplicate}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Duplizieren">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="ml-auto p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Monitoring Tab ───────────────────────────────────────────────────────────
function MonitoringTab() {
  const [stats, setStats] = useState(null)
  const [runs, setRuns] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    api.get('/workflows/stats').then(setStats).catch(() => {})
    api.get('/workflows/runs?limit=50').then(setRuns).catch(() => {})
  }, [])

  const filteredRuns = runs.filter(r => filterStatus === 'all' || r.status === filterStatus)
  const domainColors = { crm:'#3b82f6', vertrieb:'#22c55e', pmo:'#a855f7', fico:'#f59e0b', personal:'#14b8a6', general:'#64748b' }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" />Aktivität (letzte 7 Tage)
          </h3>
          {stats ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dailyActivity} barSize={16} barGap={2}>
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={d => d} formatter={(v, n) => [v, n === 'success' ? 'Erfolg' : n === 'failed' ? 'Fehler' : 'Übersprungen']} />
                <Bar dataKey="success" stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} />
                <Bar dataKey="skipped" stackId="a" fill="#fbbf24" />
                <Bar dataKey="failed"  stackId="a" fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>}
          <div className="flex gap-4 mt-2 justify-center">
            {[['bg-violet-500','Erfolg'],['bg-yellow-400','Übersprungen'],['bg-red-400','Fehler']].map(([bg,l]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-2.5 h-2.5 rounded-sm ${bg}`} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Domain distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />Domänen-Verteilung
          </h3>
          {stats?.domainDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.domainDistribution} dataKey="count" nameKey="domain" cx="50%" cy="50%" outerRadius={75} label={({ domain: d, percent }) => `${DC[d]?.label || d} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {stats.domainDistribution.map((e) => (
                    <Cell key={e.domain} fill={domainColors[e.domain] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, DC[n]?.label || n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Keine Daten</div>}
        </div>
      </div>

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Erfolgsrate', value:`${stats.successRate}%`, sub:'aller Läufe', color:'text-green-600', bg:'bg-green-50', icon:CheckCircle2 },
            { label:'⌀ Dauer', value:stats.avgDurationMs < 1000 ? `${stats.avgDurationMs}ms` : `${(stats.avgDurationMs/1000).toFixed(1)}s`, sub:'pro Ausführung', color:'text-blue-600', bg:'bg-blue-50', icon:Timer },
            { label:'Aktive Workflows', value:stats.active, sub:`von ${stats.total} gesamt`, color:'text-violet-600', bg:'bg-violet-50', icon:Zap },
            { label:'Läufe gesamt', value:stats.totalRuns, sub:'alle Zeit', color:'text-amber-600', bg:'bg-amber-50', icon:RefreshCw },
          ].map(({ label, value, sub, color, bg, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent runs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />Ausführungsprotokoll
          </h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[['all','Alle'],['success','Erfolg'],['failed','Fehler'],['skipped','Übersprungen']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors
                  ${filterStatus === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {filteredRuns.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />Keine Einträge
            </div>
          ) : filteredRuns.map(run => {
            const domain = DC[run.workflow?.domain] || DC.general
            return (
              <div key={run.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 text-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${domain.dot}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{run.workflow?.name}</span>
                </div>
                <div className="w-28 shrink-0">
                  {run.status === 'success'  && <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" />Erfolg</span>}
                  {run.status === 'failed'   && <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3.5 h-3.5" />Fehler</span>}
                  {run.status === 'skipped'  && <span className="flex items-center gap-1 text-yellow-500 text-xs"><SkipForward className="w-3.5 h-3.5" />Übersprungen</span>}
                  {run.status === 'running'  && <span className="flex items-center gap-1 text-violet-500 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Läuft</span>}
                </div>
                <p className="text-xs text-gray-400 w-32 shrink-0 truncate">{run.summary || '–'}</p>
                <p className="text-xs font-mono text-gray-400 w-16 text-right shrink-0">{fmtDuration(run.startedAt, run.finishedAt)}</p>
                <p className="text-xs text-gray-400 w-32 text-right shrink-0">
                  {new Date(run.startedAt).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Vorlagen Tab ─────────────────────────────────────────────────────────────
function VorlagenTab() {
  const [activeDomain, setActiveDomain] = useState('all')
  const filtered = activeDomain === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.domain === activeDomain)

  return (
    <div>
      {/* Domain filter pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => setActiveDomain('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${activeDomain === 'all' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          Alle
        </button>
        {Object.entries(DC).map(([k, d]) => (
          <button key={k} onClick={() => setActiveDomain(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeDomain === k ? `${d.bg} ${d.text} ring-2 ring-current` : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <d.icon className="w-3.5 h-3.5" />{d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tpl, i) => {
          const domain = DC[tpl.domain] || DC.general
          const DomainIcon = domain.icon
          const trigInfo = TRIGGER_INFO[tpl.trigger] || { label: tpl.trigger, icon: '▶' }
          const isAuto = tpl.trigger !== 'manual'
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-xl ${domain.bg} shrink-0`}>
                  <DomainIcon className={`w-4 h-4 ${domain.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{tpl.name}</h3>
                    {isAuto && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs rounded-full"><Zap className="w-2.5 h-2.5" />Auto</span>}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${domain.bg} ${domain.text} font-medium`}>{domain.label}</span>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4 flex-1">{tpl.description}</p>

              {/* Mini flow */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap text-xs">
                <span className={`px-2 py-1 rounded-lg font-medium ${domain.bg} ${domain.text}`}>{trigInfo.icon} {trigInfo.label}</span>
                {tpl.conditions.length > 0 && (
                  <><ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className="px-2 py-1 rounded-lg font-medium bg-orange-50 text-orange-600">{tpl.conditions.length} Bed.</span></>
                )}
                {tpl.actions.slice(0,2).map((a, j) => {
                  const domCfg = DOMAIN_CONFIG[tpl.domain] || DOMAIN_CONFIG.general
                  const allA = [...(domCfg.actions || []), ...DOMAIN_CONFIG.general.actions]
                  const def = allA.find(x => x.type === a.type)
                  return (
                    <span key={j} className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className={`px-2 py-1 rounded-lg font-medium ${domain.bg} ${domain.text}`}>{def?.label?.split(' ')[0] || a.type}</span>
                    </span>
                  )
                })}
              </div>

              <Link href={`/workflows/new?template=${TEMPLATES.indexOf(tpl)}`}
                className="block w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors text-center">
                Als Workflow verwenden
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Run Result Modal ─────────────────────────────────────────────────────────
function RunResultModal({ result, onClose }) {
  const { workflow, result: r, run } = result
  const domain = DC[workflow?.domain] || DC.general
  const skipped = r?.skipped
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {skipped
              ? <><SkipForward className="w-5 h-5 text-yellow-500" /><h3 className="font-semibold">Übersprungen</h3></>
              : <><CheckCircle className="w-5 h-5 text-green-500" /><h3 className="font-semibold">Ausgeführt</h3></>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${domain.bg}`}><Zap className={`w-4 h-4 ${domain.text}`} /></div>
            <div>
              <p className="font-semibold text-gray-900">{workflow?.name}</p>
              <p className="text-xs text-gray-400">Dauer: {fmtDuration(run?.startedAt, run?.finishedAt)} · {r?.count ?? 0} Einträge bearbeitet</p>
            </div>
          </div>
          <div className={`rounded-xl p-3 text-sm ${skipped ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
            {r?.summary}
          </div>
          {Array.isArray(r?.results) && r.results.length > 1 && (
            <div className="space-y-2">
              {r.results.map((res, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Aktion {i+1}</p>
                  <p className="text-gray-700">{res.summary}</p>
                  {Array.isArray(res.items) && res.items.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {res.items.slice(0,4).map((item, j) => (
                        <p key={j} className="text-xs text-gray-500 truncate">• {item.name||item.title||item.account||item.number||JSON.stringify(item)}</p>
                      ))}
                      {res.items.length > 4 && <p className="text-xs text-gray-400">…und {res.items.length-4} weitere</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {r?.data && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(r.data).map(([k,v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-xs text-gray-400 capitalize">{k.replace(/([A-Z])/g,' $1')}</p>
                  <p className="font-bold text-gray-800">{typeof v === 'number' ? v.toLocaleString('de-DE') : String(v)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">Schließen</button>
        </div>
      </div>
    </div>
  )
}

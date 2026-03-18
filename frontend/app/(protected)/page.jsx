'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import {
  Briefcase, TrendingUp, CheckSquare, Building2, Clock, AlertCircle,
  Star, Activity, ArrowRight, Calendar, Phone, Mail, Users, Presentation,
  Target, Coffee, Send, FileText, Zap, ChevronRight, Timer,
  CheckCircle2, Circle, RotateCcw, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'

// ─── Shared constants ─────────────────────────────────────────────────────────
const STAGES = ['First Contact', 'Needs Analysis', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']
const STAGE_COLORS = {
  'First Contact': '#94a3b8', 'Needs Analysis': '#60a5fa', 'Proposal Sent': '#a78bfa',
  'Negotiation': '#fb923c', 'Won': '#4ade80', 'Lost': '#f87171',
}
const ACTIVITY_TYPE_VARIANTS = {
  'Meeting': 'success', 'Phone Call': 'info', 'Email': 'purple',
  'Presentation': 'blue', 'Workshop': 'indigo', 'Conference': 'warning', 'Note': 'default',
}
const PRIORITY_VARIANTS = { Critical: 'danger', High: 'danger', Medium: 'warning', Low: 'default' }
const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const INSTITUTION_COLORS = {
  'Private Bank': 'bg-blue-100 text-blue-700', 'Savings Bank': 'bg-sky-100 text-sky-700',
  'Cooperative Bank': 'bg-cyan-100 text-cyan-700', 'Investment Bank': 'bg-indigo-100 text-indigo-700',
  'Digital Bank': 'bg-violet-100 text-violet-700', 'Insurance (Life)': 'bg-purple-100 text-purple-700',
  'Insurance (Non-Life)': 'bg-fuchsia-100 text-fuchsia-700', 'Reinsurance': 'bg-pink-100 text-pink-700',
  'Health Insurance': 'bg-rose-100 text-rose-700', 'Fintech': 'bg-emerald-100 text-emerald-700',
  'Asset Manager': 'bg-teal-100 text-teal-700', 'Other': 'bg-gray-100 text-gray-700',
}
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function getMonday(d = new Date()) {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1))
  dt.setHours(0, 0, 0, 0)
  return dt
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue', href }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600', purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600', red: 'bg-red-50 text-red-600',
  }
  const inner = (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.fill || entry.color }} className="text-xs">
          {entry.name === 'count'
            ? `Anzahl: ${entry.value}`
            : entry.name === 'billable'
            ? `Abrechenbar: ${entry.value}h`
            : entry.name === 'internal'
            ? `Intern: ${entry.value}h`
            : `Volumen: ${formatCurrency(entry.value)}`}
        </p>
      ))}
    </div>
  )
}

const PROJECT_STATUS_COLOR = {
  Active: 'bg-green-100 text-green-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-red-100 text-red-700',
}

// ─── Root: pick dashboard by role ─────────────────────────────────────────────
export default function DashboardPage() {
  const user = getUser()
  if (!user) return null
  if (user.role === 'admin') return <ManagementDashboard user={user} />
  return <ConsultantDashboard user={user} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT DASHBOARD (admin)
// ═══════════════════════════════════════════════════════════════════════════════
function ManagementDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [allAccounts, setAllAccounts] = useState([])
  const [deals, setDeals] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [upcomingActivities, setUpcomingActivities] = useState([])
  const [projects, setProjects] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [users, setUsers] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          api.get('/accounts?isKeyAccount=true'),
          api.get('/accounts'),
          api.get('/deals'),
          api.get('/tasks?view=overdue'),
          api.get('/activities'),
          api.get('/activities?upcoming=true&limit=5'),
          api.get('/projects?status=Active'),
          api.get('/projects'),
          api.get('/users'),
        ])
        const [accData, allAccData, dealData, taskData, actData, upcomingActData, projData, allProjData, userData] = results
        if (accData.status === 'fulfilled' && accData.value) setAccounts(Array.isArray(accData.value) ? accData.value : [])
        if (allAccData.status === 'fulfilled' && allAccData.value) setAllAccounts(Array.isArray(allAccData.value) ? allAccData.value : [])
        if (dealData.status === 'fulfilled' && dealData.value) setDeals(Array.isArray(dealData.value) ? dealData.value : [])
        if (taskData.status === 'fulfilled' && taskData.value) setTasks(Array.isArray(taskData.value) ? taskData.value : [])
        if (actData.status === 'fulfilled' && actData.value) setActivities((Array.isArray(actData.value) ? actData.value : []).slice(0, 6))
        if (upcomingActData.status === 'fulfilled' && upcomingActData.value) setUpcomingActivities(Array.isArray(upcomingActData.value) ? upcomingActData.value : [])
        if (projData.status === 'fulfilled' && projData.value) setProjects(Array.isArray(projData.value) ? projData.value : [])
        if (allProjData.status === 'fulfilled' && allProjData.value) setAllProjects(Array.isArray(allProjData.value) ? allProjData.value : [])
        if (userData.status === 'fulfilled' && userData.value) setUsers(Array.isArray(userData.value) ? userData.value : [])
      } finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const openDeals = deals.filter(d => !['Won', 'Lost'].includes(d.stage))
  const weightedValue = openDeals.reduce((s, d) => s + (d.value || 0) * ((d.probability ?? 50) / 100), 0)
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const tasksDueToday = tasks.filter(t => !t.dueDate || t.status === 'Done' ? false : t.dueDate.split('T')[0] === todayStr)
  const stageMap = {}
  deals.forEach(d => {
    if (!stageMap[d.stage]) stageMap[d.stage] = { stage: d.stage, count: 0, value: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].value += d.value || 0
  })
  const pipelineData = STAGES.filter(s => stageMap[s]).map(s => stageMap[s])
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const tasksDueSoon = tasks
    .filter(t => { if (!t.dueDate || t.status === 'Done') return false; return new Date(t.dueDate) <= weekEnd })
    .sort((a, b) => { const pa = PRIORITY_ORDER[a.priority] ?? 3, pb = PRIORITY_ORDER[b.priority] ?? 3; return pa !== pb ? pa - pb : new Date(a.dueDate) - new Date(b.dueDate) })
    .slice(0, 8)
  const keyAccounts = accounts.slice(0, 5)
  const totalBudget = projects.reduce((s, p) => s + (p.budgetPlanned || 0), 0)
  const winRate = Math.round(deals.filter(d => d.stage === 'Won').length / Math.max(deals.filter(d => ['Won', 'Lost'].includes(d.stage)).length, 1) * 100)

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Management Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Unternehmensüberblick · {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Admin</span>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Aktive Projekte" value={projects.length}
          sub={totalBudget > 0 ? `Budget: ${formatCurrency(totalBudget)}` : 'Kein Budget'} color="blue" href="/projects" />
        <StatCard icon={TrendingUp} label="Offene Deals" value={openDeals.length}
          sub={`Gewichtet: ${formatCurrency(weightedValue)}`} color="purple" href="/pipeline" />
        <StatCard icon={CheckSquare} label="Überfällige Aufgaben" value={tasks.filter(t => t.status !== 'Done').length}
          sub={tasksDueToday.length > 0 ? `${tasksDueToday.length} heute fällig` : 'Keine heute fällig'}
          color={tasks.filter(t => t.status !== 'Done').length > 0 ? 'yellow' : 'green'} href="/tasks" />
        <StatCard icon={Building2} label="Accounts gesamt" value={allAccounts.length}
          sub={`${accounts.length} Key Accounts · Win-Rate ${winRate}%`} color="green" href="/accounts" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Pipeline-Übersicht</h2>
            <Link href="/pipeline" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle Deals <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="flex gap-6 mb-4">
            <div><p className="text-xs text-gray-500">Gesamt</p><p className="text-lg font-bold text-gray-900">{formatCurrency(deals.reduce((s, d) => s + (d.value || 0), 0))}</p></div>
            <div><p className="text-xs text-gray-500">Gewichtet</p><p className="text-lg font-bold text-blue-600">{formatCurrency(weightedValue)}</p></div>
            <div><p className="text-xs text-gray-500">Deals offen</p><p className="text-lg font-bold text-gray-900">{openDeals.length}</p></div>
            {deals.filter(d => d.stage === 'Won').length > 0 && (
              <div><p className="text-xs text-gray-500">Win-Rate</p><p className="text-lg font-bold text-green-600">{winRate}%</p></div>
            )}
          </div>
          {pipelineData.length === 0
            ? <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2"><TrendingUp className="w-8 h-8 text-gray-300" />Keine Deals</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {pipelineData.map(entry => <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
          {pipelineData.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {pipelineData.map(entry => (
                <div key={entry.stage} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: STAGE_COLORS[entry.stage] || '#94a3b8' }} />
                  {entry.stage}: {entry.count} ({formatCurrency(entry.value)})
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Letzte Aktivitäten</h2>
            <Link href="/activities" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {activities.length === 0
            ? <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2"><Activity className="w-6 h-6 text-gray-300" />Keine Aktivitäten</div>
            : <ul className="space-y-3">
                {activities.map(activity => (
                  <li key={activity.id} className="flex items-start gap-2.5">
                    <Badge variant={ACTIVITY_TYPE_VARIANTS[activity.type] || 'default'} size="sm">{activity.type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{activity.summary || '(kein Betreff)'}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {activity.account?.companyName || activity.deal?.title || ''}
                        {activity.date && <span className="ml-1">&middot; {timeAgo(activity.date)}</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Aufgaben – fällig & überfällig</h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {tasksDueSoon.length === 0
            ? <div className="flex items-center justify-center gap-2 h-24 text-green-600 text-sm"><CheckSquare className="w-4 h-4" />Keine dringenden Aufgaben</div>
            : <ul className="divide-y divide-gray-100">
                {tasksDueSoon.map(task => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < now
                  return (
                    <li key={task.id} onClick={() => setSelectedTask(task)}
                      className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                      <div className={`flex-shrink-0 w-1 h-8 rounded-full ${isOverdue ? 'bg-red-400' : 'bg-yellow-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.dueDate && (
                            <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.project?.name && <span className="text-xs text-gray-400 truncate">&middot; {task.project.name}</span>}
                        </div>
                      </div>
                      <Badge variant={PRIORITY_VARIANTS[task.priority] || 'default'} size="sm">{task.priority}</Badge>
                    </li>
                  )
                })}
              </ul>
          }
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />Key Accounts
            </h2>
            <Link href="/accounts?isKeyAccount=true" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {keyAccounts.length === 0
            ? <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm"><Building2 className="w-6 h-6 text-gray-300 mb-1" />Keine Key Accounts</div>
            : <ul className="space-y-1">
                {keyAccounts.map(account => {
                  const initials = account.companyName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                  const typeClass = INSTITUTION_COLORS[account.institutionType] || 'bg-gray-100 text-gray-700'
                  return (
                    <li key={account.id}>
                      <Link href={`/accounts/${account.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-xs shrink-0">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{account.companyName}</p>
                          <p className="text-xs text-gray-500 truncate">{account.country || ''}</p>
                        </div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${typeClass}`}>{account.institutionType?.split(' ')[0] || '—'}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
          }
        </div>
      </div>

      {upcomingActivities.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />Bevorstehende Aktivitäten
            </h2>
            <Link href="/activities" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {upcomingActivities.map(activity => (
              <li key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.summary || '(kein Betreff)'}</p>
                  <p className="text-xs text-gray-400 truncate">{activity.account?.companyName || ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={ACTIVITY_TYPE_VARIANTS[activity.type] || 'default'} size="sm">{activity.type}</Badge>
                  {activity.date && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(activity.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      {' '}{new Date(activity.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TaskDetailModal
        task={selectedTask} isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={(updated) => { setTasks(prev => prev.map(t => t.id === updated.id ? updated : t)); setSelectedTask(null) }}
        onDeleted={(id) => setTasks(prev => prev.filter(t => t.id !== id))}
        accounts={allAccounts} users={users} projects={allProjects}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTANT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function ConsultantDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [myProjects, setMyProjects] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [timesheet, setTimesheet] = useState(null)
  const [upcomingActivities, setUpcomingActivities] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [allProjects, setAllProjects] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const weekStart = getMonday()

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          api.get('/projects?status=Active'),
          api.get('/tasks'),
          api.get(`/timesheets?userId=${user.id}&weekStart=${weekStart.toISOString()}`),
          api.get('/activities?upcoming=true&limit=6'),
          api.get(`/leave/requests?userId=${user.id}&status=pending`),
          api.get('/projects'),
        ])
        const [projRes, taskRes, tsRes, actRes, leaveRes, allProjRes] = results

        if (projRes.status === 'fulfilled' && projRes.value) {
          const all = Array.isArray(projRes.value) ? projRes.value : []
          setMyProjects(all.filter(p => p.members?.some(m => m.userId === user.id) || p.leadConsultantId === user.id))
        }
        if (taskRes.status === 'fulfilled' && taskRes.value) {
          const all = Array.isArray(taskRes.value) ? taskRes.value : []
          setMyTasks(all.filter(t => t.assignedToId === user.id || t.createdById === user.id))
        }
        if (tsRes.status === 'fulfilled' && tsRes.value) {
          const arr = Array.isArray(tsRes.value) ? tsRes.value : []
          setTimesheet(arr[0] || null)
        }
        if (actRes.status === 'fulfilled' && actRes.value) {
          setUpcomingActivities(Array.isArray(actRes.value) ? actRes.value : [])
        }
        if (leaveRes.status === 'fulfilled' && leaveRes.value) {
          setLeaveRequests(Array.isArray(leaveRes.value) ? leaveRes.value : [])
        }
        if (allProjRes.status === 'fulfilled' && allProjRes.value) {
          setAllProjects(Array.isArray(allProjRes.value) ? allProjRes.value : [])
        }
      } finally { setLoading(false) }
    }
    fetchAll()
  }, [user.id])

  // Weekly productivity chart data (Mon – Sun)
  const productivityData = useMemo(() => {
    const entries = timesheet?.entries || []
    const monday = getMonday()
    return WEEKDAYS.map((day, i) => {
      const dayDate = new Date(monday)
      dayDate.setDate(monday.getDate() + i)
      const dayStr = dayDate.toISOString().split('T')[0]
      const dayEntries = entries.filter(e => e.date?.startsWith(dayStr))
      const billable = dayEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
      const internal = dayEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0)
      const isToday = dayStr === new Date().toISOString().split('T')[0]
      return { day, billable: parseFloat(billable.toFixed(2)), internal: parseFloat(internal.toFixed(2)), isToday }
    })
  }, [timesheet])

  const hoursThisWeek = productivityData.reduce((s, d) => s + d.billable + d.internal, 0)
  const billableThisWeek = productivityData.reduce((s, d) => s + d.billable, 0)

  const now = new Date()
  const openTasks = myTasks.filter(t => t.status !== 'Done')
  const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
  const upcomingTasks = openTasks
    .filter(t => t.dueDate)
    .sort((a, b) => { const pa = PRIORITY_ORDER[a.priority] ?? 3, pb = PRIORITY_ORDER[b.priority] ?? 3; return pa !== pb ? pa - pb : new Date(a.dueDate) - new Date(b.dueDate) })
    .slice(0, 8)

  async function handleSubmitTimesheet() {
    if (!timesheet) return
    setSubmitting(true)
    try {
      await api.put(`/timesheets/${timesheet.id}/submit`, {})
      setTimesheet(prev => ({ ...prev, status: 'submitted' }))
    } catch {}
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  const tsStatusMap = {
    draft: { label: 'Entwurf', cls: 'bg-gray-100 text-gray-700' },
    submitted: { label: 'Eingereicht', cls: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Genehmigt', cls: 'bg-green-100 text-green-800' },
    returned: { label: 'Zurückgegeben', cls: 'bg-red-100 text-red-800' },
  }

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user.name?.split(' ')[0]}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {leaveRequests.length > 0 && (
              <span className="ml-3 text-amber-600 font-medium">· {leaveRequests.length} offene Urlaubsanfrage{leaveRequests.length !== 1 ? 'n' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Consultant</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Meine Projekte" value={myProjects.length}
          sub={`${myProjects.filter(p => p.status === 'Active').length} aktiv`}
          color="blue" href="/projects" />
        <StatCard icon={CheckSquare} label="Offene Aufgaben" value={openTasks.length}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} überfällig` : 'Alles im Zeitplan'}
          color={overdueTasks.length > 0 ? 'red' : 'green'} href="/tasks" />
        <StatCard icon={Timer} label="Stunden diese Woche" value={`${hoursThisWeek.toFixed(1)}h`}
          sub={`${billableThisWeek.toFixed(1)}h abrechenbar`}
          color="teal" href="/timesheets" />
        <StatCard icon={Clock} label="Zeiterfassung" value={timesheet ? tsStatusMap[timesheet.status]?.label : 'Kein Eintrag'}
          sub={timesheet?.status === 'draft' ? 'Noch nicht eingereicht' : timesheet?.status === 'approved' ? 'Diese Woche genehmigt' : 'Diese Woche'}
          color={timesheet?.status === 'returned' ? 'red' : timesheet?.status === 'approved' ? 'green' : 'yellow'}
          href="/timesheets" />
      </div>

      {/* Main content: My Projects + My Tasks */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Meine Projekte */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />Meine Projekte
            </h2>
            <Link href="/projects" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {myProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
              <Briefcase className="w-8 h-8 text-gray-200" />Keine Projekte zugewiesen
            </div>
          ) : (
            <div className="space-y-2">
              {myProjects.slice(0, 6).map(project => {
                const myRole = project.leadConsultantId === user.id ? 'Lead' : project.members?.find(m => m.userId === user.id)?.role || 'Mitglied'
                const budgetUsed = project.budgetActual && project.budgetPlanned ? Math.min(Math.round((project.budgetActual / project.budgetPlanned) * 100), 100) : null
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}
                    className="flex items-center gap-4 p-3.5 bg-gray-50 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-200 transition-all group">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-xs shrink-0">
                      {project.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{project.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLOR[project.status] || 'bg-gray-100 text-gray-600'}`}>
                          {project.status}
                        </span>
                        {myRole === 'Lead' && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Lead</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 truncate">{project.account?.companyName || project.projectType || ''}</p>
                        {budgetUsed !== null && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${budgetUsed > 90 ? 'bg-red-500' : budgetUsed > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${budgetUsed}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{budgetUsed}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                  </Link>
                )
              })}
              {myProjects.length > 6 && (
                <Link href="/projects" className="block text-center text-xs text-blue-600 hover:text-blue-700 py-2">
                  +{myProjects.length - 6} weitere Projekte →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Meine Aufgaben */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" />Meine Aufgaben
            </h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-green-600 text-sm gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />Keine offenen Aufgaben
            </div>
          ) : (
            <ul className="space-y-1.5">
              {upcomingTasks.map(task => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < now
                const isDueToday = task.dueDate && task.dueDate.startsWith(now.toISOString().split('T')[0])
                return (
                  <li key={task.id} onClick={() => setSelectedTask(task)}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors">
                    <div className={`mt-0.5 shrink-0 ${isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-500' : 'text-gray-300'}`}>
                      <Circle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate group-hover:text-blue-700 transition-colors">{task.title}</p>
                      {task.dueDate && (
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" />
                          {isOverdue ? 'Überfällig · ' : isDueToday ? 'Heute · ' : ''}{formatDate(task.dueDate)}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      task.priority === 'Critical' || task.priority === 'High' ? 'bg-red-100 text-red-600' :
                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                    }`}>{task.priority}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Productivity chart + Timesheet status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Productivity chart */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-600" />Produktivität diese Woche
            </h2>
            <Link href="/timesheets" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Zeiterfassung <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" />Abrechenbar</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />Intern</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-1 border-t-2 border-dashed border-amber-400 inline-block" />Tagesziel (8h)</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={productivityData} barSize={20} barGap={4} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 10]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={8} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1.5} />
              <Bar dataKey="billable" name="billable" stackId="a" fill="#14b8a6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="internal" name="internal" stackId="a" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-6 text-sm border-t border-gray-100 pt-3">
            <div><p className="text-xs text-gray-500">Gesamt</p><p className="font-bold text-gray-900">{hoursThisWeek.toFixed(1)}h</p></div>
            <div><p className="text-xs text-gray-500">Abrechenbar</p><p className="font-bold text-teal-600">{billableThisWeek.toFixed(1)}h</p></div>
            <div><p className="text-xs text-gray-500">Quote</p>
              <p className="font-bold text-gray-900">
                {hoursThisWeek > 0 ? `${Math.round((billableThisWeek / hoursThisWeek) * 100)}%` : '–'}
              </p>
            </div>
            <div><p className="text-xs text-gray-500">Ø pro Tag</p><p className="font-bold text-gray-900">{(hoursThisWeek / 5).toFixed(1)}h</p></div>
          </div>
        </div>

        {/* Timesheet card */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />Stundenzettel
            </h2>
            <Link href="/timesheets" className="text-xs text-blue-600 hover:text-blue-700">Öffnen</Link>
          </div>

          {!timesheet ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
              <Clock className="w-10 h-10 text-gray-200" />
              <p className="text-sm">Kein Stundenzettel diese Woche</p>
              <Link href="/timesheets" className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Zeit erfassen
              </Link>
            </div>
          ) : (
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">KW {Math.ceil((new Date(timesheet.weekStart).getDate() + new Date(timesheet.weekStart).getDay()) / 7)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${tsStatusMap[timesheet.status]?.cls}`}>
                  {tsStatusMap[timesheet.status]?.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-teal-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-teal-700">{hoursThisWeek.toFixed(1)}h</p>
                  <p className="text-xs text-teal-600">Gesamt</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-blue-700">{billableThisWeek.toFixed(1)}h</p>
                  <p className="text-xs text-blue-600">Abrechenbar</p>
                </div>
              </div>

              {timesheet.status === 'returned' && timesheet.comment && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <p className="font-medium mb-0.5">Kommentar:</p>
                  <p>{timesheet.comment}</p>
                </div>
              )}

              {timesheet.status === 'draft' && hoursThisWeek > 0 && (
                <button onClick={handleSubmitTimesheet} disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Einreichen
                </button>
              )}
              {timesheet.status === 'returned' && (
                <Link href="/timesheets" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
                  <RotateCcw className="w-4 h-4" /> Korrigieren
                </Link>
              )}
              {timesheet.status === 'approved' && (
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium py-2">
                  <CheckCircle2 className="w-5 h-5" />Genehmigt
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming activities */}
      {upcomingActivities.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />Bevorstehende Aktivitäten
            </h2>
            <Link href="/activities" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">Alle <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {upcomingActivities.map(activity => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className={`w-2 h-full min-h-[2.5rem] rounded-full shrink-0 ${
                  activity.type === 'Meeting' ? 'bg-green-400' :
                  activity.type === 'Phone Call' ? 'bg-blue-400' : 'bg-purple-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.summary || '(kein Betreff)'}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{activity.account?.companyName || activity.project?.name || ''}</p>
                  {activity.date && (
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      {new Date(activity.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {' · '}{new Date(activity.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskDetailModal
        task={selectedTask} isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={(updated) => { setMyTasks(prev => prev.map(t => t.id === updated.id ? updated : t)); setSelectedTask(null) }}
        onDeleted={(id) => setMyTasks(prev => prev.filter(t => t.id !== id))}
        accounts={[]} users={[]} projects={allProjects}
      />
    </div>
  )
}

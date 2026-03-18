'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Plus, TrendingUp, X, BarChart2, Target, Trophy, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import KanbanColumn from '@/components/pipeline/KanbanColumn'
import DealCard from '@/components/pipeline/DealCard'

const STAGES = ['First Contact', 'Needs Analysis', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']

const SERVICE_TYPES = [
  'Strategy Consulting',
  'Risk Management',
  'IT Consulting',
  'Regulatory Compliance',
  'Audit Support',
  'Change Management',
  'Process Optimization',
  'Data Analytics',
  'Other',
]

const SOURCES = ['Referral', 'Event', 'Inbound', 'Outbound', 'Other']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

function CreateDealModal({ isOpen, onClose, onCreated, accounts, contacts, users, defaultStage }) {
  const [form, setForm] = useState({
    title: '',
    accountId: '',
    contactId: '',
    serviceType: '',
    value: '',
    probability: '20',
    expectedCloseDate: '',
    source: '',
    assignedConsultantId: '',
    stage: defaultStage || 'First Contact',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (defaultStage) setForm((p) => ({ ...p, stage: defaultStage }))
  }, [defaultStage])

  function set(field, value) {
    setForm((p) => {
      const next = { ...p, [field]: value }
      // Reset contact when account changes
      if (field === 'accountId') next.contactId = ''
      return next
    })
  }

  const filteredContacts = form.accountId
    ? contacts.filter((c) => c.accounts?.some((ca) => ca.accountId === form.accountId))
    : contacts

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Titel ist erforderlich')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        value: form.value ? Number(form.value) : null,
        probability: form.probability ? Number(form.probability) : null,
        accountId: form.accountId || null,
        contactId: form.contactId || null,
        assignedConsultantId: form.assignedConsultantId || null,
      }
      const created = await api.post('/deals', payload)
      toast.success('Deal erstellt')
      onCreated(created)
      onClose()
      setForm({
        title: '', accountId: '', contactId: '', serviceType: '', value: '',
        probability: '20', expectedCloseDate: '', source: '',
        assignedConsultantId: '', stage: 'First Contact', notes: '',
      })
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Neuer Deal</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={CLS_LABEL}>Titel <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Basel IV Umsetzung Projekt"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Account</label>
                <select value={form.accountId} onChange={(e) => set('accountId', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Kein Account --</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Ansprechpartner</label>
                <select value={form.contactId} onChange={(e) => set('contactId', e.target.value)} className={CLS_INPUT} disabled={!form.accountId}>
                  <option value="">{form.accountId ? '-- Keiner --' : '-- Erst Account wählen --'}</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Service-Typ</label>
                <select value={form.serviceType} onChange={(e) => set('serviceType', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Phase</label>
                <select value={form.stage} onChange={(e) => set('stage', e.target.value)} className={CLS_INPUT}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Deal-Wert (€)</label>
                <input
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => set('value', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="z.B. 120000"
                />
              </div>
              <div>
                <label className={CLS_LABEL}>Wahrscheinlichkeit (%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.probability}
                    onChange={(e) => set('probability', e.target.value)}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-blue-600 w-10 text-right">{form.probability}%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Erwarteter Abschluss</label>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Quelle</label>
                <select value={form.source} onChange={(e) => set('source', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Zuständiger Consultant</label>
              <select value={form.assignedConsultantId} onChange={(e) => set('assignedConsultantId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Keiner --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Notizen</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className={`${CLS_INPUT} resize-none`}
                placeholder="Weitere Informationen..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Erstellen...' : 'Deal erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const SERVICE_TYPE_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
]

const MONTH_NAMES_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function ForecastTable({ deals, emptyText }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0)
  const totalWeighted = deals.reduce((s, d) => s + (d.value || 0) * ((d.probability || 0) / 100), 0)
  if (deals.length === 0) return (
    <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-400">
      <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
      <p className="text-sm">{emptyText}</p>
    </div>
  )
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Titel</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Phase</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Wert</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Wahr.</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Gewichtet</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Abschluss</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deals.map((d) => {
            const weighted = (d.value || 0) * ((d.probability || 0) / 100)
            return (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{d.title}</td>
                <td className="px-4 py-3 text-gray-600">{d.account?.companyName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{d.stage}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(d.value || 0)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{d.probability || 0}%</td>
                <td className="px-4 py-3 text-right font-medium text-indigo-600">{formatCurrency(weighted)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(d.expectedClose)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td colSpan={3} className="px-4 py-3 font-semibold text-gray-900">Gesamt</td>
            <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalValue)}</td>
            <td />
            <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(totalWeighted)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MonthlyForecastView({ deals }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [subView, setSubView] = useState('monthly') // 'monthly' | 'yearly'

  // --- Monthly ---
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const monthDeals = deals.filter((d) => {
    if (!d.expectedClose || ['Won', 'Lost'].includes(d.stage)) return false
    const c = new Date(d.expectedClose)
    return c >= monthStart && c <= monthEnd
  }).sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))

  const monthServiceMap = {}
  monthDeals.forEach((d) => {
    const key = d.serviceType || 'Other'
    if (!monthServiceMap[key]) monthServiceMap[key] = { serviceType: key, weighted: 0 }
    monthServiceMap[key].weighted += (d.value || 0) * ((d.probability || 0) / 100)
  })
  const monthChartData = Object.values(monthServiceMap).sort((a, b) => b.weighted - a.weighted)

  const monthTotalValue = monthDeals.reduce((s, d) => s + (d.value || 0), 0)
  const monthTotalWeighted = monthDeals.reduce((s, d) => s + (d.value || 0) * ((d.probability || 0) / 100), 0)
  const monthLabel = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // --- Yearly ---
  const [yearlyYear, setYearlyYear] = useState(now.getFullYear())

  const yearDeals = deals.filter((d) => {
    if (!d.expectedClose || ['Won', 'Lost'].includes(d.stage)) return false
    return new Date(d.expectedClose).getFullYear() === yearlyYear
  }).sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))

  // Monthly breakdown for chart (Jan–Dec)
  const yearChartData = MONTH_NAMES_DE.map((name, idx) => {
    const mDeals = yearDeals.filter((d) => new Date(d.expectedClose).getMonth() === idx)
    return {
      month: name,
      weighted: mDeals.reduce((s, d) => s + (d.value || 0) * ((d.probability || 0) / 100), 0),
      total: mDeals.reduce((s, d) => s + (d.value || 0), 0),
      count: mDeals.length,
    }
  })

  const yearTotalValue = yearDeals.reduce((s, d) => s + (d.value || 0), 0)
  const yearTotalWeighted = yearDeals.reduce((s, d) => s + (d.value || 0) * ((d.probability || 0) / 100), 0)

  return (
    <div className="space-y-5">
      {/* Header with sub-view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
        <h2 className="text-lg font-semibold text-gray-900">Forecast</h2>

        {/* Monatlich / Jährlich toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSubView('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${subView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Monatlich
          </button>
          <button
            onClick={() => setSubView('yearly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${subView === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Jährlich
          </button>
        </div>

        {/* Month navigator */}
        {subView === 'monthly' && (
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[150px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} className="ml-1 text-xs text-blue-600 hover:underline">
                Heute
              </button>
            )}
            <span className="ml-2 text-sm text-gray-500">{monthDeals.length} Deals</span>
          </div>
        )}

        {/* Year navigator */}
        {subView === 'yearly' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setYearlyYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">{yearlyYear}</span>
            <button onClick={() => setYearlyYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            {yearlyYear !== now.getFullYear() && (
              <button onClick={() => setYearlyYear(now.getFullYear())} className="ml-1 text-xs text-blue-600 hover:underline">
                Heute
              </button>
            )}
            <span className="ml-2 text-sm text-gray-500">{yearDeals.length} Deals</span>
          </div>
        )}
      </div>

      {/* ── MONTHLY VIEW ── */}
      {subView === 'monthly' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Deals diesen Monat</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{monthDeals.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gesamtwert</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(monthTotalValue)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gewichteter Umsatz</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(monthTotalWeighted)}</p>
            </div>
          </div>

          {monthChartData.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Gewichteter Umsatz nach Service-Typ</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthChartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="serviceType" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="weighted" name="Gewichtet" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {monthChartData.map((entry, idx) => (
                      <Cell key={entry.serviceType} fill={SERVICE_TYPE_COLORS[idx % SERVICE_TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <ForecastTable deals={monthDeals} emptyText="Keine Deals mit erwartetem Abschluss in diesem Monat" />
        </>
      )}

      {/* ── YEARLY VIEW ── */}
      {subView === 'yearly' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Deals {yearlyYear}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{yearDeals.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gesamtwert</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(yearTotalValue)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gewichteter Umsatz</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(yearTotalWeighted)}</p>
            </div>
          </div>

          {/* Bar chart: weighted revenue per month */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Gewichteter Umsatz pro Monat ({yearlyYear})</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yearChartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(v, name) => [formatCurrency(v), name === 'weighted' ? 'Gewichtet' : 'Gesamt']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="weighted" name="weighted" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {yearChartData.map((entry, idx) => (
                    <Cell key={entry.month} fill={entry.count > 0 ? '#6366f1' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ForecastTable deals={yearDeals} emptyText={`Keine Deals mit erwartetem Abschluss in ${yearlyYear}`} />
        </>
      )}
    </div>
  )
}

export default function PipelinePage() {
  const [deals, setDeals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [defaultStage, setDefaultStage] = useState('First Contact')
  const [activeDeal, setActiveDeal] = useState(null)
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterService, setFilterService] = useState('')
  const [view, setView] = useState('kanban') // 'kanban' | 'forecast'

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [d, a, c, u] = await Promise.all([
        api.get('/deals'),
        api.get('/accounts'),
        api.get('/contacts'),
        api.get('/users'),
      ])
      setDeals(Array.isArray(d) ? d : (d?.data || []))
      setAccounts(Array.isArray(a) ? a : (a?.data || []))
      setContacts(Array.isArray(c) ? c : (c?.data || []))
      setUsers(Array.isArray(u) ? u : (u?.data || []))
    } catch {
      toast.error('Fehler beim Laden der Pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filteredDeals = deals.filter((d) => {
    const matchConsultant =
      !filterConsultant ||
      String(d.assignedConsultantId) === filterConsultant ||
      String(d.assignedConsultant?.id) === filterConsultant
    const matchService =
      !filterService || d.serviceType === filterService
    return matchConsultant && matchService
  })

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = filteredDeals.filter((d) => d.stage === stage)
    return acc
  }, {})

  // Pipeline summary metrics
  const openDeals = filteredDeals.filter((d) => !['Won', 'Lost'].includes(d.stage))
  const wonDeals = filteredDeals.filter((d) => d.stage === 'Won')
  const lostDeals = filteredDeals.filter((d) => d.stage === 'Lost')
  const totalValue = filteredDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const weightedRevenue = filteredDeals.reduce(
    (s, d) => s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100),
    0
  )
  const winRate =
    wonDeals.length + lostDeals.length > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
      : 0

  function handleDragStart(event) {
    const deal = deals.find((d) => String(d.id) === event.active.id)
    setActiveDeal(deal || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveDeal(null)
    if (!over) return

    const dealId = active.id
    let newStage = over.id

    // If dropped on a card instead of the column, resolve to that card's stage
    if (!STAGES.includes(newStage)) {
      const overDeal = deals.find((d) => String(d.id) === String(newStage))
      if (!overDeal) return
      newStage = overDeal.stage
    }

    const deal = deals.find((d) => String(d.id) === dealId)
    if (!deal || deal.stage === newStage) return

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (String(d.id) === dealId ? { ...d, stage: newStage } : d))
    )

    // Only send the stage field to avoid Prisma rejecting nested objects
    api.put(`/deals/${dealId}`, { stage: newStage }).catch((err) => {
      toast.error(err.message || 'Fehler beim Aktualisieren')
      // Rollback
      setDeals((prev) =>
        prev.map((d) => (String(d.id) === dealId ? { ...d, stage: deal.stage } : d))
      )
    })
  }

  function openCreateForStage(stage) {
    setDefaultStage(stage)
    setShowCreate(true)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-sm text-gray-500">{openDeals.length} offene Deals</p>
          </div>
        </div>
        <button
          onClick={() => { setDefaultStage('First Contact'); setShowCreate(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Deal
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        {[
          {
            label: 'Gesamtwert',
            value: formatCurrency(totalValue),
            icon: BarChart2,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Gewichteter Umsatz',
            value: formatCurrency(weightedRevenue),
            icon: Target,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
          },
          {
            label: 'Offene Deals',
            value: openDeals.length.toString(),
            icon: TrendingUp,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
          },
          {
            label: 'Win Rate',
            value: `${winRate}%`,
            icon: Trophy,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${bg} shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* View toggle + Filter bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* View toggle pills */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView('forecast')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === 'forecast' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monats-Forecast
          </button>
        </div>

        <select
          value={filterConsultant}
          onChange={(e) => setFilterConsultant(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Alle Consultants</option>
          {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Alle Service-Typen</option>
          {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterConsultant || filterService) && (
          <button
            onClick={() => { setFilterConsultant(''); setFilterService('') }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Monthly Forecast View */}
      {view === 'forecast' && !loading && (
        <div className="flex-1">
          <MonthlyForecastView deals={filteredDeals} />
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm text-gray-500">Pipeline wird geladen...</p>
          </div>
        </div>
      ) : view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage] || []}
                onAddDeal={openCreateForStage}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <DealCard deal={activeDeal} isDragOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      <CreateDealModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(deal) => setDeals((prev) => [deal, ...prev])}
        accounts={accounts}
        contacts={contacts}
        users={users}
        defaultStage={defaultStage}
      />
    </div>
  )
}

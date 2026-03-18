'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Calculator, Download, Check, AlertTriangle } from 'lucide-react'

function fmtEur(n) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('de-DE') : '–' }
function monthLabel(m) { const [y, mo] = m.split('-'); return new Date(y, mo - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }) }

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b']

const INVOICE_STATUS = {
  pending:  { label: 'Offen',      cls: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Genehmigt',  cls: 'bg-blue-100 text-blue-800' },
  paid:     { label: 'Bezahlt',    cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Abgelehnt', cls: 'bg-red-100 text-red-800' },
}

const INV_CATEGORIES = [
  { value: 'subcontractor', label: 'Subunternehmer' },
  { value: 'travel',        label: 'Reisekosten' },
  { value: 'software',      label: 'Software' },
  { value: 'office',        label: 'Büro' },
  { value: 'other',         label: 'Sonstiges' },
]

function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'blue', warn }) {
  const colorMap = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    red:    'bg-red-50 border-red-100 text-red-700',
    gray:   'bg-gray-50 border-gray-100 text-gray-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      {warn && <p className="text-xs mt-1 flex items-center gap-1 text-orange-600"><AlertTriangle className="w-3 h-3" />{warn}</p>}
    </div>
  )
}

// ─── Kostenübersicht Tab ──────────────────────────────────────────────────────
function KostenTab() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/buchhaltung/overview')
      .then(setData)
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Laden…</div>
  if (!data)   return <div className="p-8 text-center text-gray-400 text-sm">Keine Daten</div>

  const { expenses, materialCosts, incomingInvoices, monthly } = data

  const pieData = [
    { name: 'Reisekosten',     value: expenses.approved },
    { name: 'Materialkosten',  value: materialCosts.approved },
    { name: 'Eingangsrechn.',  value: incomingInvoices.total },
  ].filter(d => d.value > 0)

  const chartData = monthly.map(m => ({
    name: monthLabel(m.month),
    Reisekosten:     Math.round(m.expenses),
    Materialkosten:  Math.round(m.materialCosts),
    Eingangsrechn:   Math.round(m.incomingInvoices),
  }))

  const totalApproved = expenses.approved + materialCosts.approved

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Reisekosten (genehmigt)"    value={fmtEur(expenses.approved)}         sub={`${fmtEur(expenses.pending)} ausstehend`}        color="blue" />
        <KpiCard label="Materialkosten (genehmigt)" value={fmtEur(materialCosts.approved)}     sub={`${fmtEur(materialCosts.pending)} ausstehend`}   color="blue" />
        <KpiCard label="Eingangsrechn. offen"       value={fmtEur(incomingInvoices.open)}      color="yellow"
          warn={incomingInvoices.overdue > 0 ? `${fmtEur(incomingInvoices.overdue)} überfällig` : undefined} />
        <KpiCard label="Eingangsrechn. bezahlt (YTD)" value={fmtEur(incomingInvoices.ytd)}    color="green" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Kosten der letzten 6 Monate</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtEur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Reisekosten"    fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="Materialkosten" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="Eingangsrechn"  fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Kostenverteilung</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtEur(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{fmtEur(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">Keine Daten</div>
          )}
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Kostenübersicht</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Kostenart</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">Genehmigt / Bezahlt</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">Ausstehend / Offen</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="px-5 py-3 font-medium">Reisekosten</td>
              <td className="px-5 py-3 text-right text-green-700">{fmtEur(expenses.approved)}</td>
              <td className="px-5 py-3 text-right text-yellow-700">{fmtEur(expenses.pending)}</td>
              <td className="px-5 py-3 text-right font-medium">{fmtEur(expenses.total)}</td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="px-5 py-3 font-medium">Materialkosten</td>
              <td className="px-5 py-3 text-right text-green-700">{fmtEur(materialCosts.approved)}</td>
              <td className="px-5 py-3 text-right text-yellow-700">{fmtEur(materialCosts.pending)}</td>
              <td className="px-5 py-3 text-right font-medium">{fmtEur(materialCosts.total)}</td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="px-5 py-3 font-medium">Eingangsrechnungen</td>
              <td className="px-5 py-3 text-right text-green-700">{fmtEur(incomingInvoices.paid)}</td>
              <td className="px-5 py-3 text-right text-yellow-700">{fmtEur(incomingInvoices.open)}</td>
              <td className="px-5 py-3 text-right font-medium">{fmtEur(incomingInvoices.total)}</td>
            </tr>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-5 py-3">Gesamt</td>
              <td className="px-5 py-3 text-right text-green-700">{fmtEur(expenses.approved + materialCosts.approved + incomingInvoices.paid)}</td>
              <td className="px-5 py-3 text-right text-yellow-700">{fmtEur(expenses.pending + materialCosts.pending + incomingInvoices.open)}</td>
              <td className="px-5 py-3 text-right">{fmtEur(expenses.total + materialCosts.total + incomingInvoices.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Eingangsrechnungen (Accounting) Tab ─────────────────────────────────────
function EingangsrechnungenTab() {
  const [invoices, setInvoices]     = useState([])
  const [vendors, setVendors]       = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterVendor, setFilterVendor] = useState('')
  const [search, setSearch]         = useState('')
  const [paying, setPaying]         = useState(null)   // id being marked paid

  useEffect(() => {
    load()
    api.get('/incoming-invoices/vendors').then(setVendors).catch(() => {})
  }, [filterStatus])

  async function load() {
    try {
      const q = filterStatus ? `?status=${filterStatus}` : ''
      setInvoices(await api.get(`/incoming-invoices${q}`))
    } catch {}
  }

  async function handleMarkPaid(id) {
    try {
      await api.put(`/incoming-invoices/${id}/mark-paid`)
      toast.success('Als bezahlt markiert')
      setPaying(null)
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleApprove(id) {
    try {
      await api.put(`/incoming-invoices/${id}/approve`)
      toast.success('Genehmigt')
      load()
    } catch { toast.error('Fehler') }
  }

  async function exportCsv() {
    try {
      const token = localStorage.getItem('crm_token')
      const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
      const res = await fetch(`${base}/incoming-invoices/export/csv`, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'eingangsrechnungen.csv'; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  const filtered = invoices.filter(inv => {
    const vendor = inv.vendor?.name || inv.vendorName || ''
    if (filterVendor && inv.vendorId !== filterVendor) return false
    if (search && !vendor.toLowerCase().includes(search.toLowerCase()) && !(inv.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalOpen   = filtered.filter(i => ['pending','approved'].includes(i.status)).reduce((s, i) => s + (i.amountEur || i.amount), 0)
  const totalPaid   = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amountEur || i.amount), 0)
  const totalAll    = filtered.reduce((s, i) => s + (i.amountEur || i.amount), 0)
  const overdue     = filtered.filter(i => ['pending','approved'].includes(i.status) && i.dueDate && new Date(i.dueDate) < new Date())

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Offen"     value={fmtEur(totalOpen)}   color="yellow"
          warn={overdue.length > 0 ? `${overdue.length} überfällig` : undefined} />
        <KpiCard label="Bezahlt"   value={fmtEur(totalPaid)}   color="green" />
        <KpiCard label="Gesamt"    value={fmtEur(totalAll)}    color="gray" />
        <KpiCard label="Überfällig" value={fmtEur(overdue.reduce((s, i) => s + (i.amountEur || i.amount), 0))} color="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Lieferant / Rechnungsnr. suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(INVOICE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">Alle Lieferanten</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button onClick={exportCsv}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Invoice table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lieferant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rechnungsnr.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fälligkeit</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Keine Eingangsrechnungen gefunden</td></tr>
            ) : filtered.map(inv => {
              const s      = INVOICE_STATUS[inv.status] || INVOICE_STATUS.pending
              const days   = daysUntil(inv.dueDate)
              const isOverdue = ['pending','approved'].includes(inv.status) && days !== null && days < 0
              const isDueSoon = ['pending','approved'].includes(inv.status) && days !== null && days >= 0 && days <= 7
              const catLabel = INV_CATEGORIES.find(c => c.value === inv.category)?.label || inv.category
              return (
                <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 font-medium">{inv.vendor?.name || inv.vendorName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inv.invoiceNumber || '–'}</td>
                  <td className="px-4 py-3 text-gray-500">{catLabel}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3">
                    {inv.dueDate ? (
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-600'}`}>
                        {fmtDate(inv.dueDate)}
                        {isOverdue ? ` (${Math.abs(days)}d überfällig)` : isDueSoon ? ` (${days}d)` : ''}
                      </span>
                    ) : '–'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtEur(inv.amountEur || inv.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      {inv.status === 'pending' && (
                        <button onClick={() => handleApprove(inv.id)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                          Genehmigen
                        </button>
                      )}
                      {['pending','approved'].includes(inv.status) && (
                        paying === inv.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Bezahlen?</span>
                            <button onClick={() => handleMarkPaid(inv.id)}
                              className="flex items-center gap-0.5 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                              <Check className="w-3 h-3" /> Ja
                            </button>
                            <button onClick={() => setPaying(null)}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded">
                              Nein
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setPaying(inv.id)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                            Bezahlen
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-gray-700">Summe ({filtered.length} Rechnungen)</td>
                <td className="px-4 py-3 text-right">{fmtEur(totalAll)}</td>
                <td colSpan={2} className="px-4 py-3 text-xs text-gray-500">
                  {fmtEur(totalOpen)} offen · {fmtEur(totalPaid)} bezahlt
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BuchhaltungPage() {
  const [tab, setTab] = useState('kosten')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Buchhaltung</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'kosten',   label: 'Gesamtkosten' },
          { key: 'eingang',  label: 'Eingangsrechnungen' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kosten'  && <KostenTab />}
      {tab === 'eingang' && <EingangsrechnungenTab />}
    </div>
  )
}

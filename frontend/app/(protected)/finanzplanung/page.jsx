'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, Save, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtEur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
function fmtK(n) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k €`
  return `${n.toFixed(0)} €`
}

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTHS_FULL = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

const CATEGORIES = [
  { key: 'reisekosten',        label: 'Reisekosten',       color: '#3b82f6' },
  { key: 'materialkosten',     label: 'Materialkosten',    color: '#10b981' },
  { key: 'eingangsrechnungen', label: 'Eingangsrechn.',    color: '#f59e0b' },
  { key: 'einnahmen',          label: 'Einnahmen',         color: '#8b5cf6' },
]

function pct(actual, planned) {
  if (!planned) return null
  return Math.round((actual / planned) * 100)
}

function VarianceBadge({ actual, planned, inverse = false }) {
  const p = pct(actual, planned)
  if (p === null) return <span className="text-xs text-gray-400">–</span>
  const over = inverse ? p < 100 : p > 100
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {p}%
    </span>
  )
}

function KpiCard({ label, planned, actual, color = '#3b82f6', inverse = false }) {
  const diff    = actual - planned
  const diffPct = planned ? Math.round((diff / planned) * 100) : null
  const isOver  = inverse ? diff < 0 : diff > 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <p className="text-xl font-bold text-gray-900">{fmtEur(actual)}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400">Plan: {fmtEur(planned)}</span>
        {diffPct !== null && (
          <span className={`text-xs font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
            {diff >= 0 ? '+' : ''}{fmtEur(diff)} ({diffPct > 0 ? '+' : ''}{diffPct}%)
          </span>
        )}
      </div>
      {planned > 0 && (
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{
            width: `${Math.min(100, (actual / planned) * 100)}%`,
            background: isOver ? '#ef4444' : color,
          }} />
        </div>
      )}
    </div>
  )
}

// ─── Jahresübersicht Tab ──────────────────────────────────────────────────────
function UebersichtTab({ year }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/finanzplanung/overview?year=${year}`)
      .then(setData)
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return <div className="p-12 text-center text-gray-400 text-sm">Laden…</div>
  if (!data)   return null

  const { months, totals } = data

  const chartData = months.map((m, i) => ({
    name: MONTHS_DE[i],
    Reisekosten:    Math.round(m.actual.reisekosten),
    Materialkosten: Math.round(m.actual.materialkosten),
    Eingangsrechn:  Math.round(m.actual.eingangsrechnungen),
    Einnahmen:      Math.round(m.actual.einnahmen),
    'Plan Kosten':  Math.round(m.planned.totalKosten),
    'Plan Einnahmen': Math.round(m.planned.einnahmen),
  }))

  const ergebnisData = months.map((m, i) => ({
    name: MONTHS_DE[i],
    Ergebnis:      Math.round(m.actual.einnahmen - m.actual.totalKosten),
    'Plan Ergebnis': Math.round(m.planned.einnahmen - m.planned.totalKosten),
  }))

  const totalKostenAct  = totals.actual.totalKosten
  const totalKostenPlan = totals.planned.totalKosten
  const totalEinAct     = totals.actual.einnahmen
  const totalEinPlan    = totals.planned.einnahmen
  const ergebnisAct     = totalEinAct  - totalKostenAct
  const ergebnisPlan    = totalEinPlan - totalKostenPlan

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Einnahmen (Ist)"    actual={totalEinAct}    planned={totalEinPlan}    color="#8b5cf6" inverse />
        <KpiCard label="Gesamtkosten (Ist)" actual={totalKostenAct} planned={totalKostenPlan} color="#ef4444" />
        <KpiCard label="Ergebnis (Ist)"     actual={ergebnisAct}    planned={ergebnisPlan}    color={ergebnisAct >= 0 ? '#10b981' : '#ef4444'} inverse />
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Budget-Auslastung Kosten</p>
          {totalKostenPlan > 0 ? (
            <>
              <p className="text-xl font-bold text-gray-900">{Math.round((totalKostenAct / totalKostenPlan) * 100)}%</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(100, (totalKostenAct / totalKostenPlan) * 100)}%`,
                  background: totalKostenAct > totalKostenPlan ? '#ef4444' : '#3b82f6',
                }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmtEur(totalKostenAct)} von {fmtEur(totalKostenPlan)}</p>
            </>
          ) : <p className="text-sm text-gray-400 mt-2">Kein Budget gesetzt</p>}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked cost bars + plan line */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Kosten vs. Einnahmen pro Monat</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={v => fmtEur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Reisekosten"    stackId="kosten" fill="#3b82f6" radius={[0,0,0,0]} />
              <Bar dataKey="Materialkosten" stackId="kosten" fill="#10b981" radius={[0,0,0,0]} />
              <Bar dataKey="Eingangsrechn"  stackId="kosten" fill="#f59e0b" radius={[3,3,0,0]} />
              <Bar dataKey="Einnahmen"      fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ergebnis line chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monatliches Ergebnis (Einnahmen – Kosten)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={ergebnisData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={v => fmtEur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={2} />
              <Line type="monotone" dataKey="Ergebnis"       stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Plan Ergebnis"  stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly detail table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Monatliche Übersicht — Plan vs. Ist</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Monat</th>
                <th className="text-right px-3 py-2.5 font-medium" colSpan={2}>Einnahmen</th>
                <th className="text-right px-3 py-2.5 font-medium" colSpan={2}>Reisekosten</th>
                <th className="text-right px-3 py-2.5 font-medium" colSpan={2}>Materialkosten</th>
                <th className="text-right px-3 py-2.5 font-medium" colSpan={2}>Eingangsrechn.</th>
                <th className="text-right px-3 py-2.5 font-medium">Ergebnis</th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-1.5 text-left text-gray-400 font-normal"></th>
                {['Einnahmen','Reisekosten','Materialkosten','Eingangsrechn.'].map(c => (
                  <>
                    <th key={`${c}-p`} className="px-3 py-1.5 text-right text-gray-400 font-normal">Plan</th>
                    <th key={`${c}-i`} className="px-3 py-1.5 text-right text-gray-400 font-normal">Ist</th>
                  </>
                ))}
                <th className="px-3 py-1.5 text-right text-gray-400 font-normal">Ist</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const ergebnis = m.actual.einnahmen - m.actual.totalKosten
                const isCurrent = new Date().getMonth() === i && new Date().getFullYear() === year
                return (
                  <tr key={m.month} className={`border-b border-gray-50 hover:bg-gray-50 ${isCurrent ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">
                      {MONTHS_FULL[i]}
                      {isCurrent && <span className="ml-1.5 text-xs text-blue-500">(aktuell)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmtEur(m.planned.einnahmen)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-purple-700">{fmtEur(m.actual.einnahmen)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmtEur(m.planned.reisekosten)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtEur(m.actual.reisekosten)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmtEur(m.planned.materialkosten)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtEur(m.actual.materialkosten)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmtEur(m.planned.eingangsrechnungen)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtEur(m.actual.eingangsrechnungen)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${ergebnis >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmtEur(ergebnis)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-sm">
              <tr>
                <td className="px-4 py-3">Gesamt</td>
                <td className="px-3 py-3 text-right text-gray-400">{fmtEur(totals.planned.einnahmen)}</td>
                <td className="px-3 py-3 text-right text-purple-700">{fmtEur(totals.actual.einnahmen)}</td>
                <td className="px-3 py-3 text-right text-gray-400">{fmtEur(totals.planned.reisekosten)}</td>
                <td className="px-3 py-3 text-right">{fmtEur(totals.actual.reisekosten)}</td>
                <td className="px-3 py-3 text-right text-gray-400">{fmtEur(totals.planned.materialkosten)}</td>
                <td className="px-3 py-3 text-right">{fmtEur(totals.actual.materialkosten)}</td>
                <td className="px-3 py-3 text-right text-gray-400">{fmtEur(totals.planned.eingangsrechnungen)}</td>
                <td className="px-3 py-3 text-right">{fmtEur(totals.actual.eingangsrechnungen)}</td>
                <td className={`px-3 py-3 text-right ${ergebnisAct >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtEur(ergebnisAct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Budgetplanung Tab ────────────────────────────────────────────────────────
function BudgetplanungTab({ year }) {
  // grid[month][category] = planned value string
  const [grid, setGrid]       = useState({})
  const [actuals, setActuals] = useState({})
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)

  useEffect(() => {
    loadAll()
  }, [year])

  async function loadAll() {
    try {
      const [overview, budgets] = await Promise.all([
        api.get(`/finanzplanung/overview?year=${year}`),
        api.get(`/finanzplanung/budgets?year=${year}`),
      ])
      // Populate grid from budgets
      const g = {}
      for (let m = 1; m <= 12; m++) {
        g[m] = { reisekosten: '', materialkosten: '', eingangsrechnungen: '', einnahmen: '' }
      }
      budgets.forEach(b => {
        if (g[b.month]) g[b.month][b.category] = b.planned > 0 ? String(b.planned) : ''
      })
      setGrid(g)
      // Populate actuals from overview
      const a = {}
      overview.months.forEach(mo => { a[mo.month] = mo.actual })
      setActuals(a)
      setDirty(false)
    } catch { toast.error('Fehler beim Laden') }
  }

  function setValue(month, cat, val) {
    setGrid(prev => ({ ...prev, [month]: { ...prev[month], [cat]: val } }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const entries = []
      for (let m = 1; m <= 12; m++) {
        CATEGORIES.forEach(c => {
          entries.push({ month: m, category: c.key, planned: parseFloat(grid[m]?.[c.key]) || 0 })
        })
      }
      await api.put('/finanzplanung/budgets/bulk', { year, entries })
      toast.success('Budget gespeichert')
      setDirty(false)
    } catch { toast.error('Fehler beim Speichern') }
    setSaving(false)
  }

  const colTotals = {}
  CATEGORIES.forEach(c => {
    colTotals[c.key] = {
      planned: Object.values(grid).reduce((s, row) => s + (parseFloat(row?.[c.key]) || 0), 0),
      actual:  Object.values(actuals).reduce((s, a) => s + (a?.[c.key] || 0), 0),
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Planzahlen für <strong>{year}</strong> eintragen. Leere Felder = kein Budget.</p>
        <button onClick={save} disabled={saving || !dirty}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}>
          <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Monat</th>
              {CATEGORIES.map(c => (
                <th key={c.key} colSpan={2} className="text-center px-2 py-3 font-medium text-gray-600" style={{ color: c.color }}>
                  {c.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-2"></th>
              {CATEGORIES.map(c => (
                <>
                  <th key={`${c.key}-p`} className="px-2 py-2 text-center font-normal">Plan (€)</th>
                  <th key={`${c.key}-i`} className="px-2 py-2 text-center font-normal">Ist</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const isCurrentMonth = new Date().getMonth() + 1 === m && new Date().getFullYear() === year
              return (
                <tr key={m} className={`border-b border-gray-50 ${isCurrentMonth ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-700">
                    {MONTHS_FULL[m - 1]}
                    {isCurrentMonth && <div className="text-xs text-blue-400 font-normal">aktuell</div>}
                  </td>
                  {CATEGORIES.map(c => {
                    const planned = parseFloat(grid[m]?.[c.key]) || 0
                    const actual  = actuals[m]?.[c.key] || 0
                    const over    = planned > 0 && actual > planned && c.key !== 'einnahmen'
                    const under   = planned > 0 && actual < planned && c.key === 'einnahmen'
                    return (
                      <>
                        <td key={`${m}-${c.key}-p`} className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={grid[m]?.[c.key] ?? ''}
                            onChange={e => setValue(m, c.key, e.target.value)}
                            placeholder="0"
                            className="w-28 border border-gray-200 rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                        </td>
                        <td key={`${m}-${c.key}-i`} className={`px-2 py-2 text-right text-xs font-medium ${over ? 'text-red-600' : under ? 'text-orange-500' : actual > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {actual > 0 ? fmtEur(actual) : '–'}
                          {planned > 0 && actual > 0 && (
                            <div className={`text-xs font-normal mt-0.5 ${over || under ? 'text-red-500' : 'text-gray-400'}`}>
                              {Math.round((actual / planned) * 100)}%
                            </div>
                          )}
                        </td>
                      </>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-sm">
            <tr>
              <td className="px-4 py-3 text-gray-700">Gesamt</td>
              {CATEGORIES.map(c => (
                <>
                  <td key={`tot-${c.key}-p`} className="px-2 py-3 text-right text-gray-500 text-xs">
                    {colTotals[c.key].planned > 0 ? fmtEur(colTotals[c.key].planned) : '–'}
                  </td>
                  <td key={`tot-${c.key}-i`} className="px-2 py-3 text-right text-xs font-medium">
                    {fmtEur(colTotals[c.key].actual)}
                  </td>
                </>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Prognose Tab ─────────────────────────────────────────────────────────────
function PrognoseTab({ year }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/finanzplanung/overview?year=${year}`)
      .then(setData)
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return <div className="p-12 text-center text-gray-400 text-sm">Laden…</div>
  if (!data)   return null

  const { months, totals } = data
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12
  const elapsed = Math.min(currentMonth, 12)

  // YTD actuals (up to current month)
  const ytd = {}
  CATEGORIES.forEach(c => {
    ytd[c.key] = months.slice(0, elapsed).reduce((s, m) => s + (m.actual[c.key] || 0), 0)
  })

  // Full-year forecast = YTD / elapsed × 12
  const forecast = {}
  CATEGORIES.forEach(c => {
    forecast[c.key] = elapsed > 0 ? (ytd[c.key] / elapsed) * 12 : 0
  })

  // Variance = planned - forecast (positive = under budget, negative = over)
  const variance = {}
  CATEGORIES.forEach(c => {
    variance[c.key] = (totals.planned[c.key] || 0) - forecast[c.key]
  })

  function trafficLight(cat) {
    const plan = totals.planned[cat] || 0
    const fore = forecast[cat]
    if (!plan) return 'gray'
    const ratio = fore / plan
    if (cat === 'einnahmen') return ratio >= 0.95 ? 'green' : ratio >= 0.80 ? 'yellow' : 'red'
    return ratio <= 1.05 ? 'green' : ratio <= 1.15 ? 'yellow' : 'red'
  }

  const trafficColors = { green: 'bg-green-100 text-green-700', yellow: 'bg-yellow-100 text-yellow-700', red: 'bg-red-100 text-red-700', gray: 'bg-gray-100 text-gray-500' }
  const trafficLabels = { green: 'Im Plan', yellow: 'Leicht abweichend', red: 'Kritisch', gray: 'Kein Budget' }

  const forecastChartData = months.map((m, i) => {
    const isFuture = i + 1 > elapsed
    const monthlyRun = elapsed > 0 ? ytd[Object.keys(ytd)[0]] / elapsed : 0
    return {
      name: MONTHS_DE[i],
      'Ist Einnahmen':  isFuture ? null : Math.round(m.actual.einnahmen),
      'Ist Kosten':     isFuture ? null : Math.round(m.actual.totalKosten),
      'Prognose Einnahmen': isFuture ? Math.round((forecast.einnahmen / 12)) : null,
      'Prognose Kosten':    isFuture ? Math.round((forecast.reisekosten + forecast.materialkosten + forecast.eingangsrechnungen) / 12) : null,
      'Plan Einnahmen': Math.round((totals.planned.einnahmen || 0) / 12),
      'Plan Kosten':    Math.round((totals.planned.totalKosten || 0) / 12),
    }
  })

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map(c => {
          const tl = trafficLight(c.key)
          return (
            <div key={c.key} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">{c.label}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trafficColors[tl]}`}>{trafficLabels[tl]}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{fmtEur(forecast[c.key])}</p>
              <p className="text-xs text-gray-400 mt-1">Prognose Jahresende</p>
              <div className="mt-2 text-xs flex justify-between">
                <span className="text-gray-400">Plan: {fmtEur(totals.planned[c.key] || 0)}</span>
                {totals.planned[c.key] > 0 && (
                  <span className={variance[c.key] >= 0 && c.key !== 'einnahmen' ? 'text-green-600' : variance[c.key] < 0 && c.key === 'einnahmen' ? 'text-red-600' : 'text-gray-600'}>
                    {variance[c.key] >= 0 ? '+' : ''}{fmtEur(variance[c.key])}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Forecast chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Jahresprognose</h3>
        <p className="text-xs text-gray-400 mb-4">Ist-Werte bis {MONTHS_FULL[elapsed - 1]}, danach Hochrechnung auf Basis des YTD-Durchschnitts</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={forecastChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={v => v !== null ? fmtEur(v) : '–'} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={MONTHS_DE[elapsed - 1]} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: 'Heute', fontSize: 10, fill: '#9ca3af' }} />
            <Line type="monotone" dataKey="Ist Einnahmen"        stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="Ist Kosten"           stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="Prognose Einnahmen"   stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="Prognose Kosten"      stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="Plan Einnahmen"       stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" dot={false} />
            <Line type="monotone" dataKey="Plan Kosten"          stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* YTD summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Hochrechnung auf Jahresende ({year})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Kategorie</th>
              <th className="text-right px-4 py-2.5 font-medium">Ist YTD</th>
              <th className="text-right px-4 py-2.5 font-medium">Prognose Jahresende</th>
              <th className="text-right px-4 py-2.5 font-medium">Plan Jahresende</th>
              <th className="text-right px-4 py-2.5 font-medium">Abweichung</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(c => {
              const tl       = trafficLight(c.key)
              const plan     = totals.planned[c.key] || 0
              const fore     = forecast[c.key]
              const vari     = variance[c.key]
              const isRev    = c.key === 'einnahmen'
              const goodVari = isRev ? vari >= 0 : vari >= 0
              return (
                <tr key={c.key} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium" style={{ color: c.color }}>{c.label}</td>
                  <td className="px-4 py-3 text-right">{fmtEur(ytd[c.key])}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtEur(fore)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{plan > 0 ? fmtEur(plan) : '–'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${plan > 0 ? (goodVari ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                    {plan > 0 ? `${vari >= 0 ? '+' : ''}${fmtEur(vari)}` : '–'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trafficColors[tl]}`}>{trafficLabels[tl]}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinanzplanungPage() {
  const [tab, setTab]   = useState('uebersicht')
  const [year, setYear] = useState(new Date().getFullYear())

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Finanzplanung</h1>
        </div>
        {/* Year selector */}
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm font-semibold text-gray-800 bg-gray-100 rounded-lg min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'uebersicht',    label: 'Jahresübersicht' },
          { key: 'budgetplanung', label: 'Budgetplanung' },
          { key: 'prognose',      label: 'Prognose' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'uebersicht'    && <UebersichtTab    year={year} />}
      {tab === 'budgetplanung' && <BudgetplanungTab year={year} />}
      {tab === 'prognose'      && <PrognoseTab      year={year} />}
    </div>
  )
}

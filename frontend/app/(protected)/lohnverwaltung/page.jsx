'use client'

import { useState, useEffect, useCallback } from 'react'
import { getUser } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Users, Banknote, TrendingUp, CheckCircle2, ChevronDown, ChevronUp,
  Edit2, Save, X, Lock, Unlock, Plus, Tag, Trash2, UserCheck,
  Calculator, Pencil, Info, RefreshCw, AlertTriangle, Printer, FileText,
} from 'lucide-react'

const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

const CONTRACT_LABELS = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  freelancer: 'Freiberufler',
  minijob: 'Minijob',
}

const STATUS_MAP = {
  draft:      { label: 'Entwurf',     cls: 'bg-yellow-100 text-yellow-800' },
  finalized:  { label: 'Finalisiert', cls: 'bg-green-100 text-green-800' },
}

function fmtEur(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0)
}

// ─── Bildungsgrad ───────────────────────────────────────────────────────────
const BILDUNG_LABELS = {
  ausbildung: 'Ausbildung',
  bachelor:   'Bachelor',
  master:     'Master / Diplom',
  promotion:  'Promotion (Dr.)',
}
const BILDUNG_MULTIPLIKATOREN = {
  ausbildung: 1.00,
  bachelor:   1.05,
  master:     1.12,
  promotion:  1.20,
}
const BILDUNG_COLORS = {
  ausbildung: 'bg-slate-100 text-slate-600',
  bachelor:   'bg-blue-100 text-blue-700',
  master:     'bg-purple-100 text-purple-700',
  promotion:  'bg-indigo-100 text-indigo-700',
}

// ─── Deutsche Lohnparameter 2025 ─────────────────────────────────────────────
const DE_RV_RATE   = 0.093
const DE_AV_RATE   = 0.013
const DE_KV_BASE   = 0.073
const DE_PV_RATE   = 0.017
const DE_PV_KL_ADD = 0.0035
const DE_BBG_RV_AV = 8050
const DE_BBG_KV_PV = 5512.5
const DE_TAX_RATES = { 1: 0.25, 2: 0.22, 3: 0.15, 4: 0.25, 5: 0.35, 6: 0.40 }

function calcDePayroll(gross, cfg = {}) {
  const {
    taxClass               = 1,
    kvZusatzbeitrag        = 1.7,
    pvKinderlos            = false,
    kirchensteuerPflichtig = false,
    kirchensteuerSatz      = 9,
    bvvBeitrag             = 0,
  } = cfg
  if (!gross || gross <= 0) return null
  const basisRV = Math.min(gross, DE_BBG_RV_AV)
  const basisKV = Math.min(gross, DE_BBG_KV_PV)
  const rv  = Math.round(basisRV * DE_RV_RATE * 100) / 100
  const av  = Math.round(basisRV * DE_AV_RATE * 100) / 100
  const kv  = Math.round(basisKV * (DE_KV_BASE + (kvZusatzbeitrag / 2) / 100) * 100) / 100
  const pv  = Math.round(basisKV * (DE_PV_RATE + (pvKinderlos ? DE_PV_KL_ADD : 0)) * 100) / 100
  const lst = Math.round(gross * (DE_TAX_RATES[taxClass] ?? 0.25) * 100) / 100
  const kist = kirchensteuerPflichtig ? Math.round(lst * (kirchensteuerSatz / 100) * 100) / 100 : 0
  const bvv  = parseFloat(bvvBeitrag) || 0
  const sv   = Math.round((rv + kv + pv + av) * 100) / 100
  const net  = Math.max(gross - lst - kist - sv - bvv, 0)
  return {
    incomeTax:               lst,
    kirchensteuer:           kist,
    rentenversicherung:      rv,
    krankenversicherung:     kv,
    pflegeversicherung:      pv,
    arbeitslosenversicherung:av,
    socialSecurity:          sv,
    bvv,
    netSalary:               Math.round(net * 100) / 100,
  }
}

// Shared auto-salary formula (identical to backend)
// 1. Erfahrung: linear 0–20 Jahre  2. Bildung: Multiplikator  3. Stunden: Faktor
const MAX_EXP_YEARS    = 20
const VOLLZEIT_STUNDEN = 40
function calcAutoSalary(tarifGruppe, erfahrungJahre, bildungsgrad, hoursPerWeek) {
  if (!tarifGruppe?.minSalary) return null
  const min = tarifGruppe.minSalary
  const max = tarifGruppe.maxSalary ?? min
  const ratio         = Math.min((parseFloat(erfahrungJahre) || 0) / MAX_EXP_YEARS, 1)
  const erfahrungsBasis = min + ratio * (max - min)
  const bildungsMult  = BILDUNG_MULTIPLIKATOREN[bildungsgrad] ?? 1.0
  const stundenFaktor = Math.min((parseFloat(hoursPerWeek) || VOLLZEIT_STUNDEN) / VOLLZEIT_STUNDEN, 1)
  return Math.round(erfahrungsBasis * bildungsMult * stundenFaktor)
}

function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Tab: Übersicht ────────────────────────────────────────────────────────

function UebersichtTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/lohnverwaltung/overview')
      .then(r => { if (r) setData(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-400 text-sm p-6">Lade...</p>
  if (!data) return null

  const chartData = (data.runs ?? []).map(r => ({
    name: `${MONTHS[r.month - 1]} ${r.year}`,
    Brutto: r.totalGross,
    Netto: r.totalNet,
  }))

  const currentRun = data.currentRun

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users}       label="Aktive Mitarbeiter"    value={data.employeeCount}    color="blue" />
        <KpiCard icon={Banknote}    label="Gehälter konfiguriert" value={data.configuredCount}  color="green" />
        <KpiCard icon={TrendingUp}  label="Bruttolohn gesamt (akt. Monat)" value={currentRun ? fmtEur(currentRun.totalGross) : '—'} color="purple" />
        <KpiCard icon={CheckCircle2} label="Nettolohn gesamt (akt. Monat)" value={currentRun ? fmtEur(currentRun.totalNet) : '—'} color="orange" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Lohnkosten — finalisierte Abrechnungen</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtEur(v)} />
              <Legend />
              <Bar dataKey="Brutto" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Netto"  fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Current run preview */}
      {currentRun && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Aktuelle Abrechnung — {MONTHS[currentRun.month - 1]} {currentRun.year}
            <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[currentRun.status]?.cls}`}>
              {STATUS_MAP[currentRun.status]?.label}
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                  <th className="pb-2 pr-4">Mitarbeiter</th>
                  <th className="pb-2 pr-4 text-right">Basis</th>
                  <th className="pb-2 pr-4 text-right">Bonus</th>
                  <th className="pb-2 pr-4 text-right">Brutto</th>
                  <th className="pb-2 text-right">Netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentRun.entries.slice(0, 8).map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium text-slate-700">{e.user.name}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{fmtEur(e.baseSalary)}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{fmtEur(e.bonus)}</td>
                    <td className="py-2 pr-4 text-right font-medium text-slate-700">{fmtEur(e.grossSalary)}</td>
                    <td className="py-2 text-right font-semibold text-green-700">{fmtEur(e.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentRun.entries.length > 8 && (
              <p className="text-xs text-slate-400 mt-2">+ {currentRun.entries.length - 8} weitere</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Gehälter ─────────────────────────────────────────────────────────

function GehälterTab() {
  const [employees, setEmployees] = useState([])
  const [tarifgruppen, setTarifgruppen] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null)
  const showAlert = (title, message) => setDialog({ title, message, confirmText: 'OK', variant: 'danger', confirmIcon: null })

  const load = useCallback(async () => {
    try {
      const [emps, groups] = await Promise.all([
        api.get('/lohnverwaltung/mitarbeiter'),
        api.get('/lohnverwaltung/tarifgruppen'),
      ])
      setEmployees(Array.isArray(emps) ? emps : [])
      setTarifgruppen(Array.isArray(groups) ? groups : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(emp) {
    setExpandedId(emp.id)
    setForm({
      tarifGruppeId:          emp.tarifGruppeId                    ?? '',
      erfahrungJahre:         emp.salary?.erfahrungJahre           ?? '',
      bildungsgrad:           emp.salary?.bildungsgrad              ?? '',
      salaryMode:             emp.salary?.salaryMode               ?? 'manual',
      baseSalary:             emp.salary?.baseSalary               ?? '',
      monthlyBonus:           emp.salary?.monthlyBonus             ?? 0,
      contractType:           emp.salary?.contractType             ?? 'fulltime',
      hoursPerWeek:           emp.salary?.hoursPerWeek             ?? 40,
      taxClass:               emp.salary?.taxClass                 ?? 1,
      kvZusatzbeitrag:        emp.salary?.kvZusatzbeitrag          ?? 1.7,
      pvKinderlos:            emp.salary?.pvKinderlos              ?? false,
      kirchensteuerPflichtig: emp.salary?.kirchensteuerPflichtig   ?? false,
      kirchensteuerSatz:      emp.salary?.kirchensteuerSatz        ?? 9,
      bvvBeitrag:             emp.salary?.bvvBeitrag               ?? 0,
      notes:                  emp.salary?.notes                    ?? '',
    })
  }

  function closeEdit() {
    setExpandedId(null)
    setForm({})
  }

  // Live preview of the auto-calculated salary in the edit form
  function previewAutoSalary() {
    const group = tarifgruppen.find(g => g.id === form.tarifGruppeId)
    return calcAutoSalary(group, form.erfahrungJahre, form.bildungsgrad, form.hoursPerWeek)
  }

  async function save(userId) {
    setSaving(true)
    try {
      await api.put(`/lohnverwaltung/mitarbeiter/${userId}`, form)
      closeEdit()
      load()
    } catch (err) {
      showAlert('Fehler beim Speichern', err.message || 'Ein Fehler ist aufgetreten.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm p-6">Lade...</p>

  return (
    <>
    {dialog && (
      <ConfirmDialog
        isOpen
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText ?? 'OK'}
        cancelText={dialog.cancelText ?? 'Schließen'}
        variant={dialog.variant ?? 'info'}
        confirmIcon={dialog.confirmIcon}
        onConfirm={() => { setDialog(null); dialog.onConfirm?.() }}
        onClose={() => setDialog(null)}
      />
    )}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <th className="px-4 py-3">Mitarbeiter</th>
            <th className="px-4 py-3">Tarifgruppe</th>
            <th className="px-4 py-3 text-right">Erfahrung</th>
            <th className="px-4 py-3">Bildungsgrad</th>
            <th className="px-4 py-3 text-center">Berechnungsart</th>
            <th className="px-4 py-3 text-right">Grundgehalt</th>
            <th className="px-4 py-3 text-right">Vertrag</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map(emp => {
            const isExpanded = expandedId === emp.id
            const autoVal = calcAutoSalary(emp.tarifGruppe, emp.salary?.erfahrungJahre, emp.salary?.bildungsgrad, emp.salary?.hoursPerWeek)

            return (
              <>
                {/* ── Read row ── */}
                <tr key={emp.id} className={`hover:bg-slate-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{emp.name}</p>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                  </td>

                  <td className="px-4 py-3">
                    {emp.tarifGruppe
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <Tag className="w-3 h-3" />{emp.tarifGruppe.name}
                        </span>
                      : <span className="text-xs text-slate-400 italic">Keine Gruppe</span>
                    }
                  </td>

                  <td className="px-4 py-3 text-right text-slate-600">
                    {emp.salary?.erfahrungJahre != null
                      ? `${emp.salary.erfahrungJahre} J.`
                      : '—'}
                  </td>

                  <td className="px-4 py-3">
                    {emp.salary?.bildungsgrad ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${BILDUNG_COLORS[emp.salary.bildungsgrad] ?? 'bg-slate-100 text-slate-600'}`}>
                        {BILDUNG_LABELS[emp.salary.bildungsgrad] ?? emp.salary.bildungsgrad}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {emp.salary ? (
                      emp.salary.salaryMode === 'auto'
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Calculator className="w-3 h-3" /> Automatisch
                          </span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            <Pencil className="w-3 h-3" /> Manuell
                          </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {emp.salary ? (
                      <div>
                        <p className="font-semibold text-slate-800">{fmtEur(emp.salary.baseSalary)}</p>
                        {emp.salary.monthlyBonus > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">+ {fmtEur(emp.salary.monthlyBonus)} Bonus</p>
                        )}
                        {emp.salary.salaryMode === 'auto' && autoVal !== null && (
                          <p className="text-xs text-green-600">≙ Tarif berechnet</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-orange-500 text-xs font-medium">Nicht konfiguriert</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-500 text-xs">
                    {emp.salary ? CONTRACT_LABELS[emp.salary.contractType] ?? '—' : '—'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {isExpanded ? (
                      <button
                        onClick={closeEdit}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200 ml-auto"
                      >
                        <X className="w-3 h-3" /> Schließen
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(emp)}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200 ml-auto"
                      >
                        <Edit2 className="w-3 h-3" /> Bearbeiten
                      </button>
                    )}
                  </td>
                </tr>

                {/* ── Edit panel ── */}
                {isExpanded && (
                  <tr key={`${emp.id}-edit`}>
                    <td colSpan={8} className="px-0 py-0 border-b border-blue-100">
                      <div className="bg-blue-50 px-6 py-5 space-y-5">

                        {/* Row 1: Tarifgruppe | Erfahrung | Bildungsgrad | Berechnungsart */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Tarifgruppe</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.tarifGruppeId}
                              onChange={e => setForm(f => ({ ...f, tarifGruppeId: e.target.value }))}
                            >
                              <option value="">— Keine Gruppe —</option>
                              {tarifgruppen.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                            {form.tarifGruppeId && (() => {
                              const g = tarifgruppen.find(x => x.id === form.tarifGruppeId)
                              if (!g) return null
                              return (
                                <p className="text-xs text-slate-400 mt-1">
                                  {g.minSalary != null ? fmtEur(g.minSalary) : '?'} – {g.maxSalary != null ? fmtEur(g.maxSalary) : '?'}
                                </p>
                              )
                            })()}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Erfahrung (Jahre)</label>
                            <input
                              type="number" min="0" max="50" step="0.5"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              placeholder="z.B. 5"
                              value={form.erfahrungJahre}
                              onChange={e => setForm(f => ({ ...f, erfahrungJahre: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Bildungsgrad</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.bildungsgrad}
                              onChange={e => setForm(f => ({ ...f, bildungsgrad: e.target.value }))}
                            >
                              <option value="">— Kein Abschluss —</option>
                              {Object.entries(BILDUNG_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                            {form.bildungsgrad && (
                              <p className="text-xs text-slate-400 mt-1">
                                Multiplikator: ×{BILDUNG_MULTIPLIKATOREN[form.bildungsgrad]?.toFixed(2)} ({form.bildungsgrad === 'ausbildung' ? 'Basis' : `+${Math.round((BILDUNG_MULTIPLIKATOREN[form.bildungsgrad] - 1) * 100)} %`})
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Berechnungsart</label>
                            <div className="flex rounded-lg overflow-hidden border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, salaryMode: 'auto' }))}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
                                  ${form.salaryMode === 'auto'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                              >
                                <Calculator className="w-3.5 h-3.5" /> Auto
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, salaryMode: 'manual' }))}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-slate-200
                                  ${form.salaryMode === 'manual'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                              >
                                <Pencil className="w-3.5 h-3.5" /> Manuell
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Gehalt | Bonus | Vertragsart | Std/Woche */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Grundgehalt (€/Monat brutto)
                            </label>
                            {form.salaryMode === 'auto' ? (
                              <div>
                                {(() => {
                                  const preview = previewAutoSalary()
                                  return preview !== null ? (
                                    <div className="flex items-center gap-2 h-10 px-3 bg-green-50 border border-green-200 rounded-lg">
                                      <Calculator className="w-4 h-4 text-green-600 shrink-0" />
                                      <span className="text-lg font-bold text-green-700">{fmtEur(preview)}</span>
                                      <span className="text-xs text-green-500 ml-auto">wird gespeichert</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 h-10 px-3 bg-amber-50 border border-amber-200 rounded-lg">
                                      <Info className="w-4 h-4 text-amber-500 shrink-0" />
                                      <span className="text-xs text-amber-600">
                                        Tarifgruppe mit Mindestgehalt wählen
                                      </span>
                                    </div>
                                  )
                                })()}
                                {form.tarifGruppeId && (() => {
                                  const g = tarifgruppen.find(x => x.id === form.tarifGruppeId)
                                  const yrs   = parseFloat(form.erfahrungJahre) || 0
                                  const mult  = BILDUNG_MULTIPLIKATOREN[form.bildungsgrad] ?? 1.0
                                  const hrs   = parseFloat(form.hoursPerWeek) || VOLLZEIT_STUNDEN
                                  const stFak = Math.min(hrs / VOLLZEIT_STUNDEN, 1)
                                  return g?.minSalary ? (
                                    <p className="text-xs text-slate-400 mt-1">
                                      ({fmtEur(g.minSalary)} + {Math.round(Math.min(yrs / MAX_EXP_YEARS, 1) * 100)}% Spanne)
                                      {' '}× {mult.toFixed(2)} Bildung
                                      {' '}× {stFak.toFixed(2)} Std ({hrs}/{VOLLZEIT_STUNDEN} h/Wo)
                                    </p>
                                  ) : null
                                })()}
                              </div>
                            ) : (
                              <input
                                type="number" min="0" step="50"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                placeholder="z.B. 4500"
                                value={form.baseSalary}
                                onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))}
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Monatlicher Bonus (€)
                            </label>
                            <input
                              type="number" min="0" step="50"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              placeholder="z.B. 200"
                              value={form.monthlyBonus}
                              onChange={e => setForm(f => ({ ...f, monthlyBonus: e.target.value }))}
                            />
                            {parseFloat(form.monthlyBonus) > 0 && (
                              <p className="text-xs text-emerald-600 mt-1">
                                Gesamtbrutto: {fmtEur((parseFloat(form.salaryMode === 'auto' ? previewAutoSalary() : form.baseSalary) || 0) + parseFloat(form.monthlyBonus))}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Vertragsart</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.contractType}
                              onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
                            >
                              {Object.entries(CONTRACT_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Std/Woche</label>
                            <input
                              type="number" min="0" max="60" step="0.5"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.hoursPerWeek}
                              onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Row 3: Steuerklasse | KV Zusatzbeitrag | PV Kinderlos | BVV */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Steuerklasse</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.taxClass}
                              onChange={e => setForm(f => ({ ...f, taxClass: parseInt(e.target.value) }))}
                            >
                              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">1=Ledig · 3=Verheiratet (Hauptverd.)</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">KV Zusatzbeitrag (%)</label>
                            <input
                              type="number" min="0" max="5" step="0.1"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              value={form.kvZusatzbeitrag}
                              onChange={e => setForm(f => ({ ...f, kvZusatzbeitrag: e.target.value }))}
                            />
                            <p className="text-xs text-slate-400 mt-1">Ø 2025: 1,7 % (AN-Anteil: Hälfte)</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Pflegeversicherung</label>
                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                checked={!!form.pvKinderlos}
                                onChange={e => setForm(f => ({ ...f, pvKinderlos: e.target.checked }))}
                              />
                              <span className="text-sm text-slate-700">Kinderlos (+0,35 %)</span>
                            </label>
                            <p className="text-xs text-slate-400 mt-1">
                              Satz: {((DE_PV_RATE + (form.pvKinderlos ? DE_PV_KL_ADD : 0)) * 100).toFixed(2)} %
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">BVV / betr. AV (€/Monat)</label>
                            <input
                              type="number" min="0" step="10"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              placeholder="z.B. 100"
                              value={form.bvvBeitrag}
                              onChange={e => setForm(f => ({ ...f, bvvBeitrag: e.target.value }))}
                            />
                            <p className="text-xs text-slate-400 mt-1">Betriebliche Altersvorsorge</p>
                          </div>
                        </div>

                        {/* Row 4: Kirchensteuer | Notizen */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Kirchensteuer</label>
                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                checked={!!form.kirchensteuerPflichtig}
                                onChange={e => setForm(f => ({ ...f, kirchensteuerPflichtig: e.target.checked }))}
                              />
                              <span className="text-sm text-slate-700">Kirchensteuerpflichtig</span>
                            </label>
                          </div>
                          {form.kirchensteuerPflichtig && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Kirchensteuersatz (%)</label>
                              <select
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                value={form.kirchensteuerSatz}
                                onChange={e => setForm(f => ({ ...f, kirchensteuerSatz: parseFloat(e.target.value) }))}
                              >
                                <option value={9}>9 % (Standard)</option>
                                <option value={8}>8 % (Bayern / BW)</option>
                              </select>
                            </div>
                          )}
                          <div className={form.kirchensteuerPflichtig ? 'sm:col-span-2' : 'sm:col-span-3'}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Notizen</label>
                            <input
                              type="text"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                              placeholder="Optionale Notiz..."
                              value={form.notes}
                              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Live net preview */}
                        {(() => {
                          const gross = parseFloat(
                            form.salaryMode === 'auto' ? previewAutoSalary() : form.baseSalary
                          ) + (parseFloat(form.monthlyBonus) || 0)
                          const p = gross > 0 ? calcDePayroll(gross, {
                            taxClass:               parseInt(form.taxClass),
                            kvZusatzbeitrag:        parseFloat(form.kvZusatzbeitrag),
                            pvKinderlos:            !!form.pvKinderlos,
                            kirchensteuerPflichtig: !!form.kirchensteuerPflichtig,
                            kirchensteuerSatz:      parseFloat(form.kirchensteuerSatz),
                            bvvBeitrag:             parseFloat(form.bvvBeitrag),
                          }) : null
                          if (!p) return null
                          return (
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Netto-Vorschau (monatlich)</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                  <p className="text-xs text-slate-400 mb-0.5">Bruttogehalt</p>
                                  <p className="font-semibold text-slate-800">{fmtEur(gross)}</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-3">
                                  <p className="text-xs text-slate-400 mb-0.5">Lohnsteuer</p>
                                  <p className="font-semibold text-red-700">-{fmtEur(p.incomeTax)}</p>
                                  {p.kirchensteuer > 0 && <p className="text-xs text-red-500 mt-0.5">+{fmtEur(p.kirchensteuer)} KiSt</p>}
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3">
                                  <p className="text-xs text-slate-400 mb-0.5">Sozialversicherung</p>
                                  <p className="font-semibold text-orange-700">-{fmtEur(p.socialSecurity)}</p>
                                  {p.bvv > 0 && <p className="text-xs text-orange-500 mt-0.5">+{fmtEur(p.bvv)} BVV</p>}
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                  <p className="text-xs text-slate-400 mb-0.5">Nettolohn</p>
                                  <p className="font-bold text-green-700 text-base">{fmtEur(p.netSalary)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                                <span>RV: <strong className="text-slate-700">{fmtEur(p.rentenversicherung)}</strong></span>
                                <span>KV: <strong className="text-slate-700">{fmtEur(p.krankenversicherung)}</strong></span>
                                <span>PV: <strong className="text-slate-700">{fmtEur(p.pflegeversicherung)}</strong></span>
                                <span>AV: <strong className="text-slate-700">{fmtEur(p.arbeitslosenversicherung)}</strong></span>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => save(emp.id)}
                            disabled={saving || (form.salaryMode === 'auto' && previewAutoSalary() === null)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Speichern...' : 'Speichern'}
                          </button>
                          <button
                            onClick={closeEdit}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

// ─── Tab: Abrechnung ───────────────────────────────────────────────────────

function AbrechnungTab() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [runDetail, setRunDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editEntryId, setEditEntryId] = useState(null)
  const [entryForm, setEntryForm] = useState({})
  const [newRunForm, setNewRunForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState(null)
  const showAlert = (title, message) => setDialog({ title, message, confirmText: 'OK', variant: 'danger', confirmIcon: null })
  const showConfirm = (title, message, onConfirm, opts = {}) => setDialog({ title, message, confirmText: 'Bestätigen', cancelText: 'Abbrechen', variant: 'danger', ...opts, onConfirm })

  const loadRuns = useCallback(() => {
    setError(null)
    api.get('/lohnverwaltung/abrechnungen')
      .then(r => {
        if (Array.isArray(r)) {
          setRuns(r)
        } else {
          setError('Unbekannter Fehler')
          setRuns([])
        }
      })
      .catch(err => {
        setError(err.message || 'API nicht erreichbar')
        setRuns([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  async function openRun(run) {
    if (selectedRun?.id === run.id) { setSelectedRun(null); setRunDetail(null); return }
    setSelectedRun(run)
    setDetailLoading(true)
    try {
      const r = await api.get(`/lohnverwaltung/abrechnungen/${run.id}`)
      setRunDetail(r)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  function finalize(runId) {
    showConfirm(
      'Abrechnung finalisieren',
      'Danach können keine Änderungen mehr vorgenommen werden.',
      async () => {
        try {
          await api.put(`/lohnverwaltung/abrechnungen/${runId}/finalize`)
          loadRuns()
          const r = await api.get(`/lohnverwaltung/abrechnungen/${runId}`)
          setRunDetail(r)
        } catch (err) {
          showAlert('Fehler', err.message || 'Fehler')
        }
      },
      { variant: 'warning', confirmIcon: Lock, confirmText: 'Finalisieren' }
    )
  }

  async function reopen(runId) {
    try {
      await api.put(`/lohnverwaltung/abrechnungen/${runId}/reopen`)
      loadRuns()
      const r = await api.get(`/lohnverwaltung/abrechnungen/${runId}`)
      setRunDetail(r)
    } catch (err) {
      showAlert('Fehler', err.message || 'Fehler')
    }
  }

  async function saveEntry(runId, entryId) {
    try {
      await api.put(`/lohnverwaltung/abrechnungen/${runId}/entries/${entryId}`, entryForm)
      setEditEntryId(null)
      const r = await api.get(`/lohnverwaltung/abrechnungen/${runId}`)
      setRunDetail(r)
    } catch (err) {
      showAlert('Fehler', err.message || 'Fehler')
    }
  }

  function syncRun(runId) {
    showConfirm(
      'Gehälter synchronisieren',
      'Alle Einträge aus der aktuellen Gehaltskonfiguration synchronisieren? Bestehende Abzüge bleiben erhalten, Grundgehalt und Bonus werden überschrieben.',
      async () => {
        try {
          const r = await api.put(`/lohnverwaltung/abrechnungen/${runId}/sync`)
          loadRuns()
          setRunDetail(r)
        } catch (err) {
          showAlert('Fehler beim Synchronisieren', err.message || 'Fehler beim Synchronisieren')
        }
      },
      { variant: 'warning', confirmIcon: RefreshCw, confirmText: 'Synchronisieren' }
    )
  }

  async function createRun() {
    setCreating(true)
    try {
      const r = await api.post('/lohnverwaltung/abrechnungen', newRunForm)
      loadRuns()
      setShowNewForm(false)
      setSelectedRun(r)
      setRunDetail(r)
    } catch (err) {
      showAlert('Fehler beim Erstellen', err.message || 'Fehler beim Erstellen')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm p-6">Lade...</p>

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
      <p className="font-semibold mb-1">Fehler beim Laden der Abrechnungen</p>
      <p className="text-xs font-mono">{error}</p>
      <p className="text-xs mt-2 text-red-500">Hinweis: Bitte <code>npx prisma db push</code> ausführen falls die Tabellen noch nicht existieren.</p>
    </div>
  )

  return (
    <>
    {dialog && (
      <ConfirmDialog
        isOpen
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText ?? 'OK'}
        cancelText={dialog.cancelText ?? 'Schließen'}
        variant={dialog.variant ?? 'info'}
        confirmIcon={dialog.confirmIcon}
        onConfirm={() => { setDialog(null); dialog.onConfirm?.() }}
        onClose={() => setDialog(null)}
      />
    )}
    <div className="space-y-4">
      {/* Create new run */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Lohnabrechnungen</h3>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neue Abrechnung
        </button>
      </div>

      {showNewForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Jahr</label>
            <input
              type="number"
              className="border border-slate-200 rounded px-3 py-1.5 text-sm w-24"
              value={newRunForm.year}
              onChange={e => setNewRunForm(f => ({ ...f, year: parseInt(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monat</label>
            <select
              className="border border-slate-200 rounded px-3 py-1.5 text-sm"
              value={newRunForm.month}
              onChange={e => setNewRunForm(f => ({ ...f, month: parseInt(e.target.value) }))}
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button
            onClick={createRun}
            disabled={creating}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Erstelle...' : 'Erstellen'}
          </button>
          <button
            onClick={() => setShowNewForm(false)}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-sm hover:bg-slate-200"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Run list */}
      <div className="space-y-2">
        {runs.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">Keine Abrechnungen vorhanden. Erstellen Sie die erste Abrechnung.</p>
        )}
        {runs.map(run => {
          const isOpen = selectedRun?.id === run.id
          const status = STATUS_MAP[run.status]
          return (
            <div key={run.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Run header */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => openRun(run)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {MONTHS[run.month - 1]} {run.year}
                    </p>
                    <p className="text-xs text-slate-400">{run._count?.entries ?? 0} Einträge</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status?.cls}`}>
                    {status?.label}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Brutto</p>
                    <p className="font-semibold text-slate-700">{fmtEur(run.totalGross)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Netto</p>
                    <p className="font-semibold text-green-700">{fmtEur(run.totalNet)}</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Run detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-4">
                  {/* Actions */}
                  <div className="flex gap-2 mb-4">
                    {run.status === 'draft' && (
                      <>
                        <button
                          onClick={() => syncRun(run.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                          title="Grundgehalt und Bonus aus aktueller Gehaltskonfiguration übernehmen"
                        >
                          <RefreshCw className="w-4 h-4" /> Mit Gehältern synchronisieren
                        </button>
                        <button
                          onClick={() => finalize(run.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          <Lock className="w-4 h-4" /> Finalisieren
                        </button>
                      </>
                    )}
                    {run.status === 'finalized' && (
                      <button
                        onClick={() => reopen(run.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                      >
                        <Unlock className="w-4 h-4" /> Wieder öffnen
                      </button>
                    )}
                  </div>

                  {detailLoading ? (
                    <p className="text-slate-400 text-sm">Lade Details...</p>
                  ) : runDetail ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                            <th className="pb-2 pr-4">Mitarbeiter</th>
                            <th className="pb-2 pr-4 text-right">Basis</th>
                            <th className="pb-2 pr-4 text-right">Bonus</th>
                            <th className="pb-2 pr-4 text-right">Abzüge</th>
                            <th className="pb-2 pr-4 text-right">Brutto</th>
                            <th className="pb-2 pr-4 text-right">Lohnsteuer</th>
                            <th className="pb-2 pr-4 text-right">SV</th>
                            <th className="pb-2 pr-4 text-right">Netto</th>
                            {run.status === 'draft' && <th className="pb-2" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {runDetail.entries.map(entry => {
                            const isEditingEntry = editEntryId === entry.id
                            const cfgBase  = entry.user.salary?.baseSalary   ?? null
                            const cfgBonus = entry.user.salary?.monthlyBonus ?? 0
                            const outOfSync = cfgBase !== null && (
                              Math.round(entry.baseSalary) !== Math.round(cfgBase) ||
                              Math.round(entry.bonus)      !== Math.round(cfgBonus)
                            )
                            return (
                              <tr key={entry.id} className={`hover:bg-slate-50 ${outOfSync && run.status === 'draft' ? 'bg-amber-50/40' : ''}`}>
                                <td className="py-2 pr-4">
                                  <div className="flex items-center gap-1.5">
                                    {outOfSync && run.status === 'draft' && (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Abweichung zur Gehaltskonfiguration" />
                                    )}
                                    <span className="font-medium text-slate-700">{entry.user.name}</span>
                                  </div>
                                </td>

                                {isEditingEntry ? (
                                  <>
                                    <td className="py-2 pr-4">
                                      <div>
                                        <input
                                          type="number" min="0" step="50"
                                          className="w-28 border border-slate-200 rounded px-2 py-0.5 text-sm text-right"
                                          value={entryForm.baseSalary}
                                          onChange={e => setEntryForm(f => ({ ...f, baseSalary: e.target.value }))}
                                        />
                                        {cfgBase !== null && (
                                          <p className="text-xs text-slate-400 mt-0.5 text-right">Konfig: {fmtEur(cfgBase)}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 pr-4">
                                      <div>
                                        <input
                                          type="number" min="0" step="50"
                                          className="w-24 border border-slate-200 rounded px-2 py-0.5 text-sm text-right"
                                          value={entryForm.bonus}
                                          onChange={e => setEntryForm(f => ({ ...f, bonus: e.target.value }))}
                                        />
                                        {cfgBonus > 0 && (
                                          <p className="text-xs text-slate-400 mt-0.5 text-right">Konfig: {fmtEur(cfgBonus)}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 pr-4">
                                      <input
                                        type="number" min="0" step="50"
                                        className="w-24 border border-slate-200 rounded px-2 py-0.5 text-sm text-right"
                                        value={entryForm.deductions}
                                        onChange={e => setEntryForm(f => ({ ...f, deductions: e.target.value }))}
                                      />
                                    </td>
                                    <td className="py-2 pr-4 text-right text-slate-400 text-xs" colSpan={3}>wird neu berechnet</td>
                                    <td className="py-2 pr-4" />
                                    <td className="py-2">
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => saveEntry(run.id, entry.id)}
                                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                        >
                                          <Save className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditEntryId(null)}
                                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-2 pr-4 text-right">
                                      <span className={`text-slate-600 ${outOfSync && run.status === 'draft' ? 'text-amber-700 font-medium' : ''}`}>
                                        {fmtEur(entry.baseSalary)}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-4 text-right">
                                      <span className={`text-slate-600 ${outOfSync && run.status === 'draft' && Math.round(entry.bonus) !== Math.round(cfgBonus) ? 'text-amber-700 font-medium' : ''}`}>
                                        {fmtEur(entry.bonus)}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-4 text-right text-slate-600">{fmtEur(entry.deductions)}</td>
                                    <td className="py-2 pr-4 text-right font-medium text-slate-700">{fmtEur(entry.grossSalary)}</td>
                                    <td className="py-2 pr-4 text-right text-red-600">{fmtEur(entry.incomeTax)}</td>
                                    <td className="py-2 pr-4 text-right text-orange-600">{fmtEur(entry.socialSecurity)}</td>
                                    <td className="py-2 pr-4 text-right font-semibold text-green-700">{fmtEur(entry.netSalary)}</td>
                                    {run.status === 'draft' && (
                                      <td className="py-2">
                                        <button
                                          onClick={() => { setEditEntryId(entry.id); setEntryForm({ baseSalary: entry.baseSalary, bonus: entry.bonus, deductions: entry.deductions }) }}
                                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      </td>
                                    )}
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 font-semibold">
                          <tr>
                            <td className="pt-2 pr-4 text-slate-700">Gesamt</td>
                            <td colSpan={3} />
                            <td className="pt-2 pr-4 text-right text-slate-700">{fmtEur(runDetail.totalGross)}</td>
                            <td className="pt-2 pr-4 text-right text-red-600">
                              {fmtEur(runDetail.entries.reduce((a, e) => a + e.incomeTax, 0))}
                            </td>
                            <td className="pt-2 pr-4 text-right text-orange-600">
                              {fmtEur(runDetail.entries.reduce((a, e) => a + e.socialSecurity, 0))}
                            </td>
                            <td className="pt-2 pr-4 text-right text-green-700">{fmtEur(runDetail.totalNet)}</td>
                            {run.status === 'draft' && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </>
  )
}

// ─── Tab: Tarifgruppen ─────────────────────────────────────────────────────

function TarifgruppenTab() {
  const [groups, setGroups] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editGroup, setEditGroup] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', minSalary: '', maxSalary: '' })
  const [saving, setSaving] = useState(false)
  const [assignSaving, setAssignSaving] = useState(null)
  const [dialog, setDialog] = useState(null)
  const showAlert = (title, message) => setDialog({ title, message, confirmText: 'OK', variant: 'danger', confirmIcon: null })
  const showConfirm = (title, message, onConfirm, opts = {}) => setDialog({ title, message, confirmText: 'Bestätigen', cancelText: 'Abbrechen', variant: 'danger', ...opts, onConfirm })

  const load = useCallback(async () => {
    try {
      const [g, e] = await Promise.all([
        api.get('/lohnverwaltung/tarifgruppen'),
        api.get('/lohnverwaltung/mitarbeiter'),
      ])
      setGroups(Array.isArray(g) ? g : [])
      setEmployees(Array.isArray(e) ? e : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditGroup(null)
    setForm({ name: '', description: '', minSalary: '', maxSalary: '' })
    setShowForm(true)
  }

  function openEdit(g) {
    setEditGroup(g)
    setForm({
      name: g.name,
      description: g.description ?? '',
      minSalary: g.minSalary ?? '',
      maxSalary: g.maxSalary ?? '',
    })
    setShowForm(true)
  }

  async function saveGroup() {
    if (!form.name.trim()) { showAlert('Pflichtfeld fehlt', 'Name ist erforderlich.'); return }
    setSaving(true)
    try {
      if (editGroup) {
        await api.put(`/lohnverwaltung/tarifgruppen/${editGroup.id}`, form)
      } else {
        await api.post('/lohnverwaltung/tarifgruppen', form)
      }
      setShowForm(false)
      setEditGroup(null)
      await load()
    } catch (err) {
      showAlert('Fehler beim Speichern', err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  function deleteGroup(g) {
    showConfirm(
      `Tarifgruppe löschen`,
      `Tarifgruppe "${g.name}" wirklich löschen? Die Zuweisung aller Mitarbeiter wird aufgehoben.`,
      async () => {
        try {
          await api.delete(`/lohnverwaltung/tarifgruppen/${g.id}`)
          if (selectedGroup?.id === g.id) setSelectedGroup(null)
          await load()
        } catch (err) {
          showAlert('Fehler beim Löschen', err.message || 'Fehler beim Löschen')
        }
      },
      { variant: 'danger', confirmIcon: Trash2, confirmText: 'Löschen' }
    )
  }

  async function assignGroup(userId, tarifGruppeId) {
    setAssignSaving(userId)
    try {
      await api.put(`/lohnverwaltung/mitarbeiter/${userId}/tarifgruppe`, { tarifGruppeId })
      await load()
    } catch (err) {
      showAlert('Fehler beim Zuweisen', err.message || 'Fehler beim Zuweisen')
    } finally {
      setAssignSaving(null)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm p-6">Lade...</p>

  return (
    <>
    {dialog && (
      <ConfirmDialog
        isOpen
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText ?? 'OK'}
        cancelText={dialog.cancelText ?? 'Schließen'}
        variant={dialog.variant ?? 'info'}
        confirmIcon={dialog.confirmIcon}
        onConfirm={() => { setDialog(null); dialog.onConfirm?.() }}
        onClose={() => setDialog(null)}
      />
    )}
    <div className="space-y-6">

      {/* Form: Create / Edit */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">
            {editGroup ? 'Tarifgruppe bearbeiten' : 'Neue Tarifgruppe erstellen'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="z.B. Gruppe A / Senior Consultant"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Beschreibung</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Optionale Beschreibung"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mindestgehalt (€)</label>
              <input
                type="number" min="0" step="100"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="z.B. 3000"
                value={form.minSalary}
                onChange={e => setForm(f => ({ ...f, minSalary: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Höchstgehalt (€)</label>
              <input
                type="number" min="0" step="100"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="z.B. 6000"
                value={form.maxSalary}
                onChange={e => setForm(f => ({ ...f, maxSalary: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveGroup}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Tarifgruppen</h3>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Neue Gruppe
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">
            Keine Tarifgruppen vorhanden. Erstellen Sie die erste Gruppe.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Beschreibung</th>
                <th className="px-5 py-3 text-right">Mindestgehalt</th>
                <th className="px-5 py-3 text-right">Höchstgehalt</th>
                <th className="px-5 py-3 text-right">Mitarbeiter</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map(g => (
                <tr
                  key={g.id}
                  className={`hover:bg-slate-50 cursor-pointer ${selectedGroup?.id === g.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedGroup(selectedGroup?.id === g.id ? null : g)}
                >
                  <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500 shrink-0" />
                    {g.name}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{g.description ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {g.minSalary != null ? fmtEur(g.minSalary) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {g.maxSalary != null ? fmtEur(g.maxSalary) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      <Users className="w-3 h-3" /> {g._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(g)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteGroup(g)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mitarbeiterzuweisung */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <UserCheck className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Mitarbeiter — Tarifgruppe zuweisen</h3>
        </div>

        {employees.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Keine Mitarbeiter gefunden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="px-5 py-3">Mitarbeiter</th>
                <th className="px-5 py-3">Aktuelle Tarifgruppe</th>
                <th className="px-5 py-3 w-56">Zuweisen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{emp.name}</p>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {emp.tarifGruppe ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <Tag className="w-3 h-3" /> {emp.tarifGruppe.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Keine Gruppe</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:opacity-50"
                      value={emp.tarifGruppeId ?? ''}
                      disabled={assignSaving === emp.id}
                      onChange={e => assignGroup(emp.id, e.target.value || null)}
                    >
                      <option value="">— Keine Gruppe —</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </>
  )
}

// ─── Gehaltszettel print helper ─────────────────────────────────────────────

function buildPayslipHtml(e, month, year) {
  const fmt = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0)
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Gehaltsabrechnung ${month} ${year}</title><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;padding:40px;max-width:620px;margin:0 auto}
  h1{font-size:22px;font-weight:700;margin-bottom:2px}
  .period{font-size:14px;color:#64748b;margin-bottom:28px}
  .emp{background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:24px}
  .emp-name{font-weight:600;font-size:15px}
  .emp-email{font-size:12px;color:#64748b;margin-top:2px}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:8px}
  .rows{margin-bottom:20px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569}
  .row:last-child{border-bottom:none}
  .row.total{font-weight:700;font-size:14px;color:#0f172a}
  .red{color:#dc2626}
  .orange{color:#c2410c}
  .net{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:8px}
  .net-label{font-weight:700;font-size:16px;color:#166534}
  .net-value{font-weight:800;font-size:28px;color:#15803d}
  @media print{body{padding:20px}}
</style></head>
<body>
  <h1>Gehaltsabrechnung</h1>
  <p class="period">${month} ${year}</p>
  <div class="emp">
    <p class="emp-name">${e.user.name}</p>
    <p class="emp-email">${e.user.email}</p>
  </div>
  <p class="section-title">Vergütung</p>
  <div class="rows">
    <div class="row"><span>Grundgehalt</span><span>${fmt(e.baseSalary)}</span></div>
    ${e.bonus > 0 ? `<div class="row"><span>Monatlicher Bonus</span><span>${fmt(e.bonus)}</span></div>` : ''}
    ${e.deductions > 0 ? `<div class="row"><span>Sonstige Abzüge</span><span class="red">-${fmt(e.deductions)}</span></div>` : ''}
    <div class="row total"><span>Bruttogehalt</span><span>${fmt(e.grossSalary)}</span></div>
  </div>
  <p class="section-title">Lohnsteuer</p>
  <div class="rows">
    <div class="row"><span>Lohnsteuer</span><span class="red">-${fmt(e.incomeTax)}</span></div>
    ${e.kirchensteuer > 0 ? `<div class="row"><span>Kirchensteuer</span><span class="red">-${fmt(e.kirchensteuer)}</span></div>` : ''}
  </div>
  <p class="section-title">Sozialversicherung (AN-Anteil)</p>
  <div class="rows">
    <div class="row"><span>Rentenversicherung</span><span class="orange">-${fmt(e.rentenversicherung)}</span></div>
    <div class="row"><span>Krankenversicherung</span><span class="orange">-${fmt(e.krankenversicherung)}</span></div>
    <div class="row"><span>Pflegeversicherung</span><span class="orange">-${fmt(e.pflegeversicherung)}</span></div>
    <div class="row"><span>Arbeitslosenversicherung</span><span class="orange">-${fmt(e.arbeitslosenversicherung)}</span></div>
    ${e.bvv > 0 ? `<div class="row"><span>BVV / betr. Altersvorsorge</span><span class="orange">-${fmt(e.bvv)}</span></div>` : ''}
  </div>
  <div class="net">
    <span class="net-label">Nettogehalt</span>
    <span class="net-value">${fmt(e.netSalary)}</span>
  </div>
</body></html>`
}

// ─── Tab: Meine Abrechnung (Gehaltszettel) ─────────────────────────────────

function GehaltszettelTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    api.get('/lohnverwaltung/gehaltszettel')
      .then(r => { if (Array.isArray(r)) setEntries(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function printPayslip(e) {
    const month = MONTHS[e.payrollRun.month - 1]
    const year  = e.payrollRun.year
    const w = window.open('', '_blank', 'width=700,height=860')
    w.document.write(buildPayslipHtml(e, month, year))
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  if (loading) return <p className="text-slate-400 text-sm p-6">Lade...</p>

  if (entries.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <p className="font-medium text-slate-600">Keine Abrechnungen vorhanden</p>
      <p className="text-sm mt-1 text-slate-400">Finalisierte Lohnabrechnungen werden hier angezeigt.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {entries.map(e => {
        const isOpen = expandedId === e.id
        const month  = MONTHS[e.payrollRun.month - 1]
        const year   = e.payrollRun.year
        return (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Summary row */}
            <button
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 text-left"
              onClick={() => setExpandedId(isOpen ? null : e.id)}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{month} {year}</p>
                <p className="text-xs text-slate-400">Lohnabrechnung · {e.user.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-green-700">{fmtEur(e.netSalary)}</p>
                <p className="text-xs text-slate-400">Netto</p>
              </div>
              {isOpen
                ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {/* Gehaltszettel detail */}
            {isOpen && (
              <div className="border-t border-slate-100 px-6 py-6">
                <div className="max-w-md mx-auto space-y-5">

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Gehaltsabrechnung</p>
                      <p className="text-xl font-bold text-slate-800 mt-0.5">{month} {year}</p>
                    </div>
                    <button
                      onClick={() => printPayslip(e)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
                    >
                      <Printer className="w-4 h-4" />
                      Drucken / PDF
                    </button>
                  </div>

                  {/* Employee */}
                  <div className="bg-slate-50 rounded-lg px-4 py-3">
                    <p className="font-semibold text-slate-800 text-sm">{e.user.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{e.user.email}</p>
                  </div>

                  {/* Vergütung */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Vergütung</p>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Grundgehalt</span>
                        <span className="font-medium text-slate-800">{fmtEur(e.baseSalary)}</span>
                      </div>
                      {e.bonus > 0 && (
                        <div className="flex justify-between py-2 text-sm">
                          <span className="text-slate-600">Monatlicher Bonus</span>
                          <span className="font-medium text-slate-800">{fmtEur(e.bonus)}</span>
                        </div>
                      )}
                      {e.deductions > 0 && (
                        <div className="flex justify-between py-2 text-sm">
                          <span className="text-slate-600">Sonstige Abzüge</span>
                          <span className="font-medium text-red-600">-{fmtEur(e.deductions)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 text-sm font-semibold border-t border-slate-200">
                        <span className="text-slate-700">Bruttogehalt</span>
                        <span className="text-slate-800">{fmtEur(e.grossSalary)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Steuer */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lohnsteuer</p>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Lohnsteuer</span>
                        <span className="font-medium text-red-600">-{fmtEur(e.incomeTax)}</span>
                      </div>
                      {e.kirchensteuer > 0 && (
                        <div className="flex justify-between py-2 text-sm">
                          <span className="text-slate-600">Kirchensteuer</span>
                          <span className="font-medium text-red-600">-{fmtEur(e.kirchensteuer)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sozialversicherung */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Sozialversicherung (AN-Anteil)</p>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Rentenversicherung</span>
                        <span className="font-medium text-orange-600">-{fmtEur(e.rentenversicherung)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Krankenversicherung</span>
                        <span className="font-medium text-orange-600">-{fmtEur(e.krankenversicherung)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Pflegeversicherung</span>
                        <span className="font-medium text-orange-600">-{fmtEur(e.pflegeversicherung)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm">
                        <span className="text-slate-600">Arbeitslosenversicherung</span>
                        <span className="font-medium text-orange-600">-{fmtEur(e.arbeitslosenversicherung)}</span>
                      </div>
                      {e.bvv > 0 && (
                        <div className="flex justify-between py-2 text-sm">
                          <span className="text-slate-600">BVV / betr. Altersvorsorge</span>
                          <span className="font-medium text-orange-600">-{fmtEur(e.bvv)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Netto */}
                  <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                    <span className="font-bold text-slate-800">Nettogehalt</span>
                    <span className="text-2xl font-bold text-green-700">{fmtEur(e.netSalary)}</span>
                  </div>

                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

const ADMIN_TABS = [
  { key: 'uebersicht',    label: 'Übersicht' },
  { key: 'gehaelter',     label: 'Gehälter' },
  { key: 'tarifgruppen',  label: 'Tarifgruppen' },
  { key: 'abrechnung',    label: 'Abrechnung' },
]

export default function LohnverwaltungPage() {
  const user = getUser()
  const { can, loading: permsLoading } = usePermissions()
  const isAdmin = user?.role === 'admin'
  const hasAccess = isAdmin || can('lohnverwaltung')
  const [tab, setTab] = useState('uebersicht')

  // Once permissions have loaded, redirect non-admin users to their own tab
  useEffect(() => {
    if (!permsLoading && !hasAccess) setTab('gehaltszettel')
  }, [permsLoading, hasAccess])

  if (permsLoading) return <p className="text-slate-400 text-sm p-6">Lade...</p>

  const visibleTabs = [
    ...(hasAccess ? ADMIN_TABS : []),
    { key: 'gehaltszettel', label: 'Meine Abrechnung' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lohnverwaltung</h1>
        <p className="text-sm text-slate-500 mt-1">
          {hasAccess
            ? 'Gehaltsstruktur, monatliche Abrechnungen und Lohnkosten-Übersicht'
            : 'Ihre monatlichen Lohnabrechnungen'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'uebersicht'    && <UebersichtTab />}
      {tab === 'gehaelter'     && <GehälterTab />}
      {tab === 'tarifgruppen'  && <TarifgruppenTab />}
      {tab === 'abrechnung'    && <AbrechnungTab />}
      {tab === 'gehaltszettel' && <GehaltszettelTab />}
    </div>
  )
}

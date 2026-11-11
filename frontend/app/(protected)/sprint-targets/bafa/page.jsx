'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Search, Landmark, AlertTriangle, FileDown, Plus, Trash2, Save, Calculator,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const BAFA_STATUSES = ['nicht beantragt', 'beantragt', 'bewilligt', 'abgelehnt', 'ausgezahlt']
const DOC_STATUSES = ['offen', 'angefordert', 'erhalten', 'geprüft']

const BAFA_STYLES = {
  'nicht beantragt': 'bg-gray-100 text-gray-600',
  'beantragt':       'bg-blue-100 text-blue-700',
  'bewilligt':       'bg-green-100 text-green-700',
  'abgelehnt':       'bg-red-100 text-red-700',
  'ausgezahlt':      'bg-emerald-100 text-emerald-700',
}

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const DEADLINE_DAYS = 42

function daysSince(value) {
  if (!value) return null
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export default function SprintBafaPage() {
  const router = useRouter()
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)

  const fetchTargets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/sprint-targets')
      setTargets(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  const relevant = useMemo(
    () => targets.filter((t) => t.offerValue || t.bafaStatus),
    [targets]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return relevant
      .filter((t) => !statusFilter || (t.bafaStatus || 'nicht beantragt') === statusFilter)
      .filter((t) => !q || t.companyName.toLowerCase().includes(q))
  }, [relevant, statusFilter, search])

  const overdue = useMemo(
    () => relevant.filter((t) => {
      if (t.bafaStatus !== 'beantragt') return false
      const days = daysSince(t.bafaSubmittedAt || t.bafaDate)
      return days != null && days > DEADLINE_DAYS
    }),
    [relevant]
  )

  const stats = useMemo(() => {
    const applied = relevant.filter((t) => t.bafaStatus && t.bafaStatus !== 'nicht beantragt')
    const approved = relevant.filter((t) => ['bewilligt', 'ausgezahlt'].includes(t.bafaStatus))
    const volume = relevant.reduce((s, t) => s + (t.offerValue || 0), 0)
    const approvedSum = relevant.reduce((s, t) => s + (t.bafaApprovedAmount || 0), 0)
    return {
      total: relevant.length,
      applied: applied.length,
      approved: approved.length,
      volume,
      approvedSum,
      funding: Math.round(volume * 0.5),
    }
  }, [relevant])

  async function updateTarget(id, payload, message) {
    try {
      const updated = await api.put(`/sprint-targets/${id}/bafa`, payload)
      setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)))
      if (message) toast.success(message)
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Förderungen</h1>
            <p className="text-sm text-gray-500">Förderprogramm, Antragsstatus, Nachweise und Verwendungsnachweis je Zielkunde</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Angebote mit Förderbezug', value: stats.total, cls: 'text-gray-900' },
          { label: 'Anträge gestellt', value: stats.applied, cls: 'text-blue-700' },
          { label: 'Bewilligt / ausgezahlt', value: `${stats.approved} · ${formatCurrency(stats.approvedSum)}`, cls: 'text-green-700' },
          { label: 'Förderpotenzial (Richtwert)', value: formatCurrency(stats.funding), cls: 'text-blue-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-base font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">
              {overdue.length} Antr{overdue.length === 1 ? 'ag' : 'äge'} seit über {DEADLINE_DAYS} Tagen in Bearbeitung
            </p>
            <p className="text-xs text-yellow-800">
              {overdue.map((t) => t.companyName).join(', ')}
            </p>
            <p className="text-xs text-yellow-700 mt-1">Bitte Nachweise und Zwischenstand prüfen.</p>
          </div>
        </div>
      )}

      <div className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
        <span className="font-semibold">Hinweis:</span> Quote und Obergrenze richten sich nach dem gewählten Förderprogramm.
        Banken gelten in der Regel nicht als KMU; die Einwilligung zur Datenweitergabe ist vor Antragstellung zu prüfen.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unternehmen suchen …"
            className="w-64 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
          <option value="">Alle Status</option>
          {BAFA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Landmark className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Keine Angebote mit Förderbezug.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['Unternehmen', 'Förderprogramm', 'Angebotswert', 'Fördersumme', 'Förderstatus', 'Antragsdatum', 'Ergebnis', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const status = t.bafaStatus || 'nicht beantragt'
                return (
                  <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <button onClick={() => router.push(`/sprint-targets/${t.id}`)} className="text-sm font-medium text-gray-900 hover:text-blue-700">
                        {t.companyName}
                      </button>
                      <p className="text-xs text-gray-500">{t.segment}</p>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{t.fundingProgram || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">{t.offerValue ? formatCurrency(t.offerValue) : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">
                      {t.bafaApprovedAmount
                        ? formatCurrency(t.bafaApprovedAmount)
                        : t.fundingAmount
                          ? <span className="text-gray-500">≈ {formatCurrency(t.fundingAmount)}</span>
                          : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${BAFA_STYLES[status] || BAFA_STYLES['nicht beantragt']}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="date"
                        value={t.bafaDate ? String(t.bafaDate).slice(0, 10) : ''}
                        onChange={(e) => updateTarget(t.id, { bafaDate: e.target.value || null })}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-700 bg-white"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={status}
                        onChange={(e) => updateTarget(t.id, { bafaStatus: e.target.value }, 'Förderstatus aktualisiert')}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-700 bg-white"
                      >
                        {BAFA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDetailId(t.id)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900"
                      >
                        Nachweise
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <BafaDetailModal
          targetId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => fetchTargets()}
        />
      )}
    </div>
  )
}

function BafaDetailModal({ targetId, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [rate, setRate] = useState(0.5)
  const [cap, setCap] = useState('')
  const [newDoc, setNewDoc] = useState({ name: '', status: 'offen', notes: '' })

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/sprint-targets/${targetId}/bafa`)
      setData(res)
      setForm({
        bafaStatus: res.target.bafaStatus || 'nicht beantragt',
        bafaDate: res.target.bafaDate ? res.target.bafaDate.slice(0, 10) : '',
        bafaSubmittedAt: res.target.bafaSubmittedAt ? res.target.bafaSubmittedAt.slice(0, 10) : '',
        fundingAmount: res.target.fundingAmount != null ? String(res.target.fundingAmount) : '',
        bafaApprovedAmount: res.target.bafaApprovedAmount != null ? String(res.target.bafaApprovedAmount) : '',
        bafaNotes: res.target.bafaNotes || '',
        fundingProgram: res.target.fundingProgram || '',
      })
      const programs = res.fundingPrograms || []
      const chosen = programs.find((p) => p.name === res.target.fundingProgram)
      if (chosen) {
        setRate(Number(chosen.rate) || 0.5)
        setCap(chosen.cap != null ? String(chosen.cap) : '')
      } else {
        const params = res.bafaParams || {}
        if (params.rate != null) setRate(Number(params.rate) || 0.5)
        if (params.cap != null) setCap(String(params.cap))
      }
    } catch (err) {
      toast.error(err.message || 'Förderdaten konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [targetId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const offerValue = data?.target?.offerValue || 0
  const calculated = useMemo(() => {
    const base = offerValue * (Number(rate) || 0)
    const capped = cap ? Math.min(base, Number(cap)) : base
    return Math.round(capped * 100) / 100
  }, [offerValue, rate, cap])

  function selectProgram(name) {
    setForm((prev) => ({ ...prev, fundingProgram: name }))
    const p = (data?.fundingPrograms || []).find((x) => x.name === name)
    if (p) {
      setRate(Number(p.rate) || 0)
      setCap(p.cap != null ? String(p.cap) : '')
    }
  }

  async function save() {
    setSaving(true)
    try {
      await api.put(`/sprint-targets/${targetId}/bafa`, {
        bafaStatus: form.bafaStatus,
        bafaDate: form.bafaDate || null,
        bafaSubmittedAt: form.bafaSubmittedAt || null,
        fundingAmount: form.fundingAmount === '' ? null : Number(form.fundingAmount),
        bafaApprovedAmount: form.bafaApprovedAmount === '' ? null : Number(form.bafaApprovedAmount),
        bafaNotes: form.bafaNotes || null,
        fundingProgram: form.fundingProgram || null,
      })
      toast.success('Förderdaten gespeichert')
      onChanged?.()
      fetchDetail()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function addDocument(e) {
    e.preventDefault()
    if (!newDoc.name.trim()) { toast.error('Dokumentname angeben'); return }
    try {
      await api.post(`/sprint-targets/${targetId}/bafa/documents`, {
        name: newDoc.name.trim(),
        status: newDoc.status,
        notes: newDoc.notes || null,
      })
      setNewDoc({ name: '', status: 'offen', notes: '' })
      fetchDetail()
    } catch (err) {
      toast.error(err.message || 'Dokument konnte nicht angelegt werden')
    }
  }

  async function updateDocument(doc, patch) {
    try {
      await api.put(`/sprint-targets/bafa/documents/${doc.id}`, patch)
      fetchDetail()
    } catch (err) {
      toast.error(err.message || 'Dokument konnte nicht gespeichert werden')
    }
  }

  async function deleteDocument(doc) {
    try {
      await api.delete(`/sprint-targets/bafa/documents/${doc.id}`)
      fetchDetail()
    } catch (err) {
      toast.error(err.message || 'Dokument konnte nicht gelöscht werden')
    }
  }

  async function downloadPdf() {
    try {
      await api.download(`/sprint-targets/${targetId}/bafa/pdf`, `Foerderung-${data?.target?.companyName || 'Zielkunde'}.pdf`)
    } catch (err) {
      toast.error(err.message || 'PDF-Download fehlgeschlagen')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Förder-Nachweise</h2>
              <p className="text-sm text-gray-500">{data?.target?.companyName || '…'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Schließen</button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={CLS_LABEL}>Förderprogramm</label>
                  <select value={form.fundingProgram} onChange={(e) => selectProgram(e.target.value)} className={CLS_INPUT}>
                    <option value="">— kein Programm —</option>
                    {(data?.fundingPrograms || [])
                      .filter((p) => p.active !== false || p.name === form.fundingProgram)
                      .map((p) => (
                        <option key={p.id || p.name} value={p.name}>{p.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Status</label>
                  <select value={form.bafaStatus} onChange={(e) => setForm({ ...form, bafaStatus: e.target.value })} className={CLS_INPUT}>
                    {BAFA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Antragsdatum</label>
                  <input type="date" value={form.bafaDate} onChange={(e) => setForm({ ...form, bafaDate: e.target.value })} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Eingereicht am</label>
                  <input type="date" value={form.bafaSubmittedAt} onChange={(e) => setForm({ ...form, bafaSubmittedAt: e.target.value })} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Angebotswert</label>
                  <input value={formatCurrency(offerValue)} readOnly className={`${CLS_INPUT} bg-gray-50 text-gray-500`} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Fördersumme (berechnet)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.fundingAmount}
                    onChange={(e) => setForm({ ...form, fundingAmount: e.target.value })}
                    className={CLS_INPUT}
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>Bewilligter Betrag</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.bafaApprovedAmount}
                    onChange={(e) => setForm({ ...form, bafaApprovedAmount: e.target.value })}
                    className={CLS_INPUT}
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-3">
                  <Calculator className="w-4 h-4 text-blue-500" /> Fördersummen-Rechner
                </p>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={CLS_LABEL}>Quote (%)</label>
                    <input
                      type="number" min="0" max="100" step="1"
                      value={Math.round(rate * 100)}
                      onChange={(e) => setRate((Number(e.target.value) || 0) / 100)}
                      className={CLS_INPUT}
                    />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Obergrenze (€)</label>
                    <input
                      type="number" min="0" step="1"
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                      placeholder="optional"
                      className={CLS_INPUT}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ergebnis</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(calculated)}</p>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, fundingAmount: String(calculated) }))}
                    className="text-sm text-blue-700 hover:text-blue-900"
                  >
                    Als Fördersumme übernehmen
                  </button>
                </div>
              </div>

              <div>
                <label className={CLS_LABEL}>Hinweise</label>
                <textarea rows={2} value={form.bafaNotes} onChange={(e) => setForm({ ...form, bafaNotes: e.target.value })} className={CLS_INPUT} />
              </div>

              <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Nachweise</h3>
                {(data?.documents || []).length === 0 ? (
                  <p className="text-sm text-gray-500 mb-3">Noch keine Nachweise hinterlegt.</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {data.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2 border border-gray-200 rounded-lg p-2">
                        <span className="flex-1 text-sm text-gray-900">{doc.name}</span>
                        <select
                          value={doc.status}
                          onChange={(e) => updateDocument(doc, { status: e.target.value })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-700 bg-white"
                        >
                          {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => deleteDocument(doc)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Entfernen">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={addDocument} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={newDoc.name}
                    onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                    placeholder="Dokumentname"
                    className={`${CLS_INPUT} col-span-6`}
                  />
                  <select
                    value={newDoc.status}
                    onChange={(e) => setNewDoc({ ...newDoc, status: e.target.value })}
                    className={`${CLS_INPUT} col-span-3`}
                  >
                    {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="submit" className="col-span-3 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50">
                    <Plus className="w-4 h-4" /> Hinzufügen
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

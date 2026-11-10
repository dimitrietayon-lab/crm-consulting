'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Trash2, Edit2, ShieldAlert, Search, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { exportCsv, csvFilename } from '@/lib/csv'

const REASONS = ['Kein Interesse', 'Widerspruch', 'Löschverlangen', 'Beschwerde', 'Sonstiges']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

export default function SprintBlocklistPage() {
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [modal, setModal] = useState(null) // { entry }
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/sprint-targets/blocklist')
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Fehler beim Laden der Sperrliste')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  function openEdit(entry) {
    setForm({
      companyName: entry.companyName || '',
      reason: entry.reason || 'Sonstiges',
      contactName: entry.contactName || '',
      notes: entry.notes || '',
      blockedAt: entry.blockedAt ? String(entry.blockedAt).slice(0, 10) : '',
    })
    setModal({ entry })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.companyName.trim()) { toast.error('Unternehmen erforderlich'); return }
    setSaving(true)
    try {
      const updated = await api.put(`/sprint-targets/blocklist/${modal.entry.id}`, form)
      setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      toast.success('Sperrvermerk aktualisiert')
      setModal(null)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Sperrvermerk für "${entry.companyName}" wirklich löschen?`)) return
    try {
      await api.delete(`/sprint-targets/blocklist/${entry.id}`)
      setEntries((prev) => prev.filter((x) => x.id !== entry.id))
      toast.success('Sperrvermerk gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    }
  }

  const q = search.trim().toLowerCase()
  const rows = entries.filter((e) => {
    if (reasonFilter && (e.reason || 'Sonstiges') !== reasonFilter) return false
    if (q) {
      const haystack = `${e.companyName} ${e.contactName || ''} ${e.notes || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const kpis = {
    total: entries.length,
    last30: entries.filter((e) => Date.now() - new Date(e.blockedAt).getTime() <= 30 * 86400000).length,
    objection: entries.filter((e) => ['Widerspruch', 'Löschverlangen'].includes(e.reason)).length,
  }

  function handleExport() {
    exportCsv(
      csvFilename('sprint-sperrliste'),
      [
        { key: 'companyName', label: 'Unternehmen' },
        { key: 'reason', label: 'Grund' },
        { key: 'blockedAt', label: 'Datum', format: (e) => formatDate(e.blockedAt) },
        { key: 'contactName', label: 'Kontakt' },
        { key: 'notes', label: 'Notiz' },
      ],
      rows
    )
    toast.success('CSV-Export erstellt')
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
            <h1 className="text-xl font-bold text-gray-900">Sperrliste</h1>
            <p className="text-sm text-gray-500">
              Wird automatisch befüllt, wenn ein Zielkunde auf „kein Interesse" gesetzt wird – und beim Zurücksetzen wieder entsperrt
            </p>
          </div>
          <span className="ml-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-medium">
            {entries.length}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">DSGVO:</span> „Kein Interesse" und Widersprüche werden hier dokumentiert
          (Name, Datum, Grund) und drei Jahre aufbewahrt. Gesperrte Unternehmen werden beim Listen-Import übersprungen;
          Anrufe, E-Mails, LinkedIn, Termine und Angebote sind für sie technisch blockiert (Art. 21 DSGVO).
        </span>
      </div>

      {/* KPI-Kopf */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sperrvermerke', value: kpis.total, color: 'text-red-700' },
          { label: 'Letzte 30 Tage', value: kpis.last30, color: 'text-amber-700' },
          { label: 'Widerspruch / Löschung', value: kpis.objection, color: 'text-gray-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unternehmen, Kontakt oder Notiz suchen …"
            className="w-80 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Alle Gründe</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-xs text-gray-500">{rows.length} von {entries.length}</span>
        <button
          onClick={handleExport}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <ShieldAlert className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Keine Sperrvermerke vorhanden. Setze einen Zielkunden auf „kein Interesse", um einen Eintrag zu erzeugen.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['Unternehmen', 'Grund', 'Datum', 'Kontakt', 'Notiz', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{entry.companyName}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                      {entry.reason || 'Sonstiges'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{formatDate(entry.blockedAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{entry.contactName || '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 max-w-xs truncate">{entry.notes || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(entry)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Bearbeiten">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(entry)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Löschen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Sperrvermerk bearbeiten
                </h2>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={CLS_LABEL}>Unternehmen *</label>
                  <input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} className={CLS_INPUT} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={CLS_LABEL}>Grund</label>
                    <select value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} className={CLS_INPUT}>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Datum</label>
                    <input type="date" value={form.blockedAt} onChange={(e) => setForm((p) => ({ ...p, blockedAt: e.target.value }))} className={CLS_INPUT} />
                  </div>
                </div>
                <div>
                  <label className={CLS_LABEL}>Ansprechpartner</label>
                  <input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Notiz</label>
                  <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className={`${CLS_INPUT} resize-none`} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Library, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

const ACTIVITY_TYPES = ['Note', 'Call', 'Meeting', 'Email', 'LinkedIn', 'Task']
const CLS =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

const FLAGS = [
  ['isEarly', 'Frühphase'],
  ['isInTalk', 'Im Gespräch'],
  ['isOffer', 'Angebot'],
  ['isOfferSent', 'Angebot gesendet'],
  ['isWon', 'Gewonnen'],
  ['isLost', 'Verloren'],
  ['isWildcard', 'Jederzeit wählbar'],
  ['isClosing', 'Abschluss'],
]
const FLAG_KEYS = FLAGS.map(([k]) => k)

const EMPTY = {
  label: '', activityType: 'Note',
  ...Object.fromEntries(FLAG_KEYS.map((k) => [k, false])),
}

// Verwaltung der Schritt-Bibliothek. Standard-Schritte sind geschützt (Key/Typ
// read-only); Custom-Schritte lassen sich anlegen, bearbeiten und löschen.
export default function StepLibraryTab() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // { id?, isStandard, ...form }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await api.get('/acquisition-steps')
      setTemplates(Array.isArray(rows) ? rows : [])
    } catch {
      toast.error('Schritt-Bibliothek konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((t) => `${t.label || ''} ${t.key || ''}`.toLowerCase().includes(term))
  }, [templates, q])

  function openCreate() {
    setEditing({ ...EMPTY })
  }
  function openEdit(t) {
    setEditing({
      id: t.id,
      isStandard: t.isStandard,
      usageCount: t.usageCount || 0,
      key: t.key,
      label: t.label || '',
      activityType: t.activityType || 'Note',
      ...Object.fromEntries(FLAG_KEYS.map((k) => [k, !!t[k]])),
    })
  }
  function set(field, value) {
    setEditing((prev) => ({ ...prev, [field]: value }))
  }

  async function save() {
    if (!editing.label.trim()) { toast.error('Bezeichnung ist erforderlich'); return }
    const payload = {
      label: editing.label.trim(),
      activityType: editing.activityType || 'Note',
      ...Object.fromEntries(FLAG_KEYS.map((k) => [k, !!editing[k]])),
    }
    setSaving(true)
    try {
      if (editing.id) await api.put(`/acquisition-steps/${editing.id}`, payload)
      else await api.post('/acquisition-steps', payload)
      toast.success('Schritt gespeichert')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function remove(t) {
    if (!window.confirm(`Schritt „${t.label}" löschen?`)) return
    try {
      await api.delete(`/acquisition-steps/${t.id}`)
      toast.success('Schritt gelöscht')
      await load()
    } catch (err) {
      toast.error(err.message || 'Löschen fehlgeschlagen')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-600" /> Schritt-Bibliothek
          </h2>
          <p className="text-sm text-gray-500">Wiederverwendbare Standard- und eigene Schritte für alle Workflows.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neuer Schritt
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Schritt suchen…"
          className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-2.5">Schritt</th>
              <th className="px-4 py-2.5">Key</th>
              <th className="px-4 py-2.5">Aktivität</th>
              <th className="px-4 py-2.5">Eigenschaften</th>
              <th className="px-4 py-2.5">Typ</th>
              <th className="px-4 py-2.5 text-right">Nutzung</th>
              <th className="px-4 py-2.5 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{t.label}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{t.key}</td>
                <td className="px-4 py-2.5 text-gray-600">{t.activityType}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {FLAGS.filter(([flag]) => t[flag]).map(([flag, label]) => (
                      <span key={flag} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">{label}</span>
                    ))}
                    {FLAGS.every(([flag]) => !t[flag]) && <span className="text-xs text-gray-300">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {t.isStandard ? (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold">Standard</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">Eigener</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{t.usageCount ?? 0}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => openEdit(t)} title="Bearbeiten" className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!t.isStandard && (
                      <button type="button" onClick={() => remove(t)} title="Löschen" className="p-1.5 rounded hover:bg-red-50 text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Keine Schritte gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{editing.id ? 'Schritt bearbeiten' : 'Neuer Schritt'}</h3>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>
              {editing.id && editing.isStandard && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                  Standard-Schritt: Bezeichnung und Eigenschaften sind anpassbar, Typ und Key bleiben geschützt.
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung *</label>
                <input value={editing.label} onChange={(e) => set('label', e.target.value)} className={CLS} placeholder="z. B. Angebot in Vorbereitung" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aktivitätstyp</label>
                <select value={editing.activityType} onChange={(e) => set('activityType', e.target.value)} className={CLS}>
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Eigenschaften</label>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {FLAGS.map(([flag, label]) => (
                    <label key={flag} className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!editing[flag]}
                        onChange={(e) => set(flag, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { refreshPipeline } from '@/lib/pipeline'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const EMPTY = {
  name: '', description: '', pipelineId: '', serviceId: '', package: '',
  startDate: '', endDate: '', active: true, isDefault: false,
}

const dateValue = (v) => (v ? String(v).split('T')[0] : '')

// Kampagnen: jede Kampagne verknüpft einen Workflow (Pipeline) mit optional
// Dienstleistung, Paket und Zeitraum. Zielkunden erben den Workflow der Kampagne.
export default function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [services, setServices] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // { id?, ...form }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, wf, svc, market] = await Promise.all([
        api.get('/acquisition-campaigns'),
        api.get('/acquisition-pipeline/list').catch(() => []),
        api.get('/proposals/services').catch(() => []),
        api.get('/acquisition-market').catch(() => ({ packages: [] })),
      ])
      setCampaigns(Array.isArray(c) ? c : [])
      setWorkflows(Array.isArray(wf) ? wf : [])
      setServices(Array.isArray(svc) ? svc : [])
      setPackages(Array.isArray(market?.packages) ? market.packages : [])
    } catch {
      toast.error('Kampagnen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    const def = workflows.find((w) => w.isDefault) || workflows[0]
    setEditing({ ...EMPTY, pipelineId: def?.id || '' })
  }

  function openEdit(c) {
    setEditing({
      id: c.id,
      name: c.name || '',
      description: c.description || '',
      pipelineId: c.pipelineId || '',
      serviceId: c.serviceId || '',
      package: c.package || '',
      startDate: dateValue(c.startDate),
      endDate: dateValue(c.endDate),
      active: c.active !== false,
      isDefault: !!c.isDefault,
    })
  }

  function set(field, value) {
    setEditing((prev) => ({ ...prev, [field]: value }))
  }

  async function save() {
    if (!editing.name.trim()) { toast.error('Name ist erforderlich'); return }
    if (!editing.pipelineId) { toast.error('Workflow ist erforderlich'); return }
    setSaving(true)
    try {
      const payload = {
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        pipelineId: editing.pipelineId,
        serviceId: editing.serviceId || null,
        package: editing.package || null,
        startDate: editing.startDate || null,
        endDate: editing.endDate || null,
        active: editing.active,
        isDefault: editing.isDefault,
      }
      if (editing.id) await api.put(`/acquisition-campaigns/${editing.id}`, payload)
      else await api.post('/acquisition-campaigns', payload)
      toast.success('Kampagne gespeichert')
      setEditing(null)
      await load()
      await refreshPipeline()
    } catch (err) {
      toast.error(err.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function setDefault(c) {
    try {
      await api.post(`/acquisition-campaigns/${c.id}/set-default`, {})
      toast.success('Standard-Kampagne gesetzt')
      await load()
      await refreshPipeline()
    } catch (err) {
      toast.error(err.message || 'Fehlgeschlagen')
    }
  }

  async function remove(c) {
    if (!window.confirm(`Kampagne „${c.name}" löschen?`)) return
    try {
      await api.delete(`/acquisition-campaigns/${c.id}`)
      toast.success('Kampagne gelöscht')
      await load()
      await refreshPipeline()
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kampagnen</h2>
          <p className="text-sm text-gray-500">Workflow, Dienstleistung, Paket und Zeitraum je Akquise-Kampagne.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neue Kampagne
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          Noch keine Kampagnen angelegt.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-2.5">Kampagne</th>
                <th className="px-4 py-2.5">Workflow</th>
                <th className="px-4 py-2.5">Dienstleistung</th>
                <th className="px-4 py-2.5">Paket</th>
                <th className="px-4 py-2.5">Zeitraum</th>
                <th className="px-4 py-2.5 text-right">Zielkunden</th>
                <th className="px-4 py-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.isDefault && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Star className="w-2.5 h-2.5" /> Standard
                        </span>
                      )}
                      {!c.active && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">inaktiv</span>
                      )}
                    </div>
                    {c.description && <p className="text-[11px] text-gray-400 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.pipeline?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.service?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.package || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {c.startDate || c.endDate
                      ? `${c.startDate ? formatDate(c.startDate) : '…'} – ${c.endDate ? formatDate(c.endDate) : '…'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{c.targetCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!c.isDefault && (
                        <button type="button" onClick={() => setDefault(c)} title="Als Standard setzen" className="p-1.5 rounded hover:bg-amber-50 text-amber-600">
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => openEdit(c)} title="Bearbeiten" className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => remove(c)} title="Löschen" className="p-1.5 rounded hover:bg-red-50 text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{editing.id ? 'Kampagne bearbeiten' : 'Neue Kampagne'}</h3>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <label className={CLS_LABEL}>Name *</label>
                <input value={editing.name} onChange={(e) => set('name', e.target.value)} className={CLS_INPUT} placeholder="z. B. KI Readiness Sprint" />
              </div>
              <div>
                <label className={CLS_LABEL}>Beschreibung</label>
                <input value={editing.description} onChange={(e) => set('description', e.target.value)} className={CLS_INPUT} placeholder="optional" />
              </div>
              <div>
                <label className={CLS_LABEL}>Workflow *</label>
                <select value={editing.pipelineId} onChange={(e) => set('pipelineId', e.target.value)} className={CLS_INPUT}>
                  <option value="">— Workflow wählen —</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Standard)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={CLS_LABEL}>Dienstleistung</label>
                  <select value={editing.serviceId} onChange={(e) => set('serviceId', e.target.value)} className={CLS_INPUT}>
                    <option value="">— keine —</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Paket</label>
                  <select value={editing.package} onChange={(e) => set('package', e.target.value)} className={CLS_INPUT}>
                    <option value="">— keines —</option>
                    {packages.map((p) => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Start</label>
                  <input type="date" value={editing.startDate} onChange={(e) => set('startDate', e.target.value)} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Ende</label>
                  <input type="date" value={editing.endDate} onChange={(e) => set('endDate', e.target.value)} className={CLS_INPUT} />
                </div>
              </div>
              <div className="flex items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={editing.active} onChange={(e) => set('active', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Aktiv
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={editing.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Standard-Kampagne
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Abbrechen
                </button>
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

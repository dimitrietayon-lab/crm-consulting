'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Linkedin, Send, Search, Plus, Copy, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { getSprintSettings } from '@/lib/sprintSettings'
import { EARLY_STATUSES } from '@/lib/sprintOptions'

const CHANNELS = ['E-Mail', 'LinkedIn', 'Telefon']

const PLACEHOLDERS = ['{unternehmen}', '{ansprechpartner}', '{segment}', '{ort}', '{datum}']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const EMPTY_TEMPLATE = { name: '', channel: 'E-Mail', subject: '', body: '', notes: '', active: true }

const TABS = [
  { key: 'outreach', label: 'LinkedIn-Outreach' },
  { key: 'templates', label: 'Vorlagen' },
]

function TemplateModal({ template, onClose, onSaved }) {
  const [form, setForm] = useState(template || EMPTY_TEMPLATE)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Name und Text sind erforderlich')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        channel: form.channel,
        subject: form.subject || null,
        body: form.body,
        notes: form.notes || null,
        active: form.active,
      }
      const saved = form.id
        ? await api.put(`/sprint-outreach/templates/${form.id}`, payload)
        : await api.post('/sprint-outreach/templates', payload)
      toast.success(form.id ? 'Vorlage aktualisiert' : 'Vorlage angelegt')
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className={CLS_INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kanal</label>
                <select value={form.channel} onChange={(e) => set('channel', e.target.value)} className={CLS_INPUT}>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Betreff (optional)</label>
              <input value={form.subject || ''} onChange={(e) => set('subject', e.target.value)} className={CLS_INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
              <textarea
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                rows={8}
                className={`${CLS_INPUT} resize-none`}
                required
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('body', `${form.body}${p}`)}
                    className="px-1.5 py-0.5 text-[11px] font-mono text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notiz (optional)</label>
              <input value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className={CLS_INPUT} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} />
              Aktiv
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SprintOutreachPage() {
  const router = useRouter()
  const [tab, setTab] = useState('outreach')
  const [targets, setTargets] = useState([])
  const [activities, setActivities] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [quota, setQuota] = useState(75)
  const [editing, setEditing] = useState(null) // template form (null = closed)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, a, tpl] = await Promise.all([
        api.get('/sprint-targets'),
        api.get('/activities?onlySprint=true&type=LinkedIn&limit=1000'),
        api.get('/sprint-outreach/templates'),
      ])
      setTargets(Array.isArray(t) ? t : [])
      setActivities(Array.isArray(a) ? a : [])
      setTemplates(Array.isArray(tpl) ? tpl : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setQuota(getSprintSettings().linkedinQuota)
    fetchAll()
  }, [fetchAll])

  const linkedinByTarget = useMemo(() => {
    const map = {}
    for (const a of activities) {
      if (!a.sprintTargetId) continue
      if (!map[a.sprintTargetId] || new Date(a.date) > new Date(map[a.sprintTargetId])) {
        map[a.sprintTargetId] = a.date
      }
    }
    return map
  }, [activities])

  const weeklyCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000
    return activities.filter((a) => new Date(a.date).getTime() >= cutoff).length
  }, [activities])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return targets
      .filter((t) => EARLY_STATUSES.includes(t.status))
      .filter((t) => !priorityFilter || t.priority === priorityFilter)
      .filter((t) => !q || t.companyName.toLowerCase().includes(q))
      .sort((a, b) => String(a.priority || '9').localeCompare(String(b.priority || '9')))
  }, [targets, priorityFilter, search])

  const visibleTemplates = useMemo(
    () => (channelFilter ? templates.filter((t) => t.channel === channelFilter) : templates),
    [templates, channelFilter]
  )

  async function sendRequest(target) {
    setSendingId(target.id)
    try {
      const activity = await api.post(`/sprint-targets/${target.id}/activities`, {
        type: 'LinkedIn',
        channel: 'LinkedIn',
        date: new Date().toISOString(),
        summary: 'LinkedIn-Kontaktanfrage gesendet',
      })
      setActivities((prev) => [activity, ...prev])

      if (['offen', 'recherchiert'].includes(target.status)) {
        const updated = await api.put(`/sprint-targets/${target.id}`, { status: 'vernetzt' })
        setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, ...updated } : t)))
      }
      toast.success('Anfrage protokolliert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Protokollieren')
    } finally {
      setSendingId(null)
    }
  }

  async function removeTemplate(tpl) {
    if (!window.confirm(`Vorlage „${tpl.name}“ löschen?`)) return
    try {
      await api.delete(`/sprint-outreach/templates/${tpl.id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id))
      toast.success('Vorlage gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    }
  }

  async function copyTemplate(tpl) {
    try {
      await navigator.clipboard.writeText(tpl.body)
      toast.success('Text kopiert')
    } catch {
      toast.error('Kopieren nicht möglich')
    }
  }

  function onTemplateSaved(saved) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id)
      return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]
    })
  }

  const quotaPct = quota > 0 ? Math.min(100, Math.round((weeklyCount / quota) * 100)) : 0

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outreach</h1>
            <p className="text-sm text-gray-500">Kontaktanfragen, Wochenquote und Vorlagen</p>
          </div>
        </div>
        {tab === 'templates' && (
          <button
            onClick={() => setEditing({ ...EMPTY_TEMPLATE })}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Neue Vorlage
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'outreach' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Wochenquote</span>
              </div>
              <span className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{weeklyCount}</span> / {quota} Anfragen
              </span>
            </div>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${quotaPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${quotaPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ziel: ca. {quota} Anfragen pro Woche, mindestens 50 % an Zielfirmen (Prio 1).
            </p>
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
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
              <option value="">Alle Prioritäten</option>
              <option value="1">Prio 1</option>
              <option value="2">Prio 2</option>
              <option value="3">Prio 3</option>
            </select>
            <span className="text-xs text-gray-500">{rows.length} offene Zielkunden</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">Keine offenen Zielkunden für den Outreach.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {['Unternehmen', 'Priorität', 'Status', 'Letzte Anfrage', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5">
                        <button onClick={() => router.push(`/sprint-targets/${t.id}`)} className="text-sm font-medium text-gray-900 hover:text-blue-700">
                          {t.companyName}
                        </button>
                        <p className="text-xs text-gray-500">{t.segment}{t.bundesland ? ` · ${t.bundesland}` : ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                          t.priority === '1' ? 'bg-red-50 text-red-700 border-red-100'
                          : t.priority === '2' ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                          : 'bg-gray-50 text-gray-600 border-gray-100'
                        }`}>
                          Prio {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 capitalize">{t.status}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {linkedinByTarget[t.id] ? formatDate(linkedinByTarget[t.id]) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => sendRequest(t)}
                          disabled={sendingId === t.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sendingId === t.id ? 'Speichern…' : 'Anfrage gesendet'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
              <option value="">Alle Kanäle</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-gray-500">{visibleTemplates.length} Vorlagen</span>
          </div>

          {visibleTemplates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-500 mb-4">Noch keine Vorlagen angelegt.</p>
              <button
                onClick={() => setEditing({ ...EMPTY_TEMPLATE })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Erste Vorlage anlegen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleTemplates.map((tpl) => (
                <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          tpl.channel === 'E-Mail' ? 'bg-blue-50 text-blue-700'
                          : tpl.channel === 'LinkedIn' ? 'bg-sky-50 text-sky-700'
                          : 'bg-amber-50 text-amber-700'
                        }`}>
                          {tpl.channel}
                        </span>
                        {!tpl.active && <span className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 text-gray-500">inaktiv</span>}
                      </div>
                      {tpl.subject && <p className="text-xs text-gray-600 mt-0.5 truncate">Betreff: {tpl.subject}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => copyTemplate(tpl)} title="Text kopieren" className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditing(tpl)} title="Bearbeiten" className="p-1.5 text-gray-400 hover:text-blue-700 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeTemplate(tpl)} title="Löschen" className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-5 flex-1">{tpl.body}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
                    <span>{tpl.usageCount || 0}× genutzt</span>
                    <span>{formatDate(tpl.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <TemplateModal template={editing} onClose={() => setEditing(null)} onSaved={onTemplateSaved} />
      )}
    </div>
  )
}

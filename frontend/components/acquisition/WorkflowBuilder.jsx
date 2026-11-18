'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, RotateCcw, Save,
  Settings2, Star, Trash2, Workflow, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import {
  createPipeline, deletePipeline, resetPipeline, savePipeline,
} from '@/lib/pipeline'
import { slugifyStatus } from '@/lib/pipelineLogic'

const ACTIVITY_TYPES = ['Note', 'Call', 'Meeting', 'Email', 'LinkedIn', 'Task']
const CLS =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_SM =
  'rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function blankStep(stageKey) {
  const step = {
    status: '', slug: '', label: '', shortLabel: '', stageKey: stageKey || '',
    activityType: 'Note', title: '', description: '', requiredFields: [],
    guide: [], exitCriteria: [], templateId: null, outcome: null, active: true,
  }
  for (const flag of FLAG_KEYS) step[flag] = false
  return step
}

function stepFromTemplate(tpl, stageKey, existingStatuses) {
  let status = tpl.label || tpl.key || 'Neuer Schritt'
  if (existingStatuses.has(status)) {
    let n = 2
    while (existingStatuses.has(`${status} ${n}`)) n += 1
    status = `${status} ${n}`
  }
  const step = {
    status,
    slug: slugifyStatus(status),
    label: tpl.label || status,
    shortLabel: tpl.shortLabel || '',
    stageKey: stageKey || '',
    activityType: tpl.activityType || 'Note',
    title: tpl.title || '',
    description: tpl.description || '',
    requiredFields: Array.isArray(tpl.requiredFields) ? tpl.requiredFields : [],
    guide: Array.isArray(tpl.guide) ? tpl.guide : [],
    exitCriteria: Array.isArray(tpl.exitCriteria) ? tpl.exitCriteria : [],
    templateId: tpl.id || null,
    outcome: tpl.outcome || null,
    active: tpl.active !== false,
  }
  for (const flag of FLAG_KEYS) step[flag] = !!tpl[flag]
  return step
}

// n8n-artiger Workflow-Builder: Workflows links, Stage-Bänder als Spalten mit
// Schritt-Karten, Inspector rechts. Schritte kommen aus der Schritt-Bibliothek.
export default function WorkflowBuilder() {
  const [list, setList] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inspector, setInspector] = useState(null)
  const [pickerStage, setPickerStage] = useState(null) // stageKey für Picker
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [advanced, setAdvanced] = useState(false)

  const loadTemplates = useCallback(async () => {
    const t = await api.get('/acquisition-steps').catch(() => [])
    setTemplates(Array.isArray(t) ? t : [])
  }, [])

  const loadList = useCallback(async () => {
    const l = await api.get('/acquisition-pipeline/list').catch(() => [])
    const arr = Array.isArray(l) ? l : []
    setList(arr)
    return arr
  }, [])

  const loadPipeline = useCallback(async (id) => {
    setLoading(true)
    try {
      const p = await api.get(`/acquisition-pipeline/${id}`)
      setDraft({
        id: p.id,
        key: p.key,
        name: p.name || '',
        description: p.description || '',
        active: p.active !== false,
        isDefault: p.isDefault === true,
        stages: (p.stages || []).map((s) => ({ key: s.key, label: s.label, color: s.color || '' })),
        steps: (p.steps || []).map((s) => ({ ...blankStep(), ...s })),
        transitions: (p.transitions || []).map((t) => ({ fromStatus: t.fromStatus, toStatus: t.toStatus })),
      })
      setInspector(null)
    } catch {
      toast.error('Workflow konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const arr = await loadList()
      const def = arr.find((w) => w.isDefault) || arr[0]
      if (def) {
        setSelectedId(def.id)
        await loadPipeline(def.id)
      } else {
        setLoading(false)
      }
      await loadTemplates()
    })()
  }, [loadList, loadPipeline, loadTemplates])

  async function selectWorkflow(id) {
    if (id === selectedId) return
    setSelectedId(id)
    await loadPipeline(id)
  }

  function patchDraft(patch) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }
  function patchStage(index, patch) {
    setDraft((prev) => prev && {
      ...prev,
      stages: prev.stages.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }
  function patchStep(index, patch) {
    setDraft((prev) => prev && {
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }
  function moveStep(index, dir) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = [...prev.steps]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, steps: next }
    })
  }
  function moveStage(index, dir) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = [...prev.stages]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, stages: next }
    })
  }
  function addStage() {
    setDraft((prev) => prev && ({
      ...prev,
      stages: [...prev.stages, { key: `phase-${prev.stages.length + 1}`, label: 'Neue Phase', color: '' }],
    }))
  }
  function removeStage(index) {
    setDraft((prev) => {
      if (!prev || prev.stages.length <= 1) return prev
      const removed = prev.stages[index]
      const remaining = prev.stages.filter((_, i) => i !== index)
      return {
        ...prev,
        stages: remaining,
        steps: prev.steps.map((s) => (s.stageKey === removed.key ? { ...s, stageKey: remaining[0].key } : s)),
      }
    })
  }

  function addStepFromTemplate(tpl) {
    setDraft((prev) => {
      if (!prev) return prev
      const statuses = new Set(prev.steps.map((s) => s.status))
      const stageKey = pickerStage || prev.stages[0]?.key
      const step = stepFromTemplate(tpl, stageKey, statuses)
      const next = { ...prev, steps: [...prev.steps, step] }
      setTimeout(() => setInspector(next.steps.length - 1), 0)
      return next
    })
    setPickerStage(null)
  }

  function addBlankStep() {
    setDraft((prev) => {
      if (!prev) return prev
      const step = blankStep(pickerStage || prev.stages[0]?.key)
      const next = { ...prev, steps: [...prev.steps, step] }
      setTimeout(() => setInspector(next.steps.length - 1), 0)
      return next
    })
    setPickerStage(null)
  }

  function removeStep(index) {
    setDraft((prev) => prev && ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))
    setInspector(null)
  }

  function buildPayload() {
    if (!draft) return null
    return {
      name: draft.name,
      description: draft.description,
      active: draft.active,
      isDefault: draft.isDefault,
      stages: draft.stages.map((s, i) => ({
        key: (s.key || '').trim(),
        label: (s.label || '').trim() || s.key,
        order: i + 1,
        color: s.color || null,
      })),
      steps: draft.steps.map((s, i) => ({
        status: (s.status || '').trim(),
        stageKey: s.stageKey,
        slug: (s.slug || '').trim() || slugifyStatus(s.status),
        label: (s.label || '').trim() || s.status,
        shortLabel: (s.shortLabel || '').trim() || null,
        order: i + 1,
        activityType: s.activityType || 'Note',
        title: (s.title || '').trim() || null,
        description: (s.description || '').trim() || null,
        requiredFields: Array.isArray(s.requiredFields) ? s.requiredFields : [],
        guide: Array.isArray(s.guide) ? s.guide : [],
        exitCriteria: Array.isArray(s.exitCriteria) ? s.exitCriteria : [],
        templateId: s.templateId || null,
        isEarly: !!s.isEarly,
        isInTalk: !!s.isInTalk,
        isOffer: !!s.isOffer,
        isOfferSent: !!s.isOfferSent,
        isWon: !!s.isWon,
        isLost: !!s.isLost,
        isWildcard: !!s.isWildcard,
        isClosing: !!s.isClosing,
        outcome: s.isWon ? 'won' : s.isLost ? 'lost' : (s.outcome || null),
        active: s.active !== false,
      })),
      transitions: draft.transitions.filter((t) => t.fromStatus && t.toStatus),
    }
  }

  function validate() {
    const statuses = draft.steps.map((s) => (s.status || '').trim())
    if (statuses.some((s) => !s)) return 'Jeder Schritt braucht einen Status'
    if (new Set(statuses).size !== statuses.length) return 'Status-Werte müssen innerhalb des Workflows eindeutig sein'
    const slugs = draft.steps.map((s) => (s.slug || '').trim() || slugifyStatus(s.status))
    if (new Set(slugs).size !== slugs.length) return 'Slugs müssen innerhalb des Workflows eindeutig sein'
    const keys = draft.stages.map((s) => (s.key || '').trim())
    if (keys.some((k) => !k)) return 'Jede Phase braucht einen Key'
    if (new Set(keys).size !== keys.length) return 'Phase-Keys müssen eindeutig sein'
    return null
  }

  async function onSave() {
    const error = validate()
    if (error) return toast.error(error)
    setSaving(true)
    try {
      await savePipeline(buildPayload(), selectedId)
      await loadList()
      toast.success('Workflow gespeichert')
    } catch (err) {
      toast.error(err.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function onSetDefault() {
    setSaving(true)
    try {
      await savePipeline({ ...buildPayload(), isDefault: true }, selectedId)
      const arr = await loadList()
      const def = arr.find((w) => w.isDefault)
      if (def) setSelectedId(def.id)
      setDraft((prev) => (prev ? { ...prev, isDefault: true } : prev))
      toast.success('Workflow als Standard gesetzt')
    } catch (err) {
      toast.error(err.message || 'Fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function onCreate() {
    const name = newName.trim()
    if (!name) return toast.error('Name ist erforderlich')
    setSaving(true)
    try {
      const created = await createPipeline({ name, copyFromId: selectedId || undefined })
      const arr = await loadList()
      setNewOpen(false)
      setNewName('')
      if (created?.id) {
        setSelectedId(created.id)
        await loadPipeline(created.id)
      } else if (arr.length) {
        const last = arr[arr.length - 1]
        setSelectedId(last.id)
        await loadPipeline(last.id)
      }
      toast.success('Workflow angelegt')
    } catch (err) {
      toast.error(err.message || 'Anlegen fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    const wf = list.find((w) => w.id === selectedId)
    if (!window.confirm(`Workflow „${wf?.name || ''}" löschen?`)) return
    setSaving(true)
    try {
      await deletePipeline(selectedId)
      const arr = await loadList()
      const def = arr.find((w) => w.isDefault) || arr[0]
      if (def) {
        setSelectedId(def.id)
        await loadPipeline(def.id)
      } else {
        setDraft(null)
      }
      toast.success('Workflow gelöscht')
    } catch (err) {
      toast.error(err.message || 'Löschen fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function onReset() {
    if (!window.confirm('Diesen Workflow auf den Standard zurücksetzen?')) return
    setSaving(true)
    try {
      await resetPipeline(selectedId)
      await loadList()
      await loadPipeline(selectedId)
      toast.success('Workflow zurückgesetzt')
    } catch (err) {
      toast.error(err.message || 'Zurücksetzen fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const pickerTemplates = useMemo(
    // Standard-Vorlagen + globale Custom-Vorlagen + Custom dieses Workflows.
    // Pipeline-gebundene Customs (z. B. „Fragebogen") erscheinen nur dort.
    () => templates.filter((t) => t.isStandard || !t.ownerPipelineId || t.ownerPipelineId === selectedId),
    [templates, selectedId],
  )

  const stepsByStage = useMemo(() => {
    const map = new Map()
    if (!draft) return map
    for (const stage of draft.stages) map.set(stage.key, [])
    for (const step of draft.steps) {
      const key = draft.stages.some((s) => s.key === step.stageKey) ? step.stageKey : draft.stages[0]?.key
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(step)
    }
    return map
  }, [draft])

  if (loading && !draft) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-gray-500">Noch keine Workflows vorhanden.</p>
        <button type="button" onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Neuer Workflow
        </button>
        {newOpen && renderNewModal()}
      </div>
    )
  }

  const selectedStep = inspector != null ? draft.steps[inspector] : null

  function renderNewModal() {
    return (
      <div className="fixed inset-0 z-50">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNewOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Neuer Workflow</h3>
              <button type="button" onClick={() => setNewOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500">Wird als Kopie des aktuell gewählten Workflows angelegt (Phasen, Schritte, Übergänge).</p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCreate() } }}
                placeholder="z. B. Test-Workflow"
                className={CLS}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
              <button type="button" onClick={onCreate} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Anlegen
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Workflow className="w-5 h-5 text-blue-600" /> Workflows
          </h2>
          <p className="text-sm text-gray-500">Workflows aus der Schritt-Bibliothek zusammenstellen. Zielkunden erben den Workflow ihrer Kampagne.</p>
        </div>
        <div className="flex items-center gap-2">
          {!draft.isDefault && (
            <button type="button" onClick={onSetDefault} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50">
              <Star className="w-4 h-4" /> Als Standard
            </button>
          )}
          {draft.key === 'default' && (
            <button type="button" onClick={onReset} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Zurücksetzen
            </button>
          )}
          {!draft.isDefault && (
            <button type="button" onClick={onDelete} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Löschen
            </button>
          )}
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Workflow-Liste */}
        <aside className="w-full lg:w-56 shrink-0 bg-white rounded-xl border border-gray-200 p-2 space-y-1">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Workflows</span>
            <button type="button" onClick={() => { setNewName(''); setNewOpen(true) }} className="p-1 rounded text-blue-600 hover:bg-blue-50" title="Neuer Workflow">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {list.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => selectWorkflow(w.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                w.id === selectedId ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate flex-1">{w.name}</span>
                {w.isDefault && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
              </span>
            </button>
          ))}
        </aside>

        {/* Canvas */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Workflow-Metadaten */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className={CLS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Key</label>
              <input value={draft.key} readOnly className={`${CLS} bg-gray-50 font-mono text-xs text-gray-500`} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
              <input value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} className={CLS} placeholder="optional" />
            </div>
          </div>

          {/* Phasen */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Phasen ({draft.stages.length})</h3>
              <button type="button" onClick={addStage} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                <Plus className="w-3.5 h-3.5" /> Phase
              </button>
            </div>
            <div className="space-y-2">
              {draft.stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                  <input value={stage.key} onChange={(e) => patchStage(i, { key: e.target.value })} placeholder="key" className={`${CLS} max-w-[160px] font-mono text-xs`} />
                  <input value={stage.label} onChange={(e) => patchStage(i, { label: e.target.value })} placeholder="Bezeichnung" className={CLS} />
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => moveStage(i, -1)} className="p-1 text-gray-400 hover:text-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => moveStage(i, 1)} className="p-1 text-gray-400 hover:text-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => removeStage(i)} disabled={draft.stages.length <= 1} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas: Stage-Spalten mit Schritt-Karten */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-x-auto">
            <div className="flex gap-3 items-stretch min-w-full">
              {draft.stages.map((stage) => (
                <div key={stage.key} className="w-64 shrink-0 rounded-lg border border-gray-200 bg-gray-50/60 flex flex-col">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-800 truncate">{stage.label || stage.key}</p>
                    <p className="text-[10px] text-gray-400">{(stepsByStage.get(stage.key) || []).length} Schritte</p>
                  </div>
                  <div className="p-2 space-y-2 flex-1">
                    {(stepsByStage.get(stage.key) || []).map((step) => {
                      const index = draft.steps.indexOf(step)
                      return (
                        <button
                          key={`${step.status}-${index}`}
                          type="button"
                          onClick={() => setInspector(index)}
                          className={`w-full text-left rounded-md border px-2.5 py-2 bg-white transition-colors ${
                            inspector === index ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-gray-900 truncate">{step.label || step.status || 'Neuer Schritt'}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{step.activityType}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {FLAGS.filter(([flag]) => step[flag]).map(([flag, label]) => (
                              <span key={flag} className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-medium">{label}</span>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setPickerStage(stage.key)}
                      className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-blue-300 hover:text-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Schritt hinzufügen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Übergänge (Advanced) */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button type="button" onClick={() => setAdvanced((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
              <span className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-gray-500" /> Zusätzliche Statuswechsel ({draft.transitions.length})</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${advanced ? 'rotate-180' : ''}`} />
            </button>
            {advanced && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-gray-500">Erlaubt Abkürzungen über die normale Reihenfolge hinaus.</p>
                {draft.transitions.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={t.fromStatus}
                      onChange={(e) => patchDraft({ transitions: draft.transitions.map((x, j) => (j === i ? { ...x, fromStatus: e.target.value } : x)) })}
                      className={`${CLS} max-w-[280px]`}
                    >
                      {draft.steps.map((s, si) => <option key={si} value={s.status}>{s.label || s.status}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">→</span>
                    <select
                      value={t.toStatus}
                      onChange={(e) => patchDraft({ transitions: draft.transitions.map((x, j) => (j === i ? { ...x, toStatus: e.target.value } : x)) })}
                      className={`${CLS} max-w-[280px]`}
                    >
                      {draft.steps.map((s, si) => <option key={si} value={s.status}>{s.label || s.status}</option>)}
                    </select>
                    <button type="button" onClick={() => patchDraft({ transitions: draft.transitions.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => patchDraft({ transitions: [...draft.transitions, { fromStatus: draft.steps[0]?.status || '', toStatus: draft.steps[1]?.status || '' }] })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  <Plus className="w-3.5 h-3.5" /> Übergang
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        {selectedStep && (
          <aside className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-gray-200 p-3 space-y-3 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Schritt</h3>
              <button type="button" onClick={() => setInspector(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status *</label>
              <input value={selectedStep.status} onChange={(e) => patchStep(inspector, { status: e.target.value })} className={CLS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
              <input value={selectedStep.label} onChange={(e) => patchStep(inspector, { label: e.target.value })} className={CLS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phase</label>
                <select value={selectedStep.stageKey} onChange={(e) => patchStep(inspector, { stageKey: e.target.value })} className={CLS}>
                  {draft.stages.map((s) => <option key={s.key} value={s.key}>{s.label || s.key}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aktivität</label>
                <select value={selectedStep.activityType} onChange={(e) => patchStep(inspector, { activityType: e.target.value })} className={CLS}>
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
              <input value={selectedStep.slug} onChange={(e) => patchStep(inspector, { slug: e.target.value })} placeholder={slugifyStatus(selectedStep.status)} className={`${CLS} font-mono text-xs`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
              <input value={selectedStep.title || ''} onChange={(e) => patchStep(inspector, { title: e.target.value })} className={CLS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
              <textarea value={selectedStep.description || ''} onChange={(e) => patchStep(inspector, { description: e.target.value })} rows={3} className={`${CLS} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Eigenschaften</label>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {FLAGS.map(([flag, label]) => (
                  <label key={flag} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!selectedStep[flag]}
                      onChange={(e) => patchStep(inspector, { [flag]: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button type="button" onClick={() => moveStep(inspector, -1)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => moveStep(inspector, 1)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => removeStep(inspector)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" /> Entfernen
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Schritt-Picker */}
      {pickerStage !== null && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPickerStage(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Schritt hinzufügen</h3>
                  <p className="text-xs text-gray-500">Aus der Bibliothek wählen oder eigenen Schritt anlegen.</p>
                </div>
                <button type="button" onClick={() => setPickerStage(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-1.5">
                {pickerTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => addStepFromTemplate(tpl)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{tpl.label}</span>
                        {tpl.isStandard ? (
                          <span className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-semibold">Standard</span>
                        ) : (
                          <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold">Eigener</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-gray-400 truncate">{tpl.activityType}{tpl.description ? ` · ${tpl.description}` : ''}</span>
                    </span>
                    <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                ))}
                {pickerTemplates.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Keine Vorlagen verfügbar.</p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={addBlankStep}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  <Plus className="w-4 h-4" /> Leeren Schritt anlegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {newOpen && renderNewModal()}
    </div>
  )
}

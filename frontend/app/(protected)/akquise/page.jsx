'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Target, X, Users, TrendingUp, CheckCircle, Euro, Briefcase, Upload, Activity, LayoutGrid, List, Search, ChevronDown, Download, ArrowUpDown, UserCheck, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PRIORITY_LABEL, PRIORITY_DOT } from '@/lib/acquisitionTeam'
import {
  BRANCHEN, BUNDESLAENDER, CONTACT_SOURCES,
} from '@/lib/acquisitionOptions'
import { usePipeline, usePipelineFor } from '@/lib/usePipeline'
import { getPipeline } from '@/lib/pipeline'
import {
  isStatusSelectable as isStatusSelectableIn,
  statusLabel as statusLabelIn,
  statusBadge,
} from '@/lib/pipelineLogic'
import { exportCsv, csvFilename } from '@/lib/csv'
import ActivityLogModal from '@/components/acquisition/ActivityLogModal'

const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

const VIEW_KEY = 'acquisition_targets_view'

const LIST_COLUMNS = [
  { key: 'companyName', label: 'Unternehmen' },
  { key: 'segment', label: 'Branche' },
  { key: 'bundesland', label: 'Bundesland' },
  { key: 'numberOfEmployees', label: 'Mitarbeiter' },
  { key: 'priority', label: 'Priorität' },
  { key: 'status', label: 'Status' },
  { key: 'offerValue', label: 'Angebot' },
  { key: 'callAttempts', label: 'Anrufe' },
  { key: 'assignmentCount', label: 'Zugewiesen' },
  { key: 'lastActivityAt', label: 'Letzte Aktivität' },
  { key: 'updatedAt', label: 'Aktualisiert' },
]

// ─── Sprint Card (draggable) ──────────────────────────────────────────────────

function SprintCard({ target, pipeline, isDragOverlay = false }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(target.id),
    data: { target },
    disabled: isDragOverlay,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  }

  const due = target.nextStepDue ? new Date(target.nextStepDue) : null
  const dueCls = !due
    ? ''
    : due.getTime() < Date.now()
      ? 'bg-red-50 text-red-700 border-red-200'
      : due.getTime() < Date.now() + 7 * 24 * 3600 * 1000
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
  const prioCls = target.priority === '1'
    ? 'bg-red-50 text-red-700 border-red-200'
    : target.priority === '2'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-gray-50 text-gray-600 border-gray-200'

  function handleClick() {
    if (isDragging) return
    router.push(`/akquise/${target.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={[
        'bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:shadow-md hover:border-gray-300 transition-all duration-150',
        isDragOverlay ? 'shadow-xl rotate-1 border-blue-300 cursor-grabbing' : '',
        isDragging ? 'opacity-40' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${prioCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[target.priority] || 'bg-gray-300'}`} />
          {PRIORITY_LABEL[target.priority] || `Prio ${target.priority || '—'}`}
        </span>
        {target.selfTestScore != null && (
          <span
            className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
            title="KI-Readiness-Selbsttest"
          >
            KI {target.selfTestScore}
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
        {target.companyName}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
        {[target.segment, target.location].filter(Boolean).join(' · ') || '—'}
      </p>

      <div className="flex flex-wrap items-center gap-1 mt-2">
        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(target.status, pipeline)}`}>
          {statusLabelIn(target.status, pipeline)}
        </span>
        {target.offerValue ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            {formatCurrency(target.offerValue)}
          </span>
        ) : null}
      </div>

      {target.nextStep && (
        <div className="mt-2 rounded-md bg-gray-50 border border-gray-100 px-2 py-1.5">
          <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{target.nextStep}</p>
          {due && (
            <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${dueCls}`}>
              {formatDate(target.nextStepDue)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1" title="Zugewiesene Mitarbeiter">
          <Users className="w-3 h-3" /> {target.assignmentCount || 0}
        </span>
        <span className={`inline-flex items-center gap-1 ${(target.callAttempts || 0) >= 3 ? 'text-amber-600' : ''}`} title="Anrufversuche">
          <Phone className="w-3 h-3" /> {target.callAttempts || 0}/3
        </span>
        <span title="Letzte Aktivität">{target.lastActivityAt ? formatDate(target.lastActivityAt) : '—'}</span>
      </div>
    </div>
  )
}

// ─── Sprint Kanban Column ──────────────────────────────────────────────────────

function StageColumn({ stage, steps = [], targets = [], pipeline, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.key}`, data: { stageKey: stage.key } })
  const totalValue = targets.reduce((s, t) => s + (t.offerValue || 0), 0)

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="rounded-t-xl border border-b-0 border-gray-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-gray-900 truncate">{stage.label}</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
              {targets.length}
            </span>
          </div>
          {onAdd && (
            <button
              onClick={() => onAdd(steps[0]?.status)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors shrink-0"
              title={`Zielkunde in ${stage.label} anlegen`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={steps.map((s) => s.label).join(' · ')}>
          {steps.map((s) => s.label).join(' · ') || '—'}
        </p>
        {totalValue > 0 && (
          <p className="text-xs mt-0.5 text-green-700 font-semibold">{formatCurrency(totalValue)}</p>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={[
          'flex-1 min-h-[140px] rounded-b-xl border p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]',
          isOver ? 'bg-blue-50/60 border-blue-300' : 'bg-gray-50/60 border-gray-200',
          'transition-colors duration-150',
        ].join(' ')}
      >
        {targets.length === 0 ? (
          <div className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs ${
            isOver ? 'border-blue-300 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-400'
          } transition-colors`}>
            {isOver ? 'Hier ablegen' : 'Keine Einträge'}
          </div>
        ) : (
          targets.map((t) => <SprintCard key={t.id} target={t} pipeline={pipeline} />)
        )}
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateSprintTargetModal({ isOpen, onClose, onCreated, defaultStatus }) {
  const emptyForm = {
    companyName: '', segment: '', street: '', postalCode: '', location: '',
    bundesland: '', numberOfEmployees: '', contactSource: '', priority: '2',
    contactName: '', contactEmail: '', contactPhone: '', contactRole: '', campaignId: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [campaigns, setCampaigns] = useState([])

  useEffect(() => {
    api.get('/acquisition-campaigns')
      .then((list) => {
        const arr = Array.isArray(list) ? list : []
        setCampaigns(arr)
        const def = arr.find((c) => c.isDefault) || arr[0]
        if (def) setForm((prev) => ({ ...prev, campaignId: prev.campaignId || def.id }))
      })
      .catch(() => {})
  }, [])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.companyName.trim()) { toast.error('Unternehmensname erforderlich'); return }
    if (!form.segment) { toast.error('Branche erforderlich'); return }
    setSaving(true)
    try {
      const {
        contactName, contactEmail, contactPhone, contactRole, numberOfEmployees, ...base
      } = form
      const digits = String(numberOfEmployees || '').replace(/[^\d]/g, '')
      const name = contactName.trim()
      // Status muss im Workflow der gewählten Kampagne existieren – sonst erster Schritt.
      const selectedCampaign = campaigns.find((c) => c.id === form.campaignId)
      const campaignPipeline = getPipeline(selectedCampaign?.pipelineId)
      const statusInPipeline =
        defaultStatus && campaignPipeline.statuses.includes(defaultStatus)
          ? defaultStatus
          : (campaignPipeline.steps[0]?.status || 'offen')
      const payload = {
        ...base,
        campaignId: form.campaignId || null,
        numberOfEmployees: digits ? Number(digits) : null,
        status: statusInPipeline,
        contactName: name || null,
        contactEmail: contactEmail.trim() || null,
        contactTitle: contactRole.trim() || null,
      }
      const created = await api.post('/acquisition', payload)
      // Ansprechpartner als primären Kontakt anlegen (Name, E-Mail, Telefon, Rolle)
      if (name) {
        await api.post('/acquisition-contacts', {
          acquisitionTargetId: created.id,
          name,
          email: contactEmail.trim() || null,
          phone: contactPhone.trim() || null,
          role: contactRole.trim() || null,
          isPrimary: true,
        }).catch(() => {})
      }
      toast.success('Zielkunde erstellt')
      onCreated(created)
      onClose()
      setForm(emptyForm)
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
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Neuer Zielkunde</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={CLS_LABEL}>Unternehmen <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Muster GmbH"
              />
            </div>
            <div>
              <label className={CLS_LABEL}>Kampagne / Workflow</label>
              <select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Standard --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
              <select value={form.segment} onChange={(e) => set('segment', e.target.value)} className={CLS_INPUT} required>
                <option value="">-- Bitte wählen --</option>
                {BRANCHEN.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Straße &amp; Hausnummer</label>
              <input
                type="text"
                value={form.street}
                onChange={(e) => set('street', e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Musterstraße 12"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={CLS_LABEL}>PLZ</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="12345"
                />
              </div>
              <div className="col-span-2">
                <label className={CLS_LABEL}>Ort</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="z.B. Frankfurt"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Bundesland</label>
                <select value={form.bundesland} onChange={(e) => set('bundesland', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- keins --</option>
                  {BUNDESLAENDER.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Mitarbeiter</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.numberOfEmployees}
                  onChange={(e) => set('numberOfEmployees', e.target.value)}
                  className={CLS_INPUT}
                  placeholder="z.B. 250"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Quelle</label>
                <select value={form.contactSource} onChange={(e) => set('contactSource', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- keine --</option>
                  {CONTACT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Priorität</label>
                <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={CLS_INPUT}>
                  <option value="1">1 – Hoch</option>
                  <option value="2">2 – Mittel</option>
                  <option value="3">3 – Niedrig</option>
                </select>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ansprechpartner beim Kunden</p>
              <div className="space-y-3">
                <div>
                  <label className={CLS_LABEL}>Name</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => set('contactName', e.target.value)}
                    className={CLS_INPUT}
                    placeholder="z.B. Max Mustermann"
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>E-Mail</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                    className={CLS_INPUT}
                    placeholder="max.mustermann@firma.de"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={CLS_LABEL}>Telefon</label>
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => set('contactPhone', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="z.B. +49 69 123456"
                    />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Position / Rolle</label>
                    <input
                      type="text"
                      value={form.contactRole}
                      onChange={(e) => set('contactRole', e.target.value)}
                      className={CLS_INPUT}
                      placeholder="z.B. Head of IT"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Erstellen...' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Close Modal ──────────────────────────────────────────────────────────────

function CloseSprintTargetModal({ closing, onClose, onSaved }) {
  const pipeline = usePipelineFor(closing?.target)
  const [lossReason, setLossReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isLost = pipeline.lostStatuses.includes(closing?.status)

  useEffect(() => {
    setLossReason('')
    setNotes('')
  }, [closing])

  async function handleSubmit(e) {
    e.preventDefault()
    if (isLost && !lossReason) { toast.error('Bitte Verlustgrund wählen'); return }
    setSaving(true)
    try {
      const payload = {
        status: closing.status,
        result: isLost ? 'verloren' : 'gewonnen',
        ...(isLost ? { lossReason } : {}),
        ...(notes.trim()
          ? { notes: closing.target.notes ? `${closing.target.notes}\n${notes.trim()}` : notes.trim() }
          : {}),
      }
      const updated = await api.put(`/acquisition/${closing.target.id}`, payload)
      toast.success(isLost ? 'Als verloren erfasst' : 'Als gewonnen erfasst')
      onSaved(updated)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Abschließen')
    } finally {
      setSaving(false)
    }
  }

  if (!closing) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Abschluss erfassen</h2>
              <p className="text-sm text-gray-500">{closing.target.companyName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`rounded-lg border px-3 py-2 text-sm ${
              isLost ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'
            }`}>
              Ergebnis: <span className="font-semibold">{isLost ? 'Verloren' : 'Gewonnen'}</span>
            </div>
            {isLost && (
              <div>
                <label className={CLS_LABEL}>Verlustgrund <span className="text-red-500">*</span></label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className={CLS_INPUT}
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={CLS_LABEL}>Notiz</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${CLS_INPUT} resize-none`}
                placeholder="Was war ausschlaggebend?"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className={`px-5 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                isLost ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}>
                {saving ? 'Speichern...' : 'Abschließen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Multi-Select (Filter) ────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function toggle(value) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
          selected.length
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-60 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-1">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SprintTargetsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState([])
  const [filters, setFilters] = useState({ q: '', statuses: [], priorities: [], bundeslaender: [], branchen: [], campaignId: '' })
  const selectedCampaign = campaigns.find((c) => c.id === filters.campaignId) || null
  const pipeline = usePipeline(selectedCampaign?.pipelineId)
  const STATUSES = pipeline.statuses
  const statusLabel = (s) => statusLabelIn(s, pipeline)
  const isStatusSelectable = (current, next) => isStatusSelectableIn(current, next, pipeline)
  const [targets, setTargets] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState('offen')
  const [activeTarget, setActiveTarget] = useState(null)
  const [closing, setClosing] = useState(null)
  const [view, setView] = useState('kanban') // 'kanban' | 'liste'
  const [sort, setSort] = useState({ field: 'updatedAt', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [logTarget, setLogTarget] = useState(null)

  // Ansicht aus localStorage wiederherstellen (erst nach dem Mount → keine Hydration-Mismatches)
  useEffect(() => {
    const saved =
      window.localStorage.getItem(VIEW_KEY) ??
      window.localStorage.getItem('sprint_targets_view')
    if (saved === 'kanban' || saved === 'liste') setView(saved)
  }, [])

  function changeView(next) {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // localStorage nicht verfügbar → Ansicht gilt nur für diese Sitzung
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s, c] = await Promise.all([
        api.get('/acquisition'),
        api.get('/acquisition/stats/summary'),
        api.get('/acquisition-campaigns').catch(() => []),
      ])
      setTargets(Array.isArray(t) ? t : [])
      setStats(s)
      setCampaigns(Array.isArray(c) ? c : [])
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Filter gelten für beide Ansichten (Kanban + Liste)
  const searchText = filters.q.trim().toLowerCase()
  const filteredTargets = targets.filter((t) => {
    if (filters.campaignId && t.campaignId !== filters.campaignId) return false
    if (filters.branchen.length && !filters.branchen.includes(t.segment)) return false
    if (searchText) {
      const haystack = `${t.companyName || ''} ${t.location || ''} ${t.contactName || ''}`.toLowerCase()
      if (!haystack.includes(searchText)) return false
    }
    if (filters.statuses.length && !filters.statuses.includes(t.status)) return false
    if (filters.priorities.length && !filters.priorities.includes(String(t.priority))) return false
    if (filters.bundeslaender.length && !filters.bundeslaender.includes(t.bundesland)) return false
    return true
  })

  const sortedTargets = useMemo(() => {
    const { field, dir } = sort
    const factor = dir === 'asc' ? 1 : -1
    return [...filteredTargets].sort((a, b) => {
      let av = a[field]
      let bv = b[field]
      if (field === 'updatedAt' || field === 'lastActivityAt') {
        av = av ? new Date(av).getTime() : 0
        bv = bv ? new Date(bv).getTime() : 0
      } else if (['offerValue', 'numberOfEmployees', 'callAttempts', 'priority'].includes(field)) {
        av = Number(av) || 0
        bv = Number(bv) || 0
      } else {
        av = String(av || '').toLowerCase()
        bv = String(bv || '').toLowerCase()
      }
      if (av < bv) return -1 * factor
      if (av > bv) return 1 * factor
      return 0
    })
  }, [filteredTargets, sort])

  const totalPages = Math.max(1, Math.ceil(sortedTargets.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedTargets = sortedTargets.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => { setPage(1) }, [searchText, filters.statuses, filters.priorities, filters.bundeslaender, filters.branchen, filters.campaignId, sort])

  // Karten je Stufe (Pipeline-Stage). Innerhalb einer Stufe zuerst Prio hoch.
  const targetsByStage = pipeline.stages.reduce((acc, stage) => {
    const stageSteps = pipeline.stepsByStage.get(stage.key) || []
    const statuses = new Set(stageSteps.map((s) => s.status))
    acc[stage.key] = filteredTargets
      .filter((t) => statuses.has(t.status))
      .sort((a, b) => (Number(a.priority) || 9) - (Number(b.priority) || 9))
    return acc
  }, {})

  const hasFilters =
    !!searchText || filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.bundeslaender.length > 0 || filters.branchen.length > 0 || !!filters.campaignId

  function setFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function resetFilters() {
    setFilters({ q: '', statuses: [], priorities: [], bundeslaender: [], branchen: [], campaignId: '' })
  }

  function toggleSort(field) {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function handleExport() {
    exportCsv(
      csvFilename('sprint-zielkunden'),
      [
        { key: 'companyName', label: 'Unternehmen' },
        { key: 'segment', label: 'Branche' },
        { key: 'bundesland', label: 'Bundesland' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priorität' },
        { key: 'offerValue', label: 'Angebotswert' },
        { key: 'callAttempts', label: 'Anrufe' },
        { key: 'contactName', label: 'Kontakt' },
        { key: 'assignmentCount', label: 'Zugewiesen' },
        { key: 'lastActivityAt', label: 'Letzte Aktivität', format: (t) => (t.lastActivityAt ? formatDate(t.lastActivityAt) : '') },
        { key: 'updatedAt', label: 'Aktualisiert', format: (t) => formatDate(t.updatedAt) },
      ],
      sortedTargets
    )
    toast.success('CSV-Export erstellt')
  }

  // Branchen-Chips: nur Branchen, die aktuell in den Daten vorkommen (Reihenfolge wie BRANCHEN)
  const segmentGroups = useMemo(() => {
    const present = new Set(targets.map((t) => t.segment).filter(Boolean))
    const known = BRANCHEN.filter((b) => present.has(b))
    const extra = [...present].filter((b) => !BRANCHEN.includes(b))
    return [...known, ...extra]
  }, [targets])

  function handleDragStart(event) {
    const t = targets.find((t) => String(t.id) === event.active.id)
    setActiveTarget(t || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveTarget(null)
    if (!over) return

    const targetId = active.id
    const target = targets.find((t) => String(t.id) === String(targetId))
    if (!target) return

    let newStatus = String(over.id)

    if (newStatus.startsWith('stage:')) {
      // Auf eine Stufe abgelegt → erster freigeschalteter Schritt dieser Stufe
      const stageKey = newStatus.slice('stage:'.length)
      const steps = pipeline.stepsByStage.get(stageKey) || []
      if (steps.some((s) => s.status === target.status)) return
      const dest = steps.find((s) => isStatusSelectable(target.status, s.status))
      if (!dest) {
        const stageLabel = pipeline.stages.find((s) => s.key === stageKey)?.label || stageKey
        toast.error(`„${stageLabel}“ ist noch gesperrt – bitte die Schritte der aktuellen Stufe abschließen`)
        return
      }
      newStatus = dest.status
    } else if (!pipeline.statusSet.has(newStatus)) {
      // Auf eine Karte abgelegt → deren Status übernehmen
      const overTarget = targets.find((t) => String(t.id) === newStatus)
      if (!overTarget) return
      newStatus = overTarget.status
    }

    if (!pipeline.statusSet.has(newStatus) || target.status === newStatus) return

    // Prozess-Freischaltung: nur der nächste Schritt der Reihenfolge per Drag & Drop
    if (!isStatusSelectable(target.status, newStatus)) {
      toast.error(`„${statusLabel(newStatus)}“ ist noch gesperrt – bitte den nächsten Schritt der Reihenfolge wählen`)
      return
    }

    // Abschluss: Ergebnis und Verlustgrund müssen erfasst werden
    if (pipeline.wonStatuses.includes(newStatus) || pipeline.lostStatuses.includes(newStatus)) {
      setClosing({ target, status: newStatus })
      return
    }

    setTargets((prev) =>
      prev.map((t) => (String(t.id) === targetId ? { ...t, status: newStatus } : t))
    )

    api.put(`/acquisition/${targetId}`, { status: newStatus }).catch((err) => {
      toast.error(err.message || 'Fehler beim Aktualisieren')
      setTargets((prev) =>
        prev.map((t) => (String(t.id) === targetId ? { ...t, status: target.status } : t))
      )
    })
  }

  function openCreateForStatus(status) {
    // Abschluss-Schritte (gewonnen/Verlust …) sind kein sinnvoller Startstatus
    const step = status ? pipeline.byStatus.get(status) : null
    setDefaultStatus(step && !step.isClosing ? status : 'offen')
    setShowCreate(true)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zielkunden</h1>
            <p className="text-sm text-gray-500">Zielkunden in der Akquise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/activities?onlySprint=true')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-4 h-4" /> Aktivitäten
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => router.push('/akquise/import')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => { setDefaultStatus('offen'); setShowCreate(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Zielkunde
          </button>
        </div>
      </div>


      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
          {[
            { label: 'Gesamt', value: stats.total, icon: Users, color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Im Gespräch', value: stats.imGespraech, icon: Briefcase, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Angebote', value: stats.angebote, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Gewonnen', value: stats.gewonnen, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pipeline', value: formatCurrency(stats.pipelineValue || 0), icon: Euro, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Konversion', value: `${stats.konversion || 0}%`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-base font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter row */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {[
          { value: '1', label: 'Prio 1' },
          { value: '2', label: 'Prio 2' },
          { value: '3', label: 'Prio 3' },
        ].map(({ value, label }) => {
          const active = filters.priorities.includes(value)
          return (
            <button
              key={value}
              onClick={() =>
                setFilter(
                  'priorities',
                  active ? filters.priorities.filter((p) => p !== value) : [...filters.priorities, value]
                )
              }
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {label}
            </button>
          )
        })}

        <div className="ml-auto flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => changeView('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition-colors ${
              view === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            title="Kanban-Ansicht"
          >
            <LayoutGrid className="w-4 h-4" /> Kanban
          </button>
          <button
            onClick={() => changeView('liste')}
            className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition-colors ${
              view === 'liste' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            title="Listen-Ansicht"
          >
            <List className="w-4 h-4" /> Liste
          </button>
        </div>
      </div>

      {/* Multikriterien-Filter (beide Ansichten) */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Unternehmen oder Kontakt suchen…"
              className="w-64 border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {campaigns.length > 0 && (
            <select
              value={filters.campaignId}
              onChange={(e) => setFilter('campaignId', e.target.value)}
              title="Nach Kampagne filtern"
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Kampagnen</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
              ))}
            </select>
          )}
          <MultiSelect
            label="Status"
            options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
            selected={filters.statuses}
            onChange={(v) => setFilter('statuses', v)}
          />
          <MultiSelect
            label="Priorität"
            options={[
              { value: '1', label: 'Hoch' },
              { value: '2', label: 'Mittel' },
              { value: '3', label: 'Niedrig' },
            ]}
            selected={filters.priorities}
            onChange={(v) => setFilter('priorities', v)}
          />
          <MultiSelect
            label="Branche"
            options={segmentGroups.map((b) => ({ value: b, label: b }))}
            selected={filters.branchen}
            onChange={(v) => setFilter('branchen', v)}
          />
          <MultiSelect
            label="Bundesland"
            options={BUNDESLAENDER.map((b) => ({ value: b, label: b }))}
            selected={filters.bundeslaender}
            onChange={(v) => setFilter('bundeslaender', v)}
          />
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-800 border border-transparent hover:border-gray-200 rounded-md"
            >
              <X className="w-3.5 h-3.5" /> Zurücksetzen
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {filteredTargets.length} von {targets.length} Zielkunden
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm text-gray-500">Lade Zielkunden...</p>
          </div>
        </div>
      ) : view === 'kanban' ? (
        /* Pipeline: eine Spalte je Stufe */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
            {pipeline.stages.map((stage) => (
              <StageColumn
                key={stage.key}
                stage={stage}
                steps={pipeline.stepsByStage.get(stage.key) || []}
                targets={targetsByStage[stage.key] || []}
                pipeline={pipeline}
                onAdd={openCreateForStatus}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTarget ? <SprintCard target={activeTarget} pipeline={pipeline} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Liste */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50">
                  {LIST_COLUMNS.map(({ key, label }) => (
                    <th key={key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      <button
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        {label}
                        <ArrowUpDown className={`w-3 h-3 ${sort.field === key ? 'text-blue-600' : 'text-gray-300'}`} />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {pagedTargets.length === 0 ? (
                  <tr>
                    <td colSpan={LIST_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-gray-500">
                      {hasFilters ? 'Keine Zielkunden für diese Filter.' : 'Keine Zielkunden vorhanden.'}
                    </td>
                  </tr>
                ) : (
                  pagedTargets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/akquise/${t.id}`)}
                      className="border-t border-gray-50 hover:bg-gray-50/60 cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 truncate max-w-[240px]">{t.companyName}</p>
                        {t.account?.companyName && (
                          <p className="text-xs text-gray-400 truncate max-w-[240px]">Account: {t.account.companyName}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{t.segment || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{t.bundesland || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {t.numberOfEmployees != null ? t.numberOfEmployees.toLocaleString('de-DE') : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority] || 'bg-gray-300'}`} />
                          {PRIORITY_LABEL[t.priority] || t.priority || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(t.status, pipeline)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-gray-800 font-medium">{formatCurrency(t.offerValue)}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-medium ${(t.callAttempts || 0) >= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {t.callAttempts || 0} / 3
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <UserCheck className="w-3.5 h-3.5 text-gray-400" /> {t.assignmentCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {t.lastActivityAt ? formatDate(t.lastActivityAt) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(t.updatedAt)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); setLogTarget(t) }}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                          title="Aktivität protokollieren"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-sm text-gray-600 shrink-0">
            <span>
              {sortedTargets.length === 0
                ? '0 Einträge'
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedTargets.length)} von ${sortedTargets.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Zurück
              </button>
              <span className="px-2 text-xs text-gray-500">Seite {currentPage} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Weiter
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateSprintTargetModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(t) => { setTargets((prev) => [t, ...prev]); fetchAll() }}
        defaultStatus={defaultStatus}
      />

      <CloseSprintTargetModal
        closing={closing}
        onClose={() => setClosing(null)}
        onSaved={(updated) => {
          setTargets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          fetchAll()
        }}
      />

      <ActivityLogModal
        isOpen={!!logTarget}
        onClose={() => setLogTarget(null)}
        targetId={logTarget?.id}
        target={logTarget}
        defaultType={
          logTarget
            ? (() => {
                const t = pipeline.byStatus?.get(logTarget.status)?.activityType || 'Call'
                return t === 'Call' && (logTarget.callAttempts || 0) >= 3 ? 'Note' : t
              })()
            : null
        }
        callAttempts={logTarget?.callAttempts || 0}
        contactBlocked={logTarget?.status === 'kein Interesse' || logTarget?.blocklisted === true}
        appointmentDate={logTarget?.firstMeetingDate || null}
        onLogged={() => fetchAll()}
      />
    </div>
  )
}

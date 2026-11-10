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
import { Plus, Target, X, Users, TrendingUp, CheckCircle, Euro, Briefcase, Upload, Activity, LayoutGrid, List, Search, ChevronDown, Download, ArrowUpDown, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { STATUS_BADGE, PRIORITY_LABEL, PRIORITY_DOT } from '@/lib/sprintTeam'
import {
  BRANCHEN, BUNDESLAENDER, CONTACT_SOURCES, SPRINT_STATUSES, SPRINT_PHASES,
  STATUS_STYLES, PHASE_STYLES, LOST_STATUSES, WON_STATUSES, statusLabel,
} from '@/lib/sprintOptions'
import { exportCsv, csvFilename } from '@/lib/csv'
import ActivityLogModal from '@/components/sprint/ActivityLogModal'

const STATUSES = SPRINT_STATUSES

const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

const VIEW_KEY = 'sprint_targets_view'

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

function SprintCard({ target, isDragOverlay = false }) {
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

  function handleClick() {
    if (isDragging) return
    router.push(`/sprint-targets/${target.id}`)
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
      <p className="text-xs text-gray-400 font-medium mb-0.5 truncate">{target.segment}</p>
      <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
        {target.companyName}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {target.bundesland && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-50 text-gray-600 border border-gray-100">
            {target.bundesland}
          </span>
        )}
        {target.priority && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
            target.priority === '1' ? 'bg-red-50 text-red-700 border-red-100'
            : target.priority === '2' ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
            : 'bg-gray-50 text-gray-600 border-gray-100'
          }`}>
            Prio {target.priority}
          </span>
        )}
        {target.offerValue && (
          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            {formatCurrency(target.offerValue)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${i < target.callAttempts ? 'bg-blue-500' : 'bg-gray-200'}`}
          />
        ))}
        {target.contactName && (
          <span className="ml-1 text-xs text-gray-400 truncate">{target.contactName}</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3 h-3" /> {target.assignmentCount || 0} zugewiesen
        </span>
        <span>{target.lastActivityAt ? formatDate(target.lastActivityAt) : 'keine Aktivität'}</span>
      </div>
    </div>
  )
}

// ─── Sprint Kanban Column ──────────────────────────────────────────────────────

function SprintKanbanColumn({ status, targets = [], onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } })
  const style = STATUS_STYLES[status] || STATUS_STYLES['offen']
  const totalValue = targets.reduce((s, t) => s + (t.offerValue || 0), 0)

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className={`rounded-t-xl px-3 py-2.5 ${style.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{statusLabel(status)}</span>
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${style.badge} text-white`}>
              {targets.length}
            </span>
          </div>
          {onAdd && (
            <button
              onClick={() => onAdd(status)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 transition-colors"
              title={`Zielkunde zu ${status} hinzufügen`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {totalValue > 0 && (
          <p className="text-xs mt-0.5 opacity-85 font-medium">{formatCurrency(totalValue)}</p>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={[
          'flex-1 min-h-[120px] rounded-b-xl border-x border-b p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]',
          style.border,
          isOver ? 'bg-blue-50/60 border-blue-300' : 'bg-gray-50/50',
          'transition-colors duration-150',
        ].join(' ')}
      >
        {targets.length === 0 ? (
          <div className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 ${
            isOver ? 'border-blue-300 text-blue-400 bg-blue-50' : 'border-gray-200'
          } transition-colors`}>
            {isOver ? 'Hier ablegen' : 'Keine Einträge'}
          </div>
        ) : (
          targets.map((t) => <SprintCard key={t.id} target={t} />)
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
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.companyName.trim()) { toast.error('Unternehmensname erforderlich'); return }
    if (!form.segment) { toast.error('Branche erforderlich'); return }
    setSaving(true)
    try {
      const digits = String(form.numberOfEmployees || '').replace(/[^\d]/g, '')
      const payload = {
        ...form,
        numberOfEmployees: digits ? Number(digits) : null,
        status: defaultStatus || 'offen',
      }
      const created = await api.post('/sprint-targets', payload)
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
  const [lossReason, setLossReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isLost = LOST_STATUSES.includes(closing?.status)

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
      const updated = await api.put(`/sprint-targets/${closing.target.id}`, payload)
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
            ? 'bg-violet-50 border-violet-200 text-violet-700'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold">
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
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
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
  const [targets, setTargets] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState('offen')
  const [activeTarget, setActiveTarget] = useState(null)
  const [closing, setClosing] = useState(null)
  const [filterSegment, setFilterSegment] = useState('')
  const [view, setView] = useState('kanban') // 'kanban' | 'liste'
  const [filters, setFilters] = useState({ q: '', statuses: [], priorities: [], bundeslaender: [] })
  const [sort, setSort] = useState({ field: 'updatedAt', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [logTarget, setLogTarget] = useState(null)

  // Ansicht aus localStorage wiederherstellen (erst nach dem Mount → keine Hydration-Mismatches)
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY)
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
      const [t, s] = await Promise.all([
        api.get('/sprint-targets'),
        api.get('/sprint-targets/stats/summary'),
      ])
      setTargets(Array.isArray(t) ? t : [])
      setStats(s)
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
    if (filterSegment && !t.segment?.includes(filterSegment)) return false
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

  useEffect(() => { setPage(1) }, [searchText, filterSegment, filters.statuses, filters.priorities, filters.bundeslaender, sort])

  const targetsByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filteredTargets.filter((t) => t.status === s)
    return acc
  }, {})

  const hasFilters =
    !!searchText || !!filterSegment || filters.statuses.length > 0 || filters.priorities.length > 0 || filters.bundeslaender.length > 0

  function setFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function resetFilters() {
    setFilters({ q: '', statuses: [], priorities: [], bundeslaender: [] })
    setFilterSegment('')
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
    let newStatus = over.id

    if (!STATUSES.includes(newStatus)) {
      const overTarget = targets.find((t) => String(t.id) === String(newStatus))
      if (!overTarget) return
      newStatus = overTarget.status
    }

    const target = targets.find((t) => String(t.id) === targetId)
    if (!target || target.status === newStatus) return

    // Abschluss: Ergebnis und Verlustgrund müssen erfasst werden
    if (WON_STATUSES.includes(newStatus) || LOST_STATUSES.includes(newStatus)) {
      setClosing({ target, status: newStatus })
      return
    }

    setTargets((prev) =>
      prev.map((t) => (String(t.id) === targetId ? { ...t, status: newStatus } : t))
    )

    api.put(`/sprint-targets/${targetId}`, { status: newStatus }).catch((err) => {
      toast.error(err.message || 'Fehler beim Aktualisieren')
      setTargets((prev) =>
        prev.map((t) => (String(t.id) === targetId ? { ...t, status: target.status } : t))
      )
    })
  }

  function openCreateForStatus(status) {
    setDefaultStatus(status)
    setShowCreate(true)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-violet-100 rounded-lg">
            <Target className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprint-Vertrieb</h1>
            <p className="text-sm text-gray-500">KI-Readiness Sprint — Zielkunden</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/sprint-targets/activities')}
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
            onClick={() => router.push('/sprint-targets/import')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={() => { setDefaultStatus('offen'); setShowCreate(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
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
            { label: 'Angebote', value: stats.angebote, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
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
        <button
          onClick={() => setFilterSegment('')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!filterSegment ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          Alle
        </button>
        {segmentGroups.map((g) => (
          <button
            key={g}
            onClick={() => setFilterSegment(filterSegment === g ? '' : g)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${filterSegment === g ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {g}
          </button>
        ))}

        <span className="w-px h-5 bg-gray-200 mx-1" />
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
              view === 'kanban' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            title="Kanban-Ansicht"
          >
            <LayoutGrid className="w-4 h-4" /> Kanban
          </button>
          <button
            onClick={() => changeView('liste')}
            className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition-colors ${
              view === 'liste' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'
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
              className="w-64 border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
            <p className="text-sm text-gray-500">Lade Zielkunden...</p>
          </div>
        </div>
      ) : view === 'kanban' ? (
        /* Kanban */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-4 flex-1 items-start">
            {SPRINT_PHASES.map((phase) => (
              <div key={phase.key} className="flex flex-col shrink-0">
                <div className={`mb-2 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${PHASE_STYLES[phase.key] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {phase.label}
                </div>
                <div className="flex gap-3 items-start">
                  {phase.statuses.map((status) => (
                    <SprintKanbanColumn
                      key={status}
                      status={status}
                      targets={targetsByStatus[status] || []}
                      onAdd={openCreateForStatus}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTarget ? <SprintCard target={activeTarget} isDragOverlay /> : null}
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
                        <ArrowUpDown className={`w-3 h-3 ${sort.field === key ? 'text-violet-600' : 'text-gray-300'}`} />
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
                      onClick={() => router.push(`/sprint-targets/${t.id}`)}
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
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
                          className="p-1.5 rounded hover:bg-violet-50 text-violet-600"
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
        callAttempts={logTarget?.callAttempts || 0}
        onLogged={() => fetchAll()}
      />
    </div>
  )
}

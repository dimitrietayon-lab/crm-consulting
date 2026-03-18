'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  CheckSquare,
  AlertCircle,
  Building2,
  FolderOpen,
  Calendar,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
  RefreshCw,
  Paperclip,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const PRIORITY_CONFIG = {
  Critical: { label: 'Kritisch', dot: 'bg-red-600' },
  High:     { label: 'Hoch',     dot: 'bg-orange-500' },
  Medium:   { label: 'Mittel',   dot: 'bg-yellow-500' },
  Low:      { label: 'Niedrig',  dot: 'bg-blue-500' },
}

const COLUMNS = [
  {
    status: 'Open',
    label: 'Offen',
    headerClass: 'bg-slate-600 text-white',
    badgeClass: 'bg-slate-500',
    borderClass: 'border-slate-200',
    Icon: Circle,
  },
  {
    status: 'In Progress',
    label: 'In Bearbeitung',
    headerClass: 'bg-blue-600 text-white',
    badgeClass: 'bg-blue-500',
    borderClass: 'border-blue-200',
    Icon: Clock,
  },
  {
    status: 'Done',
    label: 'Erledigt',
    headerClass: 'bg-green-600 text-white',
    badgeClass: 'bg-green-500',
    borderClass: 'border-green-200',
    Icon: CheckCircle2,
  },
  {
    status: 'Cancelled',
    label: 'Abgebrochen',
    headerClass: 'bg-red-600 text-white',
    badgeClass: 'bg-red-500',
    borderClass: 'border-red-200',
    Icon: XCircle,
  },
]

function isOverdue(task) {
  if (!task.dueDate || task.status === 'Done' || task.status === 'Cancelled') return false
  return new Date(task.dueDate) < new Date()
}

// ── Task Card ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onDelete, onEdit, isDragOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDragOverlay,
  })

  function handleClick() {
    if (isDragging || isDragOverlay) return
    onEdit?.(task)
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  }

  const overdue = isOverdue(task)
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={[
        'bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:shadow-md hover:border-blue-200 transition-all duration-150',
        overdue
          ? 'border-l-4 border-l-red-500 border-r-gray-200 border-t-gray-200 border-b-gray-200'
          : 'border-gray-200',
        isDragOverlay ? 'shadow-xl rotate-1 border-blue-300 cursor-grabbing' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Priority dot + title + delete */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${priority.dot}`} title={priority.label} />
        <p
          className={`text-sm font-semibold leading-snug flex-1 line-clamp-2 ${
            task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-900'
          }`}
        >
          {task.title}
        </p>
        {task.recurring && (
          <span title={`Wiederkehrend: ${task.recurring}`} className="shrink-0 text-blue-400">
            <RefreshCw className="w-3 h-3" />
          </span>
        )}
        {!isDragOverlay && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            className="shrink-0 p-0.5 text-gray-300 hover:text-red-500 transition-colors rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Meta info */}
      <div className="space-y-1">
        {task.dueDate && (
          <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            <Calendar className="w-3 h-3 shrink-0" />
            {overdue ? 'Überfällig: ' : ''}{formatDate(task.dueDate)}
          </div>
        )}
        {task.account?.companyName && (
          <div className="flex items-center gap-1 text-xs text-blue-600 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.account.companyName}</span>
          </div>
        )}
        {task.project?.name && (
          <div className="flex items-center gap-1 text-xs text-purple-600 truncate">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.project.name}</span>
          </div>
        )}
      </div>

      {/* Assignee */}
      {task.assignedTo?.name && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
          <div
            title={task.assignedTo.name}
            className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
          >
            {getInitials(task.assignedTo.name)}
          </div>
          <span className="text-xs text-gray-500 truncate">{task.assignedTo.name}</span>
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, onDelete, onEdit, onAddTask, allowAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })

  return (
    <div className="flex flex-col min-w-[10rem] sm:min-w-[12rem] md:min-w-[14rem] lg:min-w-[16rem] xl:min-w-[18rem] flex-1 basis-0">
      {/* Header */}
      <div className={`sticky top-0 z-10 rounded-t-xl px-3 py-2.5 ${col.headerClass} shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{col.label}</span>
            <span
              className={`inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] sm:text-xs font-bold ${col.badgeClass} text-white`}
            >
              {tasks.length}
            </span>
          </div>
          {allowAdd && (
            <button
              onClick={() => onAddTask(col.status)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 transition-colors"
              title={`Aufgabe zu ${col.label} hinzufügen`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={[
          'min-h-[120px] rounded-b-xl border-x border-b p-2 space-y-2 overflow-visible',
          col.borderClass,
          isOver ? 'bg-blue-50/60 border-blue-300' : 'bg-gray-50/50',
          'transition-colors duration-150',
        ].join(' ')}
      >
        {tasks.length === 0 ? (
          <div
            className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 ${
              isOver ? 'border-blue-300 text-blue-400 bg-blue-50' : 'border-gray-200'
            } transition-colors`}
          >
            {isOver ? 'Hier ablegen' : 'Keine Aufgaben'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Create Task Modal ──────────────────────────────────────────────────────────
const RECURRING_OPTIONS = [
  { value: '', label: 'Keine' },
  { value: 'Daily', label: 'Täglich' },
  { value: 'Weekly', label: 'Wöchentlich' },
  { value: 'Monthly', label: 'Monatlich' },
  { value: 'Quarterly', label: 'Vierteljährlich' },
]

function CreateTaskModal({ isOpen, onClose, onCreated, accounts, users, projects, defaultStatus }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    assignedToId: '',
    accountId: '',
    projectId: '',
    status: defaultStatus || 'Open',
    recurring: '',
  })
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState([])
  const [checklistDraft, setChecklistDraft] = useState([''])
  const [collaborators, setCollaborators] = useState([]) // userIds

  useEffect(() => {
    if (defaultStatus) setForm((p) => ({ ...p, status: defaultStatus }))
  }, [defaultStatus])

  const update = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value }
    if (field === 'accountId') next.projectId = ''
    return next
  })

  const filteredProjects = form.accountId
    ? projects.filter((p) => p.accountId === form.accountId)
    : []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Titel ist erforderlich.'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title.trim())
      if (form.description) fd.append('description', form.description)
      if (form.dueDate) fd.append('dueDate', form.dueDate)
      fd.append('priority', form.priority)
      if (form.assignedToId) fd.append('assignedToId', form.assignedToId)
      if (form.accountId) fd.append('accountId', form.accountId)
      if (form.projectId) fd.append('projectId', form.projectId)
      fd.append('status', form.status)
      if (form.recurring) fd.append('recurring', form.recurring)
      for (const f of files) fd.append('files', f)

      // send initial checklist as JSON string under key 'checklist'
      const checklist = checklistDraft
        .map((t, idx) => ({ title: String(t || '').trim(), order: idx }))
        .filter((i) => i.title.length > 0)
      if (checklist.length > 0) fd.append('checklist', JSON.stringify(checklist))

      if (collaborators.length > 0) fd.append('collaboratorIds', JSON.stringify(collaborators))

      const result = await api.upload('/tasks', fd)
      toast.success('Aufgabe erstellt.')
      onCreated(result)
      onClose()
      setForm({ title: '', description: '', dueDate: '', priority: 'Medium', assignedToId: '', accountId: '', projectId: '', status: defaultStatus || 'Open', recurring: '' })
      setFiles([])
      setChecklistDraft([''])
      setCollaborators([])
    } catch {
      toast.error('Aufgabe konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Neue Aufgabe" size="vw-50">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Was muss erledigt werden?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeit</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
            <select
              value={form.priority}
              onChange={(e) => update('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COLUMNS.map((c) => (
                <option key={c.status} value={c.status}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Wiederkehrend
            </label>
            <select
              value={form.recurring}
              onChange={(e) => update('recurring', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RECURRING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {users.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zuständig</label>
              <select
                value={form.assignedToId}
                onChange={(e) => update('assignedToId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nicht zugewiesen</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select
                value={form.accountId}
                onChange={(e) => update('accountId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kein Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.companyName}</option>
                ))}
              </select>
            </div>
          )}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
              <select
                value={form.projectId}
                onChange={(e) => update('projectId', e.target.value)}
                disabled={!form.accountId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {form.accountId ? 'Kein Projekt' : '— Erst Account wählen —'}
                </option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dateien anhängen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" /> Dateien anhängen
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white hover:file:bg-gray-50"
          />
          {files.length > 0 && (
            <ul className="mt-2 text-xs text-gray-500 list-disc list-inside space-y-0.5 max-h-24 overflow-auto">
              {files.map((f, i) => (
                <li key={i}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Mitarbeiter einladen (Mitwirkende) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mitwirkende (optional)</label>
          <div className="space-y-2">
            <select
              multiple
              size={Math.min(6, users.length || 6)}
              value={collaborators}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value)
                setCollaborators(values)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[2.5rem]"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {collaborators.length > 0 && (
              <p className="text-xs text-gray-500">{collaborators.length} ausgewählt</p>
            )}
          </div>
        </div>

        {/* Initial Checkliste */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Checkliste (optional)</label>
          <div className="space-y-2">
            {checklistDraft.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setChecklistDraft((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
                  placeholder={`Punkt ${idx + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setChecklistDraft((prev) => prev.filter((_, i) => i !== idx))}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setChecklistDraft((prev) => [...prev, ''])}
              className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
            >
              + Zeile hinzufügen
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Wird erstellt...' : 'Erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState('Open')
  const [selectedTask, setSelectedTask] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [activeTask, setActiveTask] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/tasks')
      setTasks(Array.isArray(data) ? data : data.tasks || [])
    } catch {
      toast.error('Aufgaben konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [accs, usrs, projs] = await Promise.all([
          api.get('/accounts'),
          api.get('/users'),
          api.get('/projects'),
        ])
        setAccounts(Array.isArray(accs) ? accs : accs.accounts || [])
        setUsers(Array.isArray(usrs) ? usrs : usrs.users || [])
        setProjects(Array.isArray(projs) ? projs : projs.projects || [])
      } catch {}
    }
    loadMeta()
  }, [])

  // Open Task detail by taskId query param (from notification links)
  useEffect(() => {
    const qid = searchParams.get('taskId')
    if (!qid) return
    const t = tasks.find((x) => String(x.id) === String(qid))
    if (t) setSelectedTask(t)
  }, [searchParams, tasks])

  const handleDelete = (id) => {
    setConfirmDeleteId(id)
  }

  const performDelete = async () => {
    if (!confirmDeleteId) return
    setDeleteLoading(true)
    try {
      await api.delete(`/tasks/${confirmDeleteId}`)
      toast.success('Aufgabe gelöscht.')
      setTasks((prev) => prev.filter((t) => t.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch {
      toast.error('Aufgabe konnte nicht gelöscht werden.')
    } finally {
      setDeleteLoading(false)
    }
  }

  function handleDragStart(event) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const taskId = active.id
    let newStatus = over.id

    // If dropped on another card, resolve to that card's status
    if (!COLUMNS.find((c) => c.status === newStatus)) {
      const overTask = tasks.find((t) => t.id === newStatus)
      if (!overTask) return
      newStatus = overTask.status
    }

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))

    api.put(`/tasks/${taskId}`, { status: newStatus }).catch((err) => {
      toast.error(err.message || 'Fehler beim Aktualisieren')
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t))
    })
  }

  function openCreateForStatus(status) {
    setDefaultStatus(status)
    setShowCreateModal(true)
  }

  const filteredTasks = tasks.filter(
    (t) => priorityFilter === 'all' || t.priority === priorityFilter
  )

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = filteredTasks.filter((t) => t.status === col.status)
    return acc
  }, {})

  const openCount = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length
  const overdueCount = tasks.filter(isOverdue).length
  const doneToday = tasks.filter((t) => {
    if (t.status !== 'Done') return false
    const updated = t.updatedAt ? new Date(t.updatedAt) : null
    return updated && updated.toDateString() === new Date().toDateString()
  }).length

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
            <CheckSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Aufgaben</h1>
            <p className="text-sm text-gray-500">{openCount} offene Aufgaben</p>
          </div>
        </div>
        <button
          onClick={() => openCreateForStatus('Open')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Aufgabe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-50 shrink-0">
            <CheckSquare className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Offen</p>
            <p className="text-lg font-bold text-gray-900">{openCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Überfällig</p>
            <p className="text-lg font-bold text-red-600">{overdueCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Heute erledigt</p>
            <p className="text-lg font-bold text-green-600">{doneToday}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">Alle Prioritäten</option>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        {priorityFilter !== 'all' && (
          <button
            onClick={() => setPriorityFilter('all')}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm text-gray-500">Aufgaben werden geladen...</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-wrap md:flex-nowrap gap-1.5 sm:gap-2 lg:gap-3 md:overflow-x-auto pb-4 flex-1">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                col={col}
                tasks={tasksByStatus[col.status] || []}
                onDelete={handleDelete}
                onEdit={setSelectedTask}
                onAddTask={openCreateForStatus}
                allowAdd={col.status === 'Open'}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <TaskCard task={activeTask} onDelete={() => {}} isDragOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newTask) => setTasks((prev) => [newTask, ...prev])}
        accounts={accounts}
        users={users}
        projects={projects}
        defaultStatus={defaultStatus}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => {
          setSelectedTask(null)
          // Clear query param to avoid reopening on back/refresh
          router.replace('/tasks', { scroll: false })
        }}
        onSaved={(updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))}
        onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        accounts={accounts}
        users={users}
        projects={projects}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => { if (!deleteLoading) setConfirmDeleteId(null) }}
        onConfirm={performDelete}
        title="Aufgabe löschen"
        message="Diese Aufgabe wird dauerhaft gelöscht. Möchten Sie fortfahren?"
        confirmText="Löschen"
        cancelText="Abbrechen"
        isDanger
        loading={deleteLoading}
      />
    </div>
  )
}

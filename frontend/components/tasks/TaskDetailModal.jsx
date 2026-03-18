'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Calendar, User, Building2, FolderOpen, Trash2, RefreshCw, Paperclip, Download, CheckSquare, Plus, UserPlus } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const RECURRING_OPTIONS = [
  { value: '', label: 'Keine' },
  { value: 'Daily', label: 'Täglich' },
  { value: 'Weekly', label: 'Wöchentlich' },
  { value: 'Monthly', label: 'Monatlich' },
  { value: 'Quarterly', label: 'Vierteljährlich' },
]

const PRIORITY_CONFIG = {
  Critical: { label: 'Kritisch', dot: 'bg-red-600' },
  High:     { label: 'Hoch',     dot: 'bg-orange-500' },
  Medium:   { label: 'Mittel',   dot: 'bg-yellow-500' },
  Low:      { label: 'Niedrig',  dot: 'bg-blue-500' },
}

const STATUS_OPTIONS = [
  { value: 'Open',        label: 'Offen' },
  { value: 'In Progress', label: 'In Bearbeitung' },
  { value: 'Done',        label: 'Erledigt' },
  { value: 'Cancelled',   label: 'Abgebrochen' },
]

const CLS_INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

export default function TaskDetailModal({ task, isOpen, onClose, onSaved, onDeleted, accounts = [], users = [], projects = [] }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState([])
  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [checklist, setChecklist] = useState([])
  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [newItem, setNewItem] = useState('')
  const originalDoneRef = useRef({})
  const [changedDone, setChangedDone] = useState({}) // id -> boolean (staged)
  const [collaborators, setCollaborators] = useState([]) // rows with { user }
  const [loadingCollaborators, setLoadingCollaborators] = useState(false)
  const [newCollaboratorIds, setNewCollaboratorIds] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'Open',
        priority: task.priority || 'Medium',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        assignedToId: task.assignedTo?.id || task.assignedToId || '',
        accountId: task.account?.id || task.accountId || '',
        projectId: task.project?.id || task.projectId || '',
        recurring: task.recurring || '',
      })
      setFiles([])
      // Load linked documents
      if (task.id) {
        setLoadingDocs(true)
        api.get(`/documents?taskId=${task.id}`)
          .then((data) => setDocuments(Array.isArray(data) ? data : data?.documents || []))
          .catch(() => setDocuments([]))
          .finally(() => setLoadingDocs(false))

        // Load checklist
        setLoadingChecklist(true)
        api.get(`/tasks/${task.id}/checklist`)
          .then((items) => {
            const arr = Array.isArray(items) ? items : []
            setChecklist(arr)
            // capture original done-state for staging
            const map = {}
            for (const it of arr) map[it.id] = !!it.done
            originalDoneRef.current = map
            setChangedDone({})
          })
          .catch(() => setChecklist([]))
          .finally(() => setLoadingChecklist(false))

        // Load collaborators
        setLoadingCollaborators(true)
        api.get(`/tasks/${task.id}/collaborators`)
          .then((rows) => setCollaborators(Array.isArray(rows) ? rows : []))
          .catch(() => setCollaborators([]))
          .finally(() => setLoadingCollaborators(false))
      } else {
        setDocuments([])
        setChecklist([])
        setCollaborators([])
        setNewCollaboratorIds([])
      }
    }
  }, [task])

  const update = (field, value) => setForm((prev) => {
    const next = { ...prev, [field]: value }
    if (field === 'accountId') next.projectId = ''
    return next
  })

  const filteredProjects = form.accountId
    ? projects.filter((p) => p.accountId === form.accountId)
    : []

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Titel ist erforderlich.'); return }
    setSaving(true)
    try {
      // Use multipart to support optional file uploads
      const fd = new FormData()
      fd.append('title', form.title.trim())
      if (form.description) fd.append('description', form.description)
      fd.append('status', form.status)
      fd.append('priority', form.priority)
      if (form.dueDate) fd.append('dueDate', form.dueDate)
      if (form.assignedToId) fd.append('assignedToId', form.assignedToId)
      if (form.accountId) fd.append('accountId', form.accountId)
      if (form.projectId) fd.append('projectId', form.projectId)
      if (form.recurring) fd.append('recurring', form.recurring)
      for (const f of files) fd.append('files', f)

      const updated = await api.uploadPut(`/tasks/${task.id}`, fd)
      // Persist staged checklist "done" changes after task save
      const entries = Object.entries(changedDone)
      if (task?.id && entries.length > 0) {
        await Promise.all(entries.map(([id, done]) => api.patch(`/tasks/${task.id}/checklist/${id}`, { done })))
        // refresh original map to current
        const map = { ...originalDoneRef.current }
        for (const [id, done] of entries) map[id] = done
        originalDoneRef.current = map
        setChangedDone({})
      }
      toast.success('Aufgabe gespeichert.')
      // If backend returned documents, refresh local list
      if (updated?.documents) setDocuments(updated.documents)
      onSaved?.(updated)
      onClose()
    } catch {
      toast.error('Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async (e) => {
    e?.preventDefault?.()
    const title = (newItem || '').trim()
    if (!task?.id || !title) return
    try {
      const item = await api.post(`/tasks/${task.id}/checklist`, { title })
      setChecklist((prev) => [...prev, item])
      setNewItem('')
    } catch {
      toast.error('Checklist-Item konnte nicht angelegt werden.')
    }
  }

  const toggleItem = (item) => {
    // Stage the change locally; do NOT persist yet (saved on main Save)
    const nextDone = !item.done
    setChecklist((prev) => prev.map((i) => i.id === item.id ? { ...i, done: nextDone } : i))
    setChangedDone((prev) => {
      const orig = originalDoneRef.current[item.id]
      const copy = { ...prev }
      if (nextDone === orig) {
        delete copy[item.id]
      } else {
        copy[item.id] = nextDone
      }
      return copy
    })
  }

  const deleteItem = async (id) => {
    if (!task?.id) return
    const prev = checklist
    setChecklist((c) => c.filter((i) => i.id !== id))
    try {
      await api.delete(`/tasks/${task.id}/checklist/${id}`)
    } catch {
      setChecklist(prev)
      toast.error('Eintrag konnte nicht gelöscht werden.')
    }
  }

  const addCollaborators = async () => {
    if (!task?.id || newCollaboratorIds.length === 0) return
    try {
      const payload = { collaboratorIds: JSON.stringify(newCollaboratorIds) }
      const rows = await api.post(`/tasks/${task.id}/collaborators`, payload)
      const rowsArr = Array.isArray(rows) ? rows : []
      const existingIds = new Set(collaborators.map((c) => c.userId))
      const merged = [...collaborators]
      for (const r of rowsArr) {
        if (!existingIds.has(r.userId)) merged.push(r)
      }
      setCollaborators(merged)
      setNewCollaboratorIds([])
      toast.success('Mitwirkende hinzugefügt.')
    } catch {
      toast.error('Mitwirkende konnten nicht hinzugefügt werden.')
    }
  }

  const removeCollaborator = async (userId) => {
    if (!task?.id) return
    const prev = collaborators
    setCollaborators((c) => c.filter((r) => r.userId !== userId))
    try {
      await api.delete(`/tasks/${task.id}/collaborators/${userId}`)
    } catch {
      setCollaborators(prev)
      toast.error('Mitwirkender konnte nicht entfernt werden.')
    }
  }

  const handleDelete = () => setShowDeleteConfirm(true)

  const performDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/tasks/${task.id}`)
      toast.success('Aufgabe gelöscht.')
      onDeleted?.(task.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch {
      toast.error('Aufgabe konnte nicht gelöscht werden.')
    } finally {
      setDeleting(false)
    }
  }

  if (!task) return null

  const priority = PRIORITY_CONFIG[form.priority] || PRIORITY_CONFIG.Medium

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aufgabe bearbeiten" size="vw-50">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Title */}
        <div>
          <label className={CLS_LABEL}>Titel <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className={CLS_INPUT}
            required
          />
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={CLS_LABEL}>Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value)} className={CLS_INPUT}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${priority.dot}`} />
                Priorität
              </span>
            </label>
            <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className={CLS_INPUT}>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={CLS_LABEL}>Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className={`${CLS_INPUT} resize-none`}
            placeholder="Weitere Details zur Aufgabe..."
          />
        </div>

        {/* Due date + Assignee */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={CLS_LABEL}>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Fälligkeit</span>
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
              className={CLS_INPUT}
            />
          </div>
          <div>
            <label className={CLS_LABEL}>
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Zuständig</span>
            </label>
            <select value={form.assignedToId} onChange={(e) => update('assignedToId', e.target.value)} className={CLS_INPUT}>
              <option value="">Nicht zugewiesen</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recurring */}
        <div>
          <label className={CLS_LABEL}>
            <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Wiederkehrend</span>
          </label>
          <select value={form.recurring} onChange={(e) => update('recurring', e.target.value)} className={CLS_INPUT}>
            {RECURRING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Calendar export buttons */}
        {task.id && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.post('/calendar/google/push', { taskId: task.id })
                  toast.success('In Google Kalender exportiert')
                } catch (err) {
                  toast.error(err.message || 'Google Kalender nicht verbunden')
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              In Google Kalender
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.post('/calendar/microsoft/push', { taskId: task.id })
                  toast.success('In Outlook Kalender exportiert')
                } catch (err) {
                  toast.error(err.message || 'Outlook nicht verbunden')
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              In Outlook Kalender
            </button>
          </div>
        )}

        {/* Account + Project */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={CLS_LABEL}>
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />Account</span>
            </label>
            <select value={form.accountId} onChange={(e) => update('accountId', e.target.value)} className={CLS_INPUT}>
              <option value="">Kein Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.companyName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={CLS_LABEL}>
              <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" />Projekt</span>
            </label>
            <select
              value={form.projectId}
              onChange={(e) => update('projectId', e.target.value)}
              disabled={!form.accountId}
              className={`${CLS_INPUT} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
            >
              <option value="">
                {form.accountId ? 'Kein Projekt' : '— Erst Account wählen —'}
              </option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Meta */}
        {task.createdAt && (
          <p className="text-xs text-gray-400">
            Erstellt am {formatDate(task.createdAt)}
          </p>
        )}

        {/* Documents upload */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className={CLS_LABEL}>
            <span className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5" /> Dateien anhängen
            </span>
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white hover:file:bg-gray-50"
          />

          {/* Existing documents */}
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-700 mb-1">Bereits hochgeladene Dokumente</p>
            {loadingDocs ? (
              <p className="text-xs text-gray-400">Lade Dokumente...</p>
            ) : documents.length === 0 ? (
              <p className="text-xs text-gray-400">Keine Dokumente vorhanden</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{d.name}</span>
                    <a
                      href={`http://localhost:3001/api/documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Collaborators (Mitwirkende) */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className={CLS_LABEL}>
            <span className="flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Mitwirkende
            </span>
          </label>

          {/* Add collaborators */}
          <div className="flex items-center gap-2">
            <select
              multiple
              size={Math.min(6, users.length || 6)}
              value={newCollaboratorIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value)
                setNewCollaboratorIds(values)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[2.5rem]"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCollaborators}
              disabled={newCollaboratorIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" /> Hinzufügen
            </button>
          </div>

          {/* Current collaborators */}
          {loadingCollaborators ? (
            <p className="text-xs text-gray-400">Lade Mitwirkende...</p>
          ) : collaborators.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Mitwirkenden</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {collaborators.map((c) => (
                <li key={c.userId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate">{c.user?.name || c.userId}</span>
                  <button
                    type="button"
                    onClick={() => removeCollaborator(c.userId)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className={CLS_LABEL}>
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" /> Checkliste
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Neuen Punkt hinzufügen..."
              className={CLS_INPUT}
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Hinzufügen
            </button>
          </div>

          {loadingChecklist ? (
            <p className="text-xs text-gray-400">Lade Checkliste...</p>
          ) : checklist.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Checkliste vorhanden</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {checklist
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((it) => (
                <li key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!it.done}
                      onChange={() => toggleItem(it)}
                      className="rounded text-blue-600"
                    />
                    <span className={it.done ? 'line-through text-gray-400' : 'text-gray-800'}>{it.title}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteItem(it.id)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Löschen
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={performDelete}
        title="Aufgabe löschen"
        message="Diese Aufgabe wird dauerhaft gelöscht. Möchten Sie fortfahren?"
        confirmText="Löschen"
        cancelText="Abbrechen"
        isDanger
        loading={deleting}
      />
    </Modal>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Trash2,
  ChevronDown,
  Filter,
  X,
  CalendarDays,
  UserCircle,
  Clock,
  ArrowRight,
  CheckSquare,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils'
import ActivityTypeIcon from '@/components/activities/ActivityTypeIcon'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { Mail } from 'lucide-react'

const ACTIVITY_TYPES = [
  'Meeting',
  'Phone Call',
  'Email',
  'Presentation',
  'Workshop',
  'Conference',
  'Note',
]

function groupActivitiesByDate(activities) {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const groups = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  }

  activities.forEach((act) => {
    const d = new Date(act.date || act.createdAt)
    const dStr = d.toDateString()
    if (dStr === todayStr) groups['Today'].push(act)
    else if (dStr === yesterdayStr) groups['Yesterday'].push(act)
    else if (d >= startOfWeek) groups['This Week'].push(act)
    else groups['Earlier'].push(act)
  })

  return groups
}

const GROUP_LABELS = {
  Today: 'Heute',
  Yesterday: 'Gestern',
  'This Week': 'Diese Woche',
  Earlier: 'Früher',
}

function ActivityCard({ activity, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const participants = activity.participants || []

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <ActivityTypeIcon type={activity.type} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">
                  {activity.type}
                </span>
                {activity.duration && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {activity.duration} Min.
                  </span>
                )}
                {activity.account?.name && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {activity.account.name}
                  </span>
                )}
                {activity.deal?.title && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {activity.deal.title}
                  </span>
                )}
                {activity.project?.name && (
                  <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                    {activity.project.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDateTime(activity.date || activity.createdAt)} ·{' '}
                {activity.createdBy?.name || '—'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                onClick={() => onDelete(activity.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-700 mt-2 line-clamp-2">
            {activity.summary}
          </p>

          {participants.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {participants.slice(0, 5).map((p) => (
                <div
                  key={p.id || p.name}
                  className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"
                  title={p.name}
                >
                  <span className="text-xs font-medium text-blue-600">
                    {p.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              ))}
              {participants.length > 5 && (
                <span className="text-xs text-gray-400">
                  +{participants.length - 5}
                </span>
              )}
            </div>
          )}

          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {activity.summary && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {activity.summary}
                </p>
              )}
              {activity.nextSteps && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Nächste Schritte:
                  </p>
                  <p className="text-sm text-gray-700">{activity.nextSteps}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateActivityModal({ isOpen, onClose, onCreated, accounts, contacts, users }) {
  const [form, setForm] = useState({
    type: 'Meeting',
    date: new Date().toISOString().slice(0, 16),
    duration: '',
    accountId: '',
    dealId: '',
    projectId: '',
    participantIds: [],
    summary: '',
    nextSteps: '',
    createFollowUpTask: false,
    taskTitle: '',
    taskDueDate: '',
    taskPriority: 'Medium',
    taskAssigneeId: '',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const toggleParticipant = (id) => {
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(id)
        ? prev.participantIds.filter((x) => x !== id)
        : [...prev.participantIds, id],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.summary.trim()) {
      toast.error('Zusammenfassung ist erforderlich.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        date: form.date,
        duration: form.duration ? parseInt(form.duration) : null,
        accountId: form.accountId || null,
        summary: form.summary,
        nextSteps: form.nextSteps || null,
        participantIds: form.participantIds,
        followUpTask: form.createFollowUpTask
          ? {
              title: form.taskTitle,
              dueDate: form.taskDueDate || null,
              priority: form.taskPriority,
              assigneeId: form.taskAssigneeId || null,
            }
          : null,
      }
      const result = await api.post('/activities', payload)
      toast.success('Aktivität erstellt.')
      onCreated(result)
      onClose()
    } catch (err) {
      toast.error('Aktivität konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Neue Aktivität">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Typ
          </label>
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum & Uhrzeit
            </label>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dauer (Min.)
            </label>
            <input
              type="number"
              placeholder="z.B. 60"
              value={form.duration}
              onChange={(e) => update('duration', e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account (optional)
          </label>
          <select
            value={form.accountId}
            onChange={(e) => update('accountId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Kein Account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Participants */}
        {contacts.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teilnehmer
            </label>
            <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto p-2 space-y-1">
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={form.participantIds.includes(c.id)}
                    onChange={() => toggleParticipant(c.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zusammenfassung <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.summary}
            onChange={(e) => update('summary', e.target.value)}
            rows={3}
            placeholder="Was wurde besprochen?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            required
          />
        </div>

        {/* Next Steps */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nächste Schritte (optional)
          </label>
          <textarea
            value={form.nextSteps}
            onChange={(e) => update('nextSteps', e.target.value)}
            rows={2}
            placeholder="Was ist als nächstes geplant?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Follow-up Task */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.createFollowUpTask}
              onChange={(e) => update('createFollowUpTask', e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              Follow-up Aufgabe erstellen
            </span>
          </label>

          {form.createFollowUpTask && (
            <div className="mt-3 space-y-3 pl-5 border-l-2 border-blue-200">
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={form.taskTitle}
                onChange={(e) => update('taskTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.taskDueDate}
                  onChange={(e) => update('taskDueDate', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={form.taskPriority}
                  onChange={(e) => update('taskPriority', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Low">Niedrig</option>
                  <option value="Medium">Mittel</option>
                  <option value="High">Hoch</option>
                  <option value="Critical">Kritisch</option>
                </select>
              </div>
              {users.length > 0 && (
                <select
                  value={form.taskAssigneeId}
                  onChange={(e) => update('taskAssigneeId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Zuständig: nicht zugewiesen</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
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

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Filters
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [consultantFilter, setConsultantFilter] = useState('all')

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (accountFilter !== 'all') params.set('accountId', accountFilter)
      if (consultantFilter !== 'all') params.set('userId', consultantFilter)

      const queryString = params.toString()
      const data = await api.get(`/activities${queryString ? '?' + queryString : ''}`)
      setActivities(Array.isArray(data) ? data : data.activities || [])
    } catch (err) {
      toast.error('Aktivitäten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, dateFrom, dateTo, accountFilter, consultantFilter])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [accs, conts, usrs] = await Promise.all([
          api.get('/accounts'),
          api.get('/contacts'),
          api.get('/users'),
        ])
        setAccounts(Array.isArray(accs) ? accs : accs.accounts || [])
        setContacts(Array.isArray(conts) ? conts : conts.contacts || [])
        setUsers(Array.isArray(usrs) ? usrs : usrs.users || [])
      } catch {
        // silently fail - filters may not be available
      }
    }
    loadMeta()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Aktivität löschen?')) return
    try {
      await api.delete(`/activities/${id}`)
      toast.success('Aktivität gelöscht.')
      setActivities((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      toast.error('Fehler beim Löschen.')
    }
  }

  const handleCreated = (newActivity) => {
    setActivities((prev) => [newActivity, ...prev])
  }

  const clearFilters = () => {
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setAccountFilter('all')
    setConsultantFilter('all')
  }

  const hasFilters =
    typeFilter !== 'all' ||
    dateFrom ||
    dateTo ||
    accountFilter !== 'all' ||
    consultantFilter !== 'all'

  const grouped = groupActivitiesByDate(activities)
  const todayActivities = activities.filter(
    (a) => new Date(a.date || a.createdAt).toDateString() === new Date().toDateString()
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aktivitäten</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activities.length} Aktivitäten insgesamt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const result = await api.post('/email/sync/google', {})
                toast.success(`Gmail sync: ${result.synced} E-Mails synchronisiert`)
              } catch (err) {
                toast.error(err.message || 'Gmail nicht verbunden – Verbinden Sie Google in den Einstellungen')
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Mail className="w-4 h-4 text-red-500" />
            Gmail sync
          </button>
          <button
            onClick={async () => {
              try {
                const result = await api.post('/email/sync/microsoft', {})
                toast.success(`Outlook sync: ${result.synced} E-Mails synchronisiert`)
              } catch (err) {
                toast.error(err.message || 'Outlook nicht verbunden – Verbinden Sie Microsoft in den Einstellungen')
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Mail className="w-4 h-4 text-blue-500" />
            Outlook sync
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Aktivität
          </button>
        </div>
      </div>

      {/* Team Feed */}
      {todayActivities.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">
            Heute · {todayActivities.length} Aktivität
            {todayActivities.length !== 1 ? 'en' : ''}
          </h2>
          <div className="flex flex-wrap gap-2">
            {todayActivities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="inline-flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-3 py-1.5 text-xs text-blue-800"
              >
                <ActivityTypeIcon type={act.type} size="sm" />
                <span className="font-medium">{act.type}</span>
                {act.account?.name && (
                  <span className="text-blue-500">· {act.account.name}</span>
                )}
              </div>
            ))}
            {todayActivities.length > 5 && (
              <span className="text-xs text-blue-500 self-center">
                +{todayActivities.length - 5} weitere
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Alle Typen</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Von"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Bis"
          />

          {accounts.length > 0 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Alle Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {users.length > 0 && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Alle Berater</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 ml-2"
            >
              <X className="w-3.5 h-3.5" />
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine Aktivitäten gefunden"
          description={
            hasFilters
              ? 'Keine Aktivitäten mit diesen Filtern.'
              : 'Erstellen Sie Ihre erste Aktivität.'
          }
          action={
            !hasFilters ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Erste Aktivität erstellen
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, items]) => {
            if (items.length === 0) return null
            return (
              <div key={group}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {GROUP_LABELS[group]} ({items.length})
                </h3>
                <div className="space-y-3">
                  {items.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
        accounts={accounts}
        contacts={contacts}
        users={users}
      />
    </div>
  )
}

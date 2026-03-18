'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Save, X, Plus, Trash2, Check, Clock,
  Users, FileText, Activity, CheckSquare, ChevronDown,
  GripVertical, Calendar, DollarSign, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { formatDate, formatCurrency, formatNumber, getInitials, timeAgo } from '@/lib/utils'
import BudgetBurnChart from '@/components/projects/BudgetBurnChart'

const PROJECT_TYPES = ['Strategy', 'Regulation', 'IT', 'Risk', 'Audit', 'Other']
const PROJECT_STATUSES = ['Offer', 'Active', 'On Hold', 'Completed', 'Lost']
const BILLING_MODELS = ['Fixed Price', 'Time & Material', 'Retainer']

const STATUS_STYLES = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Offer: 'bg-blue-100 text-blue-700 border-blue-200',
  'On Hold': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
}

const TYPE_STYLES = {
  Strategy: 'bg-purple-100 text-purple-700',
  Regulation: 'bg-orange-100 text-orange-700',
  IT: 'bg-cyan-100 text-cyan-700',
  Risk: 'bg-red-100 text-red-700',
  Audit: 'bg-amber-100 text-amber-700',
  Other: 'bg-gray-100 text-gray-600',
}

const PHASE_STATUS_STYLES = {
  Planned: 'bg-gray-100 text-gray-600',
  Active: 'bg-green-100 text-green-700',
  Completed: 'bg-blue-100 text-blue-700',
  Delayed: 'bg-red-100 text-red-700',
}

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function DL({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '—'}</dd>
    </div>
  )
}

// ── Übersicht Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ project, timeEntries }) {
  const budgetPct =
    project.budgetPlanned && project.budgetPlanned > 0
      ? Math.min((project.budgetActual / project.budgetPlanned) * 100, 100)
      : 0
  const budgetColor =
    budgetPct < 75 ? 'bg-green-500' : budgetPct < 90 ? 'bg-yellow-500' : 'bg-red-500'

  const billableHours = timeEntries
    .filter((t) => t.billable)
    .reduce((s, t) => s + Number(t.hours), 0)
  const nonBillableHours = timeEntries
    .filter((t) => !t.billable)
    .reduce((s, t) => s + Number(t.hours), 0)
  const totalHours = billableHours + nonBillableHours

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Details */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Projektdetails</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DL label="Account" value={project.account?.companyName} />
          <DL label="Projekttyp" value={project.projectType} />
          <DL label="Abrechnungsmodell" value={project.billingModel} />
          <DL
            label="Lead Consultant"
            value={project.leadConsultant?.name}
          />
          <DL label="Startdatum" value={formatDate(project.startDate)} />
          <DL label="Enddatum" value={formatDate(project.endDate)} />
        </dl>
        {project.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Beschreibung</p>
            <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
          </div>
        )}
      </div>

      {/* Right: Budget */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Budget-Übersicht
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Geplant</span>
              <span className="font-semibold">{formatCurrency(project.budgetPlanned)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Aktuell</span>
              <span className="font-semibold">{formatCurrency(project.budgetActual)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${budgetColor}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">{Math.round(budgetPct)}% verbraucht</p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Gesamt Std.</p>
              <p className="text-lg font-bold text-gray-900">{totalHours.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-green-600">Fakturierbar</p>
              <p className="text-lg font-bold text-green-700">{billableHours.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Nicht fakturierbar</p>
              <p className="text-lg font-bold text-gray-500">{nonBillableHours.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <BudgetBurnChart
            timeEntries={timeEntries}
            budgetPlanned={project.budgetPlanned}
          />
        </div>
      </div>
    </div>
  )
}

// ── Phases & Milestones Tab ───────────────────────────────────────────────────
function PhasesTab({ projectId }) {
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [phaseForm, setPhaseForm] = useState({ name: '', startDate: '', endDate: '', order: '' })
  const [saving, setSaving] = useState(false)
  const [milestoneInputs, setMilestoneInputs] = useState({})

  const fetchPhases = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/projects/${projectId}/phases`)
      const arr = Array.isArray(data) ? data : (data?.data || [])
      setPhases(arr.sort((a, b) => (a.order || 0) - (b.order || 0)))
    } catch {
      toast.error('Fehler beim Laden der Phasen')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchPhases() }, [fetchPhases])

  async function addPhase(e) {
    e.preventDefault()
    if (!phaseForm.name.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/projects/${projectId}/phases`, {
        ...phaseForm,
        order: phaseForm.order ? Number(phaseForm.order) : phases.length + 1,
      })
      setPhases((prev) => [...prev, created].sort((a, b) => (a.order || 0) - (b.order || 0)))
      setPhaseForm({ name: '', startDate: '', endDate: '', order: '' })
      setShowAddPhase(false)
      toast.success('Phase hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function deletePhase(phaseId) {
    if (!confirm('Phase löschen?')) return
    try {
      await api.delete(`/projects/${projectId}/phases/${phaseId}`)
      setPhases((prev) => prev.filter((p) => p.id !== phaseId))
      toast.success('Phase gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  async function addMilestone(phaseId) {
    const input = milestoneInputs[phaseId] || {}
    if (!input.title?.trim()) return
    try {
      const ms = await api.post(`/projects/${projectId}/phases/${phaseId}/milestones`, {
        title: input.title,
        dueDate: input.dueDate || null,
      })
      setPhases((prev) =>
        prev.map((p) =>
          p.id === phaseId
            ? { ...p, milestones: [...(p.milestones || []), ms] }
            : p
        )
      )
      setMilestoneInputs((prev) => ({ ...prev, [phaseId]: { title: '', dueDate: '' } }))
      toast.success('Meilenstein hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  async function toggleMilestone(phaseId, ms) {
    try {
      const updated = await api.put(
        `/projects/${projectId}/phases/${phaseId}/milestones/${ms.id}`,
        { completed: !ms.completed }
      )
      setPhases((prev) =>
        prev.map((p) =>
          p.id === phaseId
            ? { ...p, milestones: p.milestones.map((m) => (m.id === ms.id ? updated : m)) }
            : p
        )
      )
    } catch {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {phases.length === 0 && !showAddPhase && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Phasen vorhanden</p>
        </div>
      )}

      {phases.map((phase) => (
        <div key={phase.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Phase header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{phase.name}</span>
                {phase.status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_STATUS_STYLES[phase.status] || 'bg-gray-100 text-gray-600'}`}>
                    {phase.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(phase.startDate)} – {formatDate(phase.endDate)}
              </p>
            </div>
            <button
              onClick={() => deletePhase(phase.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Milestones */}
          <div className="p-3 space-y-1.5">
            {(phase.milestones || []).map((ms) => (
              <div key={ms.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 group">
                <button
                  onClick={() => toggleMilestone(phase.id, ms)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    ms.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {ms.completed && <Check className="w-3 h-3" />}
                </button>
                <span className={`text-sm flex-1 ${ms.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {ms.title}
                </span>
                {ms.dueDate && (
                  <span className="text-xs text-gray-400">{formatDate(ms.dueDate)}</span>
                )}
              </div>
            ))}

            {/* Add milestone inline */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Meilenstein hinzufügen..."
                value={milestoneInputs[phase.id]?.title || ''}
                onChange={(e) =>
                  setMilestoneInputs((prev) => ({
                    ...prev,
                    [phase.id]: { ...prev[phase.id], title: e.target.value },
                  }))
                }
                onKeyDown={(e) => e.key === 'Enter' && addMilestone(phase.id)}
                className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={milestoneInputs[phase.id]?.dueDate || ''}
                onChange={(e) =>
                  setMilestoneInputs((prev) => ({
                    ...prev,
                    [phase.id]: { ...prev[phase.id], dueDate: e.target.value },
                  }))
                }
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => addMilestone(phase.id)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add phase form */}
      {showAddPhase ? (
        <form onSubmit={addPhase} className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm">Neue Phase</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                type="text"
                required
                placeholder="Phasenname *"
                value={phaseForm.name}
                onChange={(e) => setPhaseForm((p) => ({ ...p, name: e.target.value }))}
                className={CLS_INPUT}
              />
            </div>
            <input
              type="date"
              value={phaseForm.startDate}
              onChange={(e) => setPhaseForm((p) => ({ ...p, startDate: e.target.value }))}
              className={CLS_INPUT}
            />
            <input
              type="date"
              value={phaseForm.endDate}
              onChange={(e) => setPhaseForm((p) => ({ ...p, endDate: e.target.value }))}
              className={CLS_INPUT}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Speichern...' : 'Phase erstellen'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddPhase(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddPhase(true)}
          className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Phase hinzufügen
        </button>
      )}
    </div>
  )
}

// ── Time Tracking Tab ─────────────────────────────────────────────────────────
function TimeTrackingTab({ projectId, timeEntries, setTimeEntries, users, currentUser }) {
  const [form, setForm] = useState({
    userId: currentUser?.id || '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    billable: true,
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const totalHours = timeEntries.reduce((s, t) => s + Number(t.hours), 0)
  const billableHours = timeEntries.filter((t) => t.billable).reduce((s, t) => s + Number(t.hours), 0)
  const nonBillableHours = totalHours - billableHours

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.hours || !form.date) {
      toast.error('Datum und Stunden sind erforderlich')
      return
    }
    setSaving(true)
    try {
      const created = await api.post(`/projects/${projectId}/time-entries`, {
        ...form,
        hours: Number(form.hours),
        userId: form.userId || null,
      })
      setTimeEntries((prev) => [created, ...prev])
      setForm({ userId: currentUser?.id || '', date: new Date().toISOString().split('T')[0], hours: '', billable: true, description: '' })
      toast.success('Zeiteintrag erfasst')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id) {
    try {
      await api.delete(`/projects/${projectId}/time-entries/${id}`)
      setTimeEntries((prev) => prev.filter((t) => t.id !== id))
      toast.success('Eintrag gelöscht')
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Gesamt Std.', value: totalHours.toFixed(1), color: 'text-gray-900' },
          { label: 'Fakturierbar', value: billableHours.toFixed(1), color: 'text-green-700' },
          { label: 'Nicht fakturierbar', value: nonBillableHours.toFixed(1), color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Log Time Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Zeit erfassen
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={CLS_LABEL}>Consultant</label>
            <div className={`${CLS_INPUT} bg-gray-50 text-gray-700 cursor-not-allowed`}>
              {currentUser?.name || '—'}
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Datum *</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className={CLS_INPUT}
            />
          </div>
          <div>
            <label className={CLS_LABEL}>Stunden *</label>
            <input
              type="number"
              required
              min="0.25"
              max="24"
              step="0.25"
              value={form.hours}
              onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
              className={CLS_INPUT}
              placeholder="z.B. 4"
            />
          </div>
          <div className="md:col-span-2">
            <label className={CLS_LABEL}>Beschreibung</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className={CLS_INPUT}
              placeholder="Was wurde gemacht?"
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer h-[38px]">
              <input
                type="checkbox"
                checked={form.billable}
                onChange={(e) => setForm((p) => ({ ...p, billable: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Fakturierbar</span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {saving ? 'Speichern...' : 'Eintragen'}
            </button>
          </div>
        </form>
      </div>

      {/* Time Entries Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">Zeiteinträge ({timeEntries.length})</h3>
        </div>
        {timeEntries.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Noch keine Zeiteinträge</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Datum</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Consultant</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Stunden</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Beschreibung</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {timeEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 group">
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(entry.date)}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {entry.user?.name || entry.userName || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {Number(entry.hours).toFixed(2)}h
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      entry.billable
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {entry.billable ? 'Fakturierbar' : 'Intern'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate">
                    {entry.description || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
function TeamTab({ projectId, users }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ userId: '', role: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/projects/${projectId}/members`)
      .then((data) => setMembers(Array.isArray(data) ? data : (data?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function addMember(e) {
    e.preventDefault()
    if (!addForm.userId) return
    setSaving(true)
    try {
      const created = await api.post(`/projects/${projectId}/members`, addForm)
      setMembers((prev) => [...prev, created])
      setAddForm({ userId: '', role: '' })
      setShowAdd(false)
      toast.success('Mitglied hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(userId) {
    if (!confirm('Mitglied entfernen?')) return
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`)
      setMembers((prev) => prev.filter((m) => m.userId !== userId && m.user?.id !== userId))
      toast.success('Mitglied entfernt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">Projektteam ({members.length})</h3>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Mitglied
          </button>
        </div>

        {members.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Noch keine Teammitglieder
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => {
              const name = m.user?.name || m.userName || `User #${m.userId}`
              const email = m.user?.email || m.userEmail || ''
              return (
                <div key={m.id || m.userId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 group">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                    <p className="text-xs text-gray-400 truncate">{email}</p>
                  </div>
                  {m.role && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {m.role}
                    </span>
                  )}
                  <button
                    onClick={() => removeMember(m.userId || m.user?.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addMember} className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900">Mitglied hinzufügen</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={CLS_LABEL}>Consultant *</label>
              <select
                required
                value={addForm.userId}
                onChange={(e) => setAddForm((p) => ({ ...p, userId: e.target.value }))}
                className={CLS_INPUT}
              >
                <option value="">-- Bitte wählen --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Rolle</label>
              <input
                type="text"
                value={addForm.role}
                onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
                className={CLS_INPUT}
                placeholder="z.B. Senior Consultant"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Hinzufügen...' : 'Hinzufügen'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Activities Tab ────────────────────────────────────────────────────────────
function ActivitiesTab({ projectId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ type: 'Note', date: new Date().toISOString().split('T')[0], summary: '', nextSteps: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/projects/${projectId}/activities`)
      .then((d) => setActivities(Array.isArray(d) ? d : (d?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function addActivity(e) {
    e.preventDefault()
    if (!form.summary.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/projects/${projectId}/activities`, form)
      setActivities((prev) => [created, ...prev])
      setForm({ type: 'Note', date: new Date().toISOString().split('T')[0], summary: '', nextSteps: '' })
      setShowAdd(false)
      toast.success('Aktivität hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  const ACTIVITY_TYPES = ['Meeting', 'Call', 'Email', 'Workshop', 'Note', 'Other']

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Aktivität hinzufügen
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addActivity} className="bg-white rounded-lg border border-blue-200 shadow-sm p-5 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900">Neue Aktivität</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={CLS_LABEL}>Typ</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={CLS_INPUT}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Datum</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={CLS_INPUT} />
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Zusammenfassung *</label>
            <textarea
              required
              value={form.summary}
              onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
              rows={3}
              className={`${CLS_INPUT} resize-none`}
              placeholder="Was wurde besprochen / erledigt?"
            />
          </div>
          <div>
            <label className={CLS_LABEL}>Nächste Schritte</label>
            <input type="text" value={form.nextSteps} onChange={(e) => setForm((p) => ({ ...p, nextSteps: e.target.value }))} className={CLS_INPUT} placeholder="Offene To-Dos..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Abbrechen</button>
          </div>
        </form>
      )}

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Aktivitäten erfasst</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {activities.map((act) => (
            <div key={act.id} className="flex gap-4 px-4 py-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{act.type}</span>
                  <span className="text-xs text-gray-400">{formatDate(act.date)}</span>
                </div>
                <p className="text-sm text-gray-900">{act.summary}</p>
                {act.nextSteps && (
                  <p className="text-xs text-gray-500 mt-1">Nächste Schritte: {act.nextSteps}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────
const DOC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

function DocumentsTab({ projectId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get(`/projects/${projectId}/documents`)
      .then((d) => setDocuments(Array.isArray(d) ? d : (d?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)
      const doc = await api.upload(`/projects/${projectId}/documents`, formData)
      setDocuments((prev) => [doc, ...prev])
      toast.success('Dokument hochgeladen')
    } catch (err) {
      toast.error(err.message || 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploading ? 'Hochladen...' : 'Dokument hochladen'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Dokumente vorhanden</p>
          <p className="text-sm text-gray-400 mt-1">Laden Sie Verträge, Präsentationen oder Reports hoch</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 group">
              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.name || doc.filename}</p>
                <p className="text-xs text-gray-400">{timeAgo(doc.createdAt)} · {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : ''}</p>
              </div>
              {doc.filePath && (
                <a
                  href={`${DOC_BASE}/${doc.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Öffnen
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────
function TasksTab({ projectId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/projects/${projectId}/tasks`)
      .then((d) => setTasks(Array.isArray(d) ? d : (d?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function addTask(e) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/projects/${projectId}/tasks`, { title: quickTitle, projectId })
      setTasks((prev) => [...prev, created])
      setQuickTitle('')
      toast.success('Aufgabe erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task) {
    try {
      const updated = await api.put(`/projects/${projectId}/tasks/${task.id}`, {
        status: task.status === 'Open' ? 'Completed' : 'Open',
      })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <form onSubmit={addTask} className="flex gap-2">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          className={`${CLS_INPUT} flex-1`}
          placeholder="Neue Aufgabe schnell erstellen..."
        />
        <button
          type="submit"
          disabled={saving || !quickTitle.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Noch keine Aufgaben vorhanden</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 group">
              <button
                onClick={() => toggleTask(task)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.status === 'Completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {task.status === 'Completed' && <Check className="w-3 h-3" />}
              </button>
              <span className={`text-sm flex-1 ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {task.title}
              </span>
              {task.dueDate && (
                <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
              )}
              {task.assignedTo?.name && (
                <div
                  title={task.assignedTo.name}
                  className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
                >
                  {getInitials(task.assignedTo.name)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditProjectModal({ isOpen, onClose, project, onSaved, accounts, users, ccs }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        accountId: project.accountId || '',
        projectType: project.projectType || '',
        status: project.status || '',
        billingModel: project.billingModel || '',
        startDate: project.startDate?.split('T')[0] || '',
        endDate: project.endDate?.split('T')[0] || '',
        budgetPlanned: project.budgetPlanned ?? '',
        budgetActual: project.budgetActual ?? '',
        leadConsultantId: project.leadConsultantId || '',
        competenceCenterId: project.competenceCenter?.id || project.competenceCenterId || '',
        description: project.description || '',
      })
    }
  }, [project])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        budgetPlanned: form.budgetPlanned !== '' ? Number(form.budgetPlanned) : null,
        budgetActual: form.budgetActual !== '' ? Number(form.budgetActual) : null,
        accountId: form.accountId || null,
        leadConsultantId: form.leadConsultantId || null,
        competenceCenterId: form.competenceCenterId || null,
      }
      const updated = await api.put(`/projects/${project.id}`, payload)
      toast.success('Projekt gespeichert')
      onSaved(updated)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  function set(field, val) {
    setForm((p) => ({ ...p, [field]: val }))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Projekt bearbeiten</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={CLS_LABEL}>Projektname *</label>
              <input type="text" required value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={CLS_INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Account</label>
                <select value={form.accountId || ''} onChange={(e) => set('accountId', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Kein Account --</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Projekttyp</label>
                <select value={form.projectType || ''} onChange={(e) => set('projectType', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Competence Center</label>
              <select value={form.competenceCenterId || ''} onChange={(e) => set('competenceCenterId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Kein CC --</option>
                {(ccs || []).map((cc) => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Status</label>
                <select value={form.status || ''} onChange={(e) => set('status', e.target.value)} className={CLS_INPUT}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={CLS_LABEL}>Abrechnungsmodell</label>
                <select value={form.billingModel || ''} onChange={(e) => set('billingModel', e.target.value)} className={CLS_INPUT}>
                  <option value="">-- Bitte wählen --</option>
                  {BILLING_MODELS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Startdatum</label>
                <input type="date" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Enddatum</label>
                <input type="date" value={form.endDate || ''} onChange={(e) => set('endDate', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Budget geplant (€)</label>
                <input type="number" min="0" value={form.budgetPlanned ?? ''} onChange={(e) => set('budgetPlanned', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Budget aktuell (€)</label>
                <input type="number" min="0" value={form.budgetActual ?? ''} onChange={(e) => set('budgetActual', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Lead Consultant</label>
              <select value={form.leadConsultantId || ''} onChange={(e) => set('leadConsultantId', e.target.value)} className={CLS_INPUT}>
                <option value="">-- Keiner --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Beschreibung</label>
              <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={3} className={`${CLS_INPUT} resize-none`} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Kosten Tab ────────────────────────────────────────────────────────────────
function KostenTab({ projectId, timeEntries }) {
  const [materialCosts, setMaterialCosts] = useState([])
  const [expenseReports, setExpenseReports] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/material-costs?projectId=${projectId}`),
      api.get(`/expenses?projectId=${projectId}`),
      api.get(`/activities?projectId=${projectId}`),
    ]).then(([mat, exp, acts]) => {
      setMaterialCosts(mat || [])
      setExpenseReports(exp || [])
      setActivities(acts || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Laden...</div>

  const totalMaterial = materialCosts.reduce((s, i) => s + (i.totalAmount || 0), 0)
  const totalReise = expenseReports.reduce((s, r) => s + (r.totalAmount || 0), 0)
  const billableEntries = (timeEntries || []).filter(e => e.billable)
  const totalBillableHours = billableEntries.reduce((s, e) => s + (e.hours || 0), 0)

  // Group activities by type (Dienste nach Kategorie)
  const diensteByCategory = activities.reduce((acc, a) => {
    const cat = a.type || 'Sonstiges'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(a)
    return acc
  }, {})
  const diensteCategories = Object.entries(diensteByCategory)
    .sort((a, b) => b[1].length - a[1].length)

  const fmtEur = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—'
  const fmtDuration = (min) => {
    if (!min) return '—'
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`
  }

  const STATUS_LABELS = { draft: 'Entwurf', submitted: 'Eingereicht', approved: 'Genehmigt', rejected: 'Abgelehnt' }
  const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-600', submitted: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' }

  const DIENST_COLORS = {
    Meeting: 'bg-blue-100 text-blue-700',
    Call: 'bg-green-100 text-green-700',
    Workshop: 'bg-purple-100 text-purple-700',
    Email: 'bg-indigo-100 text-indigo-700',
    Demo: 'bg-orange-100 text-orange-700',
    Proposal: 'bg-cyan-100 text-cyan-700',
    Negotiation: 'bg-yellow-100 text-yellow-700',
    Note: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Materialkosten</p>
          <p className="text-lg font-semibold text-gray-900">{fmtEur(totalMaterial)}</p>
          <p className="text-xs text-gray-400 mt-1">{materialCosts.length} Einträge</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Reisekosten</p>
          <p className="text-lg font-semibold text-gray-900">{fmtEur(totalReise)}</p>
          <p className="text-xs text-gray-400 mt-1">{expenseReports.length} Berichte</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Fakturierbare Stunden</p>
          <p className="text-lg font-semibold text-gray-900">{totalBillableHours.toFixed(1)} h</p>
          <p className="text-xs text-gray-400 mt-1">{billableEntries.length} Einträge</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Dienste</p>
          <p className="text-lg font-semibold text-gray-900">{activities.length}</p>
          <p className="text-xs text-gray-400 mt-1">{diensteCategories.length} Kategorien</p>
        </div>
      </div>

      {/* Material Costs */}
      {materialCosts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Materialkosten</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Datum</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Beschreibung</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Kategorie</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Betrag</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materialCosts.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{fmtDate(item.date)}</td>
                    <td className="px-4 py-2 text-gray-900">{item.description}</td>
                    <td className="px-4 py-2 text-gray-600">{item.category}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtEur(item.totalAmount)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-600">Gesamt</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{fmtEur(totalMaterial)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Expense Reports */}
      {expenseReports.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Reisekosten</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Titel</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Mitarbeiter</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Zeitraum</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Betrag</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenseReports.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{r.title}</td>
                    <td className="px-4 py-2 text-gray-600">{r.user?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {r.travelStart ? fmtDate(r.travelStart) : '—'}{r.travelEnd ? ` – ${fmtDate(r.travelEnd)}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtEur(r.totalAmount)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-600">Gesamt</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{fmtEur(totalReise)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Billable Time Entries */}
      {billableEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Fakturierbare Stunden (Stundenlohn)</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Datum</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Mitarbeiter</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Beschreibung</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Stunden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billableEntries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2 text-gray-900">{e.user?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{e.description || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{(e.hours || 0).toFixed(1)} h</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-600">Gesamt</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{totalBillableHours.toFixed(1)} h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Dienste nach Kategorie */}
      {diensteCategories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Dienste nach Kategorie</h3>
          <div className="space-y-3">
            {diensteCategories.map(([category, items]) => {
              const totalMin = items.reduce((s, a) => s + (a.duration || 0), 0)
              const totalHours = (totalMin / 60).toFixed(1)
              return (
                <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${DIENST_COLORS[category] || 'bg-gray-100 text-gray-600'}`}>
                        {category}
                      </span>
                      <span className="text-xs text-gray-500">{items.length} Einträge</span>
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {totalMin > 0 ? `${totalHours} h gesamt` : '—'}
                    </span>
                  </div>
                  {/* Activity rows */}
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {items.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500 w-28">{fmtDate(a.date)}</td>
                          <td className="px-4 py-2 text-gray-900 flex-1">{a.summary || a.subject || '—'}</td>
                          <td className="px-4 py-2 text-gray-500 text-right w-24">{fmtDuration(a.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {materialCosts.length === 0 && expenseReports.length === 0 && billableEntries.length === 0 && activities.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">Keine Kostendaten für dieses Projekt.</div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'phases', label: 'Phasen & Meilensteine' },
  { id: 'time', label: 'Zeiterfassung' },
  { id: 'team', label: 'Team' },
  { id: 'activities', label: 'Aktivitäten' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'costs', label: 'Kosten' },
]

function ComplianceMiniTab({ projectId }) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/compliance/checklists/${projectId}`)
      .then((data) => setChecklist(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  async function toggleItem(item) {
    try {
      const updated = await api.put(`/compliance/checklists/${projectId}/items/${item.id}`, { done: !item.done })
      setChecklist((prev) => ({ ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, done: updated.done } : i) }))
    } catch { toast.error('Fehler') }
  }

  if (loading) return <div className="py-4 text-center text-sm text-gray-400">Laden...</div>
  if (!checklist) return null

  const doneCount = checklist.items.filter((i) => i.done).length
  const total = checklist.items.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-700">Compliance-Checkliste</span>
            <span className="text-xs text-gray-400">{doneCount}/{total}</span>
          </div>
          <div className="w-48 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Link href="/compliance" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
          Vollständige Ansicht →
        </Link>
      </div>
      <ul className="space-y-2">
        {checklist.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <button onClick={() => toggleItem(item)} className="shrink-0">
              {item.done
                ? <Check size={18} className="text-green-500" />
                : <div className="w-4.5 h-4.5 border-2 border-gray-300 rounded hover:border-blue-400 transition-colors" style={{width:18,height:18,borderRadius:3}} />
              }
            </button>
            <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [project, setProject] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [ccs, setCcs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEdit, setShowEdit] = useState(false)
  const [statusDropdown, setStatusDropdown] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, te, a, u, centers] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/time-entries`),
        api.get('/accounts'),
        api.get('/users'),
        api.get('/admin/ccs'),
      ])
      setProject(p)
      setTimeEntries(te?.entries || [])
      setAccounts(Array.isArray(a) ? a : (a?.data || []))
      setUsers(Array.isArray(u) ? u : (u?.data || []))
      setCcs(Array.isArray(centers) ? centers : (centers?.data || []))
    } catch (err) {
      toast.error('Fehler beim Laden des Projekts')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function changeStatus(newStatus) {
    setSavingStatus(true)
    setStatusDropdown(false)
    try {
      const updated = await api.put(`/projects/${id}`, { status: newStatus })
      setProject(updated)
      toast.success(`Status: ${newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Projekt wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Projekt nicht gefunden.</p>
        <button onClick={() => router.push('/projects')} className="mt-4 text-blue-600 hover:underline text-sm">
          Zurück zu Projekten
        </button>
      </div>
    )
  }

  const statusStyle = STATUS_STYLES[project.status] || 'bg-gray-100 text-gray-600 border-gray-200'
  const typeStyle = TYPE_STYLES[project.projectType] || 'bg-gray-100 text-gray-600'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/projects')}
              className="mt-0.5 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                {project.projectType && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeStyle}`}>
                    {project.projectType}
                  </span>
                )}
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdown((v) => !v)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border cursor-pointer hover:opacity-80 transition-opacity ${statusStyle}`}
                    disabled={savingStatus}
                  >
                    {project.status}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {statusDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[150px] overflow-hidden">
                      {PROJECT_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => changeStatus(s)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${s === project.status ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.account && (
                <Link href={`/accounts/${project.accountId}`} className="text-sm text-blue-600 hover:underline mt-0.5 inline-block">
                  {project.account.companyName}
                </Link>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            <Edit2 className="w-4 h-4" /> Bearbeiten
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-200 px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex-shrink-0 px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'overview' && (
            <OverviewTab project={project} timeEntries={timeEntries} />
          )}
          {activeTab === 'phases' && (
            <PhasesTab projectId={id} />
          )}
          {activeTab === 'time' && (
            <TimeTrackingTab
              projectId={id}
              timeEntries={timeEntries}
              setTimeEntries={setTimeEntries}
              users={users}
              currentUser={getUser()}
            />
          )}
          {activeTab === 'team' && (
            <TeamTab projectId={id} users={users} />
          )}
          {activeTab === 'activities' && (
            <ActivitiesTab projectId={id} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab projectId={id} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab projectId={id} />
          )}
          {activeTab === 'compliance' && (
            <ComplianceMiniTab projectId={id} />
          )}
          {activeTab === 'costs' && (
            <KostenTab projectId={id} timeEntries={timeEntries} />
          )}
        </div>
      </div>

      <EditProjectModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        project={project}
        onSaved={setProject}
        accounts={accounts}
        users={users}
        ccs={ccs}
      />

      {statusDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(false)} />
      )}
    </div>
  )
}

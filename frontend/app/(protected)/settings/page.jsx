'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Trash2,
  Edit,
  X,
  Check,
  BookOpen,
  Users,
  ChevronDown,
  Link2,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  Brain,
  Zap,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { getUser } from '@/lib/auth'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'

const SERVICE_CATEGORIES = ['Strategy', 'Regulation', 'IT', 'Risk', 'Other']
const SERVICE_CATEGORY_LABELS = {
  Strategy: 'Strategie',
  Regulation: 'Regulierung',
  IT: 'IT',
  Risk: 'Risiko',
  Other: 'Sonstige',
}
const UNIT_OPTIONS = [
  { value: 'day', label: 'Tag' },
  { value: 'hour', label: 'Stunde' },
  { value: 'fixed', label: 'Pauschal' },
]

const ROLE_LABELS = {
  admin: 'Administrator',
  consultant: 'Berater',
  manager: 'Manager',
  viewer: 'Betrachter',
}

function ServiceForm({ initialData, onSave, onCancel, saving }) {
  const [form, setForm] = useState(
    initialData || {
      name: '',
      category: 'Strategy',
      description: '',
      dayRate: '',
      fixedFee: '',
      unit: 'day',
    }
  )

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Dienstname ist erforderlich.')
      return
    }
    onSave({
      ...form,
      dayRate: form.dayRate ? parseFloat(form.dayRate) : null,
      fixedFee: form.fixedFee ? parseFloat(form.fixedFee) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="z.B. Risikobewertung"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategorie
          </label>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {SERVICE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Beschreibung (optional)
        </label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tagessatz (€)
          </label>
          <input
            type="number"
            value={form.dayRate}
            onChange={(e) => update('dayRate', e.target.value)}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pauschalpreis (€)
          </label>
          <input
            type="number"
            value={form.fixedFee}
            onChange={(e) => update('fixedFee', e.target.value)}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Einheit
          </label>
          <select
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Speichern...' : initialData?.id ? 'Aktualisieren' : 'Erstellen'}
        </button>
      </div>
    </form>
  )
}

function ServiceCatalogTab() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get('/proposals/services')
      setServices(Array.isArray(data) ? data : data.services || [])
    } catch (err) {
      toast.error('Dienste konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleCreate = async (formData) => {
    setSaving(true)
    try {
      const result = await api.post('/proposals/services', formData)
      toast.success('Dienst erstellt.')
      setServices((prev) => [...prev, result])
      setShowCreateForm(false)
    } catch (err) {
      toast.error('Dienst konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (formData) => {
    if (!editingId) return
    setSaving(true)
    try {
      const result = await api.put(`/proposals/services/${editingId}`, formData)
      toast.success('Dienst aktualisiert.')
      setServices((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...result } : s))
      )
      setEditingId(null)
    } catch (err) {
      toast.error('Dienst konnte nicht aktualisiert werden.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/proposals/services/${id}`)
      toast.success('Dienst gelöscht.')
      setServices((prev) => prev.filter((s) => s.id !== id))
      setDeleteId(null)
    } catch (err) {
      toast.error('Dienst konnte nicht gelöscht werden.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {services.length} Dienste im Katalog
        </p>
        <button
          onClick={() => {
            setShowCreateForm(true)
            setEditingId(null)
          }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Dienst hinzufügen
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">
            Neuer Dienst
          </h3>
          <ServiceForm
            onSave={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            saving={saving}
          />
        </div>
      )}

      {services.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Kein Dienstkatalog"
          description="Fügen Sie Ihren ersten Dienst hinzu."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Tagessatz</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Pauschal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Einheit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((service) => (
                <>
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{service.name}</p>
                      {service.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">
                          {service.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="gray">
                        {SERVICE_CATEGORY_LABELS[service.category] || service.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {service.dayRate ? formatCurrency(service.dayRate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {service.fixedFee ? formatCurrency(service.fixedFee) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {UNIT_OPTIONS.find((u) => u.value === service.unit)?.label ||
                        service.unit ||
                        '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(service.id)
                            setShowCreateForm(false)
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(service.id)}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === service.id && (
                    <tr key={`edit-${service.id}`}>
                      <td colSpan={6} className="px-4 py-4 bg-yellow-50 border-b border-yellow-100">
                        <h4 className="text-sm font-semibold text-yellow-900 mb-3">
                          Dienst bearbeiten
                        </h4>
                        <ServiceForm
                          initialData={service}
                          onSave={handleUpdate}
                          onCancel={() => setEditingId(null)}
                          saving={saving}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Dienst löschen"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Möchten Sie diesen Dienst wirklich aus dem Katalog entfernen?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={() => handleDelete(deleteId)}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Löschen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.get('/users')
        setUsers(Array.isArray(data) ? data : data.users || [])
      } catch (err) {
        toast.error('Benutzer konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Keine Benutzer"
        description="Es sind keine Benutzer vorhanden."
      />
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">E-Mail</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Rolle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-blue-600">
                      {user.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                <Badge variant={user.role === 'admin' ? 'blue' : 'gray'}>
                  {ROLE_LABELS[user.role] || user.role || '—'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConnectionsTab() {
  const [status, setStatus] = useState({ google: false, microsoft: false })
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState('')

  useEffect(() => {
    api.get('/oauth/status')
      .then((data) => setStatus(data || { google: false, microsoft: false }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Check for connection result from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) {
      toast.success(`${connected === 'google' ? 'Google' : 'Microsoft'} erfolgreich verbunden!`)
      setStatus((prev) => ({ ...prev, [connected]: true }))
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (error) {
      toast.error(`Verbindung fehlgeschlagen: ${error}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleDisconnect = async (provider) => {
    if (!confirm(`${provider === 'google' ? 'Google' : 'Microsoft'} trennen?`)) return
    setDisconnecting(provider)
    try {
      await api.delete(`/oauth/${provider}/disconnect`)
      setStatus((prev) => ({ ...prev, [provider]: false }))
      toast.success(`${provider === 'google' ? 'Google' : 'Microsoft'} getrennt.`)
    } catch {
      toast.error('Trennen fehlgeschlagen.')
    } finally {
      setDisconnecting('')
    }
  }

  const handleConnect = (provider) => {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'
    const user = getUser()
    // State param carries userId for the callback to upsert the token
    window.location.href = `${base}/api/oauth/${provider}/connect?userId=${user?.id || ''}`
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  const connections = [
    {
      id: 'google',
      name: 'Google',
      description: 'Gmail (Email-Sync) + Google Kalender',
      icon: Mail,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      id: 'microsoft',
      name: 'Microsoft 365',
      description: 'Outlook (Email-Sync) + Microsoft Kalender',
      icon: Calendar,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Verbinden Sie Ihre E-Mail- und Kalenderkonten, um Aktivitäten zu synchronisieren und Aufgaben in Ihren Kalender zu exportieren.
      </p>
      {connections.map((conn) => {
        const Icon = conn.icon
        const connected = status[conn.id]
        return (
          <div
            key={conn.id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${conn.bgColor} shrink-0`}>
                <Icon className={`w-6 h-6 ${conn.iconColor}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{conn.name}</p>
                <p className="text-sm text-gray-500">{conn.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {connected ? (
                <>
                  <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Verbunden
                  </span>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={disconnecting === conn.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {disconnecting === conn.id ? 'Trenne...' : 'Trennen'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleConnect(conn.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Link2 className="w-4 h-4" />
                  Mit {conn.name} verbinden
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        <strong>Hinweis:</strong> Stellen Sie sicher, dass die OAuth2-Zugangsdaten in der Backend-Konfiguration (<code>.env</code>) hinterlegt sind, bevor Sie eine Verbindung herstellen.
      </div>
    </div>
  )
}

const GROUP_META = [
  { key: 'institutionTypes',     label: 'Institutions-Typen',          description: 'Account-Klassifizierung', badge: 'bg-blue-100 text-blue-700' },
  { key: 'regulatoryFrameworks', label: 'Regulatorische Rahmen',        description: 'Auf Accounts anwendbar',   badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'projectTypes',         label: 'Projekttypen',                 description: null,                       badge: 'bg-purple-100 text-purple-700' },
  { key: 'projectStatuses',      label: 'Projektstatus',                description: null,                       badge: 'bg-green-100 text-green-700' },
  { key: 'dealServiceTypes',     label: 'Deal Service-Typen',           description: 'Für Deals & Pipeline',     badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'crossSellingTypes',    label: 'Cross-Selling Service-Typen',  description: 'Service-Matrix & White Space', badge: 'bg-teal-100 text-teal-700' },
  { key: 'dealStages',           label: 'Deal-Phasen',                  description: null,                       badge: 'bg-amber-100 text-amber-700' },
  { key: 'dealSources',          label: 'Deal-Quellen',                 description: null,                       badge: 'bg-orange-100 text-orange-700' },
  { key: 'lossReasons',          label: 'Deal-Verlustgründe',           description: null,                       badge: 'bg-red-100 text-red-700' },
  { key: 'activityTypes',        label: 'Aktivitätstypen',              description: null,                       badge: 'bg-sky-100 text-sky-700' },
  { key: 'taskPriorities',       label: 'Aufgaben-Prioritäten',         description: null,                       badge: 'bg-rose-100 text-rose-700' },
  { key: 'taskStatuses',         label: 'Aufgaben-Status',              description: null,                       badge: 'bg-violet-100 text-violet-700' },
  { key: 'proposalStatuses',     label: 'Angebots-Status',              description: null,                       badge: 'bg-fuchsia-100 text-fuchsia-700' },
  { key: 'leaveTypes',           label: 'Abwesenheitstypen',            description: null,                       badge: 'bg-pink-100 text-pink-700' },
  { key: 'serviceCategories',    label: 'Dienstkatalog-Kategorien',     description: 'Für den Angebots-Katalog', badge: 'bg-gray-100 text-gray-700' },
]

// ── Single group card with inline CRUD ───────────────────────────────────────
function CategoryGroupCard({ groupKey, label, description, badge, items, onAdd, onRename, onDelete }) {
  const [newValue, setNewValue]   = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving]       = useState(false)

  async function handleAdd() {
    const v = newValue.trim()
    if (!v) return
    setSaving(true)
    try {
      await onAdd(groupKey, v)
      setNewValue('')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditValue(item.value)
  }

  async function handleRename(id) {
    const v = editValue.trim()
    if (!v) return
    try {
      await onRename(id, v)
      setEditingId(null)
    } catch (err) {
      toast.error(err.message || 'Fehler')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>

      {/* Value chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {items.length === 0 && <p className="text-xs text-gray-400 italic">Keine Einträge</p>}
        {items.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="flex items-center gap-1">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  handleRename(item.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="px-2 py-0.5 border border-blue-400 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={() => handleRename(item.id)} className="text-green-600 hover:text-green-700" title="Speichern">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600" title="Abbrechen">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span key={item.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge}`}>
              <span
                className="cursor-pointer hover:underline"
                title="Klicken zum Bearbeiten"
                onClick={() => startEdit(item)}
              >
                {item.value}
              </span>
              <button
                onClick={() => onDelete(item.id)}
                className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                title="Löschen"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )
        )}
      </div>

      {/* Add new value */}
      <div className="flex gap-1.5 items-center pt-1 border-t border-gray-100">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Neuen Wert hinzufügen..."
          className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newValue.trim()}
          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 shrink-0"
          title="Hinzufügen"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function CategoriesTab() {
  const [sysCats, setSysCats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/settings/categories')
      .then((data) => setSysCats(data || {}))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  // ── System category handlers ──
  async function handleSysAdd(group, value) {
    const item = await api.post(`/settings/categories/${group}`, { value })
    setSysCats((prev) => ({ ...prev, [group]: [...(prev[group] || []), item] }))
    toast.success('Hinzugefügt')
  }

  async function handleSysRename(id, value) {
    const item = await api.put(`/settings/categories/${id}`, { value })
    setSysCats((prev) => {
      const next = {}
      for (const [g, items] of Object.entries(prev)) {
        next[g] = items.map((i) => (i.id === id ? { ...i, value: item.value } : i))
      }
      return next
    })
    toast.success('Aktualisiert')
  }

  async function handleSysDelete(id) {
    await api.delete(`/settings/categories/${id}`)
    setSysCats((prev) => {
      const next = {}
      for (const [g, items] of Object.entries(prev)) {
        next[g] = items.filter((i) => i.id !== id)
      }
      return next
    })
    toast.success('Gelöscht')
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-8">

      {/* ── System-Kategorien (DB-backed, fully editable) ── */}
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">System-Kategorien</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Klicken Sie auf einen Wert zum Bearbeiten · ✕ zum Löschen · Eingabe + Enter zum Hinzufügen
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{GROUP_META.map((g) => (
            <CategoryGroupCard
              key={g.key}
              groupKey={g.key}
              label={g.label}
              description={g.description}
              badge={g.badge}
              items={sysCats[g.key] || []}
              onAdd={handleSysAdd}
              onRename={handleSysRename}
              onDelete={handleSysDelete}
            />
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── LLM Tab ──────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: 'openai',       label: 'OpenAI',        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'azure_openai', label: 'Azure OpenAI',  models: [] },
  { value: 'claude',       label: 'Claude (Anthropic)', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  { value: 'gemini',       label: 'Gemini (Google)', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
]

const PROVIDER_COLORS = {
  openai:       'bg-green-100 text-green-700',
  azure_openai: 'bg-blue-100 text-blue-700',
  claude:       'bg-violet-100 text-violet-700',
  gemini:       'bg-amber-100 text-amber-700',
}

const EMPTY_FORM = { provider: 'openai', name: '', apiKey: '', model: '', endpoint: '', deploymentName: '', apiVersion: '2024-02-01' }

function LlmForm({ initial, onSave, onCancel }) {
  const [form, setForm]         = useState(initial || EMPTY_FORM)
  const [showKey, setShowKey]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const provider = PROVIDERS.find(p => p.value === form.provider) || PROVIDERS[0]
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.apiKey.trim()) {
      toast.error('Name und API-Schlüssel sind pflicht')
      return
    }
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Provider *</label>
          <select value={form.provider} onChange={e => set('provider', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Anzeigename *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. GPT-4o Produktion"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">API-Schlüssel *</label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={form.apiKey} onChange={e => set('apiKey', e.target.value)}
            placeholder="sk-..." className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={() => setShowKey(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {form.provider === 'azure_openai' ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Endpoint URL *</label>
            <input value={form.endpoint} onChange={e => set('endpoint', e.target.value)}
              placeholder="https://xxx.openai.azure.com/"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Version</label>
            <input value={form.apiVersion} onChange={e => set('apiVersion', e.target.value)}
              placeholder="2024-02-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Deployment Name *</label>
            <input value={form.deploymentName} onChange={e => set('deploymentName', e.target.value)}
              placeholder="gpt-4o-deployment"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Modell</label>
          <select value={form.model} onChange={e => set('model', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Standard</option>
            {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Speichern...' : initial ? 'Aktualisieren' : 'Verbindung anlegen'}
        </button>
      </div>
    </form>
  )
}

function LlmTab() {
  const [configs, setConfigs]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [testing, setTesting]   = useState({})
  const [testResults, setTestResults] = useState({})
  const [deletingId, setDeletingId]   = useState(null)

  useEffect(() => {
    api.get('/settings/llm')
      .then(data => setConfigs(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(form) {
    const cfg = await api.post('/settings/llm', form)
    setConfigs(prev => [...prev, cfg])
    setShowForm(false)
    toast.success('Verbindung angelegt')
  }

  async function handleUpdate(form) {
    const cfg = await api.put(`/settings/llm/${editId}`, form)
    setConfigs(prev => prev.map(c => c.id === editId ? cfg : c))
    setEditId(null)
    toast.success('Verbindung aktualisiert')
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/settings/llm/${id}`)
      setConfigs(prev => prev.filter(c => c.id !== id))
      setDeletingId(null)
      toast.success('Verbindung gelöscht')
    } catch { toast.error('Fehler beim Löschen') }
  }

  async function handleActivate(id) {
    try {
      const cfg = await api.post(`/settings/llm/${id}/activate`, {})
      setConfigs(prev => prev.map(c => ({ ...c, isActive: c.id === id })))
      toast.success(`"${cfg.name}" ist jetzt aktiv`)
    } catch { toast.error('Fehler beim Aktivieren') }
  }

  async function handleTest(id) {
    setTesting(prev => ({ ...prev, [id]: true }))
    setTestResults(prev => ({ ...prev, [id]: null }))
    try {
      const res = await api.post(`/settings/llm/${id}/test`, {})
      setTestResults(prev => ({ ...prev, [id]: { ok: true, text: res.response } }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, text: err.message } }))
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }))
    }
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{configs.length} Verbindung{configs.length !== 1 ? 'en' : ''} konfiguriert</p>
          {!configs.some(c => c.isActive) && configs.length > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Keine Verbindung aktiv — KI-Funktionen sind deaktiviert
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditId(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Neue Verbindung
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && !editId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">Neue KI-Verbindung</h3>
          <LlmForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Config cards */}
      {configs.length === 0 && !showForm ? (
        <div className="py-16 text-center">
          <Brain className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Noch keine KI-Verbindung konfiguriert</p>
          <p className="text-xs text-gray-300 mt-1">Legen Sie eine Verbindung zu OpenAI, Azure, Claude oder Gemini an</p>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => {
            const provLabel = PROVIDERS.find(p => p.value === cfg.provider)?.label || cfg.provider
            const result    = testResults[cfg.id]
            return (
              <div key={cfg.id} className={`bg-white rounded-xl border-2 p-5 ${cfg.isActive ? 'border-green-400' : 'border-gray-200'}`}>
                {editId === cfg.id ? (
                  <>
                    <h4 className="text-sm font-semibold text-gray-800 mb-4">Verbindung bearbeiten</h4>
                    <LlmForm
                      initial={{ ...cfg, apiKey: '' }}
                      onSave={handleUpdate}
                      onCancel={() => setEditId(null)}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Brain className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{cfg.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PROVIDER_COLORS[cfg.provider] || 'bg-gray-100 text-gray-600'}`}>
                              {provLabel}
                            </span>
                            {cfg.isActive && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                <Zap className="w-3 h-3" /> Aktiv
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {cfg.model || cfg.deploymentName || 'Standard-Modell'} · API-Key: {cfg.apiKey}
                          </p>
                          {cfg.endpoint && <p className="text-xs text-gray-400">{cfg.endpoint}</p>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!cfg.isActive && (
                          <button onClick={() => handleActivate(cfg.id)}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors">
                            Aktivieren
                          </button>
                        )}
                        <button onClick={() => handleTest(cfg.id)} disabled={testing[cfg.id]}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50">
                          {testing[cfg.id] ? 'Teste...' : 'Testen'}
                        </button>
                        <button onClick={() => { setEditId(cfg.id); setShowForm(false) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Bearbeiten">
                          <Edit className="w-4 h-4" />
                        </button>
                        {deletingId === cfg.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(cfg.id)} className="text-xs text-red-600 font-medium hover:underline">Löschen</button>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400 hover:underline">Abbrechen</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(cfg.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Löschen">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Test result */}
                    {result && (
                      <div className={`mt-3 p-3 rounded-lg text-xs ${result.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        <div className="flex items-center gap-1.5 font-medium mb-1">
                          {result.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {result.ok ? 'Verbindung erfolgreich' : 'Verbindung fehlgeschlagen'}
                        </div>
                        <p className="italic">{result.text}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {configs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
          <strong>Hinweis:</strong> Nur eine Verbindung kann gleichzeitig aktiv sein. Die aktive Verbindung wird von allen KI-Funktionen im System verwendet (KI-Opportunities, News-Monitoring).
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'catalog',     label: 'Dienstkatalog', icon: BookOpen },
  { id: 'users',       label: 'Benutzer',       icon: Users },
  { id: 'categories',  label: 'Kategorien',     icon: ChevronDown },
  { id: 'connections', label: 'Verbindungen',   icon: Link2 },
  { id: 'llm',         label: 'KI-Verbindung',  icon: Brain },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('catalog')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Systemkonfiguration und Verwaltung
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'catalog' && <ServiceCatalogTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
      {activeTab === 'llm' && <LlmTab />}
    </div>
  )
}

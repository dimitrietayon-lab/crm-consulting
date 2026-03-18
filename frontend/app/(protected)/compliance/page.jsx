'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Shield,
  FileText,
  ClipboardList,
  Activity,
  UserX,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

const TABS = [
  { id: 'ndas', label: 'NDA-Register', icon: FileText },
  { id: 'checklists', label: 'Checklisten', icon: ClipboardList },
  { id: 'audit', label: 'Audit-Log', icon: Activity },
  { id: 'gdpr', label: 'GDPR', icon: UserX },
]

function ndaStatus(nda) {
  if (!nda.expiryDate) return { label: 'Aktiv', variant: 'success' }
  const now = new Date()
  const exp = new Date(nda.expiryDate)
  if (exp < now) return { label: 'Abgelaufen', variant: 'danger' }
  const diff = (exp - now) / (1000 * 60 * 60 * 24)
  if (diff <= 60) return { label: 'Läuft ab', variant: 'warning' }
  return { label: 'Aktiv', variant: 'success' }
}

const VARIANT_CLASSES = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

// ─── NDA Register ───────────────────────────────────────────────────────────

function NDATab() {
  const [ndas, setNdas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ accountId: '', signingDate: '', expiryDate: '', scope: '', signatoryClient: '', signatoryUs: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/compliance/ndas'),
      api.get('/accounts'),
    ]).then(([ndaData, accData]) => {
      setNdas(Array.isArray(ndaData) ? ndaData : [])
      const accs = accData?.accounts || accData || []
      setAccounts(Array.isArray(accs) ? accs : [])
    }).catch(() => toast.error('Fehler beim Laden')).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.accountId) return toast.error('Account erforderlich')
    setSaving(true)
    try {
      const created = await api.post(`/accounts/${form.accountId}/ndas`, {
        signingDate: form.signingDate || null,
        expiryDate: form.expiryDate || null,
        scope: form.scope || null,
        signatoryClient: form.signatoryClient || null,
        signatoryUs: form.signatoryUs || null,
      })
      setNdas((prev) => [created?.nda || created, ...prev])
      setShowForm(false)
      setForm({ accountId: '', signingDate: '', expiryDate: '', scope: '', signatoryClient: '', signatoryUs: '' })
      toast.success('NDA erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{ndas.length} NDAs gesamt</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} /> NDA hinzufügen
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
          <h3 className="font-semibold text-blue-900 text-sm">Neues NDA</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Account *</label>
              <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" required>
                <option value="">Bitte wählen...</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unterzeichnungsdatum</label>
              <input type="date" value={form.signingDate} onChange={(e) => setForm((f) => ({ ...f, signingDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ablaufdatum</label>
              <input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unterzeichner (Kunde)</label>
              <input type="text" value={form.signatoryClient} onChange={(e) => setForm((f) => ({ ...f, signatoryClient: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unterzeichner (Wir)</label>
              <input type="text" value={form.signatoryUs} onChange={(e) => setForm((f) => ({ ...f, signatoryUs: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Name" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Umfang / Notiz</label>
              <input type="text" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Abbrechen</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Erstellen'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Unterzeichnet</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Läuft ab</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Umfang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ndas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Keine NDAs vorhanden</td></tr>
            ) : ndas.map((nda) => {
              const { label, variant } = ndaStatus(nda)
              return (
                <tr key={nda.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{nda.account?.companyName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{nda.signingDate ? formatDate(nda.signingDate) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{nda.expiryDate ? formatDate(nda.expiryDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
                      {label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{nda.scope || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Checklisten ─────────────────────────────────────────────────────────────

function ChecklistTab() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  useEffect(() => {
    api.get('/projects').then((data) => {
      const list = data?.projects || data || []
      setProjects(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  async function loadChecklist(projectId) {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await api.get(`/compliance/checklists/${projectId}`)
      setChecklist(data)
    } catch (err) {
      toast.error('Fehler beim Laden der Checkliste')
    } finally {
      setLoading(false)
    }
  }

  async function toggleItem(item) {
    try {
      const updated = await api.put(`/compliance/checklists/${selectedProjectId}/items/${item.id}`, { done: !item.done })
      setChecklist((prev) => ({ ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, done: updated.done } : i) }))
    } catch {
      toast.error('Fehler')
    }
  }

  async function deleteItem(itemId) {
    try {
      await api.delete(`/compliance/checklists/${selectedProjectId}/items/${itemId}`)
      setChecklist((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }))
    } catch {
      toast.error('Fehler')
    }
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItemName.trim()) return
    setAddingItem(true)
    try {
      const item = await api.post(`/compliance/checklists/${selectedProjectId}/items`, { name: newItemName.trim() })
      setChecklist((prev) => ({ ...prev, items: [...prev.items, item] }))
      setNewItemName('')
    } catch {
      toast.error('Fehler')
    } finally {
      setAddingItem(false)
    }
  }

  const doneCount = checklist?.items?.filter((i) => i.done).length || 0
  const total = checklist?.items?.length || 0
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Projekt auswählen</label>
        <select
          value={selectedProjectId}
          onChange={(e) => {
            setSelectedProjectId(e.target.value)
            setChecklist(null)
            loadChecklist(e.target.value)
          }}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Projekt wählen...</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading && <div className="py-8 text-center text-gray-500">Laden...</div>}

      {checklist && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Fortschritt</span>
              <span className="text-sm text-gray-500">{doneCount}/{total} ({progress}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Items */}
          <ul className="space-y-2">
            {checklist.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 group">
                <button onClick={() => toggleItem(item)} className="shrink-0">
                  {item.done
                    ? <CheckCircle2 size={20} className="text-green-500" />
                    : <Circle size={20} className="text-gray-300 hover:text-blue-400 transition-colors" />
                  }
                </button>
                <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.name}</span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          {/* Add item */}
          <form onSubmit={addItem} className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Neuer Prüfpunkt..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={addingItem || !newItemName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus size={15} />
            </button>
          </form>
        </div>
      )}

      {!checklist && !loading && selectedProjectId && (
        <div className="py-8 text-center text-gray-400">Keine Checkliste gefunden</div>
      )}
      {!selectedProjectId && (
        <div className="py-12 text-center text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
          <p>Bitte wählen Sie ein Projekt aus</p>
        </div>
      )}
    </div>
  )
}

// ─── Audit-Log ────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadLogs()
  }, [page, entity])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (entity) params.append('entity', entity)
      const data = await api.get(`/compliance/audit-log?${params}`)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  const ENTITY_OPTIONS = ['Account', 'Contact', 'Deal', 'Project', 'Proposal', 'NDA']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={entity}
          onChange={(e) => { setEntity(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle Entitäten</option>
          {ENTITY_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total} Einträge</span>
        <button onClick={loadLogs} className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Zeitpunkt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aktion</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Entität</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Laden...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Keine Einträge</td></tr>
            ) : logs.map((log) => (
              <>
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.entity}</td>
                  <td className="px-4 py-3">
                    {log.changes && (
                      <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {expanded === log.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Änderungen
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === log.id && log.changes && (
                  <tr key={`${log.id}-exp`} className="bg-gray-50">
                    <td colSpan={4} className="px-4 py-3">
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 bg-white border border-gray-200 rounded p-3">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Zurück
          </button>
          <span className="text-sm text-gray-600">Seite {page} von {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  )
}

// ─── GDPR ─────────────────────────────────────────────────────────────────────

function GdprTab() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [anonymizing, setAnonymizing] = useState(null)

  useEffect(() => {
    api.get('/compliance/gdpr-contacts')
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleFlag(contact, flag) {
    try {
      const updated = await api.put(`/compliance/gdpr-contacts/${contact.id}`, {
        [flag]: !contact[flag],
      })
      setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, [flag]: updated[flag] } : c))
    } catch {
      toast.error('Fehler')
    }
  }

  async function anonymize(contact) {
    if (!confirm(`"${contact.name}" wirklich anonymisieren? Dies ist nicht rückgängig zu machen.`)) return
    setAnonymizing(contact.id)
    try {
      await api.post(`/compliance/gdpr-contacts/${contact.id}/anonymize`, {})
      setContacts((prev) => prev.filter((c) => c.id !== contact.id))
      toast.success('Kontakt anonymisiert')
    } catch {
      toast.error('Fehler')
    } finally {
      setAnonymizing(null)
    }
  }

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <AlertTriangle size={16} className="shrink-0" />
        <span>Diese Ansicht zeigt Kontakte mit aktiven GDPR-Flags. Anonymisieren löscht personenbezogene Daten unwiderruflich.</span>
      </div>

      {contacts.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <UserX size={40} className="mx-auto mb-3 text-gray-200" />
          <p>Keine Kontakte mit GDPR-Flags</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Unternehmen</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Löschanfrage</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Eingeschränkt</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{contact.name}</p>
                    {contact.email && <p className="text-xs text-gray-400">{contact.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contact.accounts?.[0]?.account?.companyName || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleFlag(contact, 'gdprDeleteRequested')}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        contact.gdprDeleteRequested ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {contact.gdprDeleteRequested ? 'Ja' : 'Nein'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleFlag(contact, 'gdprRestrictedProcessing')}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        contact.gdprRestrictedProcessing ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {contact.gdprRestrictedProcessing ? 'Ja' : 'Nein'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => anonymize(contact)}
                      disabled={anonymizing === contact.id}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {anonymizing === contact.id ? '...' : 'Anonymisieren'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState('ndas')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-500">NDA-Verwaltung, Checklisten, Audit-Log & GDPR</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'ndas' && <NDATab />}
      {activeTab === 'checklists' && <ChecklistTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'gdpr' && <GdprTab />}
    </div>
  )
}

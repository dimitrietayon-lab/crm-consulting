'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatNumber, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Building2,
  Star,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  X,
} from 'lucide-react'
import AccountForm from '@/components/accounts/AccountForm'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const INSTITUTION_TYPES = [
  'Private Bank',
  'Savings Bank',
  'Cooperative Bank',
  'Investment Bank',
  'Digital Bank',
  'Insurance (Life)',
  'Insurance (Non-Life)',
  'Reinsurance',
  'Health Insurance',
  'Fintech',
  'Asset Manager',
  'Other',
]

const INSTITUTION_COLORS = {
  'Private Bank': 'bg-blue-100 text-blue-800',
  'Savings Bank': 'bg-sky-100 text-sky-800',
  'Cooperative Bank': 'bg-cyan-100 text-cyan-800',
  'Investment Bank': 'bg-indigo-100 text-indigo-800',
  'Digital Bank': 'bg-violet-100 text-violet-800',
  'Insurance (Life)': 'bg-purple-100 text-purple-800',
  'Insurance (Non-Life)': 'bg-fuchsia-100 text-fuchsia-800',
  Reinsurance: 'bg-pink-100 text-pink-800',
  'Health Insurance': 'bg-rose-100 text-rose-800',
  Fintech: 'bg-emerald-100 text-emerald-800',
  'Asset Manager': 'bg-teal-100 text-teal-800',
  Other: 'bg-gray-100 text-gray-700',
}

function SegmenteTab({ onFilterType }) {
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/segments/analytics')
      .then((data) => setSegments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{segments.length} Segmente · Klicken Sie auf ein Segment, um die Account-Liste zu filtern</p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {segments.map((seg) => (
          <button
            key={seg.segment}
            onClick={() => onFilterType(seg.segment)}
            className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-3 ${INSTITUTION_COLORS[seg.segment] || 'bg-gray-100 text-gray-700'}`}>
              {seg.segment}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Clients</span>
                <span className="text-sm font-semibold text-gray-900">{seg.count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Pipeline</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(seg.pipelineValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Akt. Projekte</span>
                <span className="text-sm font-semibold text-gray-900">{seg.activeProjects}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterKeyAccount, setFilterKeyAccount] = useState(false)
  const [activeTab, setActiveTab] = useState('list')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [editTarget, setEditTarget] = useState(null)
  const [editing, setEditing] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadAccounts()
    loadUsers()
  }, [])

  async function loadAccounts() {
    try {
      setLoading(true)
      const data = await api.get('/accounts')
      setAccounts(data?.accounts || data || [])
    } catch (err) {
      toast.error('Fehler beim Laden der Accounts')
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers() {
    try {
      const data = await api.get('/users')
      setUsers(data?.users || data || [])
    } catch {
      // non-critical
    }
  }

  async function handleCreate(payload) {
    try {
      setCreating(true)
      const created = await api.post('/accounts', payload)
      setAccounts((prev) => [created?.account || created, ...prev])
      setCreateOpen(false)
      toast.success('Account erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen')
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(payload) {
    try {
      setEditing(true)
      const id = editTarget.id || editTarget._id
      const updated = await api.put(`/accounts/${id}`, payload)
      setAccounts((prev) =>
        prev.map((a) => (a.id === id || a._id === id ? (updated?.account || updated) : a))
      )
      setEditTarget(null)
      toast.success('Account aktualisiert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Aktualisieren')
    } finally {
      setEditing(false)
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      const id = deleteTarget.id || deleteTarget._id
      await api.delete(`/accounts/${id}`)
      setAccounts((prev) => prev.filter((a) => a.id !== id && a._id !== id))
      setDeleteTarget(null)
      toast.success('Account gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (search && !a.companyName?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterType && a.institutionType !== filterType) return false
      if (filterCountry && !a.country?.toLowerCase().includes(filterCountry.toLowerCase())) return false
      if (filterKeyAccount && !a.isKeyAccount) return false
      return true
    })
  }, [accounts, search, filterType, filterCountry, filterKeyAccount])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-500">{accounts.length} Unternehmen</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Account
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[{ id: 'list', label: 'Account-Liste' }, { id: 'segments', label: 'Segmente' }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'segments' && (
        <SegmenteTab onFilterType={(type) => { setFilterType(type); setActiveTab('list') }} />
      )}

      {activeTab === 'list' && (<>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Firmenname suchen..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700"
            >
              <option value="">Alle Typen</option>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <input
            type="text"
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            placeholder="Land filtern..."
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterKeyAccount}
              onChange={(e) => setFilterKeyAccount(e.target.checked)}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <Star size={14} className="text-amber-500" />
            <span className="text-gray-700">Nur Key Accounts</span>
          </label>

          {(search || filterType || filterCountry || filterKeyAccount) && (
            <button
              onClick={() => {
                setSearch('')
                setFilterType('')
                setFilterCountry('')
                setFilterKeyAccount(false)
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <X size={12} /> Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Accounts werden geladen...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Keine Accounts gefunden</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || filterType || filterCountry || filterKeyAccount
                ? 'Versuchen Sie andere Filterkriterien'
                : 'Erstellen Sie Ihren ersten Account'}
            </p>
            {!search && !filterType && !filterCountry && !filterKeyAccount && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Ersten Account erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Unternehmen
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Land
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rahmenwerke
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    AuM (Mio. €)
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Consultant
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((account) => {
                  const id = account.id || account._id
                  const frameworks = account.regulatoryFrameworks || []
                  const shown = frameworks.slice(0, 3)
                  const rest = frameworks.length - shown.length
                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors group">
                      {/* Company name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/accounts/${id}`}
                            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {account.companyName}
                          </Link>
                          {account.isKeyAccount && (
                            <Star
                              size={14}
                              className="text-amber-500 fill-amber-500 flex-shrink-0"
                              title="Key Account"
                            />
                          )}
                        </div>
                        {account.website && (
                          <a
                            href={account.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-blue-500 truncate block max-w-[200px]"
                          >
                            {account.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </td>

                      {/* Institution type */}
                      <td className="px-4 py-3">
                        {account.institutionType ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              INSTITUTION_COLORS[account.institutionType] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {account.institutionType}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3 text-gray-700">
                        {account.country || <span className="text-gray-400">—</span>}
                      </td>

                      {/* Frameworks */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {shown.map((fw) => (
                            <span
                              key={fw}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium"
                            >
                              {fw}
                            </span>
                          ))}
                          {rest > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-500">
                              +{rest}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Employees */}
                      <td className="px-4 py-3 text-right text-gray-700">
                        {account.numberOfEmployees != null
                          ? formatNumber(account.numberOfEmployees)
                          : <span className="text-gray-400">—</span>}
                      </td>

                      {/* AuM */}
                      <td className="px-4 py-3 text-right text-gray-700">
                        {account.aum != null
                          ? formatNumber(account.aum)
                          : <span className="text-gray-400">—</span>}
                      </td>

                      {/* Consultant */}
                      <td className="px-4 py-3">
                        {account.assignedConsultant?.name ? (
                          <span className="text-gray-700">{account.assignedConsultant.name}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/accounts/${id}`}
                            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Anzeigen"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            onClick={() => setEditTarget(account)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Bearbeiten"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(account)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            {filtered.length} von {accounts.length} Accounts angezeigt
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Neuer Account"
        size="2xl"
      >
        <AccountForm
          onSubmit={handleCreate}
          isLoading={creating}
          users={users}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Account bearbeiten"
        size="2xl"
      >
        {editTarget && (
          <AccountForm
            key={editTarget.id || editTarget._id}
            initialValues={editTarget}
            onSubmit={handleEdit}
            isLoading={editing}
            users={users}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        isDanger
        title="Account löschen"
        confirmText="Löschen"
        message={`Möchten Sie "${deleteTarget?.companyName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
      </>)}
    </div>
  )
}

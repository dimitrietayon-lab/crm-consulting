'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Users,
  Eye,
  Trash2,
  ChevronDown,
  X,
  Mail,
  Phone,
  Building2,
} from 'lucide-react'
import ContactForm from '@/components/contacts/ContactForm'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const HIERARCHY_LEVELS = ['C-Level', 'Managing Director', 'Project Lead', 'Specialist']

const HIERARCHY_COLORS = {
  'C-Level': 'bg-red-100 text-red-800',
  'Managing Director': 'bg-amber-100 text-amber-800',
  'Project Lead': 'bg-blue-100 text-blue-800',
  Specialist: 'bg-gray-100 text-gray-700',
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadContacts()
    loadAccounts()
  }, [])

  async function loadContacts() {
    try {
      setLoading(true)
      const data = await api.get('/contacts')
      setContacts(data?.contacts || data || [])
    } catch (err) {
      toast.error('Fehler beim Laden der Kontakte')
    } finally {
      setLoading(false)
    }
  }

  async function loadAccounts() {
    try {
      const data = await api.get('/accounts')
      setAccounts(data?.accounts || data || [])
    } catch {
      // non-critical
    }
  }

  async function handleCreate(payload) {
    try {
      setCreating(true)
      const created = await api.post('/contacts', payload)
      setContacts((prev) => [created?.contact || created, ...prev])
      setCreateOpen(false)
      toast.success('Kontakt erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      const id = deleteTarget.id || deleteTarget._id
      await api.delete(`/contacts/${id}`)
      setContacts((prev) => prev.filter((c) => c.id !== id && c._id !== id))
      setDeleteTarget(null)
      toast.success('Kontakt gelöscht')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (search) {
        const q = search.toLowerCase()
        if (!c.name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q) && !c.title?.toLowerCase().includes(q)) return false
      }
      if (filterLevel && c.hierarchyLevel !== filterLevel) return false
      if (filterDepartment && !c.department?.toLowerCase().includes(filterDepartment.toLowerCase())) return false
      return true
    })
  }, [contacts, search, filterLevel, filterDepartment])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kontakte</h1>
            <p className="text-sm text-gray-500">{contacts.length} Kontakte</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Kontakt
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, E-Mail oder Position suchen..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700"
            >
              <option value="">Alle Ebenen</option>
              {HIERARCHY_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <input
            type="text"
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            placeholder="Abteilung filtern..."
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {(search || filterLevel || filterDepartment) && (
            <button
              onClick={() => { setSearch(''); setFilterLevel(''); setFilterDepartment('') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <X size={12} /> Zurücksetzen
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
              <p className="text-sm text-gray-500">Kontakte werden geladen...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Keine Kontakte gefunden</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || filterLevel || filterDepartment
                ? 'Versuchen Sie andere Filterkriterien'
                : 'Erstellen Sie Ihren ersten Kontakt'}
            </p>
            {!search && !filterLevel && !filterDepartment && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Ersten Kontakt erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ebene</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Abteilung</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">E-Mail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Telefon</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((contact) => {
                  const id = contact.id || contact._id
                  const acct = contact.primaryAccount
                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => router.push(`/contacts/${id}`)}>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">
                              {contact.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <Link
                            href={`/contacts/${id}`}
                            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors whitespace-nowrap"
                          >
                            {contact.name}
                          </Link>
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 text-gray-700 max-w-[160px]">
                        <span className="truncate block" title={contact.title}>
                          {contact.title || <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Hierarchy level */}
                      <td className="px-4 py-3">
                        {contact.hierarchyLevel ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${HIERARCHY_COLORS[contact.hierarchyLevel] || 'bg-gray-100 text-gray-700'}`}>
                            {contact.hierarchyLevel}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 text-gray-700">
                        {contact.department || <span className="text-gray-400">—</span>}
                      </td>

                      {/* Account */}
                      <td className="px-4 py-3">
                        {acct ? (
                          <Link
                            href={`/accounts/${acct.id}`}
                            className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[120px]" title={acct.companyName}>
                              {acct.companyName}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[160px]" title={contact.email}>
                              {contact.email}
                            </span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone size={13} className="text-gray-400 flex-shrink-0" />
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/contacts/${id}`}
                            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Anzeigen"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(contact)}
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
            {filtered.length} von {contacts.length} Kontakten angezeigt
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Neuer Kontakt" size="2xl">
        <ContactForm
          onSubmit={handleCreate}
          isLoading={creating}
          accounts={accounts}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        isDanger
        title="Kontakt löschen"
        confirmText="Löschen"
        message={`Möchten Sie "${deleteTarget?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </div>
  )
}

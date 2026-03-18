'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Linkedin,
  Building2,
  Pencil,
  Plus,
  X,
  Activity,
  FileText,
  Briefcase,
  TrendingUp,
  CheckSquare,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react'
import ContactForm from '@/components/contacts/ContactForm'

const HIERARCHY_COLORS = {
  'C-Level': 'bg-red-100 text-red-800',
  'Managing Director': 'bg-amber-100 text-amber-800',
  'Project Lead': 'bg-blue-100 text-blue-800',
  Specialist: 'bg-gray-100 text-gray-700',
}

const DEAL_STAGE_COLORS = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-800',
  Proposal: 'bg-amber-100 text-amber-800',
  Negotiation: 'bg-orange-100 text-orange-800',
  'Closed Won': 'bg-green-100 text-green-800',
  'Closed Lost': 'bg-red-100 text-red-800',
}

const PROJECT_STATUS_COLORS = {
  Planning: 'bg-gray-100 text-gray-700',
  Active: 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-amber-100 text-amber-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
}

const TASK_STATUS_COLORS = {
  'To Do': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  Done: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
}

const ACTIVITY_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  task: Activity,
}

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

function AddToAccountModal({ isOpen, onClose, onAdd, allAccounts, linkedAccountIds, isLoading }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const available = allAccounts.filter((a) => {
    const id = a.id || a._id
    if (linkedAccountIds.includes(id)) return false
    if (search && !a.companyName?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedId) return
    onAdd(selectedId)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Zu Account hinzufügen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Account suchen..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {available.length === 0 ? (
            <p className="text-sm text-gray-500 px-3 py-3">Keine weiteren Accounts verfügbar</p>
          ) : (
            available.map((account) => {
              const id = account.id || account._id
              return (
                <label
                  key={id}
                  className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer ${selectedId === id ? 'bg-blue-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="account"
                    value={id}
                    checked={selectedId === id}
                    onChange={() => setSelectedId(id)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.companyName}</p>
                    {account.institutionType && (
                      <p className="text-xs text-gray-500">{account.institutionType}</p>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Abbrechen
          </button>
          <button type="submit" disabled={!selectedId || isLoading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Hinzufügen...' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const TABS = [
  { id: 'activities', label: 'Aktivitäten', icon: Activity },
  { id: 'deals', label: 'Deals', icon: TrendingUp },
  { id: 'projects', label: 'Projekte', icon: Briefcase },
  { id: 'tasks', label: 'Aufgaben', icon: CheckSquare },
]

export default function ContactDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [contact, setContact] = useState(null)
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [allAccounts, setAllAccounts] = useState([])
  const [activities, setActivities] = useState([])
  const [deals, setDeals] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('activities')

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [removingAccountId, setRemovingAccountId] = useState(null)

  useEffect(() => {
    if (id) loadAll()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    try {
      setLoading(true)
      const [contactData, accountsData] = await Promise.all([
        api.get(`/contacts/${id}`),
        api.get('/accounts').catch(() => []),
      ])
      const c = contactData?.contact || contactData
      setContact(c)
      // c.accounts = ContactAccount[] join records; extract the actual account objects
      setLinkedAccounts(
        (c?.accounts || []).map((ca) => ({
          id: ca.accountId,
          companyName: ca.account?.companyName,
          institutionType: ca.account?.institutionType,
          country: ca.account?.country,
          isPrimary: ca.isPrimary,
        }))
      )
      setAllAccounts(accountsData?.accounts || accountsData || [])

      const [activitiesData, dealsData, projectsData, tasksData] = await Promise.all([
        api.get(`/contacts/${id}/activities`).catch(() => []),
        api.get(`/contacts/${id}/deals`).catch(() => []),
        api.get(`/contacts/${id}/projects`).catch(() => []),
        api.get(`/contacts/${id}/tasks`).catch(() => []),
      ])
      setActivities(activitiesData?.activities || activitiesData || [])
      setDeals(dealsData?.deals || dealsData || [])
      setProjects(projectsData?.projects || projectsData || [])
      setTasks(tasksData?.tasks || tasksData || [])
    } catch (err) {
      toast.error('Fehler beim Laden des Kontakts')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(payload) {
    try {
      setEditing(true)
      const updated = await api.put(`/contacts/${id}`, payload)
      const updatedContact = updated?.contact || updated
      setContact(updatedContact)
      // don't reset linkedAccounts — PUT doesn't return account links
      setEditOpen(false)
      toast.success('Kontakt aktualisiert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Aktualisieren')
    } finally {
      setEditing(false)
    }
  }

  async function handleAddToAccount(accountId) {
    try {
      setAddingAccount(true)
      await api.post(`/contacts/${id}/accounts`, { accountId })
      const account = allAccounts.find((a) => (a.id || a._id) === accountId)
      if (account) setLinkedAccounts((prev) => [...prev, account])
      setAddAccountOpen(false)
      toast.success('Zu Account hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Hinzufügen')
    } finally {
      setAddingAccount(false)
    }
  }

  async function handleRemoveFromAccount(accountId) {
    try {
      setRemovingAccountId(accountId)
      await api.delete(`/contacts/${id}/accounts/${accountId}`)
      setLinkedAccounts((prev) => prev.filter((a) => (a.id || a._id) !== accountId))
      toast.success('Verknüpfung entfernt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Entfernen')
    } finally {
      setRemovingAccountId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Kontakt wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-gray-600">Kontakt nicht gefunden</p>
        <Link href="/contacts" className="text-blue-600 hover:underline text-sm">
          Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const initials = contact.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const linkedAccountIds = linkedAccounts.map((a) => a.id || a._id)

  const firstActivityDate = [...activities].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
  const lastActivityDate = [...activities].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/contacts')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Kontakte
          </button>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-sm text-gray-900 font-medium">{contact.name}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
                {contact.hierarchyLevel && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${HIERARCHY_COLORS[contact.hierarchyLevel] || 'bg-gray-100 text-gray-700'}`}>
                    {contact.hierarchyLevel}
                  </span>
                )}
              </div>
              {contact.title && (
                <p className="text-gray-600 mt-0.5">{contact.title}</p>
              )}
              {contact.department && (
                <p className="text-sm text-blue-600 font-medium mt-0.5">{contact.department}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil size={15} />
            Bearbeiten
          </button>
        </div>
      </div>

      {/* Main content - 2 column */}
      <div className="p-6 flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Contact info card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Kontaktinformationen</h3>
            <div className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">E-Mail</p>
                    <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone size={15} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Telefon</p>
                    <a href={`tel:${contact.phone}`} className="text-sm text-gray-900 hover:text-blue-600">
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}
              {contact.linkedInUrl && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Linkedin size={15} className="text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">LinkedIn</p>
                    <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      Profil anzeigen
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}
              {!contact.email && !contact.phone && !contact.linkedInUrl && (
                <p className="text-sm text-gray-400">Keine Kontaktdaten hinterlegt</p>
              )}
            </div>

            {/* Notes */}
            {contact.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1">
                  <FileText size={12} />
                  Notizen
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Linked Accounts section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={15} className="text-gray-400" />
                Verknüpfte Accounts ({linkedAccounts.length})
              </h3>
              <button
                onClick={() => setAddAccountOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={13} />
                Account hinzufügen
              </button>
            </div>

            {linkedAccounts.length === 0 ? (
              <div className="text-center py-6">
                <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Noch keine Accounts verknüpft</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedAccounts.map((account) => {
                  const accId = account.id || account._id
                  const isRemoving = removingAccountId === accId
                  return (
                    <div
                      key={accId}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/accounts/${accId}`}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                        >
                          {account.companyName}
                        </Link>
                        {account.institutionType && (
                          <p className="text-xs text-gray-500">{account.institutionType}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveFromAccount(accId)}
                        disabled={isRemoving}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all disabled:opacity-50"
                        title="Verknüpfung entfernen"
                      >
                        {isRemoving ? (
                          <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-4">
              <nav className="flex gap-0 overflow-x-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* ACTIVITIES TAB */}
              {activeTab === 'activities' && (
                <div>
                  {activities.length === 0 ? (
                    <EmptyTabState icon={Activity} message="Noch keine Aktivitäten" />
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                      <div className="space-y-4 pl-10">
                        {[...activities]
                          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                          .map((act) => {
                            const Icon = ACTIVITY_ICONS[act.type] || Activity
                            return (
                              <div key={act.id || act._id} className="relative">
                                <div className="absolute -left-10 top-1 w-7 h-7 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                                  <Icon size={13} className="text-gray-500" />
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-gray-900">{act.summary || act.title || act.type}</p>
                                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(act.createdAt || act.date)}</span>
                                  </div>
                                  {act.description && (
                                    <p className="text-xs text-gray-600 mt-1">{act.description}</p>
                                  )}
                                  {act.createdBy?.name && (
                                    <p className="text-xs text-gray-400 mt-1">{act.createdBy.name}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DEALS TAB */}
              {activeTab === 'deals' && (
                <div className="space-y-2">
                  {deals.length === 0 ? (
                    <EmptyTabState icon={TrendingUp} message="Keine verknüpften Deals" />
                  ) : (
                    deals.map((d) => (
                      <div key={d.id || d._id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{d.title || d.name}</p>
                            {d.stage && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DEAL_STAGE_COLORS[d.stage] || 'bg-gray-100 text-gray-700'}`}>
                                {d.stage}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            {d.probability != null && <span>{d.probability}%</span>}
                            {d.expectedCloseDate && <span>{formatDate(d.expectedCloseDate)}</span>}
                          </div>
                        </div>
                        {d.value != null && (
                          <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{d.value.toLocaleString('de-DE')} €</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PROJECTS TAB */}
              {activeTab === 'projects' && (
                <div className="space-y-2">
                  {projects.length === 0 ? (
                    <EmptyTabState icon={Briefcase} message="Keine verknüpften Projekte" />
                  ) : (
                    projects.map((p) => (
                      <Link
                        key={p.id || p._id}
                        href={`/projects/${p.id || p._id}`}
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate">{p.name}</p>
                            {p.status && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-700'}`}>
                                {p.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            {p.type && <span>{p.type}</span>}
                            {p.startDate && <span>{formatDate(p.startDate)}</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                      </Link>
                    ))
                  )}
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <EmptyTabState icon={CheckSquare} message="Keine verknüpften Aufgaben" />
                  ) : (
                    tasks.map((task) => (
                      <div key={task.id || task._id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{task.title || task.name}</p>
                            {task.status && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TASK_STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-700'}`}>
                                {task.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            {task.dueDate && <span>Fällig: {formatDate(task.dueDate)}</span>}
                            {task.assignedTo?.name && <span>{task.assignedTo.name}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Quick info */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Schnellinfo</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Interaktionen</span>
                <span className="font-semibold text-gray-900">{activities.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Verknüpfte Accounts</span>
                <span className="font-semibold text-gray-900">{linkedAccounts.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Offene Deals</span>
                <span className="font-semibold text-gray-900">
                  {deals.filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage)).length}
                </span>
              </div>
              {firstActivityDate && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Erste Interaktion</span>
                    <span className="font-medium text-gray-700">{formatDate(firstActivityDate.createdAt)}</span>
                  </div>
                </div>
              )}
              {lastActivityDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Letzte Aktivität</span>
                  <span className="font-medium text-gray-700">{formatDate(lastActivityDate.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* GDPR flags */}
          {(contact.gdprDeleteRequested || contact.gdprRestrictedProcessing) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-500" />
                <h3 className="text-sm font-semibold text-red-800">GDPR-Flags</h3>
              </div>
              <div className="space-y-2">
                {contact.gdprDeleteRequested && (
                  <p className="text-xs text-red-700">Löschanfrage aktiv</p>
                )}
                {contact.gdprRestrictedProcessing && (
                  <p className="text-xs text-red-700">Verarbeitung eingeschränkt</p>
                )}
                <Link href="/compliance?tab=gdpr" className="text-xs text-red-600 underline hover:text-red-800">
                  Compliance-Seite →
                </Link>
              </div>
            </div>
          )}

          {/* Associated Accounts summary */}
          {linkedAccounts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Accounts</h3>
              <div className="space-y-2">
                {linkedAccounts.map((account) => {
                  const accId = account.id || account._id
                  return (
                    <Link
                      key={accId}
                      href={`/accounts/${accId}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-blue-200 transition-all group"
                    >
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 truncate">{account.companyName}</p>
                        {account.country && <p className="text-xs text-gray-500">{account.country}</p>}
                      </div>
                      <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Kontakt bearbeiten">
        {contact && (
          <ContactForm
            key={contact.id || contact._id}
            initialValues={{
              ...contact,
              accountIds: linkedAccountIds,
            }}
            onSubmit={handleEdit}
            isLoading={editing}
            accounts={allAccounts}
          />
        )}
      </Modal>

      {/* Add to Account Modal */}
      <AddToAccountModal
        isOpen={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        onAdd={handleAddToAccount}
        allAccounts={allAccounts}
        linkedAccountIds={linkedAccountIds}
        isLoading={addingAccount}
      />
    </div>
  )
}

function EmptyTabState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon size={36} className="text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

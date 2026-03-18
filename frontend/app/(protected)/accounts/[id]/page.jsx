'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatDate, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Building2,
  Star,
  Globe,
  Users,
  TrendingUp,
  DollarSign,
  Shield,
  Pencil,
  Plus,
  X,
  FileText,
  Activity,
  Briefcase,
  PieChart,
  ChevronRight,
  Mail,
  Phone,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Target,
  Upload,
  UserPlus,
  List,
  GitBranch,
  Brain,
  Sparkles,
  RefreshCw,
  Download,
  Trash2,
  Check,
  Eye,
  Clock,
} from 'lucide-react'
import OrgChart from '@/components/accounts/OrgChart'
import AccountForm from '@/components/accounts/AccountForm'
import ActivityTypeIcon from '@/components/activities/ActivityTypeIcon'

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

function NdaModal({ isOpen, onClose, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    signingDate: '',
    expiryDate: '',
    scope: '',
    signatoryClient: '',
    signatoryUs: '',
  })
  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(form)
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NDA hinzufügen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unterzeichnungsdatum</label>
            <input type="date" value={form.signingDate} onChange={(e) => set('signingDate', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ablaufdatum</label>
            <input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Umfang / Scope</label>
          <textarea value={form.scope} onChange={(e) => set('scope', e.target.value)}
            rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Beschreibung des NDA-Umfangs..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unterzeichner Kunde</label>
          <input type="text" value={form.signatoryClient} onChange={(e) => set('signatoryClient', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name des Unterzeichners" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unterzeichner Wir</label>
          <input type="text" value={form.signatoryUs} onChange={(e) => set('signatoryUs', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name unseres Unterzeichners" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Abbrechen
          </button>
          <button type="submit" disabled={isLoading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Speichern...' : 'NDA speichern'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const ACTIVITY_TYPES = ['Meeting', 'Phone Call', 'Email', 'Presentation', 'Workshop', 'Conference', 'Note']

function ActivityModal({ open, mode, activity, onClose, onSave, onEdit, isLoading }) {
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isCreate = mode === 'create'

  const empty = { type: 'Meeting', date: '', duration: '', summary: '', nextSteps: '' }
  const [form, setForm] = useState(empty)
  function setF(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  useEffect(() => {
    if (open) {
      if ((isEdit || isView) && activity) {
        setForm({
          type: activity.type || 'Meeting',
          date: activity.date ? activity.date.slice(0, 16) : '',
          duration: activity.duration ?? '',
          summary: activity.summary || '',
          nextSteps: activity.nextSteps || '',
        })
      } else {
        setForm(empty)
      }
    }
  }, [open, mode, activity]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...form, duration: form.duration ? Number(form.duration) : null })
  }

  const title = isCreate ? 'Aktivität erstellen' : isEdit ? 'Aktivität bearbeiten' : 'Aktivität'
  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      {isView ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActivityTypeIcon type={activity?.type} size="md" showLabel />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Datum</p>
              <p className="font-medium text-gray-900">{activity?.date ? new Date(activity.date).toLocaleString('de-DE') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Dauer</p>
              <p className="font-medium text-gray-900">{activity?.duration ? `${activity.duration} Min.` : '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Zusammenfassung</p>
            <p className="text-sm text-gray-900">{activity?.summary || '—'}</p>
          </div>
          {activity?.nextSteps && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Nächste Schritte</p>
              <p className="text-sm text-gray-900">{activity.nextSteps}</p>
            </div>
          )}
          {activity?.createdBy?.name && (
            <p className="text-xs text-gray-400">Erstellt von: {activity.createdBy.name}</p>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Schließen
            </button>
            <button type="button" onClick={() => onEdit(activity)} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              Bearbeiten
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select value={form.type} onChange={(e) => setF('type', e.target.value)} className={inputCls}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum & Uhrzeit</label>
              <input type="datetime-local" required value={form.date} onChange={(e) => setF('date', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zusammenfassung</label>
            <input type="text" required value={form.summary} onChange={(e) => setF('summary', e.target.value)} className={inputCls} placeholder="Kurze Beschreibung der Aktivität" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dauer (Minuten, optional)</label>
            <input type="number" min="0" value={form.duration} onChange={(e) => setF('duration', e.target.value)} className={inputCls} placeholder="z.B. 60" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Schritte (optional)</label>
            <textarea rows={3} value={form.nextSteps} onChange={(e) => setF('nextSteps', e.target.value)} className={`${inputCls} resize-none`} placeholder="Was ist als nächstes geplant?" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" disabled={isLoading} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
              {isLoading ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Aktivität erstellen'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function AiOpportunitiesWidget({ accountId }) {
  const [opps, setOpps] = useState([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    api.get(`/ai-opportunities/${accountId}`)
      .then((data) => setOpps(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [accountId])

  async function generate() {
    setGenerating(true)
    try {
      const data = await api.post(`/ai-opportunities/${accountId}/generate`)
      setOpps(data)
      toast.success(`${data.length} KI-Vorschläge generiert`)
    } catch (err) {
      toast.error(err.message || 'KI-Analyse fehlgeschlagen')
    } finally {
      setGenerating(false)
    }
  }

  const visible = opps.filter((o) => o.status !== 'ignored').slice(0, 3)

  return (
    <div className="bg-violet-50 rounded-lg border border-violet-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-violet-900">KI-Opportunities</h3>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white rounded text-xs hover:bg-violet-700 disabled:opacity-50"
        >
          {generating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {generating ? '...' : 'Analysieren'}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-violet-600 opacity-70">Noch keine Vorschläge</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((o) => (
            <div key={o.id} className="text-xs text-violet-800 bg-white rounded p-2 border border-violet-100">
              {o.suggestion}
            </div>
          ))}
        </div>
      )}
      <Link href="/ai-opportunities" className="block text-xs text-violet-600 hover:underline mt-2">
        Alle Opportunities →
      </Link>
    </div>
  )
}

const TABS = [
  { id: 'overview', label: 'Übersicht', icon: Building2 },
  { id: 'contacts', label: 'Kontakte', icon: Users },
  { id: 'projects', label: 'Projekte', icon: Briefcase },
  { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
  { id: 'activities', label: 'Aktivitäten', icon: Activity },
  { id: 'documents', label: 'Dokumente', icon: FileText },
]

export default function AccountDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [account, setAccount] = useState(null)
  const [contacts, setContacts] = useState([])
  const [projects, setProjects] = useState([])
  const [deals, setDeals] = useState([])
  const [activities, setActivities] = useState([])
  const [documents, setDocuments] = useState([])
  const [ndas, setNdas] = useState([])
  const [users, setUsers] = useState([])

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [contactsView, setContactsView] = useState('list') // 'list' | 'orgchart'

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const [ndaOpen, setNdaOpen] = useState(false)
  const [addingNda, setAddingNda] = useState(false)
  const [activityModal, setActivityModal] = useState({ open: false, mode: 'create', activity: null })
  const [savingActivity, setSavingActivity] = useState(false)

  useEffect(() => {
    if (id) loadAll()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    try {
      setLoading(true)
      const [accountData, usersData] = await Promise.all([
        api.get(`/accounts/${id}`),
        api.get('/users').catch(() => ({ users: [] })),
      ])
      const acc = accountData?.account || accountData
      setAccount(acc)
      setNdas(acc?.ndas || [])
      setUsers(usersData?.users || usersData || [])

      // Contacts are already embedded in the account response (ContactAccount → contact)
      setContacts((acc?.contacts || []).map((ca) => ca.contact).filter(Boolean))

      // Load related data via query-param routes
      const [projectsData, dealsData, activitiesData, docsData] = await Promise.all([
        api.get(`/projects?accountId=${id}`).catch(() => []),
        api.get(`/deals?accountId=${id}`).catch(() => []),
        api.get(`/activities?accountId=${id}`).catch(() => []),
        api.get(`/documents?accountId=${id}`).catch(() => []),
      ])
      setProjects(Array.isArray(projectsData) ? projectsData : projectsData?.projects || [])
      setDeals(Array.isArray(dealsData) ? dealsData : dealsData?.deals || [])
      setActivities(Array.isArray(activitiesData) ? activitiesData : activitiesData?.activities || [])
      setDocuments(Array.isArray(docsData) ? docsData : docsData?.documents || [])
    } catch (err) {
      toast.error('Fehler beim Laden des Accounts')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      formData.append('accountId', id)
      formData.append('category', 'Allgemein')
      const data = await api.upload('/documents/upload', formData)
      setDocuments((prev) => [data?.document || data, ...prev])
      toast.success('Dokument hochgeladen')
    } catch (err) {
      toast.error(err.message || 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteDoc(docId) {
    try {
      await api.delete(`/documents/${docId}`)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      setDeletingId(null)
      toast.success('Dokument gelöscht')
    } catch (err) {
      toast.error(err.message || 'Löschen fehlgeschlagen')
    }
  }

  async function handleRenameDoc(docId) {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await api.patch(`/documents/${docId}`, { name: trimmed })
      setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, name: trimmed } : d))
      setRenamingId(null)
      toast.success('Umbenannt')
    } catch (err) {
      toast.error(err.message || 'Umbenennen fehlgeschlagen')
    }
  }

  async function handleDownloadDoc(docId, docName) {
    try {
      const token = localStorage.getItem('crm_token')
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${base}/documents/${docId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Download fehlgeschlagen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = docName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message || 'Download fehlgeschlagen')
    }
  }

  function openCreateActivity() { setActivityModal({ open: true, mode: 'create', activity: null }) }
  function openViewActivity(act) { setActivityModal({ open: true, mode: 'view', activity: act }) }
  function openEditActivity(act) { setActivityModal({ open: true, mode: 'edit', activity: act }) }
  function closeActivityModal() { setActivityModal({ open: false, mode: 'create', activity: null }) }

  async function handleSaveActivity(form) {
    try {
      setSavingActivity(true)
      if (activityModal.mode === 'edit') {
        const updated = await api.put(`/activities/${activityModal.activity.id}`, { ...form, accountId: id })
        setActivities((prev) => prev.map((a) => a.id === updated.id ? updated : a))
        toast.success('Aktivität aktualisiert')
      } else {
        const created = await api.post('/activities', { ...form, accountId: id })
        setActivities((prev) => [created, ...prev])
        toast.success('Aktivität erstellt')
      }
      closeActivityModal()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSavingActivity(false)
    }
  }

  async function handleEdit(payload) {
    try {
      setEditing(true)
      const updated = await api.put(`/accounts/${id}`, payload)
      setAccount(updated?.account || updated)
      setEditOpen(false)
      toast.success('Account aktualisiert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Aktualisieren')
    } finally {
      setEditing(false)
    }
  }

  async function handleAddNda(payload) {
    try {
      setAddingNda(true)
      const result = await api.post(`/accounts/${id}/ndas`, payload)
      setNdas((prev) => [...prev, result?.nda || result])
      setNdaOpen(false)
      toast.success('NDA hinzugefügt')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Hinzufügen des NDA')
    } finally {
      setAddingNda(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Account wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-gray-600">Account nicht gefunden</p>
        <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
          Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const totalProjectValue = projects.reduce((s, p) => s + (p.budgetPlanned || 0), 0)
  const totalDealsValue = deals.reduce((s, d) => s + (d.value || 0), 0)
  const recentActivities = [...activities].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/accounts')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Accounts
          </button>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-sm text-gray-900 font-medium">{account.companyName}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Building2 size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{account.companyName}</h1>
                {account.isKeyAccount && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                    <Star size={12} className="fill-amber-500 text-amber-500" />
                    Key Account
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {account.institutionType && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${INSTITUTION_COLORS[account.institutionType] || 'bg-gray-100 text-gray-700'}`}>
                    {account.institutionType}
                  </span>
                )}
                {account.country && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Globe size={13} />
                    {account.country}
                  </span>
                )}
                {account.website && (
                  <a
                    href={account.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={13} />
                    Website
                  </a>
                )}
              </div>
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

      {/* Main content - 2 column layout */}
      <div className="p-6 flex gap-6 items-start">
        {/* Left main (2/3) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab nav */}
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

            {/* Tab content */}
            <div className="p-6">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <InfoCard icon={Users} label="Mitarbeiter" value={account.numberOfEmployees != null ? formatNumber(account.numberOfEmployees) : '—'} />
                    <InfoCard icon={TrendingUp} label="AuM (Mio. €)" value={account.aum != null ? formatNumber(account.aum) : '—'} />
                    <InfoCard icon={DollarSign} label="Umsatz (Mio. €)" value={account.annualRevenue != null ? formatNumber(account.annualRevenue) : '—'} />
                  </div>

                  {/* Regulatory Frameworks */}
                  {account.regulatoryFrameworks?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Shield size={15} className="text-gray-400" />
                        Regulatorische Rahmenwerke
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {account.regulatoryFrameworks.map((fw) => (
                          <span key={fw} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {fw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Consultant */}
                  {account.assignedConsultant && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Zuständiger Consultant</h3>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {account.assignedConsultant.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{account.assignedConsultant.name}</p>
                          {account.assignedConsultant.email && (
                            <p className="text-xs text-gray-500">{account.assignedConsultant.email}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {account.tags?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {account.tags.map((tag) => (
                          <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {account.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileText size={15} className="text-gray-400" />
                        Notizen
                      </h3>
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                        {account.notes}
                      </div>
                    </div>
                  )}

                  {/* Bank-specific */}
                  {['Private Bank', 'Savings Bank', 'Cooperative Bank', 'Investment Bank', 'Digital Bank'].includes(account.institutionType) && (
                    <div className="border border-blue-100 bg-blue-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-800 mb-3">Bank-spezifische Informationen</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {account.coreSystemVendor && (
                          <div>
                            <span className="text-gray-500">Core-System:</span>
                            <span className="ml-2 font-medium text-gray-900">{account.coreSystemVendor}</span>
                          </div>
                        )}
                        {account.numberOfBranches != null && (
                          <div>
                            <span className="text-gray-500">Filialen:</span>
                            <span className="ml-2 font-medium text-gray-900">{formatNumber(account.numberOfBranches)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Online-Portal:</span>
                          <span className={`ml-2 font-medium ${account.onlinePortalAvailable ? 'text-green-700' : 'text-red-600'}`}>
                            {account.onlinePortalAvailable ? 'Vorhanden' : 'Nicht vorhanden'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Insurance-specific */}
                  {['Insurance (Life)', 'Insurance (Non-Life)', 'Reinsurance', 'Health Insurance'].includes(account.institutionType) && (
                    <div className="border border-purple-100 bg-purple-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-purple-800 mb-3">Versicherungs-spezifische Informationen</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {account.numberOfPolicies != null && (
                          <div>
                            <span className="text-gray-500">Anzahl Policen:</span>
                            <span className="ml-2 font-medium text-gray-900">{formatNumber(account.numberOfPolicies)}</span>
                          </div>
                        )}
                        {account.premiumVolumeMio != null && (
                          <div>
                            <span className="text-gray-500">Prämienvolumen:</span>
                            <span className="ml-2 font-medium text-gray-900">{formatNumber(account.premiumVolumeMio)} Mio. €</span>
                          </div>
                        )}
                        {account.actuarialSoftware && (
                          <div>
                            <span className="text-gray-500">Aktuarielle Software:</span>
                            <span className="ml-2 font-medium text-gray-900">{account.actuarialSoftware}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CONTACTS TAB */}
              {activeTab === 'contacts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {contacts.length} Kontakt{contacts.length !== 1 ? 'e' : ''}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* View toggle */}
                      <div className="flex items-center bg-gray-100 rounded-md p-1 gap-1">
                        <button
                          onClick={() => setContactsView('list')}
                          className={`p-1.5 rounded ${contactsView === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                          title="Listenansicht"
                        >
                          <List size={14} />
                        </button>
                        <button
                          onClick={() => setContactsView('orgchart')}
                          className={`p-1.5 rounded ${contactsView === 'orgchart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                          title="Organigramm"
                        >
                          <GitBranch size={14} />
                        </button>
                      </div>
                      <Link
                        href={`/contacts?accountId=${id}`}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <UserPlus size={13} />
                        Kontakt hinzufügen
                      </Link>
                    </div>
                  </div>

                  {contacts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users size={36} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-sm">Noch keine Kontakte verknüpft</p>
                    </div>
                  ) : contactsView === 'orgchart' ? (
                    <OrgChart contacts={contacts} />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[...contacts]
                        .sort((a, b) => {
                          const order = ['C-Level', 'Managing Director', 'Project Lead', 'Specialist']
                          const ai = order.indexOf(a.hierarchyLevel)
                          const bi = order.indexOf(b.hierarchyLevel)
                          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                        })
                        .map((c) => (
                          <ContactCard key={c.id || c._id} contact={c} />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* PROJECTS TAB */}
              {activeTab === 'projects' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{projects.length} Projekte</h3>
                    <Link
                      href={`/projects/new?accountId=${id}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={13} />
                      Neues Projekt
                    </Link>
                  </div>
                  {projects.length === 0 ? (
                    <EmptyTabState icon={Briefcase} message="Noch keine Projekte" />
                  ) : (
                    <div className="space-y-2">
                      {projects.map((p) => (
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
                              {p.projectType && <span>{p.projectType}</span>}
                              {p.startDate && <span>Start: {formatDate(p.startDate)}</span>}
                              {p.endDate && <span>Ende: {formatDate(p.endDate)}</span>}
                            </div>
                          </div>
                          {p.budgetPlanned != null && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-gray-900">{formatNumber(p.budgetPlanned)} €</p>
                              <p className="text-xs text-gray-400">Budget</p>
                            </div>
                          )}
                          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PIPELINE TAB */}
              {activeTab === 'pipeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{deals.length} Deals</h3>
                    <Link
                      href={`/pipeline/new?accountId=${id}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={13} />
                      Neuer Deal
                    </Link>
                  </div>
                  {deals.length === 0 ? (
                    <EmptyTabState icon={TrendingUp} message="Noch keine Deals" />
                  ) : (
                    <div className="space-y-2">
                      {deals.map((d) => (
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
                              {d.probability != null && <span>{d.probability}% Wahrscheinlichkeit</span>}
                              {d.expectedClose && <span>Abschluss: {formatDate(d.expectedClose)}</span>}
                              {d.assignedTo?.name && <span>{d.assignedTo.name}</span>}
                            </div>
                          </div>
                          {d.value != null && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-gray-900">{formatNumber(d.value)} €</p>
                              <p className="text-xs text-gray-400">Wert</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITIES TAB */}
              {activeTab === 'activities' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{activities.length} Aktivitäten</h3>
                    <button
                      onClick={openCreateActivity}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors">
                      <Plus size={13} />
                      Aktivität hinzufügen
                    </button>
                  </div>
                  {activities.length === 0 ? (
                    <EmptyTabState icon={Activity} message="Noch keine Aktivitäten" />
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                      <div className="space-y-4 pl-10">
                        {[...activities]
                          .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                          .map((act) => {
                            const Icon = ACTIVITY_ICONS[act.type] || Activity
                            return (
                              <div key={act.id || act._id} className="relative">
                                <div className="absolute -left-10 top-1 w-7 h-7 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                                  <Icon size={13} className="text-gray-500" />
                                </div>
                                <div
                                  className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                                  onClick={() => openViewActivity(act)}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-900">{act.summary || act.title || act.type}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-400">{formatDate(act.date || act.createdAt)}</span>
                                        {act.duration && (
                                          <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                            <Clock size={10} />{act.duration} Min.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => openViewActivity(act)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Öffnen">
                                        <Eye size={13} />
                                      </button>
                                      <button
                                        onClick={() => openEditActivity(act)}
                                        className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors"
                                        title="Bearbeiten">
                                        <Pencil size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  {act.nextSteps && (
                                    <p className="text-xs text-gray-500 mt-1.5 border-t border-gray-100 pt-1.5">
                                      <span className="font-medium">Nächste Schritte:</span> {act.nextSteps}
                                    </p>
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

              {/* DOCUMENTS TAB */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{documents.length} Dokumente</h3>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <Upload size={13} />
                      {uploading ? 'Hochladen...' : 'Hochladen'}
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  </div>
                  {documents.length === 0 ? (
                    <EmptyTabState icon={FileText} message="Noch keine Dokumente" />
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {documents.map((doc) => {
                        const docId = doc.id || doc._id
                        const isRenaming = renamingId === docId
                        const isDeleting = deletingId === docId
                        return (
                          <div key={docId}>
                            <div className="flex items-center gap-3 py-3">
                              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText size={16} className="text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                {isRenaming ? (
                                  <input
                                    autoFocus
                                    className="text-sm font-medium text-gray-900 border border-blue-400 rounded px-1.5 py-0.5 w-full focus:outline-none"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameDoc(docId)
                                      if (e.key === 'Escape') setRenamingId(null)
                                    }}
                                    onBlur={() => handleRenameDoc(docId)}
                                  />
                                ) : (
                                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                )}
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                  {doc.category && <span>{doc.category}</span>}
                                  {doc.createdAt && <span>{formatDate(doc.createdAt)}</span>}
                                  {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleDownloadDoc(docId, doc.name)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Herunterladen">
                                  <Download size={14} />
                                </button>
                                <button
                                  onClick={() => { setRenamingId(docId); setRenameValue(doc.name) }}
                                  className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors"
                                  title="Umbenennen">
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setDeletingId(isDeleting ? null : docId)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Löschen">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {isDeleting && (
                              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-2 text-xs">
                                <span className="text-red-700 font-medium">Wirklich löschen?</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 transition-colors">
                                    Abbrechen
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(docId)}
                                    className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors">
                                    Löschen
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Quick stats */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Schnellstatistik</h3>
            <div className="space-y-3">
              <SidebarStat label="Projektvolumen" value={`${formatNumber(totalProjectValue)} €`} icon={Briefcase} color="blue" />
              <SidebarStat label="Deal-Wert (gesamt)" value={`${formatNumber(totalDealsValue)} €`} icon={TrendingUp} color="green" />
              <SidebarStat label="Kontakte" value={contacts.length} icon={Users} color="purple" />
              <SidebarStat label="Aktive Projekte" value={projects.filter((p) => p.status === 'Active').length} icon={Target} color="amber" />
            </div>
          </div>

          {/* Key Account Plan */}
          {account.isKeyAccount && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star size={15} className="text-amber-500 fill-amber-500" />
                <h3 className="text-sm font-semibold text-amber-900">Key Account Plan</h3>
              </div>
              <Link href={`/key-accounts/${account.id}`} className="text-xs text-amber-700 underline hover:text-amber-900">
                Account-Plan öffnen →
              </Link>
            </div>
          )}

          {/* Recent Activities */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Letzte Aktivitäten</h3>
              <button
                onClick={() => setActiveTab('activities')}
                className="text-xs text-blue-600 hover:underline"
              >
                Alle anzeigen
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <p className="text-xs text-gray-500">Keine Aktivitäten</p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => {
                  const Icon = ACTIVITY_ICONS[act.type] || Activity
                  return (
                    <div key={act.id || act._id} className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={12} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{act.summary || act.title || act.type}</p>
                        <p className="text-xs text-gray-400">{formatDate(act.date || act.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* NDAs */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield size={14} className="text-gray-400" />
                NDAs
              </h3>
              <button
                onClick={() => setNdaOpen(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus size={13} />
                Hinzufügen
              </button>
            </div>
            {ndas.length === 0 ? (
              <p className="text-xs text-gray-500">Keine NDAs vorhanden</p>
            ) : (
              <div className="space-y-2">
                {ndas.map((nda, idx) => {
                  const isExpired = nda.expiryDate && new Date(nda.expiryDate) < new Date()
                  const expiringSoon = nda.expiryDate && !isExpired &&
                    new Date(nda.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  return (
                    <div key={nda.id || nda._id || idx} className={`p-3 rounded-lg border text-xs ${isExpired ? 'border-red-200 bg-red-50' : expiringSoon ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          {nda.signatoryClient && (
                            <p className="font-medium text-gray-900">{nda.signatoryClient}</p>
                          )}
                          {nda.scope && (
                            <p className="text-gray-600 mt-0.5 line-clamp-2">{nda.scope}</p>
                          )}
                        </div>
                        {isExpired && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium ml-2 flex-shrink-0">
                            Abgelaufen
                          </span>
                        )}
                        {expiringSoon && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium ml-2 flex-shrink-0">
                            Bald ablaufend
                          </span>
                        )}
                      </div>
                      {nda.expiryDate && (
                        <div className="flex items-center gap-1 mt-1.5 text-gray-500">
                          <Calendar size={11} />
                          <span>Ablauf: {formatDate(nda.expiryDate)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* KI Opportunities */}
          <AiOpportunitiesWidget accountId={id} />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Account bearbeiten">
        {account && (
          <AccountForm
            key={account.id || account._id}
            initialValues={account}
            onSubmit={handleEdit}
            isLoading={editing}
            users={users}
          />
        )}
      </Modal>

      {/* Activity Modal */}
      <ActivityModal
        open={activityModal.open}
        mode={activityModal.mode}
        activity={activityModal.activity}
        onClose={closeActivityModal}
        onSave={handleSaveActivity}
        onEdit={(act) => setActivityModal({ open: true, mode: 'edit', activity: act })}
        isLoading={savingActivity}
      />

      {/* NDA Modal */}
      <NdaModal
        isOpen={ndaOpen}
        onClose={() => setNdaOpen(false)}
        onSubmit={handleAddNda}
        isLoading={addingNda}
      />
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function SidebarStat({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}

function ContactCard({ contact }) {
  const id = contact.id || contact._id
  return (
    <Link
      href={`/contacts/${id}`}
      className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-semibold">
            {contact.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">{contact.name}</p>
            {contact.hierarchyLevel && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${HIERARCHY_COLORS[contact.hierarchyLevel] || 'bg-gray-100 text-gray-700'}`}>
                {contact.hierarchyLevel}
              </span>
            )}
          </div>
          {contact.title && <p className="text-xs text-gray-600 mt-0.5">{contact.title}</p>}
          {contact.department && <p className="text-xs text-blue-600 font-medium mt-0.5">{contact.department}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {contact.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail size={11} />
                {contact.email}
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Phone size={11} />
                {contact.phone}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
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

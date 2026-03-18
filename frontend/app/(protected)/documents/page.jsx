'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Trash2,
  Download,
  Search,
  Grid3X3,
  List,
  FileText,
  FileSpreadsheet,
  File,
  Image,
  AlertTriangle,
  Building2,
  Folder,
  FolderOpen,
  Upload,
  Lock,
  Unlock,
  X,
  RefreshCw,
  History,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'

const CATEGORIES = [
  'NDA',
  'Contract',
  'Proposal',
  'Presentation',
  'Report',
  'Study',
  'Invoice',
  'Other',
]

const CATEGORY_LABELS = {
  NDA: 'NDA',
  Contract: 'Vertrag',
  Proposal: 'Angebot',
  Presentation: 'Präsentation',
  Report: 'Bericht',
  Study: 'Studie',
  Invoice: 'Rechnung',
  Other: 'Sonstige',
}

function getFileIcon(mimeType) {
  if (mimeType?.includes('pdf')) return { icon: FileText, color: 'text-red-500' }
  if (mimeType?.includes('word') || mimeType?.includes('document'))
    return { icon: FileText, color: 'text-blue-500' }
  if (mimeType?.includes('sheet') || mimeType?.includes('excel'))
    return { icon: FileSpreadsheet, color: 'text-green-500' }
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint'))
    return { icon: FileText, color: 'text-orange-500' }
  if (mimeType?.includes('image')) return { icon: Image, color: 'text-purple-500' }
  return { icon: File, color: 'text-gray-500' }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false
  const exp = new Date(expiryDate)
  const now = new Date()
  const diffDays = (exp - now) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 30
}

function isExpired(expiryDate) {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

// ── Version History Modal ────────────────────────────────────────────────────
function VersionHistoryModal({ doc, isOpen, onClose, onUploadVersion }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isOpen && doc) {
      setLoading(true)
      api.get(`/documents/${doc.id}/versions`)
        .then((data) => setVersions(Array.isArray(data) ? data : []))
        .catch(() => toast.error('Versionen konnten nicht geladen werden.'))
        .finally(() => setLoading(false))
    }
  }, [isOpen, doc])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !doc) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api.upload(`/documents/${doc.id}/new-version`, formData)
      toast.success('Neue Version hochgeladen.')
      setVersions((prev) => [result, ...prev])
      onUploadVersion?.(result)
    } catch {
      toast.error('Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDownloadVersion = (v) => {
    window.open(`http://localhost:3001/api/documents/${v.id}/download`, '_blank')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Versionshistorie – ${doc?.name || ''}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Aktuelle Version: <span className="font-semibold text-gray-900">v{doc?.version || 1}</span>
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Wird hochgeladen...' : 'Neue Version hochladen'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Keine früheren Versionen vorhanden.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Version {v.version}</p>
                  <p className="text-xs text-gray-400">{formatDate(v.createdAt)} · {formatBytes(v.fileSize)}</p>
                </div>
                <button
                  onClick={() => handleDownloadVersion(v)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Herunterladen"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── New Version Upload Modal ─────────────────────────────────────────────────
function NewVersionModal({ doc, isOpen, onClose, onUploaded }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Bitte wählen Sie eine Datei aus.'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api.upload(`/documents/${doc.id}/new-version`, formData)
      toast.success('Neue Version hochgeladen.')
      onUploaded(result)
      onClose()
      setFile(null)
    } catch {
      toast.error('Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Neue Version – ${doc?.name || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <File className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">{file.name}</span>
              <span className="text-xs text-gray-500">({formatBytes(file.size)})</span>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Datei für neue Version auswählen</p>
              <p className="text-xs text-gray-400 mt-1">Wird als v{(doc?.version || 1) + 1} gespeichert</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Abbrechen
          </button>
          <button type="submit" disabled={uploading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DocumentCard({ doc, onDelete, onDownload, onNewVersion, onShowHistory }) {
  const { icon: Icon, color } = getFileIcon(doc.mimeType)
  const expiringSoon = isExpiringSoon(doc.expiryDate)
  const expired = isExpired(doc.expiryDate)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 bg-gray-50 rounded-lg">
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
        <div className="flex items-center gap-1">
          {doc.isInternal !== false ? (
            <span title="Intern"><Lock className="w-3.5 h-3.5 text-gray-400" /></span>
          ) : (
            <span title="Extern"><Unlock className="w-3.5 h-3.5 text-blue-400" /></span>
          )}
          {(expiringSoon || expired) && (
            <AlertTriangle
              className={`w-4 h-4 ${expired ? 'text-red-500' : 'text-yellow-500'}`}
              title={expired ? 'Abgelaufen' : 'Läuft bald ab'}
            />
          )}
          {doc.version > 1 && (
            <button
              onClick={() => onShowHistory(doc)}
              className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium hover:bg-blue-100 transition-colors"
              title="Versionshistorie"
            >
              v{doc.version}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate" title={doc.name}>
          {doc.name || doc.originalName}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="gray">{CATEGORY_LABELS[doc.category] || doc.category}</Badge>
          {doc.isInternal !== false ? (
            <span className="text-xs text-gray-400">Intern</span>
          ) : (
            <span className="text-xs text-blue-500">Extern</span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
        <p className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</p>
        {doc.account?.companyName && (
          <p className="text-xs text-blue-600 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {doc.account.companyName}
          </p>
        )}
        {doc.project?.name && (
          <p className="text-xs text-purple-600 flex items-center gap-1">
            <FolderOpen className="w-3 h-3" />
            {doc.project.name}
          </p>
        )}
        {doc.task?.title && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Aufgabe: {doc.task.title}
          </p>
        )}
        {doc.expiryDate && (
          <p
            className={`text-xs flex items-center gap-1 ${
              expired
                ? 'text-red-600 font-medium'
                : expiringSoon
                ? 'text-yellow-600 font-medium'
                : 'text-gray-400'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Ablauf: {formatDate(doc.expiryDate)}
          </p>
        )}
      </div>

      <div className="flex gap-1 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => onDownload(doc)}
          className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg border border-blue-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          onClick={() => onNewVersion(doc)}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
          title="Neue Version hochladen"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function DocumentRow({ doc, onDelete, onDownload, onNewVersion, onShowHistory }) {
  const { icon: Icon, color } = getFileIcon(doc.mimeType)
  const expiringSoon = isExpiringSoon(doc.expiryDate)
  const expired = isExpired(doc.expiryDate)

  return (
    <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 ${color}`} />
          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
            {doc.name || doc.originalName}
          </span>
          {doc.version > 1 && (
            <button
              onClick={() => onShowHistory(doc)}
              className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium hover:bg-blue-100"
              title="Versionshistorie"
            >
              v{doc.version}
            </button>
          )}
          {(expiringSoon || expired) && (
            <AlertTriangle
              className={`w-3.5 h-3.5 ${expired ? 'text-red-500' : 'text-yellow-500'}`}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="gray">{CATEGORY_LABELS[doc.category] || doc.category}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.createdAt)}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatBytes(doc.fileSize)}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {doc.task?.title ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {doc.task.title}
          </span>
        ) : (doc.account?.companyName || doc.project?.name || '—')}
      </td>
      <td className="px-4 py-3">
        {doc.isInternal !== false ? (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Intern
          </span>
        ) : (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Unlock className="w-3 h-3" /> Extern
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDownload(doc)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNewVersion(doc)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
            title="Neue Version hochladen"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onShowHistory(doc)}
            className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded transition-colors"
            title="Versionshistorie"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(doc.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Folder View ──────────────────────────────────────────────────────────────
function FolderDocRow({ doc, onDelete, onDownload, onNewVersion, onShowHistory }) {
  const { icon: Icon, color } = getFileIcon(doc.mimeType)
  const expiringSoon = isExpiringSoon(doc.expiryDate)
  const expired = isExpired(doc.expiryDate)

  return (
    <div className="flex items-center gap-3 pl-14 pr-4 py-2.5 hover:bg-blue-50/40 group border-t border-gray-100 first:border-0">
      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{doc.name || doc.originalName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{CATEGORY_LABELS[doc.category] || doc.category}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
          <span className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</span>
          {doc.version > 1 && (
            <span className="text-xs text-blue-500 font-medium">v{doc.version}</span>
          )}
          {expired && <span className="text-xs text-red-500 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Abgelaufen</span>}
          {!expired && expiringSoon && <span className="text-xs text-yellow-600 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Läuft ab</span>}
          {doc.isInternal !== false
            ? <span className="text-xs text-gray-400 flex items-center gap-0.5"><Lock className="w-3 h-3" /> Intern</span>
            : <span className="text-xs text-blue-500 flex items-center gap-0.5"><Unlock className="w-3 h-3" /> Extern</span>
          }
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onDownload(doc)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Download">
          <Download className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onNewVersion(doc)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded" title="Neue Version">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onShowHistory(doc)} className="p-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded" title="Versionshistorie">
          <History className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(doc.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" title="Löschen">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function FolderView({ documents, onDelete, onDownload, onNewVersion, onShowHistory }) {
  // expandedX[key] === false means collapsed; undefined / true means expanded
  const [expandedAccounts, setExpandedAccounts] = useState({})
  const [expandedProjects, setExpandedProjects] = useState({})

  // Build tree: accountKey → { account, projects: { projKey → { project, docs } }, noProject }
  const tree = {}
  for (const doc of documents) {
    const accountKey = doc.accountId || '__none__'
    if (!tree[accountKey]) {
      tree[accountKey] = { account: doc.account || null, projects: {}, noProject: [] }
    }
    if (doc.projectId) {
      if (!tree[accountKey].projects[doc.projectId]) {
        tree[accountKey].projects[doc.projectId] = {
          project: doc.project || { id: doc.projectId, name: 'Unbekanntes Projekt' },
          docs: [],
        }
      }
      tree[accountKey].projects[doc.projectId].docs.push(doc)
    } else {
      tree[accountKey].noProject.push(doc)
    }
  }

  const accountEntries = Object.entries(tree).sort(([a], [b]) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return (tree[a].account?.companyName || '').localeCompare(tree[b].account?.companyName || '')
  })

  const totalDocs = (entry) =>
    entry.noProject.length + Object.values(entry.projects).reduce((s, p) => s + p.docs.length, 0)

  return (
    <div className="space-y-2">
      {accountEntries.map(([accountKey, accountData]) => {
        const isExpanded = expandedAccounts[accountKey] !== false
        const count = totalDocs(accountData)
        const projectEntries = Object.entries(accountData.projects).sort((a, b) =>
          a[1].project.name.localeCompare(b[1].project.name)
        )

        return (
          <div key={accountKey} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Account row */}
            <button
              onClick={() => setExpandedAccounts(p => ({ ...p, [accountKey]: !isExpanded }))}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-semibold text-sm text-gray-900 flex-1">
                {accountData.account?.companyName || 'Ohne Account'}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                {count} Dok.
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100">
                {/* Project sub-folders */}
                {projectEntries.map(([projKey, projData]) => {
                  const isProjExpanded = expandedProjects[projKey] !== false
                  return (
                    <div key={projKey} className="border-t border-gray-100 first:border-0">
                      <button
                        onClick={() => setExpandedProjects(p => ({ ...p, [projKey]: !isProjExpanded }))}
                        className="w-full flex items-center gap-2.5 pl-8 pr-4 py-2.5 hover:bg-gray-50 transition-colors text-left bg-gray-50/50"
                      >
                        {isProjExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        {isProjExpanded
                          ? <FolderOpen className="w-4 h-4 text-purple-500 shrink-0" />
                          : <Folder className="w-4 h-4 text-purple-400 shrink-0" />}
                        <span className="text-sm text-gray-700 flex-1 font-medium">{projData.project.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                          {projData.docs.length}
                        </span>
                      </button>
                      {isProjExpanded && projData.docs.map(doc => (
                        <FolderDocRow
                          key={doc.id} doc={doc}
                          onDelete={onDelete} onDownload={onDownload}
                          onNewVersion={onNewVersion} onShowHistory={onShowHistory}
                        />
                      ))}
                    </div>
                  )
                })}

                {/* Account-level docs (no project) */}
                {accountData.noProject.map(doc => (
                  <div key={doc.id} className="border-t border-gray-100 first:border-0">
                    <div className="flex items-center gap-2.5 pl-8 pr-4 py-2.5 hover:bg-blue-50/40 group">
                      {(() => {
                        const { icon: Icon, color } = getFileIcon(doc.mimeType)
                        return <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{doc.name || doc.originalName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{CATEGORY_LABELS[doc.category] || doc.category}</span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onDownload(doc)} className="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Download"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onNewVersion(doc)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded" title="Neue Version"><RefreshCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onShowHistory(doc)} className="p-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded" title="Versionshistorie"><History className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onDelete(doc.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" title="Löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UploadModal({ isOpen, onClose, onUploaded, accounts, projects }) {
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({
    name: '',
    category: 'Other',
    accountId: '',
    projectId: '',
    isInternal: true,
    expiryDate: '',
  })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f) {
      setFile(f)
      if (!form.name) update('name', f.name.replace(/\.[^.]+$/, ''))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Bitte wählen Sie eine Datei aus.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', form.name || file.name)
      formData.append('category', form.category)
      formData.append('isInternal', String(form.isInternal))
      if (form.accountId) formData.append('accountId', form.accountId)
      if (form.projectId) formData.append('projectId', form.projectId)
      if (form.expiryDate) formData.append('expiryDate', form.expiryDate)

      const result = await api.upload('/documents/upload', formData)
      toast.success('Dokument hochgeladen.')
      onUploaded(result)
      onClose()
      setFile(null)
      setForm({ name: '', category: 'Other', accountId: '', projectId: '', isInternal: true, expiryDate: '' })
    } catch (err) {
      toast.error('Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dokument hochladen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Datei <span className="text-red-500">*</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <File className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500">({formatBytes(file.size)})</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Datei auswählen oder hier ablegen</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, PPT, Bilder</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dokumentname</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Dokumentname..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account (optional)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Projekt (optional)</label>
              <select
                value={form.projectId}
                onChange={(e) => update('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kein Projekt</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ablaufdatum (optional, für NDAs/Verträge)
          </label>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => update('expiryDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isInternal}
              onChange={(e) => update('isInternal', e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Internes Dokument</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Abbrechen
          </button>
          <button type="submit" disabled={uploading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('folder')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all') // 'all' | 'expired' | 'expiring'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [projects, setProjects] = useState([])
  const [newVersionDoc, setNewVersionDoc] = useState(null)
  const [historyDoc, setHistoryDoc] = useState(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const qs = params.toString()
      const data = await api.get(`/documents${qs ? '?' + qs : ''}`)
      setDocuments(Array.isArray(data) ? data : data.documents || [])
    } catch (err) {
      toast.error('Dokumente konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [accs, projs] = await Promise.all([
          api.get('/accounts'),
          api.get('/projects'),
        ])
        setAccounts(Array.isArray(accs) ? accs : accs.accounts || [])
        setProjects(Array.isArray(projs) ? projs : projs.projects || [])
      } catch {}
    }
    loadMeta()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Dokument löschen?')) return
    try {
      await api.delete(`/documents/${id}`)
      toast.success('Dokument gelöscht.')
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      toast.error('Dokument konnte nicht gelöscht werden.')
    }
  }

  const handleDownload = (doc) => {
    window.open(`http://localhost:3001/api/documents/${doc.id}/download`, '_blank')
  }

  const handleUploaded = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev])
  }

  const handleNewVersionUploaded = (newDoc) => {
    // Add new version to list and update old doc's version number display
    setDocuments((prev) => [newDoc, ...prev])
  }

  // Computed expiry stats
  const expiredDocs = documents.filter((d) => isExpired(d.expiryDate))
  const expiringSoonDocs = documents.filter((d) => isExpiringSoon(d.expiryDate))

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery ||
      (doc.name || doc.originalName || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter
    const matchesEntity =
      entityFilter === 'all' ||
      (entityFilter === 'account' && doc.accountId) ||
      (entityFilter === 'project' && doc.projectId)
    const matchesExpiry =
      expiryFilter === 'all' ||
      (expiryFilter === 'expired' && isExpired(doc.expiryDate)) ||
      (expiryFilter === 'expiring' && isExpiringSoon(doc.expiryDate))
    return matchesSearch && matchesCategory && matchesEntity && matchesExpiry
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Expiry Alert Banner */}
      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0) && (
        <div className="mb-5 rounded-lg overflow-hidden border border-red-200">
          {expiredDocs.length > 0 && (
            <button
              onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                expiryFilter === 'expired' ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-sm font-medium text-red-800">
                {expiredDocs.length} Dokument{expiredDocs.length !== 1 ? 'e' : ''} abgelaufen
              </span>
              <span className="ml-auto text-xs text-red-600">
                {expiryFilter === 'expired' ? 'Filter aufheben' : 'Anzeigen'}
              </span>
            </button>
          )}
          {expiringSoonDocs.length > 0 && (
            <button
              onClick={() => setExpiryFilter(expiryFilter === 'expiring' ? 'all' : 'expiring')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-yellow-200 ${
                expiryFilter === 'expiring' ? 'bg-yellow-100' : 'bg-yellow-50 hover:bg-yellow-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
              <span className="text-sm font-medium text-yellow-800">
                {expiringSoonDocs.length} Dokument{expiringSoonDocs.length !== 1 ? 'e' : ''} laufen in 30 Tagen ab
              </span>
              <span className="ml-auto text-xs text-yellow-600">
                {expiryFilter === 'expiring' ? 'Filter aufheben' : 'Anzeigen'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumente</h1>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length} Dokumente insgesamt
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Dokument hochladen
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Dokumente durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle Kategorien</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle Verknüpfungen</option>
          <option value="account">Account-Dokumente</option>
          <option value="project">Projekt-Dokumente</option>
        </select>

        {expiryFilter !== 'all' && (
          <button
            onClick={() => setExpiryFilter('all')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="w-3.5 h-3.5" /> Ablauf-Filter
          </button>
        )}

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('folder')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'folder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Ordnerstruktur"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Rasteransicht"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Listenansicht"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          icon={File}
          title="Keine Dokumente gefunden"
          description={
            searchQuery || categoryFilter !== 'all'
              ? 'Passen Sie die Suchkriterien an.'
              : 'Laden Sie Ihr erstes Dokument hoch.'
          }
          action={
            !searchQuery && categoryFilter === 'all' ? (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Dokument hochladen
              </button>
            ) : undefined
          }
        />
      ) : viewMode === 'folder' ? (
        <FolderView
          documents={filteredDocuments}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onNewVersion={(d) => setNewVersionDoc(d)}
          onShowHistory={(d) => setHistoryDoc(d)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onNewVersion={(d) => setNewVersionDoc(d)}
              onShowHistory={(d) => setHistoryDoc(d)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Größe</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Verknüpft mit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Typ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onNewVersion={(d) => setNewVersionDoc(d)}
                  onShowHistory={(d) => setHistoryDoc(d)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleUploaded}
        accounts={accounts}
        projects={projects}
      />

      {newVersionDoc && (
        <NewVersionModal
          doc={newVersionDoc}
          isOpen={!!newVersionDoc}
          onClose={() => setNewVersionDoc(null)}
          onUploaded={handleNewVersionUploaded}
        />
      )}

      {historyDoc && (
        <VersionHistoryModal
          doc={historyDoc}
          isOpen={!!historyDoc}
          onClose={() => setHistoryDoc(null)}
          onUploadVersion={handleNewVersionUploaded}
        />
      )}
    </div>
  )
}

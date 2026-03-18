'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import { ShoppingCart, Plus, Trash2, CheckCircle, XCircle, ChevronUp, Briefcase, Paperclip, ExternalLink } from 'lucide-react'

function receiptUrl(filePath) {
  if (!filePath) return null
  const name = filePath.replace(/\\/g, '/').split('/').pop()
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
  return `${base}/uploads/${name}`
}

const STATUS_MAP = {
  draft:        { label: 'Entwurf',     cls: 'bg-gray-100 text-gray-700' },
  submitted:    { label: 'Eingereicht', cls: 'bg-yellow-100 text-yellow-800' },
  pre_approved: { label: 'Vorgeprüft', cls: 'bg-purple-100 text-purple-800' },
  approved:     { label: 'Genehmigt',   cls: 'bg-green-100 text-green-800' },
  rejected:     { label: 'Abgelehnt',   cls: 'bg-red-100 text-red-800' },
}

const CATEGORIES = [
  'Büromaterial',
  'Software-Lizenz',
  'Hardware',
  'Verbrauchsmaterial',
  'Sonstiges',
]

function fmtDate(d) { return new Date(d).toLocaleDateString('de-DE') }
function fmtEur(n)  { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-600 mb-1'

// ─── Meine Einträge ──────────────────────────────────────────────────────────
function MeineTab({ user }) {
  const [projects, setProjects]       = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [items, setItems]             = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingItems, setLoadingItems]       = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const fileInputRef                  = useRef(null)

  const makeEmpty = () => ({
    date:        new Date().toISOString().split('T')[0],
    description: '',
    category:    'Sonstiges',
    quantity:    1,
    unitPrice:   '',
    supplier:    '',
    notes:       '',
  })
  const [form, setForm] = useState(makeEmpty)
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  const total = Number(form.quantity || 1) * Number(form.unitPrice || 0)

  // Load projects once
  useEffect(() => {
    api.get('/projects')
      .then(pr => setProjects(Array.isArray(pr) ? pr : (pr?.projects || [])))
      .catch(() => toast.error('Projekte konnten nicht geladen werden'))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Load items when project is selected
  useEffect(() => {
    if (!selectedProject || !user?.id) return
    setLoadingItems(true)
    api.get(`/material-costs?projectId=${selectedProject}&userId=${user.id}`)
      .then(mc => setItems(Array.isArray(mc) ? mc : []))
      .catch(() => toast.error('Fehler beim Laden der Einträge'))
      .finally(() => setLoadingItems(false))
  }, [selectedProject, user?.id])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const token = localStorage.getItem('crm_token')
      const base  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const fd = new FormData()
      fd.append('projectId',   selectedProject)
      fd.append('userId',      user.id)
      fd.append('date',        form.date)
      fd.append('description', form.description)
      fd.append('category',    form.category)
      fd.append('quantity',    String(Number(form.quantity)))
      fd.append('unitPrice',   String(Number(form.unitPrice)))
      if (form.supplier) fd.append('supplier', form.supplier)
      if (form.notes)    fd.append('notes',    form.notes)
      if (receiptFile)   fd.append('receipt',  receiptFile)

      const res = await fetch(`${base}/material-costs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const created = await res.json()
      setItems(prev => [created, ...prev])
      setForm(makeEmpty())
      setReceiptFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowForm(false)
      toast.success('Eintrag erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(id) {
    try {
      const updated = await api.put(`/material-costs/${id}/submit`, {})
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      toast.success('Eingereicht')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/material-costs/${id}`)
      setItems(prev => prev.filter(i => i.id !== id))
      toast.success('Gelöscht')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  return (
    <div className="space-y-5">

      {/* ── Projekt-Auswahl ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Projekt auswählen</h3>
        </div>
        {loadingProjects ? (
          <p className="text-sm text-gray-400">Projekte werden geladen…</p>
        ) : (
          <select
            value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value); setShowForm(false) }}
            className={CLS_INPUT}
          >
            <option value="">— Projekt wählen —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Only show content when a project is selected */}
      {!selectedProject ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Bitte zuerst ein Projekt auswählen, um Materialkosten zu erfassen.
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{items.length} Einträge</p>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              {showForm ? <ChevronUp size={15} /> : <Plus size={15} />}
              {showForm ? 'Abbrechen' : 'Neuer Eintrag'}
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Neuer Materialkosteneintrag</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={CLS_LABEL}>Datum *</label>
                    <input type="date" required value={form.date} onChange={e => setF('date', e.target.value)} className={CLS_INPUT} />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Kategorie</label>
                    <select value={form.category} onChange={e => setF('category', e.target.value)} className={CLS_INPUT}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={CLS_LABEL}>Beschreibung *</label>
                    <input type="text" required value={form.description} onChange={e => setF('description', e.target.value)} className={CLS_INPUT} placeholder="Was wurde beschafft?" />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Menge</label>
                    <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setF('quantity', e.target.value)} className={CLS_INPUT} />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Einzelpreis (€) *</label>
                    <input type="number" required min="0" step="0.01" value={form.unitPrice} onChange={e => setF('unitPrice', e.target.value)} className={CLS_INPUT} placeholder="0,00" />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Lieferant (optional)</label>
                    <input type="text" value={form.supplier} onChange={e => setF('supplier', e.target.value)} className={CLS_INPUT} placeholder="z.B. Amazon, Conrad" />
                  </div>
                  <div>
                    <label className={CLS_LABEL}>Notizen (optional)</label>
                    <input type="text" value={form.notes} onChange={e => setF('notes', e.target.value)} className={CLS_INPUT} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={CLS_LABEL}>Rechnung / Beleg (optional)</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <Paperclip size={14} />
                        {receiptFile ? receiptFile.name : 'Datei auswählen'}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      {receiptFile && (
                        <button type="button" onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                          className="text-xs text-red-500 hover:text-red-700">
                          Entfernen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    Gesamt: <span className="text-blue-600">{fmtEur(total)}</span>
                  </p>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Speichern...' : 'Eintrag erstellen'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Items List */}
          {loadingItems ? (
            <div className="text-center py-8 text-gray-400 text-sm">Laden…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Noch keine Materialkosten für dieses Projekt
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => {
                const s = STATUS_MAP[item.status] || STATUS_MAP.draft
                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{item.description}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                          <span>{item.category}</span>
                          <span>{fmtDate(item.date)}</span>
                          {item.supplier && <span>Lieferant: {item.supplier}</span>}
                          <span>{item.quantity} × {fmtEur(item.unitPrice)}</span>
                        </div>
                        {item.notes && <p className="text-xs text-gray-400 mt-1">{item.notes}</p>}
                        {item.approverComment && (
                          <p className="text-xs mt-1 text-red-600">Kommentar: {item.approverComment}</p>
                        )}
                        {item.receiptPath && (
                          <a href={receiptUrl(item.receiptPath)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                            <Paperclip size={11} /> Rechnung ansehen
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-gray-900">{fmtEur(item.totalAmount)}</p>
                        {item.status === 'draft' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSubmit(item.id)}
                              className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                            >
                              Einreichen
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Genehmigung ─────────────────────────────────────────────────────────────
function GenehmigungTab({ user, isCCHead, isTeamLead }) {
  const [teamItems, setTeamItems]   = useState([])
  const [ccItems, setCcItems]       = useState([])
  const [processed, setProcessed]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [commentMap, setCommentMap] = useState({})

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id, isCCHead, isTeamLead])

  async function load() {
    setLoading(true)
    try {
      const ccScope = (user?.role !== 'admin' && isCCHead) ? `&ccLeaderId=${user.id}` : ''
      const [teamSubmitted, ccPreApproved, appr, rej] = await Promise.all([
        isTeamLead ? api.get(`/material-costs?status=submitted&managerId=${user.id}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/material-costs?status=pre_approved${ccScope}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/material-costs?status=approved${ccScope}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/material-costs?status=rejected${ccScope}`) : Promise.resolve([]),
      ])
      setTeamItems(Array.isArray(teamSubmitted) ? teamSubmitted : [])
      setCcItems(Array.isArray(ccPreApproved) ? ccPreApproved : [])
      setProcessed([
        ...(Array.isArray(appr) ? appr : []),
        ...(Array.isArray(rej)  ? rej  : []),
      ].sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt)))
    } catch { toast.error('Fehler beim Laden') }
    setLoading(false)
  }

  async function handlePreApprove(id) {
    try {
      await api.put(`/material-costs/${id}/pre-approve`, {})
      setTeamItems(prev => prev.filter(i => i.id !== id))
      toast.success('Vorgeprüft')
      load()
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  async function handleApprove(id) {
    try {
      const updated = await api.put(`/material-costs/${id}/approve`, {
        approvedById:    user.id,
        approverComment: commentMap[id] || null,
      })
      setCcItems(prev => prev.filter(i => i.id !== id))
      setProcessed(prev => [updated, ...prev])
      toast.success('Genehmigt')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  async function handleReject(id) {
    if (!commentMap[id]?.trim()) { toast.error('Bitte einen Ablehnungsgrund angeben'); return }
    try {
      const updated = await api.put(`/material-costs/${id}/reject`, {
        approvedById:    user.id,
        approverComment: commentMap[id],
      })
      setCcItems(prev => prev.filter(i => i.id !== id))
      setProcessed(prev => [updated, ...prev])
      toast.success('Abgelehnt')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  if (loading) return <div className="text-center py-10 text-gray-400 text-sm">Laden...</div>

  function ItemCard({ item, children }) {
    const s = STATUS_MAP[item.status] || STATUS_MAP.draft
    return (
      <div className="bg-white border border-yellow-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 text-sm">{item.description}</p>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span>{item.project?.name}</span>
              <span>{item.category}</span>
              <span>{fmtDate(item.date)}</span>
              <span>{item.user?.name}</span>
              {item.supplier && <span>Lieferant: {item.supplier}</span>}
            </div>
            {item.notes && <p className="text-xs text-gray-400 mt-1">{item.notes}</p>}
            {item.receiptPath && (
              <a href={receiptUrl(item.receiptPath)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                <Paperclip size={11} /> Rechnung ansehen
              </a>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <p className="font-bold text-gray-900">{fmtEur(item.totalAmount)}</p>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {isTeamLead && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Vorgenehmigung — Mein Team</h2>
          {teamItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Keine eingereichten Einträge</p>
          ) : (
            <div className="space-y-3">
              {teamItems.map(item => (
                <ItemCard key={item.id} item={item}>
                  <button
                    onClick={() => handlePreApprove(item.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                  >
                    <CheckCircle size={12} /> Vorprüfen
                  </button>
                </ItemCard>
              ))}
            </div>
          )}
        </div>
      )}

      {isCCHead && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Genehmigung — CC</h2>
          {ccItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Keine vorgeprüften Einträge</p>
          ) : (
            <div className="space-y-3">
              {ccItems.map(item => (
                <ItemCard key={item.id} item={item}>
                  <div className="flex flex-col gap-1 w-full items-end">
                    <input
                      type="text"
                      placeholder="Kommentar (bei Ablehnung erforderlich)"
                      value={commentMap[item.id] || ''}
                      onChange={e => setCommentMap(p => ({ ...p, [item.id]: e.target.value }))}
                      className="mt-1 w-48 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle size={12} /> Genehmigen
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={12} /> Ablehnen
                      </button>
                    </div>
                  </div>
                </ItemCard>
              ))}
            </div>
          )}

          {processed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Bearbeitet ({processed.length})</h3>
              <div className="space-y-2">
                {processed.map(item => {
                  const s = STATUS_MAP[item.status] || STATUS_MAP.draft
                  return (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${s.cls}`}>{s.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{item.project?.name} · {item.user?.name} · {fmtDate(item.date)}</p>
                        {item.approverComment && <p className="text-xs text-gray-400 mt-0.5">"{item.approverComment}"</p>}
                      </div>
                      <p className="font-semibold text-gray-900 flex-shrink-0">{fmtEur(item.totalAmount)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isTeamLead && !isCCHead && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Keine Genehmigungsrechte</div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaterialCostsPage() {
  const [tab, setTab]       = useState('meine')
  const [user, setUser]     = useState(null)
  const [ledCCs, setLedCCs] = useState([])
  const [ledTeams, setLedTeams] = useState([])

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    api.get('/teams/led-cc').then(setLedCCs).catch(() => {})
    api.get('/teams/led').then(setLedTeams).catch(() => {})
  }, [])

  const isCCHead = user?.role === 'admin' || ledCCs.length > 0
  const isTeamLead = ledTeams.length > 0

  if (!user) return (
    <div className="p-6 text-center text-gray-400 text-sm">Laden...</div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Materialkosten</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'meine',       label: 'Meine Einträge' },
          ...(isCCHead || isTeamLead ? [{ key: 'genehmigung', label: 'Genehmigung' }] : []),
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meine'       && <MeineTab user={user} />}
      {tab === 'genehmigung' && <GenehmigungTab user={user} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
    </div>
  )
}

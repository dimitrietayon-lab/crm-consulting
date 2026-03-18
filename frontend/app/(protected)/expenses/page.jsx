'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import { Receipt, Plus, Trash2, Download, Paperclip, ExternalLink, Loader2, CheckCircle, AlertCircle, Brain, Building2, Home } from 'lucide-react'

function receiptUrl(filePath) {
  if (!filePath) return null
  const name = filePath.replace(/\\/g, '/').split('/').pop()
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
  return `${base}/uploads/${name}`
}

const STATUS_MAP = {
  draft: { label: 'Entwurf', cls: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Eingereicht', cls: 'bg-yellow-100 text-yellow-800' },
  pre_approved: { label: 'Vorgeprüft', cls: 'bg-purple-100 text-purple-800' },
  approved: { label: 'Genehmigt', cls: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Abgelehnt', cls: 'bg-red-100 text-red-800' },
  paid: { label: 'Ausgezahlt', cls: 'bg-green-100 text-green-800' },
}

const CATEGORIES = [
  { value: 'transport', label: 'Transport' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'meals', label: 'Verpflegung' },
  { value: 'parking', label: 'Parkgebühren' },
  { value: 'mileage', label: 'Kilometer' },
  { value: 'other', label: 'Sonstiges' },
]

function fmtDate(d) { return new Date(d).toLocaleDateString('de-DE') }
function fmtEur(n) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }

function isInternalProject(p) {
  return p?.projectType?.toLowerCase().includes('intern') || false
}

function ProjectBadge({ project, size = 'sm' }) {
  if (!project) return null
  const internal = isInternalProject(project)
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium
      ${size === 'xs' ? 'text-[10px]' : 'text-xs'}
      ${internal ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
      {internal ? <Home className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
      {internal ? 'Intern' : 'Extern'}
    </span>
  )
}

export default function ExpensesPage() {
  const [tab, setTab] = useState('meine')
  const [ledCCs, setLedCCs] = useState([])
  const [ledTeams, setLedTeams] = useState([])
  const user = getUser()

  useEffect(() => {
    api.get('/teams/led-cc').then(setLedCCs).catch(() => {})
    api.get('/teams/led').then(setLedTeams).catch(() => {})
  }, [])

  const isCCHead = user?.role === 'admin' || ledCCs.length > 0
  const isTeamLead = ledTeams.length > 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Receipt className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Reisekosten</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'meine', label: 'Meine Berichte' },
          ...(isCCHead || isTeamLead ? [{ key: 'genehmigung', label: 'Genehmigung' }] : []),
          { key: 'einstellungen', label: 'Einstellungen' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meine' && <MeineTab user={user} />}
      {tab === 'genehmigung' && <GenehmigungTab user={user} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
      {tab === 'einstellungen' && <EinstellungenTab isCCHead={isCCHead} />}
    </div>
  )
}

function MeineTab({ user }) {
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', projectId: '', destination: '', travelStart: '', travelEnd: '', purpose: '' })
  const [itemForm, setItemForm] = useState({ category: 'transport', description: '', date: new Date().toISOString().split('T')[0], amount: '', currency: 'EUR', km: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
    api.get('/projects').then(setProjects).catch(() => {})
  }, [])

  async function handleFileSelect(file) {
    setReceiptFile(file)
    setVerifyResult(null)
    if (!file) return
    setVerifying(true)
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const fd = new FormData()
      fd.append('receipt', file)
      const res = await fetch(`${baseUrl}/expenses/verify-receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) setVerifyResult(await res.json())
    } catch {}
    setVerifying(false)
  }

  function applyVerifyResult() {
    if (!verifyResult) return
    setItemForm(f => ({
      ...f,
      ...(verifyResult.date && { date: verifyResult.date }),
      ...(verifyResult.amount != null && { amount: String(verifyResult.amount) }),
      ...(verifyResult.category && { category: verifyResult.category }),
      ...(verifyResult.description && { description: verifyResult.description }),
    }))
    toast.success('Felder aus Beleg übernommen')
  }

  async function load() {
    try { setReports(await api.get(`/expenses?userId=${user.id}`)) } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.title) return toast.error('Titel erforderlich')
    try {
      const r = await api.post('/expenses', { ...createForm, userId: user.id })
      toast.success('Bericht erstellt')
      setShowCreate(false)
      setCreateForm({ title: '', projectId: '', destination: '', travelStart: '', travelEnd: '', purpose: '' })
      setReports(prev => [r, ...prev])
      setSelected(r)
    } catch { toast.error('Fehler') }
  }

  async function handleSubmit(id) {
    try {
      await api.put(`/expenses/${id}/submit`)
      toast.success('Eingereicht')
      load()
      if (selected?.id === id) setSelected(prev => ({ ...prev, status: 'submitted' }))
    } catch { toast.error('Fehler') }
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!selected) return
    if (!itemForm.amount && itemForm.category !== 'mileage') return toast.error('Betrag erforderlich')
    if (itemForm.category === 'mileage' && !itemForm.km) return toast.error('Km erforderlich')
    if (!receiptFile) return toast.error('Bitte einen Beleg hochladen')

    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const formData = new FormData()
      Object.entries(itemForm).forEach(([k, v]) => { if (v) formData.append(k, v) })
      if (receiptFile) formData.append('receipt', receiptFile)
      const res = await fetch(`${baseUrl}/expenses/${selected.id}/items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error()
      toast.success('Position hinzugefügt')
      setItemForm(f => ({ ...f, description: '', amount: '', km: '' }))
      setReceiptFile(null)
      setVerifyResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      const updated = await api.get(`/expenses/${selected.id}`)
      setSelected(updated)
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleDeleteItem(itemId) {
    try {
      await api.delete(`/expenses/${selected.id}/items/${itemId}`)
      toast.success('Gelöscht')
      const updated = await api.get(`/expenses/${selected.id}`)
      setSelected(updated)
      load()
    } catch { toast.error('Fehler') }
  }

  async function exportCsv(id) {
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/expenses/export/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `reisekosten-${id}.csv`; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">← Zurück</button>
          <div className="flex items-center gap-3">
            {selected.status && <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[selected.status]?.cls}`}>{STATUS_MAP[selected.status]?.label}</span>}
            <button onClick={() => exportCsv(selected.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            {selected.status === 'draft' && (
              <button onClick={() => handleSubmit(selected.id)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Einreichen
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            {selected.project && (
              <div className="flex items-center gap-1.5 shrink-0">
                <ProjectBadge project={selected.project} />
                <span className="text-sm text-gray-600 font-medium">{selected.project.name}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-sm text-gray-600">
            {selected.destination && <span><strong>Reiseziel:</strong> {selected.destination}</span>}
            {selected.purpose && <span><strong>Zweck:</strong> {selected.purpose}</span>}
            {selected.travelStart && <span><strong>Von:</strong> {fmtDate(selected.travelStart)}</span>}
            {selected.travelEnd && <span><strong>Bis:</strong> {fmtDate(selected.travelEnd)}</span>}
          </div>
          <div className="mt-3 text-right">
            <span className="text-xl font-bold text-gray-900">{fmtEur(selected.totalAmount)}</span>
            <span className="text-sm text-gray-500 ml-1">Gesamt</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">Positionen</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Kategorie</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Beschreibung</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Datum</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Betrag</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">Beleg</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(selected.items || []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">Noch keine Positionen</td></tr>
              ) : (selected.items || []).map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</td>
                  <td className="px-4 py-2 text-gray-600">{item.description || (item.km ? `${item.km} km` : '–')}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(item.date)}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtEur(item.amountEur || item.amount)}</td>
                  <td className="px-4 py-2 text-center">
                    {item.receiptPath ? (
                      <a
                        href={receiptUrl(item.receiptPath)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Beleg anzeigen"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {selected.status === 'draft' && (
                      <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected.status === 'draft' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold mb-4">Position hinzufügen</h3>
            <form onSubmit={handleAddItem} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kategorie</label>
                <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
                <input type="date" value={itemForm.date} onChange={e => setItemForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
                <input type="text" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              {itemForm.category === 'mileage' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kilometer *</label>
                  <input type="number" step="0.1" value={itemForm.km} onChange={e => setItemForm(f => ({ ...f, km: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Betrag (EUR) *</label>
                  <input type="number" step="0.01" value={itemForm.amount} onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Beleg hochladen *
                </label>
                <div className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-lg transition-colors ${receiptFile ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Paperclip className={`w-4 h-4 shrink-0 ${receiptFile ? 'text-blue-500' : 'text-gray-400'}`} />
                  <label className="flex-1 cursor-pointer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                    {receiptFile ? (
                      <span className="text-sm text-blue-700 font-medium flex items-center gap-2">
                        {receiptFile.name}
                        {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Foto oder PDF auswählen…</span>
                    )}
                  </label>
                  {receiptFile && !verifying && (
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); setVerifyResult(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* KI-Prüfungsergebnis */}
                {verifyResult && (
                  <div className={`mt-2 p-3 rounded-lg border text-sm ${verifyResult.isValidReceipt ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-medium text-xs">
                          {verifyResult.isValidReceipt
                            ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">KI: Gültiger Beleg erkannt</span></>
                            : <><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span className="text-red-700">KI: Kein gültiger Beleg erkannt</span></>
                          }
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                          {verifyResult.vendor && <span><strong>Händler:</strong> {verifyResult.vendor}</span>}
                          {verifyResult.date && <span><strong>Datum:</strong> {verifyResult.date}</span>}
                          {verifyResult.amount != null && <span><strong>Betrag:</strong> {verifyResult.amount} {verifyResult.currency || 'EUR'}</span>}
                          {verifyResult.category && <span><strong>Kategorie:</strong> {CATEGORIES.find(c => c.value === verifyResult.category)?.label || verifyResult.category}</span>}
                          {verifyResult.description && <span className="col-span-2"><strong>Beschreibung:</strong> {verifyResult.description}</span>}
                        </div>
                        {verifyResult.notes && (
                          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{verifyResult.notes}</p>
                        )}
                        {verifyResult.amount != null && itemForm.amount && Math.abs(parseFloat(verifyResult.amount) - parseFloat(itemForm.amount)) > 0.01 && (
                          <p className="text-xs font-medium text-amber-700">
                            ⚠ Abweichung: Beleg zeigt {verifyResult.amount} {verifyResult.currency}, eingetragen {itemForm.amount} EUR
                          </p>
                        )}
                      </div>
                      {verifyResult.isValidReceipt && (
                        <button
                          type="button"
                          onClick={applyVerifyResult}
                          className="shrink-0 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                        >
                          Felder übernehmen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Position hinzufügen
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Meine Reisekostenberichte</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Neuer Bericht
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">Neuer Reisekostenbericht</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
              <input type="text" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
              <select value={createForm.projectId} onChange={e => setCreateForm(f => ({ ...f, projectId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Kein Projekt zugeordnet</option>
                <optgroup label="Interne Projekte">
                  {projects.filter(p => isInternalProject(p)).map(p => (
                    <option key={p.id} value={p.id}>🏠 {p.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Externe Projekte">
                  {projects.filter(p => !isInternalProject(p)).map(p => (
                    <option key={p.id} value={p.id}>🏢 {p.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reiseziel</label>
              <input type="text" value={createForm.destination} onChange={e => setCreateForm(f => ({ ...f, destination: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reisezweck</label>
              <input type="text" value={createForm.purpose} onChange={e => setCreateForm(f => ({ ...f, purpose: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reisebeginn</label>
              <input type="date" value={createForm.travelStart} onChange={e => setCreateForm(f => ({ ...f, travelStart: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reiseende</label>
              <input type="date" value={createForm.travelEnd} onChange={e => setCreateForm(f => ({ ...f, travelEnd: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Erstellen</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(r => (
          <div key={r.id} onClick={() => setSelected(r)}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 cursor-pointer transition-colors">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-sm">{r.title}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[r.status]?.cls}`}>{STATUS_MAP[r.status]?.label}</span>
            </div>
            {r.project && (
              <div className="flex items-center gap-1.5 mb-1">
                <ProjectBadge project={r.project} size="xs" />
                <span className="text-xs text-gray-600 truncate">{r.project.name}</span>
              </div>
            )}
            {r.destination && <p className="text-xs text-gray-500">{r.destination}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">{(r.items || []).length} Positionen</span>
              <span className="font-bold text-gray-900">{fmtEur(r.totalAmount)}</span>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Noch keine Reisekostenberichte
          </div>
        )}
      </div>
    </div>
  )
}

function GenehmigungTab({ user, isCCHead, isTeamLead }) {
  const [teamItems, setTeamItems] = useState([])
  const [ccItems, setCcItems] = useState([])
  const [processed, setProcessed] = useState([])
  const [selected, setSelected] = useState(null)
  const [verifyResults, setVerifyResults] = useState({})
  const [verifying, setVerifying] = useState({})

  useEffect(() => { load() }, [isCCHead, isTeamLead])

  async function load() {
    try {
      const [teamSubmitted, ccPreApproved, approved] = await Promise.all([
        isTeamLead ? api.get(`/expenses?status=submitted&managerId=${user.id}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/expenses?status=pre_approved${user?.role !== 'admin' ? `&ccLeaderId=${user.id}` : ''}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/expenses?status=approved${user?.role !== 'admin' ? `&ccLeaderId=${user.id}` : ''}`) : Promise.resolve([]),
      ])
      setTeamItems(Array.isArray(teamSubmitted) ? teamSubmitted : [])
      setCcItems(Array.isArray(ccPreApproved) ? ccPreApproved : [])
      setProcessed(Array.isArray(approved) ? approved : [])
    } catch {}
  }

  async function selectReport(r) {
    try {
      const detail = await api.get(`/expenses/${r.id}`)
      setSelected(detail)
    } catch { setSelected(r) }
    setVerifyResults({})
  }

  async function handleAction(id, action) {
    try {
      await api.put(`/expenses/${id}/${action}`)
      toast.success(action === 'approve' ? 'Genehmigt' : action === 'mark-paid' ? 'Als bezahlt markiert' : 'Abgelehnt')
      setSelected(null)
      load()
    } catch { toast.error('Fehler') }
  }

  async function handlePreApprove(id) {
    try {
      await api.put(`/expenses/${id}/pre-approve`)
      toast.success('Vorgeprüft')
      load()
    } catch { toast.error('Fehler') }
  }

  async function verifyItem(itemId) {
    setVerifying(v => ({ ...v, [itemId]: true }))
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/expenses/items/${itemId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { const data = await res.json(); setVerifyResults(r => ({ ...r, [itemId]: data })) }
      else toast.error('KI-Prüfung fehlgeschlagen')
    } catch { toast.error('KI-Prüfung fehlgeschlagen') }
    setVerifying(v => ({ ...v, [itemId]: false }))
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">← Zurück</button>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[selected.status]?.cls}`}>
              {STATUS_MAP[selected.status]?.label}
            </span>
            {selected.status === 'submitted' && isTeamLead && (
              <button onClick={() => handlePreApprove(selected.id)} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Vorprüfen</button>
            )}
            {selected.status === 'pre_approved' && isCCHead && (
              <>
                <button onClick={() => handleAction(selected.id, 'approve')} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Genehmigen</button>
                <button onClick={() => handleAction(selected.id, 'reject')} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ablehnen</button>
              </>
            )}
            {selected.status === 'approved' && (
              <button onClick={() => handleAction(selected.id, 'mark-paid')} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Als bezahlt markieren</button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <p className="text-sm text-gray-500">{selected.user?.name}</p>
              {selected.project && (
                <div className="flex items-center gap-1.5 mt-1">
                  <ProjectBadge project={selected.project} />
                  <span className="text-sm text-gray-600">{selected.project.name}</span>
                </div>
              )}
            </div>
            <span className="text-xl font-bold text-gray-900">{fmtEur(selected.totalAmount)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm text-gray-600">
            {selected.destination && <span><strong>Reiseziel:</strong> {selected.destination}</span>}
            {selected.purpose && <span><strong>Zweck:</strong> {selected.purpose}</span>}
            {selected.travelStart && <span><strong>Von:</strong> {fmtDate(selected.travelStart)}</span>}
            {selected.travelEnd && <span><strong>Bis:</strong> {fmtDate(selected.travelEnd)}</span>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-sm">Positionen & Belege</span>
            <span className="text-xs text-gray-400">Belege manuell oder per KI prüfen</span>
          </div>
          <div className="divide-y divide-gray-100">
            {(selected.items || []).map(item => {
              const result = verifyResults[item.id]
              return (
                <div key={item.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 grid grid-cols-4 gap-3 text-sm">
                      <span className="font-medium">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</span>
                      <span className="text-gray-600">{item.description || (item.km ? `${item.km} km` : '–')}</span>
                      <span className="text-gray-500">{fmtDate(item.date)}</span>
                      <span className="font-semibold text-right">{fmtEur(item.amountEur || item.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.receiptPath ? (
                        <>
                          <a href={receiptUrl(item.receiptPath)} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            <Paperclip className="w-3 h-3" /> Beleg
                          </a>
                          <button
                            onClick={() => verifyItem(item.id)}
                            disabled={verifying[item.id]}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                          >
                            {verifying[item.id]
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Brain className="w-3 h-3" />}
                            KI prüfen
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Kein Beleg</span>
                      )}
                    </div>
                  </div>

                  {result && (
                    <div className={`mt-3 p-3 rounded-lg border text-xs ${result.isValidReceipt ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-1.5 font-medium mb-1.5">
                        {result.isValidReceipt
                          ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">KI: Gültiger Beleg</span></>
                          : <><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span className="text-red-700">KI: Kein gültiger Beleg erkannt</span></>
                        }
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-gray-600">
                        {result.vendor && <span><strong>Händler:</strong> {result.vendor}</span>}
                        {result.date && <span><strong>Datum:</strong> {result.date}</span>}
                        {result.amount != null && <span><strong>Betrag:</strong> {result.amount} {result.currency || 'EUR'}</span>}
                        {result.description && <span className="col-span-3"><strong>Beschreibung:</strong> {result.description}</span>}
                      </div>
                      {result.notes && (
                        <p className="mt-1 text-amber-700 bg-amber-50 rounded px-2 py-1">{result.notes}</p>
                      )}
                      {result.amount != null && Math.abs(result.amount - (item.amountEur || item.amount)) > 0.01 && (
                        <p className="mt-1 font-medium text-amber-700">
                          ⚠ Abweichung: Beleg zeigt {result.amount} {result.currency || 'EUR'}, erfasst {fmtEur(item.amountEur || item.amount)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function ReportTable({ items, actionLabel, onRowClick }) {
    if (items.length === 0) return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Keine Einträge</div>
    )
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mitarbeiter</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Titel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reiseziel</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} onClick={() => onRowClick(r)}
                className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-medium">{r.user?.name}</td>
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3 text-gray-500">{r.destination || '–'}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtEur(r.totalAmount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[r.status]?.cls}`}>{STATUS_MAP[r.status]?.label}</span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-blue-600 font-medium">{actionLabel} →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {isTeamLead && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Vorgenehmigung — Mein Team</h2>
          <ReportTable items={teamItems} actionLabel="Vorprüfen" onRowClick={selectReport} />
        </div>
      )}
      {isCCHead && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Genehmigung — CC</h2>
          <ReportTable items={ccItems} actionLabel="Prüfen" onRowClick={selectReport} />
          {processed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Bearbeitet ({processed.length})</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {processed.map(r => (
                      <tr key={r.id} onClick={() => selectReport(r)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-medium">{r.user?.name}</td>
                        <td className="px-4 py-3">{r.title}</td>
                        <td className="px-4 py-3 text-gray-500">{r.destination || '–'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtEur(r.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[r.status]?.cls}`}>{STATUS_MAP[r.status]?.label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

function EinstellungenTab({ isCCHead }) {
  const [rate, setRate] = useState(null)
  const [newRate, setNewRate] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    api.get('/expenses/mileage-rate').then(r => { setRate(r); setNewRate(String(r?.ratePerKm || 0.30)) }).catch(() => {})
  }, [])

  async function handleSave() {
    try {
      const updated = await api.put('/expenses/mileage-rate', { ratePerKm: parseFloat(newRate) })
      setRate(updated)
      setEditing(false)
      toast.success('Kilometersatz aktualisiert')
    } catch { toast.error('Fehler') }
  }

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">Kilometersatz</h3>
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <input type="number" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32" />
              <span className="text-sm text-gray-500">€/km</span>
              <button onClick={handleSave} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Speichern</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Abbrechen</button>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">{rate?.ratePerKm?.toFixed(2) || '0.30'} €</span>
              <span className="text-sm text-gray-500">pro km</span>
              {isCCHead && (
                <button onClick={() => setEditing(true)} className="ml-3 text-sm text-blue-600 hover:text-blue-800">Ändern</button>
              )}
            </>
          )}
        </div>
        {rate?.validFrom && (
          <p className="text-xs text-gray-400 mt-2">Gültig seit {fmtDate(rate.validFrom)}</p>
        )}
      </div>
    </div>
  )
}

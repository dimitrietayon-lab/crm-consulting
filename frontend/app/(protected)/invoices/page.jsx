'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import { FileSpreadsheet, Plus, Trash2, Download, CheckCircle, XCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const STATUS_MAP = {
  draft: { label: 'Entwurf', cls: 'bg-gray-100 text-gray-700' },
  pre_approved: { label: 'Vorgeprüft', cls: 'bg-purple-100 text-purple-800' },
  approved: { label: 'Genehmigt', cls: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Abgelehnt', cls: 'bg-red-100 text-red-800' },
  sent: { label: 'Versendet', cls: 'bg-blue-100 text-blue-800' },
  partially_paid: { label: 'Teilbezahlt', cls: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Bezahlt', cls: 'bg-green-100 text-green-800' },
  overdue: { label: 'Überfällig', cls: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Storniert', cls: 'bg-gray-100 text-gray-500' },
}

const BILLING_MODELS = [
  { value: 'time_material', label: 'Zeit & Material' },
  { value: 'fixed_price', label: 'Festpreis' },
  { value: 'retainer', label: 'Retainer' },
]

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('de-DE') : '–' }
function fmtEur(n) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }

export default function InvoicesPage() {
  const [tab, setTab] = useState('rechnungen')
  const [ledCCs, setLedCCs] = useState([])
  const [ledTeams, setLedTeams] = useState([])
  const user = getUser()

  useEffect(() => {
    api.post('/invoices/mark-overdue').catch(() => {})
    api.get('/teams/led-cc').then(setLedCCs).catch(() => {})
    api.get('/teams/led').then(setLedTeams).catch(() => {})
  }, [])

  const isCCHead = user?.role === 'admin' || ledCCs.length > 0
  const isTeamLead = ledTeams.length > 0

  const tabs = [
    { key: 'rechnungen', label: 'Rechnungen' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'neu', label: 'Neue Rechnung' },
    ...((isCCHead || isTeamLead) ? [{ key: 'genehmigung', label: 'Genehmigung' }] : []),
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Ausgangsrechnungen</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rechnungen' && <RechnungenTab />}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'neu' && <NeueRechnungTab onCreated={() => setTab('rechnungen')} />}
      {tab === 'genehmigung' && <GenehmigungTab user={user} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
    </div>
  )
}

function RechnungenTab() {
  const [invoices, setInvoices] = useState([])
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit: 'Tage', unitPrice: '' })
  const [cnForm, setCnForm] = useState({ amount: '', reason: '' })

  useEffect(() => { load() }, [filterStatus])

  async function load() {
    try { setInvoices(await api.get(`/invoices${filterStatus ? `?status=${filterStatus}` : ''}`)) } catch {}
  }

  async function loadDetail(id) {
    try { setSelected(await api.get(`/invoices/${id}`)) } catch {}
  }

  async function handleStatus(id, status, paidAmount) {
    try {
      await api.put(`/invoices/${id}/status`, { status, ...(paidAmount !== undefined && { paidAmount }) })
      toast.success('Status aktualisiert')
      load()
      if (selected?.id === id) loadDetail(id)
    } catch { toast.error('Fehler') }
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!selected || !itemForm.description || !itemForm.unitPrice) return toast.error('Fehlende Felder')
    try {
      await api.post(`/invoices/${selected.id}/items`, {
        ...itemForm, quantity: parseFloat(itemForm.quantity), unitPrice: parseFloat(itemForm.unitPrice),
      })
      toast.success('Position hinzugefügt')
      setItemForm({ description: '', quantity: 1, unit: 'Tage', unitPrice: '' })
      loadDetail(selected.id)
    } catch { toast.error('Fehler') }
  }

  async function handleDeleteItem(itemId) {
    try {
      await api.delete(`/invoices/${selected.id}/items/${itemId}`)
      toast.success('Gelöscht')
      loadDetail(selected.id)
    } catch { toast.error('Fehler') }
  }

  async function handleCreditNote(e) {
    e.preventDefault()
    if (!cnForm.amount) return
    try {
      await api.post(`/invoices/${selected.id}/credit-note`, cnForm)
      toast.success('Gutschrift erstellt')
      setCnForm({ amount: '', reason: '' })
      loadDetail(selected.id)
    } catch { toast.error('Fehler') }
  }

  async function exportCsv() {
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/invoices/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'rechnungen.csv'; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  if (selected) {
    const remaining = selected.total - selected.paidAmount
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">← Zurück</button>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[selected.status]?.cls}`}>{STATUS_MAP[selected.status]?.label}</span>
            {selected.status === 'draft' && (
              <button onClick={() => handleStatus(selected.id, 'sent')} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Versenden</button>
            )}
            {['sent', 'overdue', 'partially_paid'].includes(selected.status) && (
              <button onClick={() => handleStatus(selected.id, 'paid', selected.total)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Als bezahlt markieren</button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{selected.invoiceNumber}</h2>
              <p className="text-gray-600 mt-1">{selected.account?.companyName}</p>
              {selected.project && <p className="text-sm text-gray-500">Projekt: {selected.project.name}</p>}
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1">
              <p>Rechnungsdatum: {fmtDate(selected.issueDate)}</p>
              <p>Fällig: {fmtDate(selected.dueDate)}</p>
              <p>Modell: {BILLING_MODELS.find(b => b.value === selected.billingModel)?.label || selected.billingModel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">Positionen</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Beschreibung</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Menge</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Einheit</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Einzelpreis</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Gesamt</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(selected.lineItems || []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Noch keine Positionen</td></tr>
              ) : (selected.lineItems || []).map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-gray-500">{item.unit || '–'}</td>
                  <td className="px-4 py-2 text-right">{fmtEur(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtEur(item.amount)}</td>
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
            <tfoot className="border-t border-gray-200 text-sm">
              <tr><td colSpan={4} className="px-4 py-2 text-right text-gray-600">Netto</td><td className="px-4 py-2 text-right">{fmtEur(selected.subtotal)}</td><td /></tr>
              <tr><td colSpan={4} className="px-4 py-2 text-right text-gray-600">MwSt. ({selected.vatRate}%)</td><td className="px-4 py-2 text-right">{fmtEur(selected.vatAmount)}</td><td /></tr>
              <tr className="font-bold"><td colSpan={4} className="px-4 py-2 text-right">Brutto</td><td className="px-4 py-2 text-right">{fmtEur(selected.total)}</td><td /></tr>
              {selected.paidAmount > 0 && <tr><td colSpan={4} className="px-4 py-2 text-right text-green-600">Bezahlt</td><td className="px-4 py-2 text-right text-green-600">{fmtEur(selected.paidAmount)}</td><td /></tr>}
              {remaining > 0.01 && <tr><td colSpan={4} className="px-4 py-2 text-right text-red-600 font-medium">Offen</td><td className="px-4 py-2 text-right text-red-600 font-medium">{fmtEur(remaining)}</td><td /></tr>}
            </tfoot>
          </table>
        </div>

        {selected.status === 'draft' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold mb-3 text-sm">Position hinzufügen</h3>
            <form onSubmit={handleAddItem} className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung *</label>
                <input type="text" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="w-20">
                <label className="block text-xs font-medium text-gray-700 mb-1">Menge</label>
                <input type="number" step="0.1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-gray-700 mb-1">Einheit</label>
                <input type="text" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-700 mb-1">Einzelpreis (€) *</label>
                <input type="number" step="0.01" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap">Hinzufügen</button>
            </form>
          </div>
        )}

        {(selected.creditNotes || []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">Gutschriften</div>
            {selected.creditNotes.map(cn => (
              <div key={cn.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div>
                  <span className="font-medium text-sm">{cn.number}</span>
                  {cn.reason && <span className="text-xs text-gray-500 ml-2">{cn.reason}</span>}
                </div>
                <span className="font-semibold text-red-600">-{fmtEur(cn.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {['sent', 'overdue', 'partially_paid'].includes(selected.status) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold mb-3 text-sm">Gutschrift erstellen</h3>
            <form onSubmit={handleCreditNote} className="flex gap-3 items-end">
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-700 mb-1">Betrag (€)</label>
                <input type="number" step="0.01" value={cnForm.amount} onChange={e => setCnForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Grund</label>
                <input type="text" value={cnForm.reason} onChange={e => setCnForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">Gutschrift</button>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fällig</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Brutto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keine Rechnungen vorhanden</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} onClick={() => loadDetail(inv.id)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-mono text-sm font-medium">{inv.invoiceNumber}</td>
                <td className="px-4 py-3">{inv.account?.companyName}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(inv.issueDate)}</td>
                <td className={`px-4 py-3 ${inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{fmtDate(inv.dueDate)}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtEur(inv.total)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[inv.status]?.cls}`}>{STATUS_MAP[inv.status]?.label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DashboardTab() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/invoices/dashboard').then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="text-center py-8 text-gray-400">Lade Daten...</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Umsatz gesamt', value: fmtEur(data.stats.total), cls: 'text-gray-900' },
          { label: 'Bezahlt', value: fmtEur(data.stats.paid), cls: 'text-green-600' },
          { label: 'Ausstehend', value: fmtEur(data.stats.outstanding), cls: 'text-yellow-600' },
          { label: 'Überfällig', value: fmtEur(data.stats.overdue), cls: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-4">Umsatz der letzten 6 Monate</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.monthly}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => fmtEur(v)} />
            <Legend />
            <Bar dataKey="total" name="Fakturiert" fill="#3b82f6" />
            <Bar dataKey="paid" name="Bezahlt" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function GenehmigungTab({ user, isCCHead, isTeamLead }) {
  const [teamItems, setTeamItems] = useState([])
  const [ccItems, setCcItems]     = useState([])
  const [commentMap, setCommentMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id, isCCHead, isTeamLead])

  async function load() {
    setLoading(true)
    try {
      const ccScope = user?.role !== 'admin' ? `&ccLeaderId=${user.id}` : ''
      const [teamDraft, ccPreApproved] = await Promise.all([
        isTeamLead ? api.get(`/invoices?status=draft&managerId=${user.id}`) : Promise.resolve([]),
        isCCHead   ? api.get(`/invoices?status=pre_approved${ccScope}`) : Promise.resolve([]),
      ])
      setTeamItems(Array.isArray(teamDraft) ? teamDraft : [])
      setCcItems(Array.isArray(ccPreApproved) ? ccPreApproved : [])
    } catch { toast.error('Fehler beim Laden') }
    setLoading(false)
  }

  async function handlePreApprove(id) {
    try {
      await api.put(`/invoices/${id}/pre-approve`, { comment: commentMap[id] || null })
      setTeamItems(prev => prev.filter(inv => inv.id !== id))
      toast.success('Rechnung vorgeprüft')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  async function handleApprove(id) {
    try {
      await api.put(`/invoices/${id}/approve`, { comment: commentMap[id] || null })
      setCcItems(prev => prev.filter(inv => inv.id !== id))
      toast.success('Rechnung genehmigt')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  async function handleReject(id) {
    if (!commentMap[id]?.trim()) { toast.error('Bitte einen Ablehnungsgrund angeben'); return }
    try {
      await api.put(`/invoices/${id}/reject`, { comment: commentMap[id] })
      setCcItems(prev => prev.filter(inv => inv.id !== id))
      toast.success('Rechnung abgelehnt')
    } catch (err) { toast.error(err.message || 'Fehler') }
  }

  if (loading) return <div className="text-center py-10 text-gray-400 text-sm">Laden...</div>

  function InvoiceCard({ inv, children }) {
    return (
      <div className="bg-white border border-yellow-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 text-sm font-mono">{inv.invoiceNumber}</p>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[inv.status]?.cls}`}>
                {STATUS_MAP[inv.status]?.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span>{inv.account?.companyName}</span>
              {inv.project && <span>Projekt: {inv.project.name}</span>}
              <span>Fällig: {fmtDate(inv.dueDate)}</span>
            </div>
            <input
              type="text"
              placeholder="Kommentar (bei Ablehnung erforderlich)"
              value={commentMap[inv.id] || ''}
              onChange={e => setCommentMap(p => ({ ...p, [inv.id]: e.target.value }))}
              className="mt-2 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <p className="font-bold text-gray-900">{fmtEur(inv.total)}</p>
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
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Keine Rechnungen zur Vorprüfung
            </div>
          ) : (
            <div className="space-y-3">
              {teamItems.map(inv => (
                <InvoiceCard key={inv.id} inv={inv}>
                  <button
                    onClick={() => handlePreApprove(inv.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                  >
                    <CheckCircle size={12} /> Vorprüfen
                  </button>
                </InvoiceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {isCCHead && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Genehmigung — CC</h2>
          {ccItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Keine vorgeprüften Rechnungen zur Genehmigung
            </div>
          ) : (
            <div className="space-y-3">
              {ccItems.map(inv => (
                <InvoiceCard key={inv.id} inv={inv}>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleApprove(inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle size={12} /> Genehmigen
                    </button>
                    <button
                      onClick={() => handleReject(inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                    >
                      <XCircle size={12} /> Ablehnen
                    </button>
                  </div>
                </InvoiceCard>
              ))}
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

function NeueRechnungTab({ onCreated }) {
  const [step, setStep] = useState(1)
  const [accounts, setAccounts] = useState([])
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({
    accountId: '', projectId: '', billingModel: 'time_material',
    dueDate: '', vatRate: 19, notes: '', paymentTerms: 'Zahlbar innerhalb 30 Tagen',
  })
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit: 'Tage', unitPrice: '' })

  useEffect(() => {
    api.get('/accounts').then(setAccounts).catch(() => {})
    api.get('/projects').then(setProjects).catch(() => {})
  }, [])

  function addItem() {
    if (!newItem.description || !newItem.unitPrice) return toast.error('Beschreibung und Einzelpreis erforderlich')
    const qty = parseFloat(newItem.quantity)
    const price = parseFloat(newItem.unitPrice)
    setItems(prev => [...prev, { ...newItem, quantity: qty, unitPrice: price, amount: qty * price, id: Date.now() }])
    setNewItem({ description: '', quantity: 1, unit: 'Tage', unitPrice: '' })
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const vatAmount = subtotal * (form.vatRate / 100)
  const total = subtotal + vatAmount

  async function handleCreate() {
    if (!form.accountId || !form.dueDate) return toast.error('Bitte alle Pflichtfelder ausfüllen')
    try {
      const inv = await api.post('/invoices', form)
      for (const item of items) {
        await api.post(`/invoices/${inv.id}/items`, item)
      }
      toast.success(`Rechnung ${inv.invoiceNumber} erstellt`)
      onCreated()
    } catch { toast.error('Fehler beim Erstellen') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex gap-4 mb-2">
        {['Stammdaten', 'Positionen', 'Vorschau'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>{s}</span>
            {i < 2 && <div className="w-12 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Stammdaten</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
            <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Kunde wählen...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Kein Projekt</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Abrechnungsmodell</label>
            <select value={form.billingModel} onChange={e => setForm(f => ({ ...f, billingModel: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {BILLING_MODELS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeitsdatum *</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsbedingungen</label>
            <input type="text" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Weiter →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Positionen</h3>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <span className="flex-1">{item.description}</span>
                <span className="text-gray-500 mx-4">{item.quantity} × {fmtEur(item.unitPrice)}</span>
                <span className="font-medium w-24 text-right">{fmtEur(item.amount)}</span>
                <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="ml-3 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium">Position hinzufügen</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input type="text" placeholder="Beschreibung *" value={newItem.description} onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <input type="number" step="0.1" placeholder="Menge" value={newItem.quantity} onChange={e => setNewItem(f => ({ ...f, quantity: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input type="text" placeholder="Einheit" value={newItem.unit} onChange={e => setNewItem(f => ({ ...f, unit: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input type="number" step="0.01" placeholder="Einzelpreis (€) *" value={newItem.unitPrice} onChange={e => setNewItem(f => ({ ...f, unitPrice: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-900">
                <Plus className="w-3.5 h-3.5" /> Hinzufügen
              </button>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">← Zurück</button>
            <button onClick={() => setStep(3)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Weiter →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold">Vorschau & MwSt.</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MwSt.-Satz (%)</label>
            <input type="number" step="1" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: parseFloat(e.target.value) }))}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Nettobetrag</span><span>{fmtEur(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">MwSt. ({form.vatRate}%)</span><span>{fmtEur(vatAmount)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Bruttobetrag</span><span>{fmtEur(total)}</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">← Zurück</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Rechnung erstellen</button>
          </div>
        </div>
      )}
    </div>
  )
}

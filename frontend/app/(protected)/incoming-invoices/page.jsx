'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { ArrowDownToLine, Plus, Trash2, Download, Building2 } from 'lucide-react'

const STATUS_MAP = {
  pending: { label: 'Offen', cls: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Genehmigt', cls: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Bezahlt', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Abgelehnt', cls: 'bg-red-100 text-red-800' },
}

const CATEGORIES = [
  { value: 'subcontractor', label: 'Subunternehmer' },
  { value: 'travel', label: 'Reisekosten' },
  { value: 'software', label: 'Software' },
  { value: 'office', label: 'Büro' },
  { value: 'other', label: 'Sonstiges' },
]

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('de-DE') : '–' }
function fmtEur(n) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }

function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
}

export default function IncomingInvoicesPage() {
  const [tab, setTab] = useState('rechnungen')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ArrowDownToLine className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Eingangsrechnungen</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'rechnungen', label: 'Eingangsrechnungen' },
          { key: 'kalender', label: 'Zahlungskalender' },
          { key: 'lieferanten', label: 'Lieferanten' },
          { key: 'berichte', label: 'Berichte' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rechnungen' && <RechnungenTab />}
      {tab === 'kalender' && <KalenderTab />}
      {tab === 'lieferanten' && <LieferantenTab />}
      {tab === 'berichte' && <BerichteTab />}
    </div>
  )
}

function RechnungenTab() {
  const [invoices, setInvoices] = useState([])
  const [vendors, setVendors] = useState([])
  const [projects, setProjects] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({
    vendorId: '', vendorName: '', invoiceNumber: '', invoiceDate: '', dueDate: '',
    amount: '', vatRate: 19, currency: 'EUR', category: 'other', projectId: '', description: '',
  })

  useEffect(() => {
    load()
    api.get('/incoming-invoices/vendors').then(setVendors).catch(() => {})
    api.get('/projects').then(setProjects).catch(() => {})
  }, [filterStatus])

  async function load() {
    try { setInvoices(await api.get(`/incoming-invoices${filterStatus ? `?status=${filterStatus}` : ''}`)) } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.invoiceDate || !form.amount || !form.category) return toast.error('Pflichtfelder fehlen')
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const vatAmount = parseFloat(form.amount) * (parseFloat(form.vatRate) / 100)
      const formData = new FormData()
      Object.entries({ ...form, vatAmount: vatAmount.toFixed(2) }).forEach(([k, v]) => { if (v) formData.append(k, v) })
      const res = await fetch(`${baseUrl}/incoming-invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error()
      toast.success('Rechnung erfasst')
      setShowCreate(false)
      setForm({ vendorId: '', vendorName: '', invoiceNumber: '', invoiceDate: '', dueDate: '', amount: '', vatRate: 19, currency: 'EUR', category: 'other', projectId: '', description: '' })
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleAction(id, action) {
    try {
      await api.put(`/incoming-invoices/${id}/${action}`)
      toast.success(action === 'approve' ? 'Genehmigt' : action === 'mark-paid' ? 'Als bezahlt markiert' : 'Abgelehnt')
      load()
    } catch { toast.error('Fehler') }
  }

  async function exportCsv() {
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/incoming-invoices/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'eingangsrechnungen.csv'; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Rechnung erfassen
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">Eingangsrechnung erfassen</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant</label>
              <select value={form.vendorId} onChange={e => {
                const v = vendors.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, vendorId: e.target.value, vendorName: v?.name || f.vendorName }))
              }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Lieferant wählen...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferantenname *</label>
              <input type="text" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsnummer</label>
              <input type="text" value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum *</label>
              <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeitsdatum</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nettobetrag (€) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. (%)</label>
              <input type="number" step="1" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Speichern</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lieferant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Re.-Nummer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fällig</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Betrag</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kategorie</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Eingangsrechnungen</td></tr>
            ) : invoices.map(inv => {
              const days = daysUntil(inv.dueDate)
              return (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{inv.vendor?.name || inv.vendorName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inv.invoiceNumber || '–'}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(inv.invoiceDate)}</td>
                  <td className={`px-4 py-3 ${days !== null && days < 0 && inv.status !== 'paid' ? 'text-red-600 font-medium' : days !== null && days <= 7 && inv.status !== 'paid' ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                    {fmtDate(inv.dueDate)}
                    {days !== null && !['paid', 'rejected'].includes(inv.status) && (
                      <span className="ml-1 text-xs">({days < 0 ? `${Math.abs(days)}d überfällig` : `${days}d`})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtEur(inv.amountEur || inv.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{CATEGORIES.find(c => c.value === inv.category)?.label || inv.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[inv.status]?.cls}`}>{STATUS_MAP[inv.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      {inv.status === 'pending' && (
                        <>
                          <button onClick={() => handleAction(inv.id, 'approve')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Genehmigen</button>
                          <button onClick={() => handleAction(inv.id, 'reject')} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Ablehnen</button>
                        </>
                      )}
                      {inv.status === 'approved' && (
                        <button onClick={() => handleAction(inv.id, 'mark-paid')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Bezahlt</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KalenderTab() {
  const [buckets, setBuckets] = useState({ '0-30': [], '31-60': [], '61-90': [] })

  useEffect(() => {
    async function load() {
      try {
        const all = await api.get('/incoming-invoices?status=approved')
        const now = new Date()
        const b = { '0-30': [], '31-60': [], '61-90': [] }
        all.forEach(inv => {
          if (!inv.dueDate) return
          const days = Math.ceil((new Date(inv.dueDate) - now) / (1000 * 60 * 60 * 24))
          if (days <= 30) b['0-30'].push(inv)
          else if (days <= 60) b['31-60'].push(inv)
          else if (days <= 90) b['61-90'].push(inv)
        })
        setBuckets(b)
      } catch {}
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fälligkeiten der nächsten 90 Tage</h2>
      {[
        { key: '0-30', label: 'Nächste 30 Tage', cls: 'text-red-600' },
        { key: '31-60', label: '31–60 Tage', cls: 'text-yellow-600' },
        { key: '61-90', label: '61–90 Tage', cls: 'text-gray-600' },
      ].map(({ key, label, cls }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-medium text-sm ${cls}`}>{label}</h3>
            <span className="text-sm text-gray-500">{fmtEur(buckets[key].reduce((s, i) => s + (i.amountEur || i.amount), 0))}</span>
          </div>
          {buckets[key].length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-100 p-4 text-center text-sm text-gray-400">Keine fälligen Rechnungen</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {buckets[key].map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{inv.vendor?.name || inv.vendorName}</td>
                      <td className="px-4 py-3 text-gray-500">{inv.invoiceNumber || '–'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtEur(inv.amountEur || inv.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function LieferantenTab() {
  const [vendors, setVendors] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editVendor, setEditVendor] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', vatNumber: '', iban: '' })

  useEffect(() => { load() }, [])

  async function load() {
    try { setVendors(await api.get('/incoming-invoices/vendors')) } catch {}
  }

  function openCreate() { setEditVendor(null); setForm({ name: '', email: '', phone: '', address: '', vatNumber: '', iban: '' }); setShowForm(true) }
  function openEdit(v) { setEditVendor(v); setForm({ name: v.name, email: v.email || '', phone: v.phone || '', address: v.address || '', vatNumber: v.vatNumber || '', iban: v.iban || '' }); setShowForm(true) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name) return toast.error('Name erforderlich')
    try {
      if (editVendor) {
        await api.put(`/incoming-invoices/vendors/${editVendor.id}`, form)
        toast.success('Lieferant aktualisiert')
      } else {
        await api.post('/incoming-invoices/vendors', form)
        toast.success('Lieferant erstellt')
      }
      setShowForm(false)
      load()
    } catch { toast.error('Fehler') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Lieferanten</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Lieferant anlegen
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">{editVendor ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">USt-IdNr.</label>
              <input type="text" value={form.vatNumber} onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
              <input type="text" value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Speichern</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map(v => (
          <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-sm">{v.name}</h3>
              </div>
              <button onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:text-blue-800">Bearbeiten</button>
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-500">
              {v.email && <p>{v.email}</p>}
              {v.phone && <p>{v.phone}</p>}
              {v.vatNumber && <p>USt-IdNr.: {v.vatNumber}</p>}
              {v.iban && <p className="font-mono">{v.iban}</p>}
            </div>
          </div>
        ))}
        {vendors.length === 0 && (
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Noch keine Lieferanten angelegt
          </div>
        )}
      </div>
    </div>
  )
}

function BerichteTab() {
  const [report, setReport] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => { load() }, [year])

  async function load() {
    try { setReport(await api.get(`/incoming-invoices/report?year=${year}`)) } catch {}
  }

  async function exportCsv() {
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/incoming-invoices/export/csv?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `eingangsrechnungen-${year}.csv`; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  const total = report.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Jahr:</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between">
          <span className="font-semibold text-sm">Kosten nach Projekt</span>
          <span className="font-semibold text-sm">{fmtEur(total)}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Projekt</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Anzahl</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Gesamt</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {report.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Keine Daten</td></tr>
            ) : report.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{row.project}</td>
                <td className="px-4 py-3 text-right text-gray-500">{row.count}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtEur(row.total)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{total > 0 ? Math.round((row.total / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Shuffle, Check, X, Lightbulb, Plus, Trash2 } from 'lucide-react'

const SERVICE_TYPES = ['Strategy', 'Regulation', 'IT', 'Risk', 'Audit', 'Finance', 'Operations', 'HR', 'Legal', 'Digital']

const STAGES = ['First Contact', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const STAGE_COLORS = {
  'First Contact': 'bg-gray-100 text-gray-700',
  'Qualified':     'bg-blue-100 text-blue-700',
  'Proposal':      'bg-purple-100 text-purple-700',
  'Negotiation':   'bg-amber-100 text-amber-700',
  'Closed Won':    'bg-green-100 text-green-700',
  'Closed Lost':   'bg-red-100 text-red-700',
}

const TABS = [
  { id: 'matrix',      label: 'Service-Matrix' },
  { id: 'whitespace',  label: 'White Space' },
  { id: 'suggestions', label: 'Vorschläge' },
  { id: 'pipeline',    label: 'Pipeline' },
]

// ─── Create Deal Modal ────────────────────────────────────────────────────────

function CreateDealModal({ initialAccountId, initialAccountName, initialServiceType, allAccounts = [], onClose, onCreated }) {
  const [accountId, setAccountId]     = useState(initialAccountId || '')
  const [serviceType, setServiceType] = useState(initialServiceType || '')
  const [title, setTitle]             = useState(
    initialAccountName && initialServiceType
      ? `Cross-Selling: ${initialServiceType} – ${initialAccountName}`
      : ''
  )
  const [value, setValue]   = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  function handleAccountChange(id) {
    setAccountId(id)
    const acc = allAccounts.find((a) => a.id === id)
    if (acc && serviceType) setTitle(`Cross-Selling: ${serviceType} – ${acc.companyName}`)
  }

  function handleServiceTypeChange(st) {
    setServiceType(st)
    const acc = allAccounts.find((a) => a.id === accountId)
    const name = acc?.companyName || initialAccountName || ''
    if (name) setTitle(`Cross-Selling: ${st} – ${name}`)
  }

  async function handleCreate() {
    if (!accountId || !serviceType) return
    setSaving(true)
    try {
      const deal = await api.post('/cross-selling/create-deal', {
        accountId,
        serviceType,
        title: title.trim() || `Cross-Selling: ${serviceType}`,
        value: value ? parseFloat(value) : undefined,
        notes: notes || undefined,
      })
      toast.success('Deal angelegt')
      onCreated(deal)
    } catch {
      toast.error('Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Cross-Selling Deal anlegen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          {/* Account */}
          {initialAccountId ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{initialAccountName}</div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account *</label>
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Account wählen...</option>
                {allAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.companyName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Service Type */}
          {initialServiceType ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service-Typ</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{initialServiceType}</div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service-Typ *</label>
              <select
                value={serviceType}
                onChange={(e) => handleServiceTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Service-Typ wählen...</option>
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Wert (€)</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
          <button
            onClick={handleCreate}
            disabled={saving || !accountId || !serviceType}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Speichern...' : 'Deal anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Service-Matrix ───────────────────────────────────────────────────────────

function ServiceMatrixTab() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/cross-selling/service-map')
      .then((d) => setData(d))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>
  if (!data) return null

  const { serviceTypes, accounts } = data

  return (
    <div className="space-y-3">
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-700"><Check size={11} /></span>
        Deal vorhanden
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 text-blue-700"><Check size={11} /></span>
        Nur Projekt
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 text-gray-300"><X size={10} /></span>
        Nicht genutzt
      </span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50 border-r border-gray-200">
              Account
            </th>
            {serviceTypes.map((type) => (
              <th key={type} className="px-3 py-3 text-xs font-semibold text-gray-600 text-center whitespace-nowrap">
                {type}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((acc) => (
            <tr key={acc.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-200 whitespace-nowrap">
                <div>
                  <span>{acc.companyName}</span>
                  <span className="ml-2 text-xs text-gray-400">{acc.institutionType}</span>
                </div>
              </td>
              {serviceTypes.map((type) => {
                const deals    = acc.dealCounts?.[type] || 0
                const projects = acc.projectCounts?.[type] || 0
                const used     = acc.usedTypes.includes(type)
                const parts    = []
                if (deals)    parts.push(`${deals} Deal(s)`)
                if (projects) parts.push(`${projects} Projekt(e)`)
                const tooltip  = used ? parts.join(', ') : 'Nicht genutzt'
                // color: both=green, project-only=blue, deal-only=green
                const cellCls  = !used
                  ? 'bg-gray-100 text-gray-300'
                  : projects && !deals
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                return (
                  <td key={type} className="px-3 py-3 text-center">
                    <div
                      title={tooltip}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium cursor-default ${cellCls}`}
                    >
                      {used ? <Check size={14} /> : <X size={12} />}
                    </div>
                    {used && (deals + projects) > 1 && (
                      <div className="text-xs text-gray-400 mt-0.5">{deals + projects}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

// ─── White Space ──────────────────────────────────────────────────────────────

function WhiteSpaceTab({ allAccounts, onDealCreated }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)

  useEffect(() => {
    api.get('/cross-selling/white-space')
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <>
      {modal && (
        <CreateDealModal
          {...modal}
          allAccounts={allAccounts}
          onClose={() => setModal(null)}
          onCreated={(deal) => { setModal(null); onDealCreated(deal) }}
        />
      )}

      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          {accounts.length} Accounts mit weniger als 3 genutzten Service-Typen — klicken Sie auf einen fehlenden Service um einen Deal anzulegen
        </p>

        {accounts.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Alle Accounts nutzen 3+ Services — kein White Space erkannt</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Genutzte Services</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fehlende Services (klicken zum Anlegen)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{acc.companyName}</p>
                      <p className="text-xs text-gray-400">{acc.institutionType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {acc.usedTypes.length === 0 ? (
                          <span className="text-xs text-gray-400">Keine</span>
                        ) : acc.usedTypes.map((t) => (
                          <span key={t} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {acc.missingTypes.slice(0, 5).map((t) => (
                          <button
                            key={t}
                            onClick={() => setModal({ initialAccountId: acc.id, initialAccountName: acc.companyName, initialServiceType: t })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 border border-transparent hover:border-emerald-200 transition-colors"
                          >
                            <Plus size={10} />
                            {t}
                          </button>
                        ))}
                        {acc.missingTypes.length > 5 && (
                          <span className="text-xs text-gray-400">+{acc.missingTypes.length - 5}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

function SuggestionsTab({ allAccounts, onDealCreated }) {
  const [accounts, setAccounts]       = useState([])
  const [suggestions, setSuggestions] = useState({})
  const [loading, setLoading]         = useState(true)
  const [loadingSugg, setLoadingSugg] = useState({})
  const [modal, setModal]             = useState(null)

  useEffect(() => {
    api.get('/accounts')
      .then((data) => {
        const accs = data?.accounts || data || []
        setAccounts(Array.isArray(accs) ? accs : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function loadSuggestions(accountId) {
    if (suggestions[accountId]) return
    setLoadingSugg((prev) => ({ ...prev, [accountId]: true }))
    try {
      const data = await api.get(`/cross-selling/suggestions/${accountId}`)
      setSuggestions((prev) => ({ ...prev, [accountId]: data }))
    } catch {
      toast.error('Fehler beim Laden der Vorschläge')
    } finally {
      setLoadingSugg((prev) => ({ ...prev, [accountId]: false }))
    }
  }

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <>
      {modal && (
        <CreateDealModal
          {...modal}
          allAccounts={allAccounts}
          onClose={() => setModal(null)}
          onCreated={(deal) => { setModal(null); onDealCreated(deal) }}
        />
      )}

      <div className="space-y-3">
        <p className="text-sm text-gray-500">Klicken Sie auf einen Account, um personalisierte Service-Empfehlungen zu erhalten</p>
        {accounts.map((acc) => {
          const sugg      = suggestions[acc.id]
          const isLoading = loadingSugg[acc.id]
          return (
            <div key={acc.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                onClick={() => loadSuggestions(acc.id)}
              >
                <div>
                  <span className="font-medium text-gray-900">{acc.companyName}</span>
                  <span className="ml-2 text-xs text-gray-400">{acc.institutionType}</span>
                </div>
                <Lightbulb size={16} className="text-amber-400 shrink-0" />
              </button>

              {isLoading && (
                <div className="px-4 pb-3 text-xs text-gray-400">Lade Vorschläge...</div>
              )}

              {sugg && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100">
                  {sugg.suggestions.length === 0 ? (
                    <p className="text-sm text-gray-400 pt-2">Keine Vorschläge — Account nutzt bereits alle gängigen Services</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 pt-2">
                        Basierend auf {sugg.peerCount} ähnlichen Unternehmen ({sugg.account.institutionType}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sugg.suggestions.map((s) => (
                          <div key={s.serviceType} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <Lightbulb size={12} className="text-amber-500 shrink-0" />
                            <span className="text-sm font-medium text-amber-800">{s.serviceType}</span>
                            <span className="text-xs text-amber-500">({s.peerCount} Peers)</span>
                            <button
                              onClick={() => setModal({
                                initialAccountId: acc.id,
                                initialAccountName: acc.companyName,
                                initialServiceType: s.serviceType,
                              })}
                              className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors"
                            >
                              <Plus size={10} />
                              Deal
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab({ allAccounts }) {
  const [deals, setDeals]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const loadDeals = useCallback(async () => {
    try {
      const data = await api.get('/cross-selling/pipeline')
      setDeals(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Fehler beim Laden der Pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDeals() }, [loadDeals])

  async function updateStage(dealId, stage) {
    try {
      await api.patch(`/cross-selling/pipeline/${dealId}`, { stage })
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage } : d))
    } catch {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  async function confirmDelete(dealId) {
    try {
      await api.delete(`/cross-selling/pipeline/${dealId}`)
      setDeals((prev) => prev.filter((d) => d.id !== dealId))
      setDeletingId(null)
      toast.success('Deal gelöscht')
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  function handleDealCreated(deal) {
    setDeals((prev) => [deal, ...prev])
    setModal(null)
  }

  if (loading) return <div className="py-10 text-center text-gray-500">Laden...</div>

  return (
    <>
      {modal && (
        <CreateDealModal
          allAccounts={allAccounts}
          onClose={() => setModal(null)}
          onCreated={handleDealCreated}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{deals.length} Cross-Selling Deal{deals.length !== 1 ? 's' : ''} in der Pipeline</p>
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            <Plus size={15} />
            Neuer Deal
          </button>
        </div>

        {deals.length === 0 ? (
          <div className="py-16 text-center">
            <Shuffle size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Noch keine Cross-Selling Deals</p>
            <p className="text-xs text-gray-300 mt-1">Erstellen Sie Deals über die Vorschläge, den White Space Tab oder "Neuer Deal"</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Phase</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Wert</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Titel</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{deal.account?.companyName}</p>
                      <p className="text-xs text-gray-400">{deal.account?.institutionType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                        {deal.serviceType || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={deal.stage}
                        onChange={(e) => updateStage(deal.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${STAGE_COLORS[deal.stage] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {deal.value != null ? `${Number(deal.value).toLocaleString('de-DE')} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate text-xs">{deal.title}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {deletingId === deal.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => confirmDelete(deal.id)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >Löschen</button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs text-gray-400 hover:underline"
                          >Abbrechen</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(deal.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CrossSellingPage() {
  const [activeTab, setActiveTab]   = useState('matrix')
  const [allAccounts, setAllAccounts] = useState([])
  const [pipelineKey, setPipelineKey] = useState(0)

  useEffect(() => {
    api.get('/accounts')
      .then((data) => {
        const accs = data?.accounts || data || []
        setAllAccounts(Array.isArray(accs) ? accs : [])
      })
      .catch(() => {})
  }, [])

  function onDealCreated() {
    setPipelineKey((k) => k + 1)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
          <Shuffle size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cross-Selling</h1>
          <p className="text-sm text-gray-500">Service-Nutzung, White-Space-Analyse & Empfehlungen</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
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

      {activeTab === 'matrix'      && <ServiceMatrixTab />}
      {activeTab === 'whitespace'  && <WhiteSpaceTab allAccounts={allAccounts} onDealCreated={onDealCreated} />}
      {activeTab === 'suggestions' && <SuggestionsTab allAccounts={allAccounts} onDealCreated={onDealCreated} />}
      {activeTab === 'pipeline'    && <PipelineTab key={pipelineKey} allAccounts={allAccounts} />}
    </div>
  )
}

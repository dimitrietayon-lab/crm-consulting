'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  Plus,
  Trash2,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  X,
  ArrowLeft,
} from 'lucide-react'
import api from '@/lib/api'
import { getUser } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

let tempIdCounter = 1
function generateTempId() {
  return `temp_${tempIdCounter++}`
}

function ServiceCatalogPanel({ services, onAdd }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))]

  const filtered = services.filter((s) => {
    const matchSearch =
      !search || s.name?.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Dienstkatalog
        </h3>
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Dienst suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Keine Dienste gefunden
          </p>
        ) : (
          filtered.map((service) => (
            <button
              key={service.id}
              onClick={() => onAdd(service)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {service.name}
                  </p>
                  <p className="text-xs text-gray-500">{service.category}</p>
                </div>
                <div className="text-right shrink-0">
                  {service.dayRate ? (
                    <p className="text-xs font-medium text-blue-600">
                      {formatCurrency(service.dayRate)}/{service.unit || 'Tag'}
                    </p>
                  ) : service.fixedFee ? (
                    <p className="text-xs font-medium text-blue-600">
                      {formatCurrency(service.fixedFee)} pauschal
                    </p>
                  ) : null}
                  <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100">
                    + Hinzufügen
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default function NewProposalPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [services, setServices] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [coverText, setCoverText] = useState('')
  const [scopeOfWork, setScopeOfWork] = useState('')
  const [lineItems, setLineItems] = useState([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [accountsData, servicesData] = await Promise.all([
          api.get('/accounts'),
          api.get('/proposals/services'),
        ])
        setAccounts(Array.isArray(accountsData) ? accountsData : accountsData.accounts || [])
        setServices(Array.isArray(servicesData) ? servicesData : servicesData.services || [])
      } catch (err) {
        toast.error('Daten konnten nicht geladen werden.')
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [])

  const addLineItemFromService = useCallback((service) => {
    const unitPrice = service.dayRate || service.fixedFee || 0
    const quantity = 1
    setLineItems((prev) => [
      ...prev,
      {
        id: generateTempId(),
        description: service.name,
        quantity,
        unit: service.unit || 'Tag',
        unitPrice,
        total: unitPrice * quantity,
        serviceId: service.id,
      },
    ])
    toast.success(`"${service.name}" hinzugefügt`)
  }, [])

  const addEmptyLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        id: generateTempId(),
        description: '',
        quantity: 1,
        unit: 'Tag',
        unitPrice: 0,
        total: 0,
        serviceId: null,
      },
    ])
  }, [])

  const updateLineItem = useCallback((id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          const qty =
            field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0
          const price =
            field === 'unitPrice' ? parseFloat(value) || 0 : parseFloat(item.unitPrice) || 0
          updated.total = qty * price
        }
        return updated
      })
    )
  }, [])

  const removeLineItem = useCallback((id) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
  const requiresApproval = subtotal > 50000

  const handleSave = async (sendForReview = false) => {
    if (!title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein.')
      return
    }
    if (!accountId) {
      toast.error('Bitte wählen Sie einen Account aus.')
      return
    }

    setSaving(true)
    try {
      const currentUser = getUser()
      const payload = {
        title: title.trim(),
        accountId,
        authorId: currentUser?.id || null,
        coverText,
        scopeOfWork,
        lineItems: lineItems.map(({ id, ...item }) => item),
        status: sendForReview ? 'Sent' : 'Draft',
      }
      const result = await api.post('/proposals', payload)
      toast.success(
        sendForReview ? 'Angebot gesendet.' : 'Entwurf gespeichert.'
      )
      router.push(`/proposals/${result.id || result.proposal?.id}`)
    } catch (err) {
      toast.error('Angebot konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/proposals')}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Neues Angebot
              </h1>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>Angebote</span>
                <ChevronRight className="w-3 h-3" />
                <span>Neu erstellen</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Als Entwurf speichern'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Wird gesendet...' : 'Zur Prüfung senden'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left Panel - 2/3 */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Header Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Angebotsdetails
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. IT-Sicherheits-Audit 2025"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Account auswählen...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Cover Text */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Anschreiben
              </h2>
              <textarea
                placeholder="Einleitungstext für das Angebot..."
                value={coverText}
                onChange={(e) => setCoverText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Scope of Work */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Leistungsumfang
              </h2>
              <textarea
                placeholder="Beschreibung des Leistungsumfangs..."
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Leistungspositionen
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={addEmptyLineItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Freie Position
                  </button>
                </div>
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-400">
                    Keine Positionen. Fügen Sie Dienste aus dem Katalog hinzu
                    oder erstellen Sie eine freie Position.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left pb-2 font-medium text-gray-600">
                          Beschreibung
                        </th>
                        <th className="text-right pb-2 font-medium text-gray-600 w-20">
                          Menge
                        </th>
                        <th className="text-left pb-2 font-medium text-gray-600 w-24 pl-2">
                          Einheit
                        </th>
                        <th className="text-right pb-2 font-medium text-gray-600 w-28">
                          Einzelpreis (€)
                        </th>
                        <th className="text-right pb-2 font-medium text-gray-600 w-28">
                          Gesamt (€)
                        </th>
                        <th className="w-10 pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineItems.map((item) => (
                        <tr key={item.id} className="group">
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                updateLineItem(item.id, 'description', e.target.value)
                              }
                              placeholder="Beschreibung..."
                              className="w-full px-2 py-1 border border-transparent rounded focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(item.id, 'quantity', e.target.value)
                              }
                              min="0"
                              step="0.5"
                              className="w-full px-2 py-1 border border-transparent rounded text-right focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <select
                              value={item.unit}
                              onChange={(e) =>
                                updateLineItem(item.id, 'unit', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-transparent rounded focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            >
                              <option value="Tag">Tag</option>
                              <option value="Stunde">Stunde</option>
                              <option value="Pauschal">Pauschal</option>
                              <option value="Stück">Stück</option>
                            </select>
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(item.id, 'unitPrice', e.target.value)
                              }
                              min="0"
                              step="0.01"
                              className="w-full px-2 py-1 border border-transparent rounded text-right focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </td>
                          <td className="py-2 text-right font-medium text-gray-900">
                            {formatCurrency(item.total || 0)}
                          </td>
                          <td className="py-2 pl-2">
                            <button
                              onClick={() => removeLineItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td
                          colSpan={4}
                          className="pt-3 text-right font-semibold text-gray-900"
                        >
                          Gesamtbetrag
                        </td>
                        <td className="pt-3 text-right font-bold text-gray-900 text-base">
                          {formatCurrency(subtotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - 1/3 */}
          <div className="w-80 shrink-0 space-y-4">
            {/* Summary Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Zusammenfassung</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Positionen</span>
                  <span className="text-gray-900">{lineItems.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Zwischensumme</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Gesamtbetrag</span>
                  <span className="font-bold text-xl text-gray-900">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
              </div>

              {requiresApproval && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    <strong>Genehmigung erforderlich</strong> – Angebote über
                    50.000 € benötigen eine Freigabe.
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Als Entwurf speichern
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Zur Prüfung senden
                </button>
              </div>
            </div>

            {/* Service Catalog */}
            <ServiceCatalogPanel services={services} onAdd={addLineItemFromService} />
          </div>
        </div>
      </div>
    </div>
  )
}

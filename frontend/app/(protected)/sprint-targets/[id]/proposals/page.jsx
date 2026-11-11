'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Sparkles, Plus, ExternalLink, TrendingUp, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const TYPE_LABELS = {
  implementierung: 'Implementierung',
  zusatzpaket:     'Zusatzpaket',
  strategie:       'Strategie',
}

const PRIORITY_STYLES = {
  high:   'bg-red-50 text-red-700 border-red-100',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  low:    'bg-gray-50 text-gray-600 border-gray-100',
}

const FEASIBILITY_LABELS = {
  'now':        { label: 'Sofort umsetzbar', color: 'text-green-600' },
  'after-prep': { label: 'Nach Vorbereitung', color: 'text-yellow-600' },
  'longterm':   { label: 'Langfristig', color: 'text-gray-500' },
}

function ProposalCard({ uc, selected, onToggle }) {
  const feasibility = FEASIBILITY_LABELS[uc.feasibility]
  return (
    <div className={`bg-white rounded-xl border p-4 transition-shadow ${selected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(uc.id)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className={`px-2 py-0.5 rounded border text-xs font-medium ${PRIORITY_STYLES[uc.priority] || PRIORITY_STYLES.low}`}>
            {uc.priority}
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium">
            {TYPE_LABELS[uc.type] || uc.type}
          </span>
          {feasibility && (
            <span className={`text-xs ${feasibility.color}`}>{feasibility.label}</span>
          )}
        </div>
        {uc.estimatedValue && (
          <span className="text-sm font-semibold text-emerald-700 shrink-0">
            {formatCurrency(uc.estimatedValue)}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{uc.title}</h3>
      {uc.description && (
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{uc.description}</p>
      )}
      {uc.basis && (
        <p className="mt-2 text-xs text-gray-400">Basis: {uc.basis}</p>
      )}
    </div>
  )
}

export default function ProposalsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [useCases, setUseCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [creatingDeal, setCreatingDeal] = useState(false)
  const [selected, setSelected] = useState(new Set())

  function toggleSelected(ucId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ucId)) next.delete(ucId)
      else next.add(ucId)
      return next
    })
  }

  const selectedUseCases = useCases.filter((uc) => selected.has(uc.id))
  const selectedValue = selectedUseCases.reduce((sum, uc) => sum + (uc.estimatedValue || 0), 0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [t, asses] = await Promise.all([
        api.get(`/sprint-targets/${id}`),
        api.get(`/sprint-assessments/target/${id}`),
      ])
      setTarget(t)
      const list = Array.isArray(asses) ? asses : []
      setAssessments(list)

      // Collect all use cases from all assessments
      const allUcs = list.flatMap((a) => (a.useCases || []).map((uc) => ({ ...uc, assessmentVersion: a.version })))
      setUseCases(allUcs)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = filterType ? useCases.filter((uc) => uc.type === filterType) : useCases

  async function createDeal() {
    if (!target) return
    setCreatingDeal(true)
    try {
      // Build deal from top use case
      const topUc = useCases.find((uc) => uc.priority === 'high') || useCases[0]
      const payload = {
        title: topUc ? `KI-Readiness: ${topUc.title} – ${target.companyName}` : `KI-Readiness – ${target.companyName}`,
        value: topUc?.estimatedValue || null,
        stage: 'First Contact',
        notes: `Zielkunde: ${target.companyName}\nBranche: ${target.segment}\n${topUc?.description || ''}`,
      }
      // Link to account if exists
      if (target.accountId) payload.accountId = target.accountId

      const deal = await api.post('/deals', payload)
      toast.success('Deal erstellt')
      router.push(`/pipeline/${deal.id}`)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Erstellen des Deals')
    } finally {
      setCreatingDeal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/sprint-targets/${id}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projektvorschläge</h1>
            {target && <p className="text-sm text-gray-500">{target.companyName}</p>}
          </div>
          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            {useCases.length} Use Cases
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/sprint-targets/${id}/assessment`)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Sparkles className="w-4 h-4 text-blue-500" /> Assessment öffnen
          </button>
          {useCases.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectedUseCases.length > 0) {
                    const items = selectedUseCases.map((uc) => ({
                      description: uc.title,
                      quantity: 1,
                      unitPrice: uc.estimatedValue || 0,
                    }))
                    window.sessionStorage.setItem('sprint_offer_items', JSON.stringify(items))
                  }
                  router.push(`/sprint-targets/offers/new?target=${id}`)
                }}
                title={selectedUseCases.length > 0 ? 'Ausgewählte Use Cases als Angebotspositionen übernehmen' : 'Angebot für diesen Zielkunden anlegen'}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                <FileText className="w-4 h-4" />
                Angebot aus Auswahl{selectedUseCases.length > 0 ? ` (${selectedUseCases.length})` : ''}
              </button>
              <button
                onClick={createDeal}
                disabled={creatingDeal}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <TrendingUp className="w-4 h-4" />
                {creatingDeal ? 'Erstelle...' : 'Deal anlegen'}
              </button>
            </>
          )}
        </div>
      </div>

      {useCases.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Sparkles className="w-10 h-10 text-blue-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Noch keine Projektvorschläge</h3>
          <p className="text-sm text-gray-500 mb-6">
            Führe zuerst ein KI-Assessment durch, um Projektvorschläge zu generieren.
          </p>
          <button
            onClick={() => router.push(`/sprint-targets/${id}/assessment`)}
            className="flex items-center gap-2 mx-auto px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Sparkles className="w-4 h-4" /> Zum Assessment
          </button>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType('')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                !filterType ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Alle ({useCases.length})
            </button>
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const count = useCases.filter((uc) => uc.type === key).length
              if (count === 0) return null
              return (
                <button
                  key={key}
                  onClick={() => setFilterType(filterType === key ? '' : key)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    filterType === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          {/* Summen-KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">Geschätztes Potenzial (gefiltert)</p>
              <p className="text-lg font-bold text-emerald-700">
                {formatCurrency(filtered.reduce((s, uc) => s + (uc.estimatedValue || 0), 0))}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">Ausgewählt</p>
              <p className="text-lg font-bold text-blue-700">{selectedUseCases.length} Use Cases</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">Summe Auswahl</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedValue)}</p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((uc) => (
              <ProposalCard
                key={uc.id}
                uc={uc}
                selected={selected.has(uc.id)}
                onToggle={toggleSelected}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

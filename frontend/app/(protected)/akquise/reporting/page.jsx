'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Download, TrendingUp, Users, FileText, CheckCircle2, Target, Brain, RotateCcw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { exportCsv, csvFilename } from '@/lib/csv'
import { usePipeline } from '@/lib/usePipeline'
import { flagStatuses, styleForStep } from '@/lib/pipelineLogic'
import { primeSprintSettings } from '@/lib/acquisitionSettings'
import AiModal from '@/components/acquisition/AiModal'

const ACTIVITY_LABELS = { Call: 'Anrufe', Meeting: 'Meetings', Email: 'E-Mails', LinkedIn: 'LinkedIn', Note: 'Notizen', Task: 'Aufgaben' }

const CSV_COLUMNS = [
  { key: 'companyName', label: 'Unternehmen' },
  { key: 'segment', label: 'Branche' },
  { key: 'bundesland', label: 'Bundesland' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priorität' },
  { key: 'offerValue', label: 'Angebotswert' },
  { key: 'result', label: 'Ergebnis' },
  { key: 'lossReason', label: 'Verlustgrund' },
  { key: 'contactSource', label: 'Kanal' },
]

export default function SprintReportingPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState([])
  const [campaignFilter, setCampaignFilter] = useState('')
  const selectedCampaign = campaigns.find((c) => c.id === campaignFilter) || null
  const pipeline = usePipeline(selectedCampaign?.pipelineId)
  const statusRows = pipeline.steps.map((s) => ({ status: s.status, label: s.label, color: styleForStep(s).dot }))
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [revenueTarget, setRevenueTarget] = useState(500000)
  const [campaign, setCampaign] = useState({ name: '', start: '', end: '' })
  const [periodReady, setPeriodReady] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    api.get('/acquisition-campaigns')
      .then((list) => setCampaigns(Array.isArray(list) ? list : []))
      .catch(() => {})
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // Immer senden: leerer Wert = bewusst kein Zeitraum (Gesamter Zeitraum).
      // Fehlt der Parameter, würde das Backend den Kampagnen-Zeitraum einsetzen.
      params.set('from', from || '')
      params.set('to', to || '')
      if (revenueTarget) params.set('revenueTarget', String(revenueTarget))
      if (campaignFilter) params.set('campaignId', campaignFilter)
      const qs = params.toString()
      const data = await api.get(`/acquisition/reporting/summary${qs ? `?${qs}` : ''}`)
      setStats(data)
    } catch {
      toast.error('Fehler beim Laden des Reportings')
    } finally {
      setLoading(false)
    }
  }, [from, to, revenueTarget, campaignFilter])

  useEffect(() => {
    if (periodReady) fetchStats()
  }, [fetchStats, periodReady])

  // Akquise-Info: Kampagnenname + Laufzeit als Standard-Zeitraum übernehmen.
  // Erst die Server-Einstellungen laden, damit der Zeitraum beim ersten Abruf stimmt.
  useEffect(() => {
    let cancelled = false
    primeSprintSettings().then((s) => {
      if (cancelled) return
      const start = s.sprintStart ? String(s.sprintStart).slice(0, 10) : ''
      const end = s.sprintEnd ? String(s.sprintEnd).slice(0, 10) : ''
      setCampaign({ name: s.sprintName || '', start, end })
      setFrom((cur) => cur || start)
      setTo((cur) => cur || end)
      setPeriodReady(true)
    })
    return () => { cancelled = true }
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const targets = await api.get('/acquisition')
      exportCsv(csvFilename('sprint-reporting'), CSV_COLUMNS, Array.isArray(targets) ? targets : [])
      toast.success('Export erstellt')
    } catch {
      toast.error('Export fehlgeschlagen')
    } finally {
      setExporting(false)
    }
  }

  async function handlePdf() {
    setPdfBusy(true)
    try {
      const params = new URLSearchParams()
      params.set('from', from || '')
      params.set('to', to || '')
      if (revenueTarget) params.set('revenueTarget', String(revenueTarget))
      if (campaignFilter) params.set('campaignId', campaignFilter)
      const qs = params.toString()
      await api.download(`/acquisition/reporting/pdf${qs ? `?${qs}` : ''}`, 'Akquise-Reporting.pdf')
    } catch (err) {
      toast.error(err.message || 'PDF-Export fehlgeschlagen')
    } finally {
      setPdfBusy(false)
    }
  }

  function resetPeriod() {
    setFrom(campaign.start)
    setTo(campaign.end)
  }

  const byStatus = stats?.byStatus || {}
  const total = stats?.total || 0
  const periodIsDefault = from === campaign.start && to === campaign.end
  const campaignName = selectedCampaign?.name || campaign.name || stats?.campaign?.name || ''

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/akquise')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Reporting</h1>
              {campaignName && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{campaignName}</span>
              )}
            </div>
            <p className="text-sm text-gray-500">KPIs je Phase, Funnel und Aktivitäten</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePdf}
            disabled={pdfBusy}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" /> {pdfBusy ? 'PDF...' : 'PDF-Export'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> CSV-Export
          </button>
        </div>
      </div>

      {/* Zeitraum + Umsatzziel */}
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Zeitraum</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700"
        />
        <span className="text-xs text-gray-400">bis</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700"
        />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <span className="text-xs font-medium text-gray-500">Umsatzziel (€)</span>
        <input
          type="number"
          min="0"
          value={revenueTarget}
          onChange={(e) => setRevenueTarget(Number(e.target.value) || 0)}
          className="w-32 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700"
        />
        {campaigns.length > 0 && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <span className="text-xs font-medium text-gray-500">Kampagne</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700"
            >
              <option value="">Alle Kampagnen</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
              ))}
            </select>
          </>
        )}
        {!periodIsDefault && (
          <button onClick={resetPeriod} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {periodIsDefault && (campaign.start || campaign.end)
            ? 'Kampagnen-Zeitraum'
            : (from || to ? 'Gefilterter Zeitraum' : 'Gesamter Zeitraum')}
        </span>
      </div>

      {loading || !stats ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {[
              { label: 'Zielkunden', value: stats.total, icon: Users, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Im Gespräch', value: flagStatuses(pipeline, 'inTalk').reduce((sum, s) => sum + (byStatus[s] || 0), 0), icon: TrendingUp, color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'Angebote offen', value: stats.offers.pending, icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Gewonnen', value: flagStatuses(pipeline, 'won').reduce((sum, s) => sum + (byStatus[s] || 0), 0), icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Win-Rate', value: `${stats.winRate}%`, icon: TrendingUp, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Umsatz', value: formatCurrency(stats.wonValue), icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Assessments', value: `${stats.assessments.coverage}%`, icon: Brain, color: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'Umsatzziel', value: `${stats.revenue.percent}%`, icon: Target, color: 'text-teal-700', bg: 'bg-teal-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* KI-Insights */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">KI-Insights</h3>
                <p className="text-xs text-gray-600">Automatisch aus den aktuellen Daten abgeleitet.</p>
              </div>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-indigo-600">Vorschlag · prüfen</span>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Öffnen
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Funnel</h2>
              <div className="space-y-2.5">
                {statusRows.map(({ status, label, color }) => {
                  const count = byStatus[status] || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="w-40 text-xs text-gray-600">{label}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-gray-900">{count}</span>
                      <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Pipeline-Wert</p>
                  <p className="font-bold text-gray-900">{formatCurrency(stats.pipelineValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Angebotsvolumen</p>
                  <p className="font-bold text-gray-900">{formatCurrency(stats.offers.value)}</p>
                </div>
              </div>
            </div>

            {/* Segmente */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Zielkunden nach Branche</h2>
              {stats.segmentList.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten.</p>
              ) : (
                <div className="space-y-2">
                  {stats.segmentList.slice(0, 8).map(({ segment, count }) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={segment} className="flex items-center gap-3">
                        <span className="w-52 text-xs text-gray-600 truncate" title={segment}>{segment}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs font-semibold text-gray-900">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Aktivitäten */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Aktivitäten</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xl font-bold text-gray-900">{stats.activities.total}</p>
                  <p className="text-xs text-gray-500">gesamt</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xl font-bold text-blue-700">{stats.activities.last7}</p>
                  <p className="text-xs text-blue-600">7 Tage</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xl font-bold text-blue-700">{stats.activities.last30}</p>
                  <p className="text-xs text-blue-600">30 Tage</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {Object.entries(stats.activities.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{ACTIVITY_LABELS[type] || type}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Marktdaten */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Zielkunden nach Bundesland</h2>
              {stats.bundeslandList.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten.</p>
              ) : (
                <div className="space-y-2">
                  {stats.bundeslandList.slice(0, 8).map(({ bundesland, count }) => (
                    <div key={bundesland} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{bundesland}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-600">Sperrliste</span>
                <span className="font-semibold text-red-600">{stats.blocklist} Einträge</span>
              </div>
            </div>

            {/* Umsatzfortschritt */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Umsatzfortschritt</h2>
                <span className="text-xs text-gray-500">
                  {formatCurrency(stats.revenue.achieved)} von {formatCurrency(stats.revenue.target)}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.revenue.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {stats.revenue.percent}% des Ziels erreicht · {stats.assessments.targets} von {stats.total} Zielkunden mit Assessment ({stats.assessments.coverage}%)
              </p>
            </div>

            {/* Verlustgründe */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Verlustgründe</h2>
              {stats.lossReasonList.length === 0 ? (
                <p className="text-sm text-gray-400">Keine verlorenen Zielkunden im Zeitraum.</p>
              ) : (
                <div className="space-y-2">
                  {stats.lossReasonList.map(({ reason, count }) => (
                    <div key={reason} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-gray-600 truncate">{reason}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100, count * 10)}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kanal */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Kanal-Analyse</h2>
              {stats.channelList.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten.</p>
              ) : (
                <div className="space-y-2">
                  {stats.channelList.map(({ channel, count }) => (
                    <div key={channel} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{channel}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Team-Performance */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Team-Performance</h2>
              {stats.teamPerformance.length === 0 ? (
                <p className="text-sm text-gray-400">Noch keine Zuweisungen oder Aktivitäten im Zeitraum.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="py-2 pr-4">Mitarbeiter</th>
                        <th className="py-2 pr-4 text-right">Zugewiesen</th>
                        <th className="py-2 pr-4 text-right">Gewonnen</th>
                        <th className="py-2 pr-4 text-right">Umsatz</th>
                        <th className="py-2 text-right">Aktivitäten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.teamPerformance.map((m) => (
                        <tr key={m.userId} className="border-t border-gray-50">
                          <td className="py-2 pr-4 text-gray-800">{m.name}</td>
                          <td className="py-2 pr-4 text-right text-gray-600">{m.assigned}</td>
                          <td className="py-2 pr-4 text-right text-green-700 font-medium">{m.won}</td>
                          <td className="py-2 pr-4 text-right text-emerald-700 font-medium">{formatCurrency(m.wonValue)}</td>
                          <td className="py-2 text-right text-gray-600">{m.activities}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AiModal open={aiOpen} kind="insights" onClose={() => setAiOpen(false)} />
    </div>
  )
}

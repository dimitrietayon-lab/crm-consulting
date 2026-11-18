'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, TrendingUp, FileText, CheckCircle2, ArrowRight, CalendarClock,
  Upload, ShieldAlert, Send, Crosshair, Activity as ActivityIcon, AlertTriangle, Trophy, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePipeline } from '@/lib/usePipeline'
import { flagStatuses, styleForStep } from '@/lib/pipelineLogic'
import AiModal from '@/components/acquisition/AiModal'

const QUICK_LINKS = [
  { label: 'Listen-Import', desc: 'CSV einlesen und Dubletten prüfen', href: '/akquise/import', icon: Upload },
  { label: 'Outreach',      desc: 'LinkedIn-Anfragen und Wochenquote', href: '/akquise/outreach', icon: Send },
  { label: 'Sperrliste',    desc: 'Widersprüche und Löschverlangen',   href: '/akquise/blocklist', icon: ShieldAlert },
  { label: 'Reporting',     desc: 'Funnel, KPIs und CSV-Export',       href: '/akquise/reporting', icon: TrendingUp },
]

export default function SprintDashboardPage({ embedded = false }) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState([])
  const [campaignId, setCampaignId] = useState('')
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null
  const pipeline = usePipeline(selectedCampaign?.pipelineId)
  const funnel = pipeline.steps.map((s) => ({ key: s.status, label: s.label, color: styleForStep(s).dot }))
  const [stats, setStats] = useState(null)
  const [dash, setDash] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''
    try {
      const [summary, dashboard, acts, camps] = await Promise.all([
        api.get(`/acquisition/reporting/summary${qs}`),
        api.get(`/acquisition/dashboard/summary${qs}`),
        api.get('/activities?onlySprint=true&limit=6'),
        api.get('/acquisition-campaigns').catch(() => []),
      ])
      setStats(summary)
      setDash(dashboard)
      setActivities(Array.isArray(acts) ? acts : [])
      if (Array.isArray(camps)) setCampaigns(camps)
    } catch {
      toast.error('Fehler beim Laden des Dashboards')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  const byStatus = stats?.byStatus || {}
  const total = stats?.total || 0

  const kpis = [
    { label: 'Zielkunden',     value: total,                                icon: Users,        color: 'text-gray-700',   bg: 'bg-gray-50' },
    { label: 'Im Gespräch',    value: flagStatuses(pipeline, 'inTalk').reduce((sum, s) => sum + (byStatus[s] || 0), 0), icon: TrendingUp, color: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'Angebote offen', value: stats?.offers?.pending || 0,           icon: FileText,     color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Gewonnen',       value: flagStatuses(pipeline, 'won').reduce((sum, s) => sum + (byStatus[s] || 0), 0), icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-50' },
    { label: 'Win-Rate',       value: `${stats?.winRate || 0}%`,             icon: TrendingUp,   color: 'text-blue-700',   bg: 'bg-blue-50' },
    { label: 'Umsatz',         value: formatCurrency(stats?.wonValue || 0),  icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="space-y-4">

      {/* Kopf */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-blue-600" /> Akquise
            </h2>
            <p className="text-xs text-gray-500">Zielkunden, Outreach und offene Gespräche</p>
          </div>
          <div className="flex items-center gap-2">
            {campaigns.length > 0 && (
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Alle Kampagnen</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => router.push('/akquise')}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Crosshair className="w-4 h-4" /> Zu den Zielkunden
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Akquise
          </div>
          <h1 className="mt-1.5 text-2xl font-bold">Akquise-Übersicht</h1>
          <p className="text-sm text-white/80 mt-0.5">
            Zielkunden, Outreach, Angebote und Reporting an einem Ort
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/akquise')}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-blue-700 rounded-lg hover:bg-white/90"
            >
              <Crosshair className="w-4 h-4" /> Zu den Zielkunden
            </button>
            <button
              onClick={() => router.push('/akquise/import')}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white/15 border border-white/25 rounded-lg hover:bg-white/25"
            >
              <Upload className="w-4 h-4" /> Liste importieren
            </button>
          </div>
          {campaigns.length > 0 && (
            <div className="mt-3">
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/15 border border-white/25 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <option value="" className="text-gray-900">Alle Kampagnen</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="text-gray-900">{c.name}{c.isDefault ? ' (Standard)' : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Sprint-Banner-Kennzahlen */}
      {!embedded && dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Aktive Opportunities', value: dash.sprint.active, hint: `${dash.sprint.total} Zielkunden gesamt` },
            { label: 'Pipeline-Wert', value: formatCurrency(dash.sprint.pipelineValue), hint: 'Im Gespräch + Angebote' },
            { label: 'Gewonnener Umsatz', value: formatCurrency(dash.sprint.wonValue), hint: `${dash.sprint.won} gewonnen` },
            { label: 'Conversion', value: `${dash.sprint.conversion}%`, hint: `${dash.sprint.lost} verloren` },
          ].map(({ label, value, hint }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
              <p className="text-[11px] text-gray-400 truncate">{hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Warnungen */}
      {dash && (dash.alerts.callLimitReached > 0 || dash.alerts.blocklistCount > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {dash.alerts.callLimitReached > 0 && (
            <button
              onClick={() => router.push('/akquise')}
              className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-100"
            >
              <AlertTriangle className="w-4 h-4" />
              {dash.alerts.callLimitReached} Zielkunden am Anruflimit (UWG)
            </button>
          )}
          {dash.alerts.blocklistCount > 0 && (
            <button
              onClick={() => router.push('/akquise/blocklist')}
              className="flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2 hover:bg-red-100"
            >
              <ShieldAlert className="w-4 h-4" />
              {dash.alerts.blocklistCount} Sperrvermerke in der Sperrliste
            </button>
          )}
        </div>
      )}

      {loading || !stats ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-bold ${color} truncate`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tagesagenda */}
          {dash && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-blue-500" /> Tagesagenda (7 Tage)
                  </h2>
                  <button onClick={() => router.push('/activities?onlySprint=true')} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                    Aktivitäten <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                {dash.agenda.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Keine fälligen Follow-ups oder Meetings.</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {dash.agenda.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => item.targetId && router.push(`/akquise/${item.targetId}`)}
                        className="flex items-center gap-3 w-full py-2.5 text-left hover:bg-gray-50/60"
                      >
                        <span className="w-16 shrink-0 text-xs font-semibold text-blue-700">
                          {new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{item.type}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.companyName || '—'}</p>
                          <p className="text-xs text-gray-500 truncate">{item.title}</p>
                        </div>
                        {item.status && (
                          <span className="text-[11px] text-gray-400 shrink-0">{item.status}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top-Zielkunden */}
          {!embedded && dash && dash.topTargets.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Top-Zielkunden
                </h2>
                <button onClick={() => router.push('/akquise')} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                  Alle <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                {dash.topTargets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/akquise/${t.id}`)}
                    className="text-left rounded-lg border border-gray-100 bg-gray-50/60 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <p className="text-xs text-gray-400 truncate">{t.segment}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.companyName}</p>
                    <p className="text-xs text-gray-500 mt-1">Prio {t.priority} · {t.status}</p>
                    {t.offerValue > 0 && <p className="text-xs font-semibold text-emerald-700 mt-0.5">{formatCurrency(t.offerValue)}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!embedded && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Funnel */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Funnel</h2>
                <button onClick={() => router.push('/akquise/reporting')} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                  Zum Reporting <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {funnel.map(({ key, label, color }) => {
                  const count = byStatus[key] || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-36 text-xs text-gray-600">{label}</span>
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
                  <p className="font-bold text-gray-900">{formatCurrency(stats.pipelineValue || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Angebotsvolumen</p>
                  <p className="font-bold text-gray-900">{formatCurrency(stats.offers?.value || 0)}</p>
                </div>
              </div>
            </div>

            {/* Aktivitäten */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Letzte Aktivitäten</h2>
                <button onClick={() => router.push('/activities?onlySprint=true')} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                  Alle <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Noch keine Aktivitäten.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activities.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => a.acquisitionTarget && router.push(`/akquise/${a.acquisitionTarget.id}`)}
                      className="flex items-start gap-3 w-full py-2.5 text-left hover:bg-gray-50/60"
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <ActivityIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {a.acquisitionTarget?.companyName || 'Aktivität'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{a.summary || a.type}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(a.date)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* KI-Insights */}
          {!embedded && (
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
          )}

          {/* Quick links */}
          {!embedded && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_LINKS.map(({ label, desc, href, icon: Icon }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          )}
        </>
      )}

      <AiModal open={aiOpen} kind="insights" onClose={() => setAiOpen(false)} />
    </div>
  )
}

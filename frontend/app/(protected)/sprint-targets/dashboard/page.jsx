'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, TrendingUp, FileText, CheckCircle2, ArrowRight, CalendarClock,
  Upload, ShieldAlert, Send, Crosshair, Activity as ActivityIcon, AlertTriangle, Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IN_TALK_STATUSES } from '@/lib/sprintOptions'

const FUNNEL = [
  { key: 'offen',                   label: 'Offen',                   color: 'bg-slate-400' },
  { key: 'recherchiert',            label: 'Recherchiert',            color: 'bg-gray-500' },
  { key: 'vernetzt',                label: 'Vernetzt',                color: 'bg-blue-500' },
  { key: 'kontaktiert',             label: 'Kontaktiert',             color: 'bg-indigo-500' },
  { key: 'Qualifizierungsgespräch', label: 'Qualifizierungsgespräch', color: 'bg-yellow-500' },
  { key: 'Übergabe an Engagement Manager', label: 'Übergabe an EM',    color: 'bg-amber-500' },
  { key: 'Erstgespräch terminiert',  label: 'Erstgespräch terminiert', color: 'bg-teal-500' },
  { key: 'Erstgespräch durchgeführt', label: 'Erstgespräch durchgeführt', color: 'bg-teal-700' },
  { key: 'Fragebogen geschickt',     label: 'Fragebogen geschickt',    color: 'bg-cyan-600' },
  { key: 'Angebot in Vorbereitung',  label: 'Angebot in Vorbereitung', color: 'bg-violet-500' },
  { key: 'Angebot versendet',        label: 'Angebot versendet',       color: 'bg-violet-700' },
  { key: 'Nachverhandlung',          label: 'Nachverhandlung',         color: 'bg-purple-700' },
  { key: 'gewonnen',                label: 'Gewonnen',                color: 'bg-green-500' },
  { key: 'Folgeprojekt',            label: 'Folgeprojekt',            color: 'bg-emerald-500' },
  { key: 'Verlust',                 label: 'Verlust',                 color: 'bg-rose-600' },
  { key: 'kein Interesse',          label: 'Kein Interesse',          color: 'bg-red-500' },
]

const QUICK_LINKS = [
  { label: 'Listen-Import', desc: 'CSV einlesen und Dubletten prüfen', href: '/sprint-targets/import', icon: Upload },
  { label: 'Outreach',      desc: 'LinkedIn-Anfragen und Wochenquote', href: '/sprint-targets/outreach', icon: Send },
  { label: 'Sperrliste',    desc: 'Widersprüche und Löschverlangen',   href: '/sprint-targets/blocklist', icon: ShieldAlert },
  { label: 'Reporting',     desc: 'Funnel, KPIs und CSV-Export',       href: '/sprint-targets/reporting', icon: TrendingUp },
]

export default function SprintDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState(null)
  const [dash, setDash] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summary, dashboard, acts] = await Promise.all([
        api.get('/sprint-targets/reporting/summary'),
        api.get('/sprint-targets/dashboard/summary'),
        api.get('/activities?onlySprint=true&limit=6'),
      ])
      setStats(summary)
      setDash(dashboard)
      setActivities(Array.isArray(acts) ? acts : [])
    } catch {
      toast.error('Fehler beim Laden des Dashboards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const byStatus = stats?.byStatus || {}
  const total = stats?.total || 0

  const kpis = [
    { label: 'Zielkunden',     value: total,                                icon: Users,        color: 'text-gray-700',   bg: 'bg-gray-50' },
    { label: 'Im Gespräch',    value: IN_TALK_STATUSES.reduce((sum, s) => sum + (byStatus[s] || 0), 0), icon: TrendingUp, color: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'Angebote offen', value: stats?.offers?.pending || 0,           icon: FileText,     color: 'text-violet-700', bg: 'bg-violet-50' },
    { label: 'Gewonnen',       value: (byStatus['gewonnen'] || 0) + (byStatus['Folgeprojekt'] || 0), icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-50' },
    { label: 'Win-Rate',       value: `${stats?.winRate || 0}%`,             icon: TrendingUp,   color: 'text-blue-700',   bg: 'bg-blue-50' },
    { label: 'Umsatz',         value: formatCurrency(stats?.wonValue || 0),  icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="space-y-4">

      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 text-white">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/80">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          KI-Readiness Sprint · Aktives Portal
        </div>
        <h1 className="mt-1.5 text-2xl font-bold">Sprint-Vertrieb</h1>
        <p className="text-sm text-white/80 mt-0.5">
          Zielkunden, Outreach, Angebote und Reporting in einem Portal
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => router.push('/sprint-targets')}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-violet-700 rounded-lg hover:bg-white/90"
          >
            <Crosshair className="w-4 h-4" /> Zu den Zielkunden
          </button>
          <button
            onClick={() => router.push('/sprint-targets/import')}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white/15 border border-white/25 rounded-lg hover:bg-white/25"
          >
            <Upload className="w-4 h-4" /> Liste importieren
          </button>
        </div>
      </div>

      {/* Sprint-Banner-Kennzahlen */}
      {dash && (
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
              onClick={() => router.push('/sprint-targets')}
              className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-100"
            >
              <AlertTriangle className="w-4 h-4" />
              {dash.alerts.callLimitReached} Zielkunden am Anruflimit (UWG)
            </button>
          )}
          {dash.alerts.blocklistCount > 0 && (
            <button
              onClick={() => router.push('/sprint-targets/blocklist')}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
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

          {/* Agenda + Team-Auslastung */}
          {dash && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-violet-500" /> Tagesagenda (7 Tage)
                  </h2>
                  <button onClick={() => router.push('/sprint-targets/activities')} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900">
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
                        onClick={() => item.targetId && router.push(`/sprint-targets/${item.targetId}`)}
                        className="flex items-center gap-3 w-full py-2.5 text-left hover:bg-gray-50/60"
                      >
                        <span className="w-16 shrink-0 text-xs font-semibold text-violet-700">
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

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-500" /> Team-Auslastung
                  </h2>
                  <button onClick={() => router.push('/sprint-targets/team')} className="text-xs font-medium text-violet-700 hover:text-violet-900">Team</button>
                </div>
                {dash.team.members.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Noch keine Zuweisungen.</p>
                ) : (
                  <div className="space-y-3">
                    {dash.team.members.slice(0, 6).map((m) => (
                      <div key={m.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-700 truncate">{m.name}</span>
                          <span className="text-gray-500 shrink-0">{m.assignments} Kunden</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.utilization >= 90 ? 'bg-red-500' : m.utilization >= 60 ? 'bg-amber-500' : 'bg-violet-500'}`}
                            style={{ width: `${m.utilization}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top-Zielkunden */}
          {dash && dash.topTargets.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Top-Zielkunden
                </h2>
                <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900">
                  Alle <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                {dash.topTargets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/sprint-targets/${t.id}`)}
                    className="text-left rounded-lg border border-gray-100 bg-gray-50/60 p-3 hover:border-violet-200 hover:bg-violet-50/40"
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Funnel */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Funnel</h2>
                <button onClick={() => router.push('/sprint-targets/reporting')} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900">
                  Zum Reporting <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {FUNNEL.map(({ key, label, color }) => {
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
                <button onClick={() => router.push('/sprint-targets/activities')} className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900">
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
                      onClick={() => a.sprintTarget && router.push(`/sprint-targets/${a.sprintTarget.id}`)}
                      className="flex items-start gap-3 w-full py-2.5 text-left hover:bg-gray-50/60"
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-50 text-violet-600 shrink-0 mt-0.5">
                        <ActivityIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {a.sprintTarget?.companyName || 'Aktivität'}
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

          {/* Quick links */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_LINKS.map(({ label, desc, href, icon: Icon }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-violet-200 hover:bg-violet-50/30 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-600 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

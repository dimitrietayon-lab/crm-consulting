'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Crosshair, CalendarClock, FileText, Activity as ActivityIcon, ArrowRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { STATUS_BADGE, statusLabel, WON_STATUSES } from '@/lib/sprintOptions'
import { getSprintSettings } from '@/lib/sprintSettings'
import { TEAM_ROLES } from '@/lib/sprintTeam'

const ACTIVITY_LABELS = {
  Call: 'Anrufe',
  Email: 'E-Mails',
  Meeting: 'Meetings',
  LinkedIn: 'LinkedIn',
  Note: 'Notizen',
}

function roleLabels(roles) {
  return (roles || [])
    .map((r) => TEAM_ROLES.find((x) => x.key === r)?.label || r)
    .join(' · ')
}

export default function SprintMePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/sprint-targets/me/summary')
      setData(res)
    } catch {
      toast.error('Fehler beim Laden von „Mein Bereich"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const settings = getSprintSettings()
  const stats = data?.stats
  const statsCards = stats ? [
    { label: 'Meine Zielkunden', value: stats.assigned },
    { label: 'Aktiv', value: stats.active },
    { label: 'Gewonnen', value: stats.won, color: 'text-green-700' },
    { label: 'Pipeline-Wert', value: formatCurrency(stats.pipelineValue) },
    { label: 'Offene Angebote', value: stats.openOffers },
    { label: 'Aktivitäten (7 Tage)', value: stats.weekActivities },
  ] : []

  const today = data ? [...data.followUps.overdue, ...data.followUps.dueToday] : []
  const weekQuotaRows = data ? [
    { label: 'Anrufe', actual: data.activityByType.Call || 0, quota: settings.callsQuota },
    { label: 'LinkedIn', actual: data.activityByType.LinkedIn || 0, quota: settings.linkedinQuota },
  ] : []

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mein Bereich</h1>
          <p className="text-sm text-gray-500">
            Meine Zielkunden, fällige nächste Schritte und Wochenpuls
          </p>
        </div>
        <button
          onClick={() => router.push('/sprint-targets')}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <Crosshair className="w-4 h-4" /> Alle Zielkunden
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !data || stats.assigned === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Crosshair className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Dir sind noch keine Zielkunden zugewiesen.</p>
          <button
            onClick={() => router.push('/sprint-targets/team')}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Zur Kundenzuweisung
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {statsCards.map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-lg font-bold truncate ${color || 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Heute & überfällig */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-blue-500" /> Heute &amp; überfällig
                </h2>
                <span className="text-xs text-gray-500">{today.length} offen</span>
              </div>
              {today.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Keine fälligen nächsten Schritte.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {today.map((t) => {
                    const overdue = new Date(t.nextStepDue) < new Date().setHours(0, 0, 0, 0)
                    return (
                      <button
                        key={t.id}
                        onClick={() => router.push(`/sprint-targets/${t.id}`)}
                        className="flex items-center gap-3 w-full py-2.5 text-left hover:bg-gray-50/60"
                      >
                        <span className={`flex items-center gap-1 w-20 shrink-0 text-xs font-semibold ${overdue ? 'text-red-600' : 'text-amber-600'}`}>
                          {overdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {new Date(t.nextStepDue).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.companyName}</p>
                          <p className="text-xs text-gray-500 truncate">{t.nextStep}</p>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {statusLabel(t.status)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Wochenpuls */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-blue-500" /> Wochenpuls
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <div key={key} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-base font-bold text-gray-900">{data.activityByType[key] || 0}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-1">
                {weekQuotaRows.map(({ label, actual, quota }) => {
                  const pct = quota > 0 ? Math.min(100, Math.round((actual / quota) * 100)) : 0
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-gray-500">{actual} / {quota}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => router.push('/activities?onlySprint=true')}
                className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                Alle Aktivitäten <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Offene Angebote */}
          {data.offers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" /> Offene Angebote
                  {data.expiringOffers > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      {data.expiringOffers} laufen bald ab
                    </span>
                  )}
                </h2>
                <button onClick={() => router.push('/proposals?tab=akquise')} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                  Alle Angebote <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {data.offers.slice(0, 6).map((o) => {
                  const expiring = o.validUntil && new Date(o.validUntil) <= new Date(Date.now() + 7 * 86400000)
                  return (
                    <button
                      key={o.id}
                      onClick={() => router.push(`/sprint-targets/offers/${o.id}`)}
                      className="text-left rounded-lg border border-gray-100 bg-gray-50/60 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-gray-500">{o.offerNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${expiring ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {o.status === 'draft' ? 'Entwurf' : 'Versendet'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate mt-1">{o.sprintTarget?.companyName || '—'}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(o.value)} · gültig bis {formatDate(o.validUntil)}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Meine Zielkunden */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-blue-500" /> Meine Zielkunden
              </h2>
              <span className="text-xs text-gray-500">{data.targets.length}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {['Unternehmen', 'Status', 'Prio', 'Meine Rolle', 'Nächster Schritt', 'Fällig', 'Angebot'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.targets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/sprint-targets/${t.id}`)}
                    className="border-t border-gray-50 hover:bg-gray-50/60 cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {WON_STATUSES.includes(t.status) && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {t.companyName}
                      </div>
                      <p className="text-[11px] text-gray-400 font-normal">{t.segment}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{t.priority}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{roleLabels(t.roles) || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 max-w-xs truncate">{t.nextStep || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{t.nextStepDue ? formatDate(t.nextStepDue) : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-700">{t.offerValue ? formatCurrency(t.offerValue) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

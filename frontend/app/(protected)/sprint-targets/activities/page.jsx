'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Phone, Users, Mail, StickyNote, CheckCircle2, Search, Linkedin, Download, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { exportCsv, csvFilename } from '@/lib/csv'
import ActivityLogModal from '@/components/sprint/ActivityLogModal'

const TYPE_META = {
  Call:    { label: 'Anruf',   icon: Phone,        color: 'text-blue-600 bg-blue-50' },
  Meeting: { label: 'Meeting', icon: Users,        color: 'text-violet-600 bg-violet-50' },
  Email:   { label: 'E-Mail',  icon: Mail,         color: 'text-green-600 bg-green-50' },
  Note:    { label: 'Notiz',   icon: StickyNote,   color: 'text-gray-600 bg-gray-100' },
  Task:    { label: 'Aufgabe', icon: CheckCircle2, color: 'text-yellow-600 bg-yellow-50' },
  LinkedIn:{ label: 'LinkedIn', icon: Linkedin,    color: 'text-sky-600 bg-sky-50' },
}

const PERIODS = [
  { value: 'all', label: 'Gesamter Zeitraum' },
  { value: '7', label: 'Letzte 7 Tage' },
  { value: '30', label: 'Letzte 30 Tage' },
  { value: '90', label: 'Letzte 90 Tage' },
]

export default function SprintActivitiesPage() {
  const router = useRouter()
  const [activities, setActivities] = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [period, setPeriod] = useState('30')
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [logOpen, setLogOpen] = useState(false)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const [data, targetList] = await Promise.all([
        api.get('/activities?onlySprint=true&limit=500'),
        api.get('/sprint-targets'),
      ])
      setActivities(Array.isArray(data) ? data : [])
      setTargets(Array.isArray(targetList) ? targetList : [])
    } catch {
      toast.error('Fehler beim Laden der Aktivitäten')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const filtered = useMemo(() => {
    const cutoff = period === 'all'
      ? null
      : new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)
    const q = search.trim().toLowerCase()

    return activities.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false
      if (cutoff && new Date(a.date) < cutoff) return false
      if (ownerFilter && a.createdBy?.id !== ownerFilter) return false
      if (segmentFilter && !(a.sprintTarget?.segment || '').includes(segmentFilter)) return false
      if (q) {
        const haystack = `${a.sprintTarget?.companyName || ''} ${a.summary || ''} ${a.nextSteps || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [activities, typeFilter, period, search, ownerFilter, segmentFilter])

  // Gruppierung nach Tag
  const grouped = useMemo(() => {
    const map = new Map()
    for (const a of filtered) {
      const key = new Date(a.date).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    }
    return [...map.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0]))
  }, [filtered])

  const stats = useMemo(() => {
    const byType = {}
    let last7 = 0
    const cutoff7 = Date.now() - 7 * 86400000
    for (const a of filtered) {
      byType[a.type] = (byType[a.type] || 0) + 1
      if (new Date(a.date).getTime() >= cutoff7) last7++
    }
    return { total: filtered.length, last7, byType }
  }, [filtered])

  const owners = useMemo(() => {
    const map = new Map()
    for (const a of activities) {
      if (a.createdBy?.id && !map.has(a.createdBy.id)) map.set(a.createdBy.id, a.createdBy.name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [activities])

  const segmentOptions = useMemo(
    () => [...new Set(targets.map((t) => (t.segment || '').trim()).filter(Boolean))],
    [targets]
  )

  function handleExport() {
    exportCsv(
      csvFilename('sprint-aktivitaeten'),
      [
        { key: 'date', label: 'Datum', format: (a) => formatDate(a.date) },
        { key: 'type', label: 'Typ' },
        { key: 'companyName', label: 'Zielkunde', format: (a) => a.sprintTarget?.companyName || '' },
        { key: 'summary', label: 'Zusammenfassung' },
        { key: 'nextSteps', label: 'Nächster Schritt' },
        { key: 'createdByName', label: 'Erstellt von', format: (a) => a.createdBy?.name || '' },
      ],
      filtered
    )
    toast.success('CSV-Export erstellt')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/sprint-targets')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aktivitäten</h1>
            <p className="text-sm text-gray-500">Alle protokollierten Aktivitäten im Sprint</p>
          </div>
          <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            {filtered.length} von {activities.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
          >
            <Plus className="w-4 h-4" /> Aktivität
          </button>
        </div>
      </div>

      {/* Statistikleiste */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-xs text-gray-500">Aktivitäten</p>
          <p className="text-base font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
          <p className="text-xs text-gray-500">Letzte 7 Tage</p>
          <p className="text-base font-bold text-violet-700">{stats.last7}</p>
        </div>
        {Object.entries(TYPE_META).slice(0, 3).map(([key, meta]) => {
          const Icon = meta.icon
          return (
            <div key={key} className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <Icon className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">{meta.label}</p>
                <p className="text-base font-bold text-gray-900">{stats.byType[key] || 0}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Typ-Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setTypeFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!typeFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          Alle ({activities.length})
        </button>
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const count = activities.filter((a) => a.type === key).length
          const active = typeFilter === key
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(active ? '' : key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${active ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {meta.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zielkunde oder Text …"
            className="w-64 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Alle Mitarbeiter</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Alle Branchen</option>
          {segmentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Keine Aktivitäten im gewählten Zeitraum.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Datum</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Typ</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Zielkunde</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Zusammenfassung</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Nächster Schritt</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Erstellt von</th>
              </tr>
            </thead>
            {grouped.map(([day, rows]) => (
              <tbody key={day}>
                <tr className="bg-gray-100/70">
                  <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold text-gray-600">
                    {new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    <span className="ml-2 text-gray-400 font-normal">{rows.length}</span>
                  </td>
                </tr>
                {rows.map((a) => {
                  const meta = TYPE_META[a.type] || { label: a.type, icon: StickyNote, color: 'text-gray-600 bg-gray-100' }
                  const Icon = meta.icon
                  return (
                    <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">{formatDate(a.date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {a.sprintTarget ? (
                          <button
                            onClick={() => router.push(`/sprint-targets/${a.sprintTarget.id}`)}
                            className="font-medium text-gray-900 hover:text-violet-700"
                          >
                            {a.sprintTarget.companyName}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 max-w-md">
                        <span className="line-clamp-2">{a.summary || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-blue-700 max-w-xs">
                        <span className="line-clamp-2">{a.nextSteps || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">{a.createdBy?.name || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        )}
      </div>

      <ActivityLogModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        targets={targets}
        onLogged={() => fetchActivities()}
      />
    </div>
  )
}

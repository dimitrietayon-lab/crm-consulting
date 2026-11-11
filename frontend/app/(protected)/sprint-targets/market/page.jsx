'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, MapPin, Target, Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getSprintSettings } from '@/lib/sprintSettings'
import { formatCurrency } from '@/lib/utils'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const PRIORITIES = [1, 2, 3, 4, 5]

export default function SprintMarketPage() {
  const router = useRouter()
  const [targets, setTargets] = useState([])
  const [regions, setRegions] = useState([])
  const [wzMappings, setWzMappings] = useState([])
  const [packages, setPackages] = useState([])
  const [segments, setSegments] = useState([])
  const [zielgroesse, setZielgroesse] = useState(878)
  const [loading, setLoading] = useState(true)
  const [savingRegions, setSavingRegions] = useState(false)
  const [savingWz, setSavingWz] = useState(false)
  const [newRegion, setNewRegion] = useState({ bundesland: '', priority: 3, note: '' })
  const [newWz, setNewWz] = useState({ wzCode: '', segment: '', priority: 3 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [market, t] = await Promise.all([
        api.get('/sprint-market'),
        api.get('/sprint-targets'),
      ])
      setRegions(Array.isArray(market.regions) ? market.regions : [])
      setWzMappings(Array.isArray(market.wzMappings) ? market.wzMappings : [])
      setPackages(Array.isArray(market.packages) ? market.packages : [])
      setSegments(Array.isArray(market.segments) ? market.segments : [])
      setTargets(Array.isArray(t) ? t : [])
    } catch {
      toast.error('Fehler beim Laden der Marktdaten')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setZielgroesse(getSprintSettings().targetFirms)
    fetchData()
  }, [fetchData])

  const byBundesland = useMemo(() => {
    const map = {}
    for (const t of targets) {
      if (!t.bundesland) continue
      map[t.bundesland] = (map[t.bundesland] || 0) + 1
    }
    return map
  }, [targets])

  const fokusIst = useMemo(
    () => regions.reduce((sum, r) => sum + (byBundesland[r.bundesland] || 0), 0),
    [regions, byBundesland]
  )

  const fokusShare = targets.length ? Math.round((fokusIst / targets.length) * 100) : 0

  function updateRegion(index, patch) {
    setRegions((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRegion() {
    const name = newRegion.bundesland.trim()
    if (!name) {
      toast.error('Bundesland angeben')
      return
    }
    if (regions.some((r) => r.bundesland.toLowerCase() === name.toLowerCase())) {
      toast.error('Bundesland ist bereits vorhanden')
      return
    }
    setRegions((prev) => [...prev, { bundesland: name, priority: Number(newRegion.priority) || 3, note: newRegion.note || null }])
    setNewRegion({ bundesland: '', priority: 3, note: '' })
  }

  async function saveRegions() {
    setSavingRegions(true)
    try {
      const saved = await api.put('/sprint-market/regions', {
        regions: regions.map((r) => ({
          bundesland: r.bundesland,
          priority: Number(r.priority) || 3,
          note: r.note || null,
          active: true,
        })),
      })
      setRegions(saved)
      toast.success('Bundesländer gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSavingRegions(false)
    }
  }

  function updateWz(index, patch) {
    setWzMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function addWz() {
    if (!newWz.wzCode.trim() || !newWz.segment.trim()) {
      toast.error('WZ-Code und Segment angeben')
      return
    }
    setWzMappings((prev) => [
      ...prev,
      { wzCode: newWz.wzCode.trim(), segment: newWz.segment.trim(), priority: Number(newWz.priority) || 3 },
    ])
    setNewWz({ wzCode: '', segment: '', priority: 3 })
  }

  async function saveWz() {
    setSavingWz(true)
    try {
      const saved = await api.put('/sprint-market/wz-mappings', {
        wzMappings: wzMappings.map((m) => ({
          wzCode: m.wzCode,
          segment: m.segment,
          priority: Number(m.priority) || 3,
          note: m.note || null,
        })),
      })
      setWzMappings(saved)
      toast.success('WZ-Zuordnung gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSavingWz(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marktauswahl</h1>
          <p className="text-sm text-gray-500">Bundesland-Priorisierung und WZ-Zuordnung</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Zielgröße Markt</p>
          <p className="text-lg font-bold text-gray-900">{zielgroesse.toLocaleString('de-DE')}</p>
          <p className="text-xs text-gray-400">Unternehmen ab 50 MA (netto)</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Fokusländer-Anteil</p>
          <p className="text-lg font-bold text-gray-900">{fokusShare} %</p>
          <p className="text-xs text-gray-400">der Zielliste</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Zielkunden insgesamt</p>
          <p className="text-lg font-bold text-blue-700">{targets.length}</p>
          <p className="text-xs text-gray-400">in der Zielliste</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">in Fokusländern</p>
          <p className="text-lg font-bold text-blue-700">{fokusIst}</p>
          <p className="text-xs text-gray-400">{regions.map((r) => r.bundesland).slice(0, 4).join(', ') || '—'}</p>
        </div>
      </div>

      {/* Bundesländer */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Bundesländer-Priorisierung</h2>
          </div>
          <button
            onClick={saveRegions}
            disabled={savingRegions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {savingRegions ? 'Speichern…' : 'Speichern'}
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {['Prio', 'Bundesland', 'Begründung', 'Zielkunden', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((r, i) => (
              <tr key={r.id || `${r.bundesland}-${i}`} className="border-t border-gray-50">
                <td className="px-3 py-2 w-20">
                  <select value={r.priority} onChange={(e) => updateRegion(i, { priority: Number(e.target.value) })} className={CLS_INPUT}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{r.bundesland}</td>
                <td className="px-3 py-2">
                  <input
                    value={r.note || ''}
                    onChange={(e) => updateRegion(i, { note: e.target.value })}
                    className={CLS_INPUT}
                    placeholder="Begründung / Notiz"
                  />
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-gray-900 w-24">{byBundesland[r.bundesland] || 0}</td>
                <td className="px-3 py-2 text-right w-12">
                  <button
                    onClick={() => setRegions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-100 bg-gray-50/50">
              <td className="px-3 py-2">
                <select value={newRegion.priority} onChange={(e) => setNewRegion((p) => ({ ...p, priority: Number(e.target.value) }))} className={CLS_INPUT}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  value={newRegion.bundesland}
                  onChange={(e) => setNewRegion((p) => ({ ...p, bundesland: e.target.value }))}
                  className={CLS_INPUT}
                  placeholder="Bundesland"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={newRegion.note}
                  onChange={(e) => setNewRegion((p) => ({ ...p, note: e.target.value }))}
                  className={CLS_INPUT}
                  placeholder="Begründung / Notiz"
                />
              </td>
              <td className="px-3 py-2 text-sm text-gray-400">neu</td>
              <td className="px-3 py-2 text-right">
                <button onClick={addRegion} className="p-1 text-blue-600 hover:text-blue-800" title="Hinzufügen">
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* WZ-Zuordnung */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">WZ-Zuordnung</h2>
          </div>
          <button
            onClick={saveWz}
            disabled={savingWz}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {savingWz ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          WZ-2008-Codes werden beim Import auf Branche und Priorität abgebildet. Bereiche wie „64-66" oder Listen wie „62,63,70-72" sind erlaubt; die ersten zwei Ziffern der WZ-Nummer entscheiden.
        </p>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {['WZ 2008', 'Branche', 'Priorität', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wzMappings.map((m, i) => (
              <tr key={m.id || `${m.wzCode}-${i}`} className="border-t border-gray-50">
                <td className="px-3 py-2 w-36">
                  <input value={m.wzCode} onChange={(e) => updateWz(i, { wzCode: e.target.value })} className={`${CLS_INPUT} font-mono`} />
                </td>
                <td className="px-3 py-2">
                  <input value={m.segment} onChange={(e) => updateWz(i, { segment: e.target.value })} className={CLS_INPUT} />
                </td>
                <td className="px-3 py-2 w-24">
                  <select value={m.priority} onChange={(e) => updateWz(i, { priority: Number(e.target.value) })} className={CLS_INPUT}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>P{p}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right w-12">
                  <button
                    onClick={() => setWzMappings((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-100 bg-gray-50/50">
              <td className="px-3 py-2">
                <input value={newWz.wzCode} onChange={(e) => setNewWz((p) => ({ ...p, wzCode: e.target.value }))} className={`${CLS_INPUT} font-mono`} placeholder="z. B. 64-66" />
              </td>
              <td className="px-3 py-2">
                <input value={newWz.segment} onChange={(e) => setNewWz((p) => ({ ...p, segment: e.target.value }))} className={CLS_INPUT} placeholder="Branche" />
              </td>
              <td className="px-3 py-2">
                <select value={newWz.priority} onChange={(e) => setNewWz((p) => ({ ...p, priority: Number(e.target.value) }))} className={CLS_INPUT}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>P{p}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={addWz} className="p-1 text-blue-600 hover:text-blue-800" title="Hinzufügen">
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Pakete</h2>
            <button onClick={() => router.push('/settings?tab=akquise')} className="text-xs text-blue-600 hover:underline">Bearbeiten →</button>
          </div>
          {packages.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Pakete hinterlegt.</p>
          ) : (
            <div className="space-y-2">
              {packages.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{p.label}</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Branchen</h2>
            <button onClick={() => router.push('/settings?tab=akquise')} className="text-xs text-blue-600 hover:underline">Bearbeiten →</button>
          </div>
          {segments.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Branchen hinterlegt.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {segments.map((s) => (
                <span key={s.id} className="px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs">{s.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

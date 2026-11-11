'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Calculator, Clock, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getSprintSettings, saveSprintSettings } from '@/lib/sprintSettings'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

export default function SprintCapacityPage() {
  const router = useRouter()
  const [targets, setTargets] = useState([])
  const [netto, setNetto] = useState(878)
  const [hoursPerFirm, setHoursPerFirm] = useState(0.45)
  const [hoursPerWeek, setHoursPerWeek] = useState(8.4)
  const [memberCount, setMemberCount] = useState(0)
  const [teamHours, setTeamHours] = useState(8.4)
  const [teamHoursTouched, setTeamHoursTouched] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [data, team] = await Promise.all([
        api.get('/sprint-targets'),
        api.get('/sprint-targets/team/overview').catch(() => null),
      ])
      setTargets(Array.isArray(data) ? data : [])
      if (team) {
        const members = Array.isArray(team.members) ? team.members.length : 0
        setMemberCount(members)
        const perMember = getSprintSettings().hoursPerWeek || 8.4
        setHoursPerWeek(perMember)
        setTeamHours(Number((members * perMember).toFixed(1)) || perMember)
      }
    } catch {
      toast.error('Fehler beim Laden')
    }
  }, [])

  useEffect(() => {
    const s = getSprintSettings()
    setNetto(s.targetFirms)
    setHoursPerWeek(s.hoursPerWeek)
    fetchData()
  }, [fetchData])

  function handleTeamHours(value) {
    setTeamHoursTouched(true)
    setTeamHours(value)
  }

  const weeks = useMemo(() => {
    if (!teamHours) return 0
    return Math.ceil((netto * hoursPerFirm) / teamHours)
  }, [netto, hoursPerFirm, teamHours])

  const totalHours = useMemo(() => Math.round(netto * hoursPerFirm), [netto, hoursPerFirm])

  const priorityCounts = useMemo(() => {
    const counts = { '1': 0, '2': 0, '3': 0 }
    for (const t of targets) {
      if (counts[t.priority] !== undefined) counts[t.priority]++
    }
    return counts
  }, [targets])

  function handleSave() {
    const perMember = memberCount > 0 ? Number((teamHours / memberCount).toFixed(2)) : Number(hoursPerWeek)
    setHoursPerWeek(perMember)
    saveSprintSettings({ targetFirms: Number(netto), hoursPerWeek: perMember })
    toast.success('Planungsparameter gespeichert')
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kapazitätsplanung</h1>
          <p className="text-sm text-gray-500">Wochen bis zur Marktabdeckung</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Rechenhilfe Zeitbedarf</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={CLS_LABEL}>Netto-Zielbestand</label>
              <input type="number" min="1" value={netto} onChange={(e) => setNetto(Number(e.target.value))} className={CLS_INPUT} />
              <p className="text-xs text-gray-400 mt-1">Unternehmen nach Abzug gesperrter Adressen</p>
            </div>
            <div>
              <label className={CLS_LABEL}>Stunden je Firma</label>
              <input type="number" step="0.05" min="0.05" value={hoursPerFirm} onChange={(e) => setHoursPerFirm(Number(e.target.value))} className={CLS_INPUT} />
              <p className="text-xs text-gray-400 mt-1">Recherche, Anfrage, Anruf, Doku</p>
            </div>
            <div>
              <label className={CLS_LABEL}>Team-Kapazität (h/Woche)</label>
              <input type="number" step="0.1" min="0.5" value={teamHours} onChange={(e) => handleTeamHours(Number(e.target.value))} className={CLS_INPUT} />
              <p className="text-xs text-gray-400 mt-1">
                {memberCount > 0
                  ? `${memberCount} Mitglieder × ${hoursPerWeek} h${teamHoursTouched ? ' (angepasst)' : ''}`
                  : 'Keine Teammitglieder geladen'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs text-blue-600">Wochen bis zur Abdeckung</p>
              <p className="text-3xl font-bold text-blue-700">{weeks}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Gesamtstunden</p>
              <p className="text-3xl font-bold text-gray-900">{totalHours.toLocaleString('de-DE')}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              {netto.toLocaleString('de-DE')} Firmen × {hoursPerFirm} h ÷ {teamHours} h/Woche
            </span>
            <button onClick={handleSave} className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium">
              <Save className="w-3.5 h-3.5" /> Als Standard speichern
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Bestand nach Priorität</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Prio 1</span>
                <span className="font-semibold text-red-600">{priorityCounts['1']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Prio 2</span>
                <span className="font-semibold text-yellow-600">{priorityCounts['2']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Prio 3</span>
                <span className="font-semibold text-gray-600">{priorityCounts['3']}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-600">Gesamt</span>
                <span className="font-bold text-gray-900">{targets.length}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <span className="font-semibold">Richtwert:</span> 878 Firmen netto ergeben bei 395 Stunden
            und 8,4 Stunden pro Woche rund 47 Wochen bis zur vollständigen Marktabdeckung.
          </div>
        </div>
      </div>
    </div>
  )
}

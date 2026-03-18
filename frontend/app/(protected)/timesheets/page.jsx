'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import { Clock, ChevronLeft, ChevronRight, Download, Check, RotateCcw, Coffee, Timer } from 'lucide-react'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function getMonday(d) {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1)
  dt.setDate(diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusBadge(status) {
  const map = {
    draft:        'bg-gray-100 text-gray-700',
    submitted:    'bg-yellow-100 text-yellow-800',
    pre_approved: 'bg-purple-100 text-purple-800',
    approved:     'bg-green-100 text-green-800',
    returned:     'bg-red-100 text-red-800',
  }
  const labels = { draft: 'Entwurf', submitted: 'Eingereicht', pre_approved: 'Vorgeprüft', approved: 'Genehmigt', returned: 'Zurückgegeben' }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{labels[status] || status}</span>
}

export default function TimesheetsPage() {
  const [tab, setTab] = useState('zeiterfassung')
  const [ledTeams, setLedTeams] = useState([])
  const [ledCCs, setLedCCs] = useState([])
  const user = getUser()

  useEffect(() => {
    api.get('/teams/led').then(setLedTeams).catch(() => {})
    api.get('/teams/led-cc').then(setLedCCs).catch(() => {})
  }, [])

  const isAdmin   = user?.role === 'admin'
  const isCCHead  = ledCCs.length > 0
  const isTeamLead = ledTeams.length > 0
  const canApprove = isAdmin || isCCHead || isTeamLead

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Zeiterfassung</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'zeiterfassung', label: 'Zeiterfassung' },
          { key: 'woche', label: 'Wochenübersicht' },
          ...(canApprove ? [{ key: 'genehmigung', label: 'Genehmigung' }] : []),
          { key: 'berichte', label: 'Berichte' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'zeiterfassung' && <ZeiterfassungTab user={user} />}
      {tab === 'woche' && <WochenTab user={user} />}
      {tab === 'genehmigung' && <GenehmigungTab user={user} isAdmin={isAdmin} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
      {tab === 'berichte' && <BerichteTab user={user} isAdmin={isAdmin} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
    </div>
  )
}

function calcNetHours(start, end, breakMins) {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMins = (eh * 60 + em) - (sh * 60 + sm)
  const netMins = totalMins - (parseInt(breakMins) || 0)
  if (netMins <= 0) return ''
  return (netMins / 60).toFixed(2)
}

function ZeiterfassungTab({ user }) {
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [mode, setMode] = useState('times') // 'times' | 'hours'
  const [form, setForm] = useState({
    projectId: '', date: new Date().toISOString().split('T')[0],
    phase: '', description: '', billable: true,
    startTime: '', endTime: '', breakMinutes: '30', hours: '',
  })

  useEffect(() => {
    api.get(`/projects?memberId=${user.id}`).then(setProjects).catch(() => {})
    loadEntries()
  }, [])

  async function loadEntries() {
    try {
      const all = await api.get(`/timesheets?userId=${user.id}`)
      const today = new Date().toISOString().split('T')[0]
      const allEntries = all.flatMap(ts => ts.entries || [])
      setEntries(allEntries.filter(e => e.date?.startsWith(today)))
    } catch {}
  }

  function setField(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (mode === 'times' && ['startTime', 'endTime', 'breakMinutes'].includes(k)) {
        next.hours = calcNetHours(
          k === 'startTime' ? v : f.startTime,
          k === 'endTime' ? v : f.endTime,
          k === 'breakMinutes' ? v : f.breakMinutes,
        )
      }
      return next
    })
  }

  function switchMode(m) {
    setMode(m)
    if (m === 'times') {
      setForm(f => ({ ...f, hours: calcNetHours(f.startTime, f.endTime, f.breakMinutes) }))
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.projectId) return toast.error('Projekt ist ein Pflichtfeld')
    if (!form.hours || parseFloat(form.hours) <= 0) return toast.error('Nettoarbeitszeit konnte nicht berechnet werden')

    try {
      const weekStart = getMonday(new Date(form.date)).toISOString()
      const ts = await api.post('/timesheets', { userId: user.id, weekStart })
      await api.post(`/timesheets/${ts.id}/entries`, {
        projectId: form.projectId,
        date: form.date,
        hours: parseFloat(form.hours),
        billable: form.billable,
        description: form.description || null,
        phase: form.phase || null,
        startTime: mode === 'times' ? (form.startTime || null) : null,
        endTime: mode === 'times' ? (form.endTime || null) : null,
        breakMinutes: parseInt(form.breakMinutes) || 0,
      })
      toast.success('Eintrag gespeichert')
      setForm(f => ({ ...f, description: '', startTime: '', endTime: '', breakMinutes: '30', hours: '' }))
      loadEntries()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    }
  }

  const totalBreakToday = entries.reduce((s, e) => s + (e.breakMinutes || 0), 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Zeit erfassen</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[['times', 'Stempeluhr'], ['hours', 'Stunden']].map(([m, l]) => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors
                  ${mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projekt *</label>
            <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Projekt wählen...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <input type="text" value={form.phase} onChange={e => setField('phase', e.target.value)}
              placeholder="z.B. Analyse, Implementierung..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          {mode === 'times' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beginn</label>
                  <input type="time" value={form.startTime} onChange={e => setField('startTime', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ende</label>
                  <input type="time" value={form.endTime} onChange={e => setField('endTime', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                    <Coffee className="w-3.5 h-3.5 text-amber-500" /> Pause (min)
                  </label>
                  <input type="number" min="0" max="480" step="5" value={form.breakMinutes}
                    onChange={e => setField('breakMinutes', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border
                ${form.hours ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Timer className="w-3.5 h-3.5" /> Nettoarbeitszeit
                </span>
                <span className={`font-bold ${form.hours ? 'text-blue-700' : 'text-gray-400'}`}>
                  {form.hours ? `${form.hours} h` : '– h'}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stunden *</label>
                <input type="number" step="0.25" min="0.25" max="24" value={form.hours}
                  onChange={e => setField('hours', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Coffee className="w-3.5 h-3.5 text-amber-500" /> Pause (min)
                </label>
                <input type="number" min="0" max="480" step="5" value={form.breakMinutes}
                  onChange={e => setField('breakMinutes', e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.billable} onChange={e => setField('billable', e.target.checked)}
              className="rounded" />
            Abrechenbar
          </label>

          <button type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Eintrag speichern
          </button>
        </form>
      </div>

      {/* Today's entries */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Heutige Einträge</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Einträge heute</p>
        ) : (
          <div className="space-y-3">
            {entries.map(e => (
              <div key={e.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.project?.name || '–'}</p>
                  {e.phase && <p className="text-xs text-gray-500">{e.phase}</p>}
                  {(e.startTime || e.endTime) && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      {e.startTime || '?'} – {e.endTime || '?'}
                      {e.breakMinutes > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                          <Coffee className="w-3 h-3" />{e.breakMinutes} min Pause
                        </span>
                      )}
                    </p>
                  )}
                  {e.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{e.description}</p>}
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="text-sm font-bold">{e.hours} h</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${e.billable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {e.billable ? 'Abrechenbar' : 'Intern'}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-sm font-medium">
                <span>Nettoarbeitszeit</span>
                <span>{entries.reduce((s, e) => s + e.hours, 0).toFixed(2)} h</span>
              </div>
              {totalBreakToday > 0 && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span className="flex items-center gap-1"><Coffee className="w-3 h-3" /> Gesamtpause</span>
                  <span>{totalBreakToday} min</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WochenTab({ user }) {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [timesheet, setTimesheet] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadWeek() }, [weekStart])

  async function loadWeek() {
    setLoading(true)
    try {
      const all = await api.get(`/timesheets?userId=${user.id}&weekStart=${weekStart.toISOString()}`)
      setTimesheet(all[0] || null)
    } catch {}
    setLoading(false)
  }

  async function handleSubmit() {
    if (!timesheet) return toast.error('Kein Stundenzettel vorhanden')
    try {
      await api.put(`/timesheets/${timesheet.id}/submit`)
      toast.success('Stundenzettel eingereicht')
      loadWeek()
    } catch { toast.error('Fehler') }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const entries = timesheet?.entries || []

  const projectMap = {}
  entries.forEach(e => {
    const dayIdx = weekDays.findIndex(d => d.toISOString().split('T')[0] === e.date?.split('T')[0])
    if (!projectMap[e.projectId]) projectMap[e.projectId] = { name: e.project?.name || e.projectId, days: Array(7).fill(0) }
    if (dayIdx >= 0) projectMap[e.projectId].days[dayIdx] += e.hours
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm">
            {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
          </span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {timesheet && statusBadge(timesheet.status)}
          {timesheet?.status === 'draft' && (
            <button onClick={handleSubmit} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Einreichen
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[160px]">Projekt</th>
              {weekDays.map((d, i) => (
                <th key={i} className="px-3 py-3 font-medium text-gray-600 text-center min-w-[70px]">
                  <div>{DAYS[i]}</div>
                  <div className="text-xs text-gray-400 font-normal">{d.getDate()}.{d.getMonth() + 1}.</div>
                </th>
              ))}
              <th className="px-3 py-3 font-medium text-gray-600 text-center">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(projectMap).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">Keine Einträge diese Woche</td></tr>
            ) : (
              Object.entries(projectMap).map(([pid, { name, days }]) => (
                <tr key={pid} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{name}</td>
                  {days.map((h, i) => (
                    <td key={i} className="px-3 py-2 text-center text-gray-600">{h > 0 ? h.toFixed(1) : '–'}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{days.reduce((s, h) => s + h, 0).toFixed(1)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-medium">
              <td className="px-4 py-2 text-gray-700">Gesamt</td>
              {Array.from({ length: 7 }, (_, i) => {
                const total = Object.values(projectMap).reduce((s, p) => s + p.days[i], 0)
                return <td key={i} className="px-3 py-2 text-center">{total > 0 ? total.toFixed(1) : '–'}</td>
              })}
              <td className="px-3 py-2 text-center">{entries.reduce((s, e) => s + e.hours, 0).toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function GenehmigungTab({ user, isAdmin, isCCHead, isTeamLead }) {
  const [teamItems, setTeamItems]   = useState([])
  const [ccItems, setCcItems]       = useState([])
  const [processed, setProcessed]   = useState([])
  const [modalTs, setModalTs]       = useState(null)
  const [modalAction, setModalAction] = useState('')
  const [comment, setComment]       = useState('')

  useEffect(() => { load() }, [user?.id, isCCHead, isTeamLead])

  async function load() {
    try {
      const ccScope = (isCCHead && !isAdmin) ? `&ccLeaderId=${user.id}` : ''
      const [submitted, preApproved, appr, ret] = await Promise.all([
        isTeamLead ? api.get(`/timesheets?status=submitted&managerId=${user.id}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/timesheets?status=pre_approved${ccScope}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/timesheets?status=approved${ccScope}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/timesheets?status=returned${ccScope}`) : Promise.resolve([]),
      ])
      setTeamItems(Array.isArray(submitted)   ? submitted   : [])
      setCcItems(Array.isArray(preApproved) ? preApproved : [])
      setProcessed([
        ...(Array.isArray(appr) ? appr : []),
        ...(Array.isArray(ret)  ? ret  : []),
      ].sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt)))
    } catch {}
  }

  async function handlePreApprove(id) {
    try {
      await api.put(`/timesheets/${id}/pre-approve`, {})
      toast.success('Vorgeprüft')
      setTeamItems(prev => prev.filter(t => t.id !== id))
    } catch { toast.error('Fehler') }
  }

  async function handleAction() {
    if (!modalTs) return
    try {
      await api.put(`/timesheets/${modalTs.id}/${modalAction}`, { comment })
      toast.success(modalAction === 'approve' ? 'Genehmigt' : 'Zurückgegeben')
      setModalTs(null)
      setComment('')
      load()
    } catch { toast.error('Fehler') }
  }

  function TsTable({ items, actions }) {
    if (items.length === 0) return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
        Keine ausstehenden Einträge
      </div>
    )
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mitarbeiter</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Woche</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stunden</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Eingereicht</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(ts => (
              <tr key={ts.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{ts.user?.name}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(ts.weekStart)}</td>
                <td className="px-4 py-3">{(ts.entries || []).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</td>
                <td className="px-4 py-3 text-gray-500">{ts.submittedAt ? fmtDate(ts.submittedAt) : '–'}</td>
                <td className="px-4 py-3 flex gap-2 justify-end">{actions(ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {isTeamLead && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Vorgenehmigung — Mein Team</h2>
          <TsTable
            items={teamItems}
            actions={ts => (
              <button onClick={() => handlePreApprove(ts.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                <Check className="w-3 h-3" /> Vorprüfen
              </button>
            )}
          />
        </div>
      )}

      {(isCCHead || isAdmin) && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Genehmigung — CC</h2>
          <TsTable
            items={ccItems}
            actions={ts => (
              <>
                <button onClick={() => { setModalTs(ts); setModalAction('approve'); setComment('') }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                  <Check className="w-3 h-3" /> Genehmigen
                </button>
                <button onClick={() => { setModalTs(ts); setModalAction('return'); setComment('') }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                  <RotateCcw className="w-3 h-3" /> Zurückgeben
                </button>
              </>
            )}
          />
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Bearbeitet ({processed.length})</h3>
          <div className="space-y-2">
            {processed.map(ts => (
              <div key={ts.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{ts.user?.name}</p>
                    {statusBadge(ts.status)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Woche ab {fmtDate(ts.weekStart)}</p>
                  {ts.comment && <p className="text-xs text-gray-400 mt-0.5">"{ts.comment}"</p>}
                </div>
                <p className="text-sm text-gray-600">{(ts.entries || []).reduce((s, e) => s + e.hours, 0).toFixed(1)}h</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalTs && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">
              {modalAction === 'approve' ? 'Genehmigen' : 'Zurückgeben'}: {modalTs.user?.name}
            </h3>
            <p className="text-sm text-gray-500 mb-4">Woche ab {fmtDate(modalTs.weekStart)}</p>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Kommentar (optional)..." rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModalTs(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Abbrechen
              </button>
              <button onClick={handleAction}
                className={`px-4 py-2 text-sm text-white rounded-lg ${modalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {modalAction === 'approve' ? 'Genehmigen' : 'Zurückgeben'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BerichteTab({ user, isAdmin, isCCHead, isTeamLead }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState(null)

  useEffect(() => { loadReport() }, [month, isAdmin, isCCHead, isTeamLead])

  function reportScope() {
    if (isAdmin) return ''
    if (isCCHead) return `&ccLeaderId=${user.id}`
    if (isTeamLead) return `&managerId=${user.id}`
    return `&userId=${user.id}`
  }

  async function loadReport() {
    try {
      setReport(await api.get(`/timesheets/report?month=${month}-01${reportScope()}`))
    } catch {}
  }

  async function exportCsv() {
    try {
      const token = localStorage.getItem('crm_token')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${baseUrl}/timesheets/export?month=${month}-01${reportScope()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `zeiterfassung-${month}.csv`; a.click()
    } catch { toast.error('Export fehlgeschlagen') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Monat:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> CSV Export
        </button>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Gesamt', value: (report.total || 0).toFixed(1) + 'h' },
              { label: 'Abrechenbar', value: (report.billable || 0).toFixed(1) + 'h' },
              { label: 'Intern', value: (report.nonBillable || 0).toFixed(1) + 'h' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mitarbeiter</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Abrechenbar</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Intern</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Gesamt</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Quote</th>
                </tr>
              </thead>
              <tbody>
                {(report.byUser || []).map(u => (
                  <tr key={u.user?.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.user?.name}</td>
                    <td className="px-4 py-3 text-right text-green-700">{u.billable.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right text-gray-500">{u.nonBillable.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right font-semibold">{u.total.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right">
                      {u.total > 0 ? Math.round((u.billable / u.total) * 100) : 0}%
                    </td>
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

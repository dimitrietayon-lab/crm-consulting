'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import toast from 'react-hot-toast'
import { CalendarOff, Plus, Trash2, X, Check, XCircle } from 'lucide-react'

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'training', label: 'Weiterbildung' },
  { value: 'holiday', label: 'Feiertag' },
  { value: 'other', label: 'Sonstiges' },
]

const STATUS_COLORS = {
  pending:      'bg-yellow-100 text-yellow-800',
  pre_approved: 'bg-purple-100 text-purple-800',
  approved:     'bg-green-100 text-green-800',
  rejected:     'bg-red-100 text-red-800',
}

const STATUS_LABELS = {
  pending:      'Ausstehend',
  pre_approved: 'Vorgeprüft',
  approved:     'Genehmigt',
  rejected:     'Abgelehnt',
}

const TYPE_COLORS = {
  vacation: 'bg-blue-200',
  sick: 'bg-red-200',
  training: 'bg-purple-200',
  holiday: 'bg-green-200',
  other: 'bg-gray-200',
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function LeavePage() {
  const [tab, setTab] = useState('meine')
  const [ledTeams, setLedTeams] = useState([])
  const [ledCCs, setLedCCs]     = useState([])
  const user = getUser()

  useEffect(() => {
    api.get('/teams/led').then(setLedTeams).catch(() => {})
    api.get('/teams/led-cc').then(setLedCCs).catch(() => {})
  }, [])

  const isAdmin    = user?.role === 'admin'
  const isCCHead   = isAdmin || ledCCs.length > 0
  const isTeamLead = ledTeams.length > 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalendarOff className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Urlaubs- & Fehlzeiten</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'meine',    label: 'Meine Abwesenheiten' },
          ...(isCCHead || isTeamLead ? [{ key: 'genehmigung', label: 'Genehmigung' }] : []),
          { key: 'kalender', label: 'Team-Kalender' },
          { key: 'guthaben', label: 'Urlaubsguthaben' },
          { key: 'feiertage', label: 'Feiertage' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meine'       && <MeineTab user={user} />}
      {tab === 'genehmigung' && <GenehmigungTab user={user} isAdmin={isAdmin} isCCHead={isCCHead} isTeamLead={isTeamLead} />}
      {tab === 'kalender'    && <KalenderTab />}
      {tab === 'guthaben'    && <GuthabenTab />}
      {tab === 'feiertage'   && <FeiertageTab />}
    </div>
  )
}

function GenehmigungTab({ user, isAdmin, isCCHead, isTeamLead }) {
  const [teamItems, setTeamItems] = useState([])
  const [ccItems, setCcItems]     = useState([])
  const [processed, setProcessed] = useState([])
  const [commentMap, setCommentMap] = useState({})

  useEffect(() => { load() }, [user?.id, isCCHead, isTeamLead])

  async function load() {
    try {
      const ccScope = (isCCHead && !isAdmin) ? `&ccLeaderId=${user.id}` : ''
      const [submitted, preApproved, appr, rej] = await Promise.all([
        isTeamLead ? api.get(`/leave/requests?status=pending&managerId=${user.id}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/leave/requests?status=pre_approved${ccScope}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/leave/requests?status=approved${ccScope}`) : Promise.resolve([]),
        (isCCHead || isAdmin) ? api.get(`/leave/requests?status=rejected${ccScope}`) : Promise.resolve([]),
      ])
      setTeamItems(Array.isArray(submitted)   ? submitted   : [])
      setCcItems(Array.isArray(preApproved) ? preApproved : [])
      setProcessed([
        ...(Array.isArray(appr) ? appr : []),
        ...(Array.isArray(rej)  ? rej  : []),
      ].sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt)))
    } catch {}
  }

  async function handlePreApprove(id) {
    try {
      await api.put(`/leave/requests/${id}/pre-approve`, {})
      toast.success('Vorgeprüft')
      setTeamItems(prev => prev.filter(r => r.id !== id))
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleApprove(id) {
    try {
      await api.put(`/leave/requests/${id}/approve`, { comment: commentMap[id] || null })
      toast.success('Genehmigt')
      setCcItems(prev => prev.filter(r => r.id !== id))
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleReject(id) {
    if (!commentMap[id]?.trim()) { toast.error('Bitte einen Ablehnungsgrund angeben'); return }
    try {
      await api.put(`/leave/requests/${id}/reject`, { comment: commentMap[id] })
      toast.success('Abgelehnt')
      setCcItems(prev => prev.filter(r => r.id !== id))
      load()
    } catch { toast.error('Fehler') }
  }

  function RequestRow({ r, actions }) {
    const typeLabel = LEAVE_TYPES.find(t => t.value === r.type)?.label || r.type
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50">
        <td className="px-4 py-3 font-medium">{r.user?.name}</td>
        <td className="px-4 py-3">{typeLabel}</td>
        <td className="px-4 py-3">{fmtDate(r.startDate)}{r.halfDay ? ' (½)' : ''}</td>
        <td className="px-4 py-3">{fmtDate(r.endDate)}</td>
        <td className="px-4 py-3 text-gray-500">{r.comment || '–'}</td>
        <td className="px-4 py-3">{actions}</td>
      </tr>
    )
  }

  function RequestTable({ items, actions }) {
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Typ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Von</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bis</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kommentar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>{items.map(r => <RequestRow key={r.id} r={r} actions={actions(r)} />)}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {isTeamLead && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Vorgenehmigung — Mein Team</h2>
          <RequestTable
            items={teamItems}
            actions={r => (
              <button onClick={() => handlePreApprove(r.id)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                <Check className="w-3 h-3" /> Vorprüfen
              </button>
            )}
          />
        </div>
      )}

      {(isCCHead || isAdmin) && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Genehmigung — CC</h2>
          <RequestTable
            items={ccItems}
            actions={r => (
              <div className="flex flex-col items-end gap-1">
                <input
                  type="text"
                  placeholder="Kommentar..."
                  value={commentMap[r.id] || ''}
                  onChange={e => setCommentMap(p => ({ ...p, [r.id]: e.target.value }))}
                  className="w-40 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex gap-1.5">
                  <button onClick={() => handleApprove(r.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                    <Check className="w-3 h-3" /> Genehmigen
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">
                    <XCircle className="w-3 h-3" /> Ablehnen
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Bearbeitet ({processed.length})</h3>
          <div className="space-y-2">
            {processed.map(r => {
              const typeLabel = LEAVE_TYPES.find(t => t.value === r.type)?.label || r.type
              return (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{r.user?.name}</p>
                      <span className="text-sm text-gray-600">{typeLabel}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}{r.halfDay ? ' (halber Tag)' : ''}</p>
                    {r.approverComment && <p className="text-xs text-gray-400 mt-0.5">"{r.approverComment}"</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MeineTab({ user }) {
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'vacation', startDate: '', endDate: '', halfDay: false, halfDayPart: 'morning', comment: '' })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setRequests(await api.get(`/leave/requests?userId=${user.id}`))
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.startDate || !form.endDate) return toast.error('Bitte Daten angeben')
    try {
      await api.post('/leave/requests', { ...form, userId: user.id })
      toast.success('Antrag gestellt')
      setShowForm(false)
      setForm({ type: 'vacation', startDate: '', endDate: '', halfDay: false, halfDayPart: 'morning', comment: '' })
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleCancel(id) {
    try {
      await api.delete(`/leave/requests/${id}`)
      toast.success('Storniert')
      load()
    } catch { toast.error('Fehler') }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Meine Anträge</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Antrag stellen
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-4">Neuer Abwesenheitsantrag</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
              <input type="text" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.halfDay} onChange={e => setForm(f => ({ ...f, halfDay: e.target.checked }))}
                  className="rounded" />
                Halber Tag
              </label>
              {form.halfDay && (
                <select value={form.halfDayPart} onChange={e => setForm(f => ({ ...f, halfDayPart: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="morning">Vormittag</option>
                  <option value="afternoon">Nachmittag</option>
                </select>
              )}
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Einreichen</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Typ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Von</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bis</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kommentar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keine Anträge vorhanden</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">{LEAVE_TYPES.find(t => t.value === r.type)?.label || r.type}</td>
                <td className="px-4 py-3">{fmtDate(r.startDate)}{r.halfDay ? ' (½)' : ''}</td>
                <td className="px-4 py-3">{fmtDate(r.endDate)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{r.approverComment || r.comment || '–'}</td>
                <td className="px-4 py-3">
                  {r.status === 'pending' && (
                    <button onClick={() => handleCancel(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                      <X className="w-3 h-3" /> Stornieren
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KalenderTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [absences, setAbsences] = useState([])

  useEffect(() => { load() }, [year, month])

  async function load() {
    try {
      setAbsences(await api.get(`/leave/calendar?year=${year}&month=${month}`))
    } catch {}
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const users = [...new Map(absences.map(a => [a.userId, a.user])).values()]

  function getAbsenceForDay(userId, day) {
    const date = new Date(year, month - 1, day)
    return absences.find(a => {
      const start = new Date(a.startDate)
      const end = new Date(a.endDate)
      return a.userId === userId && date >= start && date <= end
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          className="p-1 hover:bg-gray-100 rounded">◀</button>
        <span className="font-medium">{new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          className="p-1 hover:bg-gray-100 rounded">▶</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-[120px]">Mitarbeiter</th>
              {days.map(d => (
                <th key={d} className={`px-1 py-2 text-center font-medium min-w-[28px] ${
                  new Date(year, month - 1, d).getDay() === 0 || new Date(year, month - 1, d).getDay() === 6
                    ? 'bg-gray-50 text-gray-400' : 'text-gray-600'
                }`}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={daysInMonth + 1} className="px-4 py-8 text-center text-gray-400">Keine Abwesenheiten</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{u.name}</td>
                {days.map(d => {
                  const absence = getAbsenceForDay(u.id, d)
                  const isWeekend = new Date(year, month - 1, d).getDay() === 0 || new Date(year, month - 1, d).getDay() === 6
                  return (
                    <td key={d} className={`px-1 py-2 text-center ${isWeekend ? 'bg-gray-50' : ''}`}>
                      {absence && (
                        <div className={`w-5 h-5 rounded mx-auto ${TYPE_COLORS[absence.type] || 'bg-gray-200'}`}
                          title={LEAVE_TYPES.find(t => t.value === absence.type)?.label} />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 flex-wrap">
        {LEAVE_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${TYPE_COLORS[t.value]}`} />
            <span className="text-xs text-gray-600">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GuthabenTab() {
  const [balances, setBalances] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => { load() }, [year])

  async function load() {
    try {
      setBalances(await api.get(`/leave/balances?year=${year}`))
    } catch {}
  }

  const byUser = {}
  balances.forEach(b => {
    if (!byUser[b.userId]) byUser[b.userId] = { user: b.user, balances: {} }
    byUser[b.userId].balances[b.type] = b
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Jahr:</label>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm">
          {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mitarbeiter</th>
              {['vacation', 'sick', 'training'].map(type => (
                <th key={type} colSpan={3} className="text-center px-4 py-3 font-medium text-gray-600">
                  {LEAVE_TYPES.find(t => t.value === type)?.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2"></th>
              {['vacation', 'sick', 'training'].flatMap(type => [
                <th key={`${type}-e`} className="text-center px-2 py-2 text-xs text-gray-500">Anspruch</th>,
                <th key={`${type}-u`} className="text-center px-2 py-2 text-xs text-gray-500">Genommen</th>,
                <th key={`${type}-r`} className="text-center px-2 py-2 text-xs text-gray-500">Rest</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {Object.values(byUser).length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Keine Daten</td></tr>
            ) : Object.values(byUser).map(({ user, balances: b }) => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                {['vacation', 'sick', 'training'].flatMap(type => {
                  const bal = b[type] || { entitlement: 0, used: 0 }
                  const rest = bal.entitlement - bal.used
                  return [
                    <td key={`${type}-e`} className="text-center px-2 py-3 text-gray-600">{bal.entitlement}</td>,
                    <td key={`${type}-u`} className="text-center px-2 py-3 text-gray-600">{bal.used}</td>,
                    <td key={`${type}-r`} className={`text-center px-2 py-3 font-medium ${rest < 0 ? 'text-red-600' : 'text-green-600'}`}>{rest.toFixed(1)}</td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FeiertageTab() {
  const [holidays, setHolidays] = useState([])
  const [form, setForm] = useState({ name: '', date: '', region: '' })

  useEffect(() => { load() }, [])

  async function load() {
    try { setHolidays(await api.get('/leave/holidays')) } catch {}
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || !form.date) return toast.error('Name und Datum erforderlich')
    try {
      await api.post('/leave/holidays', form)
      toast.success('Feiertag hinzugefügt')
      setForm({ name: '', date: '', region: '' })
      load()
    } catch { toast.error('Fehler') }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/leave/holidays/${id}`)
      toast.success('Gelöscht')
      load()
    } catch { toast.error('Fehler') }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">Feiertag hinzufügen</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input type="text" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              placeholder="z.B. Bayern, NRW..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Hinzufügen
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold">Feiertage</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {holidays.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Keine Feiertage eingetragen</p>
          ) : holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-gray-500">{fmtDate(h.date)}{h.region ? ` · ${h.region}` : ''}</p>
              </div>
              <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

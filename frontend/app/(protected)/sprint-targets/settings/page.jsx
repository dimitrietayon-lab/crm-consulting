'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Users, Settings as SettingsIcon, Building2, Megaphone,
  Bell, Landmark, Linkedin, AlertTriangle, RotateCcw, Plus, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { SPRINT_DEFAULTS, refreshSprintSettings } from '@/lib/sprintSettings'
import { BRANCHEN } from '@/lib/sprintOptions'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const TABS = [
  { id: 'quoten',            label: 'Quoten',            icon: SettingsIcon },
  { id: 'info',              label: 'Akquise-Info',      icon: Building2 },
  { id: 'branchen',          label: 'Branchen',          icon: Megaphone },
  { id: 'foerderung',        label: 'Förderungen',       icon: Landmark },
  { id: 'outreach',          label: 'Outreach',          icon: Linkedin },
  { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
  { id: 'system',            label: 'System',            icon: AlertTriangle },
]

function normalizeSegmentsText(raw) {
  if (!Array.isArray(raw)) return ''
  return raw.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean).join(', ')
}

function normalizeNotifications(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    notifications: {
      email: src.email !== undefined ? Boolean(src.email) : true,
      weeklyDigest: src.weeklyDigest !== undefined ? Boolean(src.weeklyDigest) : true,
      overdue: src.overdue !== undefined ? Boolean(src.overdue) : true,
    },
  }
}

function defaultForm() {
  return {
    ...SPRINT_DEFAULTS,
    sprintStart: '',
    sprintEnd: '',
    segmentsText: '',
    notifEmail: true,
    notifWeeklyDigest: true,
    notifOverdue: true,
    linkedinDailyLimit: 25,
    linkedinInviteMessage: '',
  }
}

// Förderprogramme (Admin-Katalog). Rate wird als Prozent geführt, in den
// Einstellungen aber als Bruch (0.5) gespeichert – hier umgerechnet.
function normalizeFundingPrograms(bafaParams) {
  const p = bafaParams && typeof bafaParams === 'object' ? bafaParams : null
  if (Array.isArray(p?.programs) && p.programs.length) {
    return p.programs.map((x, i) => ({
      id: x.id || `fp-${i}`,
      name: x.name || '',
      rate: x.rate != null ? Math.round(Number(x.rate) * 100) : 50,
      cap: x.cap != null ? String(x.cap) : '',
      note: x.note || '',
      active: x.active !== false,
    }))
  }
  if (p && (p.rate != null || p.cap != null)) {
    return [{
      id: 'bafa',
      name: 'BAFA',
      rate: p.rate != null ? Math.round(Number(p.rate) * 100) : 50,
      cap: p.cap != null ? String(p.cap) : '',
      note: '',
      active: true,
    }]
  }
  return [{ id: 'bafa', name: 'BAFA', rate: 50, cap: '', note: '', active: true }]
}

function applySettingsToForm(settings) {
  const notif = normalizeNotifications(settings.notifications).notifications
  const linkedin = settings.linkedin && typeof settings.linkedin === 'object' ? settings.linkedin : {}
  return {
    ...defaultForm(),
    ...settings,
    sprintStart: settings.sprintStart ? String(settings.sprintStart).slice(0, 10) : '',
    sprintEnd: settings.sprintEnd ? String(settings.sprintEnd).slice(0, 10) : '',
    segmentsText: normalizeSegmentsText(settings.segments),
    notifEmail: notif.email,
    notifWeeklyDigest: notif.weeklyDigest,
    notifOverdue: notif.overdue,
    linkedinDailyLimit: linkedin.dailyLimit != null ? linkedin.dailyLimit : 25,
    linkedinInviteMessage: linkedin.inviteMessage || '',
  }
}

export const SPRINT_SETTINGS_TABS = TABS

export default function SprintSettingsPage({ embedded = false, activeTab: controlledTab }) {
  const router = useRouter()
  const [form, setForm] = useState(defaultForm)
  const [fundingPrograms, setFundingPrograms] = useState(() => normalizeFundingPrograms(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [localTab, setLocalTab] = useState('quoten')
  const activeTab = controlledTab || localTab
  const isAdmin = getUser()?.role === 'admin'
  // System (Danger Zone / Reset) ist Admin-only
  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t.id !== 'system')
  const [newSegment, setNewSegment] = useState('')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = await refreshSprintSettings()
      const nextForm = applySettingsToForm(settings)
      setForm(nextForm)
      setFundingPrograms(normalizeFundingPrograms(settings.bafaParams))

      // Marktdaten (Segmente/Pakete) sind die gemeinsame Quelle für Marktauswahl & Import
      try {
        const market = await api.get('/sprint-market')
        const names = (market?.segments || []).map((s) => s.name).filter(Boolean)
        if (names.length) setForm((prev) => ({ ...prev, segmentsText: names.join(', ') }))
      } catch {
        // Marktdaten optional
      }
    } catch {
      toast.error('Einstellungen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  function setNum(field, value) {
    setForm((p) => ({ ...p, [field]: value === '' ? '' : Number(value) }))
  }

  // ─── Branchen (Chips) ──────────────────────────────────────────────────────
  const segmentList = (form.segmentsText || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const segmentSuggestions = BRANCHEN.filter(
    (b) => !segmentList.some((s) => s.toLowerCase() === b.toLowerCase())
  )

  function addSegment(name) {
    const n = (name || '').trim()
    if (!n) return
    if (segmentList.some((s) => s.toLowerCase() === n.toLowerCase())) return
    set('segmentsText', [...segmentList, n].join(', '))
  }
  function removeSegment(name) {
    set('segmentsText', segmentList.filter((s) => s !== name).join(', '))
  }

  function addFundingProgram() {
    setFundingPrograms((prev) => [
      ...prev,
      { id: `fp-${Date.now()}`, name: '', rate: 50, cap: '', note: '', active: true },
    ])
  }
  function updateFundingProgram(idx, patch) {
    setFundingPrograms((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function removeFundingProgram(idx) {
    setFundingPrograms((prev) => prev.filter((_, i) => i !== idx))
  }

  // ─── Einstellungen speichern ───────────────────────────────────────────────

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const programs = fundingPrograms
        .filter((p) => (p.name || '').trim())
        .map((p, i) => ({
          id: p.id || `fp-${i}`,
          name: p.name.trim(),
          rate: (Number(p.rate) || 0) / 100,
          cap: p.cap === '' ? null : Number(p.cap),
          note: p.note || '',
          active: p.active !== false,
        }))
      const firstActive = programs.find((p) => p.active) || programs[0] || null

      const payload = {
        sprintName: form.sprintName || null,
        sprintStart: form.sprintStart || null,
        sprintEnd: form.sprintEnd || null,
        linkedinQuota: Number(form.linkedinQuota) || 0,
        callsQuota: Number(form.callsQuota) || 0,
        hoursPerWeek: Number(form.hoursPerWeek) || 0,
        offerValidityDays: Number(form.offerValidityDays) || 0,
        targetFirms: Number(form.targetFirms) || 0,
        teamCapacity: Number(form.teamCapacity) || 0,
        revenueTarget: Number(form.revenueTarget) || 0,
        segments: (form.segmentsText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notifications: {
          email: Boolean(form.notifEmail),
          weeklyDigest: Boolean(form.notifWeeklyDigest),
          overdue: Boolean(form.notifOverdue),
        },
        bafaParams: {
          programs,
          // Legacy-Einzelwerte für rückwärtskompatible Verbraucher (1. aktives Programm)
          rate: firstActive ? firstActive.rate : null,
          cap: firstActive ? firstActive.cap : null,
        },
        linkedin: {
          dailyLimit: Number(form.linkedinDailyLimit) || 0,
          inviteMessage: form.linkedinInviteMessage || '',
        },
      }
      const saved = await api.put('/sprint-settings', payload)

      // Segmente zusätzlich in die Marktkonfiguration spiegeln
      if (payload.segments.length) {
        api.put('/sprint-market/segments', { segments: payload.segments }).catch(() => {})
      }
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem('sprint_settings', JSON.stringify(saved))
      } catch {
        // ignorieren
      }
      setForm(applySettingsToForm(saved))
      refreshSprintSettings().catch(() => {})
      toast.success('Einstellungen gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (typeof window !== 'undefined' && !window.confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) return
    setResetting(true)
    try {
      const res = await api.post('/sprint-settings/reset', {})
      setForm(applySettingsToForm(res))
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem('sprint_settings', JSON.stringify(res))
      } catch {
        // ignorieren
      }
      refreshSprintSettings().catch(() => {})
      toast.success('Einstellungen zurückgesetzt')
    } catch (err) {
      toast.error(err.message || 'Zurücksetzen fehlgeschlagen')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 max-w-5xl mx-auto space-y-4'}>

      {!embedded && (
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Akquise-Einstellungen</h1>
          <p className="text-sm text-gray-500 mt-1">Akquise-Info, Quoten, Benachrichtigungen und Förderparameter</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">

          {/* Tabs */}
          {!embedded && (
            <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLocalTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 items-start ${activeTab === 'quoten' ? '' : 'hidden'}`}>
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <SettingsIcon className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Quoten &amp; Parameter</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={CLS_LABEL}>LinkedIn-Anfragen pro Woche</label>
                  <input type="number" min="1" value={form.linkedinQuota} onChange={(e) => setNum('linkedinQuota', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Grundlage für die Wochenquote im Outreach</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Anrufe pro Woche</label>
                  <input type="number" min="1" value={form.callsQuota} onChange={(e) => setNum('callsQuota', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Richtwert für die Telefonakquise</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Stunden pro Woche</label>
                  <input type="number" step="0.1" min="0.5" value={form.hoursPerWeek} onChange={(e) => setNum('hoursPerWeek', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Basis der Kapazitätsplanung</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Angebotsgültigkeit (Tage)</label>
                  <input type="number" min="1" value={form.offerValidityDays} onChange={(e) => setNum('offerValidityDays', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Danach gilt ein Angebot als abgelaufen</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Netto-Zielbestand</label>
                  <input type="number" min="1" value={form.targetFirms} onChange={(e) => setNum('targetFirms', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Unternehmen ab 50 MA nach Abzug der Sperrliste</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Kapazität pro Teammitglied (Kunden)</label>
                  <input type="number" min="1" value={form.teamCapacity} onChange={(e) => setNum('teamCapacity', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Basis der Auslastung auf der Team-Seite</p>
                </div>
                <div>
                  <label className={CLS_LABEL}>Umsatzziel (€)</label>
                  <input type="number" min="0" step="1000" value={form.revenueTarget} onChange={(e) => setNum('revenueTarget', e.target.value)} className={CLS_INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Basis der Fortschrittsanzeige im Reporting</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Team &amp; Zugriff</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Benutzer, Rollen und Berechtigungen werden zentral in der Administration verwaltet.
              </p>
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Zur Administration
              </button>
              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                Einstellungen werden serverseitig gespeichert und gelten für alle Nutzer.
              </div>
            </div>
          </div>

          {/* Akquise-Info */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${activeTab === 'info' ? '' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Akquise-Info</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={CLS_LABEL}>Name der Akquise</label>
                <input value={form.sprintName || ''} onChange={(e) => set('sprintName', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Start</label>
                <input type="date" value={form.sprintStart} onChange={(e) => set('sprintStart', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Ende</label>
                <input type="date" value={form.sprintEnd} onChange={(e) => set('sprintEnd', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
          </div>

          {/* Branchen */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${activeTab === 'branchen' ? '' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Branchen</h2>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{segmentList.length}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">Diese Branchen stehen bei Zielkunden, Filtern und Auswertungen zur Auswahl.</p>

            {/* Ausgewählte Branchen */}
            {segmentList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400 mb-4">
                Noch keine Branchen hinterlegt.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {segmentList.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-gray-100 text-sm text-gray-800">
                    {name}
                    <button
                      type="button"
                      onClick={() => removeSegment(name)}
                      className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Entfernen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Eigene Branche hinzufügen */}
            <div className="flex gap-2">
              <input
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSegment(newSegment)
                    setNewSegment('')
                  }
                }}
                className={CLS_INPUT}
                placeholder="Weitere Branche hinzufügen…"
              />
              <button
                type="button"
                onClick={() => { addSegment(newSegment); setNewSegment('') }}
                className="shrink-0 flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Hinzufügen
              </button>
            </div>

            {/* Vorschläge aus der Standardliste */}
            {segmentSuggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Vorschläge aus der Standardliste</p>
                <div className="flex flex-wrap gap-2">
                  {segmentSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addSegment(name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Benachrichtigungen */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${activeTab === 'benachrichtigungen' ? '' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">Benachrichtigungen</h2>
            </div>
            <div className="space-y-2.5">
              {[
                { key: 'notifEmail', label: 'E-Mail-Benachrichtigungen bei neuen Aktivitäten' },
                { key: 'notifWeeklyDigest', label: 'Wöchentliche Zusammenfassung (Reporting)' },
                { key: 'notifOverdue', label: 'Erinnerungen für überfällige Follow-ups' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form[item.key])}
                    onChange={(e) => set(item.key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Förderprogramme */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${activeTab === 'foerderung' ? '' : 'hidden'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Förderprogramme</h2>
              </div>
              <button
                type="button"
                onClick={addFundingProgram}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" /> Programm
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Der Admin stellt Förderprogramme bereit; sie stehen bei jedem Zielkunden zur Auswahl.
            </p>
            {fundingPrograms.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Förderprogramme hinterlegt.</p>
            ) : (
              <div className="space-y-3">
                {fundingPrograms.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded-lg p-3">
                    <div className="col-span-4">
                      <label className={CLS_LABEL}>Name</label>
                      <input value={p.name} onChange={(e) => updateFundingProgram(idx, { name: e.target.value })} placeholder="z. B. BAFA" className={CLS_INPUT} />
                    </div>
                    <div className="col-span-2">
                      <label className={CLS_LABEL}>Quote (%)</label>
                      <input type="number" min="0" max="100" value={p.rate} onChange={(e) => updateFundingProgram(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} className={CLS_INPUT} />
                    </div>
                    <div className="col-span-2">
                      <label className={CLS_LABEL}>Obergrenze (€)</label>
                      <input type="number" min="0" value={p.cap} onChange={(e) => updateFundingProgram(idx, { cap: e.target.value })} placeholder="optional" className={CLS_INPUT} />
                    </div>
                    <div className="col-span-3">
                      <label className={CLS_LABEL}>Notiz</label>
                      <input value={p.note} onChange={(e) => updateFundingProgram(idx, { note: e.target.value })} placeholder="optional" className={CLS_INPUT} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1 pb-1.5">
                      <input
                        type="checkbox"
                        checked={p.active !== false}
                        onChange={(e) => updateFundingProgram(idx, { active: e.target.checked })}
                        title="Aktiv (zur Auswahl verfügbar)"
                      />
                      <button onClick={() => removeFundingProgram(idx)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Entfernen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LinkedIn */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${activeTab === 'outreach' ? '' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Linkedin className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900">LinkedIn</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={CLS_LABEL}>Tageslimit Anfragen</label>
                <input type="number" min="0" value={form.linkedinDailyLimit} onChange={(e) => setNum('linkedinDailyLimit', e.target.value)} className={CLS_INPUT} />
              </div>
              <div className="md:col-span-2">
                <label className={CLS_LABEL}>Standard-Nachricht</label>
                <input value={form.linkedinInviteMessage} onChange={(e) => set('linkedinInviteMessage', e.target.value)} className={CLS_INPUT} placeholder="Vorlage für Vernetzungsanfragen" />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className={`bg-white rounded-xl border border-red-200 p-5 ${activeTab === 'system' ? '' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-semibold text-red-700">Zurücksetzen</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Setzt alle Einstellungen auf die Standardwerte zurück. Zielkunden, Angebote und Aktivitäten bleiben unverändert.
            </p>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> {resetting ? 'Zurücksetzen...' : 'Auf Standardwerte zurücksetzen'}
            </button>
          </div>

          <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 py-3 flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Alle Einstellungen speichern'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

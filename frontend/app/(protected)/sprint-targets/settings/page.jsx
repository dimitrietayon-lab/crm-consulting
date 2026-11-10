'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Save, Users, Package, Settings as SettingsIcon, Building2, Megaphone,
  Bell, Landmark, Linkedin, AlertTriangle, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { SPRINT_DEFAULTS, refreshSprintSettings } from '@/lib/sprintSettings'
import { TEAM_ROLES, SPRINT_PACKAGES, SPRINT_PACKAGE_LABELS } from '@/lib/sprintTeam'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const PACKAGE_DEFAULT_LABELS = { compact: 'Compact', standard: 'Standard', premium: 'Premium' }

function normalizePackages(raw) {
  const arr = Array.isArray(raw) ? raw : []
  return SPRINT_PACKAGES.map((key) => {
    const found = arr.find((p) => p && (p.key === key || p.id === key))
    return {
      key,
      label: found?.label || PACKAGE_DEFAULT_LABELS[key],
      price: found?.price != null ? String(found.price) : '',
    }
  })
}

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
    bafaRate: 50,
    bafaCap: '',
    linkedinDailyLimit: 25,
    linkedinInviteMessage: '',
  }
}

function applySettingsToForm(settings) {
  const notif = normalizeNotifications(settings.notifications).notifications
  const bafa = settings.bafaParams && typeof settings.bafaParams === 'object' ? settings.bafaParams : {}
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
    bafaRate: bafa.rate != null ? Math.round(Number(bafa.rate) * 100) : 50,
    bafaCap: bafa.cap != null ? String(bafa.cap) : '',
    linkedinDailyLimit: linkedin.dailyLimit != null ? linkedin.dailyLimit : 25,
    linkedinInviteMessage: linkedin.inviteMessage || '',
  }
}

export default function SprintSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState(defaultForm)
  const [packageRows, setPackageRows] = useState(() => normalizePackages(null))
  const [pkgRoles, setPkgRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [savingPkg, setSavingPkg] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = await refreshSprintSettings()
      const nextForm = applySettingsToForm(settings)
      setForm(nextForm)
      setPackageRows(normalizePackages(settings.packages))

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

  useEffect(() => {
    let active = true
    api.get('/sprint-targets/package-roles')
      .then((rows) => { if (active) setPkgRoles(Array.isArray(rows) ? rows : []) })
      .catch(() => toast.error('Fehler beim Laden der Paket-Rollen'))
    return () => { active = false }
  }, [])

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  function setNum(field, value) {
    setForm((p) => ({ ...p, [field]: value === '' ? '' : Number(value) }))
  }

  // ─── Paket-Rollen ──────────────────────────────────────────────────────────

  function rolesForPackage(pkg) {
    return pkgRoles.filter((r) => r.package === pkg)
  }

  function isRequired(pkg, role) {
    return rolesForPackage(pkg).some((r) => r.role === role)
  }

  function headcountFor(pkg, role) {
    return rolesForPackage(pkg).find((r) => r.role === role)?.headcount || 1
  }

  function setRequired(pkg, role, on) {
    setPkgRoles((prev) => {
      const rest = prev.filter((r) => !(r.package === pkg && r.role === role))
      return on ? [...rest, { package: pkg, role, headcount: 1 }] : rest
    })
  }

  function setHeadcount(pkg, role, value) {
    const n = Math.max(1, Number(value) || 1)
    setPkgRoles((prev) =>
      prev.map((r) => (r.package === pkg && r.role === role ? { ...r, headcount: n } : r))
    )
  }

  async function savePackageRoles() {
    setSavingPkg(true)
    try {
      for (const pkg of SPRINT_PACKAGES) {
        const roles = rolesForPackage(pkg).map((r) => ({ role: r.role, headcount: r.headcount }))
        await api.put(`/sprint-targets/package-roles/${pkg}`, { roles })
      }
      toast.success('Paket-Rollen gespeichert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSavingPkg(false)
    }
  }

  // ─── Einstellungen speichern ───────────────────────────────────────────────

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
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
        packages: packageRows
          .filter((p) => p.label || p.price)
          .map((p) => ({ key: p.key, label: p.label || p.key, price: p.price === '' ? null : Number(p.price) })),
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
          rate: (Number(form.bafaRate) || 0) / 100,
          cap: form.bafaCap === '' ? null : Number(form.bafaCap),
        },
        linkedin: {
          dailyLimit: Number(form.linkedinDailyLimit) || 0,
          inviteMessage: form.linkedinInviteMessage || '',
        },
      }
      const saved = await api.put('/sprint-settings', payload)

      // Segmente & Pakete zusätzlich in die Marktkonfiguration spiegeln
      if (payload.segments.length) {
        api.put('/sprint-market/segments', { segments: payload.segments }).catch(() => {})
      }
      if (payload.packages.length) {
        api.put('/sprint-market/packages', { packages: payload.packages }).catch(() => {})
      }
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem('sprint_settings', JSON.stringify(saved))
      } catch {
        // ignorieren
      }
      setForm(applySettingsToForm(saved))
      setPackageRows(normalizePackages(saved.packages))
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
      setPackageRows(normalizePackages(res.packages))
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

  function updatePackageRow(key, patch) {
    setPackageRows((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sprint-targets')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sprint-Einstellungen</h1>
            <p className="text-sm text-gray-500">Sprint-Info, Quoten, Pakete, Benachrichtigungen und Förderparameter</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <SettingsIcon className="w-4 h-4 text-violet-600" />
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

          {/* Sprint-Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">Sprint-Info</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={CLS_LABEL}>Name des Sprints</label>
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

          {/* Pakete & Preise */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">Pakete &amp; Preise</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Paketnamen und Standardpreise. Der Preis wird beim Anlegen eines Angebots als Position vorgeschlagen.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packageRows.map((pkg) => (
                <div key={pkg.key} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{pkg.key}</p>
                  <label className={CLS_LABEL}>Bezeichnung</label>
                  <input value={pkg.label} onChange={(e) => updatePackageRow(pkg.key, { label: e.target.value })} className={`${CLS_INPUT} mb-2`} />
                  <label className={CLS_LABEL}>Preis (€)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={pkg.price}
                    onChange={(e) => updatePackageRow(pkg.key, { price: e.target.value })}
                    className={CLS_INPUT}
                    placeholder="z.B. 9990"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Branchen */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">Branchen</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Kommagetrennte Liste der Branchen für Filter und Auswertungen.</p>
            <input
              value={form.segmentsText}
              onChange={(e) => set('segmentsText', e.target.value)}
              className={CLS_INPUT}
              placeholder="z.B. Banken, Maschinenbau & Elektro, Gesundheit & Soziales"
            />
          </div>

          {/* Benachrichtigungen */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-violet-600" />
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
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* BAFA */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">BAFA-Parameter</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Standardwerte für den Fördersummen-Rechner.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Förderquote (%)</label>
                <input type="number" min="0" max="100" step="1" value={form.bafaRate} onChange={(e) => setNum('bafaRate', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Obergrenze (€)</label>
                <input type="number" min="0" step="1" value={form.bafaCap} onChange={(e) => set('bafaCap', e.target.value)} className={CLS_INPUT} placeholder="optional" />
              </div>
            </div>
          </div>

          {/* LinkedIn */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Linkedin className="w-4 h-4 text-violet-600" />
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

          {/* Pakete & Rollen */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">Pakete &amp; Rollen</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Lege je Paket fest, welche Rollen benötigt werden und welchen Umfang (Anzahl Mitarbeiter) sie haben.
              Diese Vorgaben gelten als Standard für Kunden mit diesem Paket.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SPRINT_PACKAGES.map((pkg) => (
                <div key={pkg} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">{SPRINT_PACKAGE_LABELS[pkg]}</p>
                  <div className="space-y-2.5">
                    {TEAM_ROLES.map((role) => {
                      const on = isRequired(pkg, role.key)
                      return (
                        <div key={role.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${pkg}-${role.key}`}
                            checked={on}
                            onChange={(e) => setRequired(pkg, role.key, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <label htmlFor={`${pkg}-${role.key}`} className="flex-1 text-sm text-gray-700 cursor-pointer">
                            {role.label}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={on ? headcountFor(pkg, role.key) : 1}
                            disabled={!on}
                            onChange={(e) => setHeadcount(pkg, role.key, e.target.value)}
                            className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Anzahl Mitarbeiter (Umfang)"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={savePackageRoles}
                disabled={savingPkg}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {savingPkg ? 'Speichern...' : 'Paket-Rollen speichern'}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Alle Einstellungen speichern'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl border border-red-200 p-5">
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
        </form>
      )}
    </div>
  )
}

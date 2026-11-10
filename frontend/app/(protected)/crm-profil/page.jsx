'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import {
  Building2, TrendingUp, Briefcase, Brain, Settings, Home,
  Eye, EyeOff, Undo2, Save, ShieldCheck, Activity,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  CRM_HIDDEN_MODULES,
  CRM_HIDDEN_KEYS,
  getHiddenModules,
  setHiddenModules,
  resetCrmProfile,
} from '@/lib/crmProfile'

const COLOR = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'border-blue-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  ring: 'border-green-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'border-purple-200' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-600',   ring: 'border-pink-200' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  ring: 'border-amber-200' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   ring: 'border-teal-200' },
}

// 19 Einträge, die im CRM-Profil sichtbar bleiben
const VISIBLE_GROUPS = [
  { label: 'Kunden & Kontakte', color: 'blue',   icon: Building2, items: ['Accounts', 'Kontakte', 'Aktivitäten'] },
  { label: 'Vertrieb',          color: 'green',  icon: TrendingUp, items: ['Pipeline', 'Angebote', 'Verträge'] },
  { label: 'Mandate & Wissen',  color: 'purple', icon: Briefcase, items: ['Projekte', 'Aufgaben', 'Dokumente'] },
  { label: 'Analyse & KI',      color: 'pink',   icon: Brain, items: ['Key Accounts', 'Cross-Selling', 'Compliance', 'KI-Opportunities', 'News Monitoring'] },
  { label: 'System',            color: 'amber',  icon: Settings, items: ['Einstellungen', 'Administration', 'CRM-Profil'] },
  { label: 'Portal',            color: 'teal',   icon: Home, items: ['Dashboard'] },
]

const VISIBLE_COUNT = VISIBLE_GROUPS.reduce((n, g) => n + g.items.length, 0)

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors shrink-0 ${
        on ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function CrmProfilPage() {
  const router = useRouter()
  const [hidden, setHidden] = useState(CRM_HIDDEN_KEYS)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  // Nur unter Administration: erst nach dem Mount prüfen und Profil lesen.
  useEffect(() => {
    const user = getUser()
    if (user?.role !== 'admin') {
      router.replace('/')
      return
    }
    setHidden(getHiddenModules())
    setReady(true)
    setAllowed(true)
  }, [router])

  const dirty = ready && hidden.join('|') !== getHiddenModules().join('|')

  function toggle(key) {
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function save() {
    setHiddenModules(hidden)
    toast.success('CRM-Profil gespeichert')
  }

  function reset() {
    resetCrmProfile()
    setHidden(CRM_HIDDEN_MODULES.map((m) => m.key))
    toast.success('CRM-Profil zurückgesetzt')
  }

  if (!allowed) return null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM-Profil</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Nur was zur Kundenbeziehung passt – Navigation und Dashboard auf den CRM-Kern zuschneiden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="btn-secondary">
            <Undo2 className="w-4 h-4 mr-1.5" /> Zurücksetzen
          </button>
          <button onClick={save} disabled={!dirty} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4 mr-1.5" /> Profil speichern
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="rounded-xl bg-slate-900 text-white p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold">
            Profil aktiv · Ponturo Beratung
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200">CRM</span>
          </p>
          <p className="text-sm text-slate-300 mt-1">
            Ausgeblendete Module verschwinden nur aus der Navigation und den Dashboard-Widgets.
            Daten, Endpunkte und Berechtigungen bleiben unverändert – nichts wird gelöscht.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-500">Navigationseinträge</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{VISIBLE_COUNT}</p>
          <p className="text-xs text-gray-400 mt-1">im CRM-Profil sichtbar</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-500">Ausgeblendete Module</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{hidden.length}</p>
          <p className="text-xs text-gray-400 mt-1">von {CRM_HIDDEN_MODULES.length} Profil-Modulen</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-500">Entfernte Seiten</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">2</p>
          <p className="text-xs text-gray-400 mt-1">Network · Satisfaction</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-500">Rollen</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">4</p>
          <p className="text-xs text-gray-400 mt-1">Rechte bleiben unangetastet</p>
        </div>
      </div>

      {/* Sichtbar */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-green-600" />
          <h2 className="text-base font-semibold text-gray-900">Im CRM-Profil sichtbar</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {VISIBLE_GROUPS.map((g) => {
            const Icon = g.icon
            const c = COLOR[g.color]
            return (
              <div key={g.label} className={`card p-5 border ${c.ring}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{g.label}</p>
                    <p className="text-xs text-gray-400">{g.items.length} Einträge</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {g.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-600">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ausgeblendet */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <EyeOff className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Ausgeblendet im CRM-Profil</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            {hidden.length} Module
          </span>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Modul</th>
                <th className="px-4 py-2.5">Gruppe</th>
                <th className="px-4 py-2.5">Begründung</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Sichtbar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CRM_HIDDEN_MODULES.map((m) => {
                const isHidden = hidden.includes(m.key)
                return (
                  <tr key={m.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-400">{m.route}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.group}</td>
                    <td className="px-4 py-3 text-gray-500">{m.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isHidden ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {isHidden ? 'Ausgeblendet' : 'Sichtbar'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Switch
                          on={!isHidden}
                          onChange={() => toggle(m.key)}
                          label={`${m.label} anzeigen`}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wirkung außerhalb der Navigation */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Was das Profil außerhalb der Navigation ändert</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <p className="font-semibold text-gray-900 text-sm">Dashboard</p>
            </div>
            <p className="text-sm text-gray-600">
              Ohne Zeiterfassung verschwinden Stundenzettel, Produktivitätsdiagramm und die Stunden-KPIs.
              Ohne Abwesenheiten entfällt der Urlaubshinweis im Kopf des Berater-Dashboards.
            </p>
          </div>
        </div>
      </div>

      {/* Aktionsleiste */}
      <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white/90 backdrop-blur border-t border-gray-200 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert'}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="btn-secondary">
            <Undo2 className="w-4 h-4 mr-1.5" /> Profil zurücksetzen
          </button>
          <button onClick={save} disabled={!dirty} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4 mr-1.5" /> Profil speichern
          </button>
        </div>
      </div>
    </div>
  )
}

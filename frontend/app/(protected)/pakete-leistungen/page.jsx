'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package, BookOpen, Plus, Trash2, Save, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { TEAM_ROLES } from '@/lib/sprintTeam'
import { refreshSprintSettings } from '@/lib/sprintSettings'
import { ServiceCatalogTab } from '../settings/page'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const TABS = [
  { id: 'leistungen', label: 'Leistungen', icon: BookOpen },
  { id: 'pakete', label: 'Pakete & Rollen', icon: Package },
]

const UNIT_LABELS = { day: 'Tag(e)', hour: 'Stunde(n)', fixed: 'Pauschal' }

function slugify(value) {
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
  return String(value || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

let localSeq = 0
function nextId(prefix) {
  localSeq += 1
  return `${prefix}-${Date.now()}-${localSeq}`
}

export default function PackagesServicesPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState('leistungen')
  const [packages, setPackages] = useState([])
  const [services, setServices] = useState([])
  const [pkgRoles, setPkgRoles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Nur für Administratoren
  useEffect(() => {
    if (getUser()?.role === 'admin') setAuthorized(true)
    else router.replace('/')
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [market, roleRows, serviceRows] = await Promise.all([
        api.get('/sprint-market'),
        api.get('/sprint-targets/package-roles'),
        api.get('/proposals/services').catch(() => []),
      ])

      const pkgList = (Array.isArray(market?.packages) ? market.packages : []).map((p) => ({
        _id: p.key,
        key: p.key,
        label: p.label || p.key,
        price: p.price != null ? String(p.price) : '',
        services: (Array.isArray(p.services) ? p.services : []).map((s) => ({
          _id: nextId('svc'),
          serviceId: s.serviceId || s.service?.id || '',
          quantity: s.quantity || 1,
        })),
      }))
      setPackages(pkgList)
      setSelectedId((cur) => (pkgList.some((p) => p._id === cur) ? cur : pkgList[0]?._id || ''))

      setServices(Array.isArray(serviceRows) ? serviceRows : serviceRows?.services || [])

      setPkgRoles(
        (Array.isArray(roleRows) ? roleRows : []).map((r) => ({
          ...r,
          packageId: r.package,
          label: r.label || TEAM_ROLES.find((t) => t.key === r.role)?.label || '',
          _id: r.role,
        }))
      )
    } catch {
      toast.error('Pakete & Rollen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) load()
  }, [authorized, load])

  // ─── Pakete ───
  function rolesForPackage(packageId) {
    return pkgRoles.filter((r) => r.packageId === packageId)
  }

  function addPackage() {
    const p = { _id: nextId('pkg'), key: '', label: '', price: '', services: [] }
    setPackages((prev) => [...prev, p])
    setSelectedId(p._id)
  }

  function updatePackage(pkgId, patch) {
    setPackages((prev) => prev.map((p) => (p._id === pkgId ? { ...p, ...patch } : p)))
  }

  function removePackage(pkgId) {
    const next = packages.filter((p) => p._id !== pkgId)
    setPackages(next)
    setPkgRoles((prev) => prev.filter((r) => r.packageId !== pkgId))
    if (selectedId === pkgId) setSelectedId(next[0]?._id || '')
  }

  // ─── Leistungen eines Pakets ───
  function addServiceRow(pkgId) {
    setPackages((prev) =>
      prev.map((p) =>
        p._id === pkgId
          ? { ...p, services: [...p.services, { _id: nextId('svc'), serviceId: '', quantity: 1 }] }
          : p
      )
    )
  }

  function updateServiceRow(pkgId, rowId, patch) {
    setPackages((prev) =>
      prev.map((p) =>
        p._id === pkgId
          ? { ...p, services: p.services.map((s) => (s._id === rowId ? { ...s, ...patch } : s)) }
          : p
      )
    )
  }

  function removeServiceRow(pkgId, rowId) {
    setPackages((prev) =>
      prev.map((p) =>
        p._id === pkgId ? { ...p, services: p.services.filter((s) => s._id !== rowId) } : p
      )
    )
  }

  // ─── Rollen eines Pakets ───
  function updateRole(pkgId, id, patch) {
    setPkgRoles((prev) =>
      prev.map((r) => (r.packageId === pkgId && r._id === id ? { ...r, ...patch } : r))
    )
  }

  function removeRole(pkgId, id) {
    setPkgRoles((prev) => prev.filter((r) => !(r.packageId === pkgId && r._id === id)))
  }

  function addRole(pkgId) {
    setPkgRoles((prev) => [
      ...prev,
      { packageId: pkgId, role: '', label: '', headcount: 1, _id: nextId('role') },
    ])
  }

  async function saveAll(e) {
    e?.preventDefault()
    setSaving(true)
    try {
      // Paket-Keys: bestehende übernehmen, neue aus der Bezeichnung ableiten (eindeutig)
      const usedKeys = new Set()
      const prepared = []
      for (const p of packages) {
        const label = (p.label || '').trim()
        if (!label) continue
        let key = (p.key || '').trim() || slugify(label) || 'paket'
        const base = key
        let n = 2
        while (usedKeys.has(key)) key = `${base}-${n++}`
        usedKeys.add(key)
        prepared.push({
          _id: p._id,
          key,
          label,
          price: p.price === '' || p.price == null ? null : Number(p.price),
          services: (p.services || [])
            .filter((s) => s.serviceId)
            .map((s) => ({ serviceId: s.serviceId, quantity: Math.max(1, Number(s.quantity) || 1) })),
        })
      }
      if (!prepared.length) {
        toast.error('Mindestens ein Paket mit Bezeichnung anlegen')
        return
      }
      // Auswahl nach dem Speichern auf dasselbe Paket (jetzt mit finalem Key) halten
      const currentKey = prepared.find((p) => p._id === selected?._id)?.key

      // Pakete inkl. Leistungen (zentrale Quelle)
      await api.put('/sprint-market/packages', {
        packages: prepared.map((p) => ({
          key: p.key, label: p.label, price: p.price, services: p.services,
        })),
      })
      // Preise zusätzlich in den Einstellungen spiegeln (Angebots-Wizard)
      await api.put('/sprint-settings', {
        packages: prepared.map((p) => ({ key: p.key, label: p.label, price: p.price })),
      })

      // Rollen je Paket – beliebig viele, frei definierbar
      for (const p of prepared) {
        const roles = rolesForPackage(p._id)
          .map((r) => ({
            role: r.role || slugify(r.label),
            label: (r.label || '').trim(),
            headcount: Math.max(1, Number(r.headcount) || 1),
          }))
          .filter((r) => r.role)
        await api.put(`/sprint-targets/package-roles/${p.key}`, { roles })
      }

      refreshSprintSettings().catch(() => {})
      toast.success('Pakete, Leistungen & Rollen gespeichert')
      await load()
      if (currentKey) setSelectedId(currentKey)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (!authorized) return null

  const selected = packages.find((p) => p._id === selectedId) || packages[0] || null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Pakete &amp; Leistungen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dienstkatalog verwalten und Pakete aus Leistungen &amp; Rollen konfigurieren
        </p>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'leistungen' && <ServiceCatalogTab />}

      {activeTab === 'pakete' && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
              {/* Paket-Auswahl */}
              <div className="bg-white rounded-xl border border-gray-200 p-2 space-y-1">
                {packages.map((p) => {
                  const count = rolesForPackage(p._id).length
                  const active = selected?._id === p._id
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => setSelectedId(p._id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                        active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 shrink-0" />
                        <span className="truncate">{p.label || 'Unbenanntes Paket'}</span>
                      </span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={addPackage}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm font-medium text-blue-700 border border-dashed border-blue-200 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" /> Neues Paket
                </button>
              </div>

              {/* Formular für das gewählte Paket */}
              {!selected ? (
                <div className="lg:col-span-3 bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
                  <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Noch keine Pakete – lege das erste an.</p>
                </div>
              ) : (
                <form onSubmit={saveAll} className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        Paket „{selected.label || 'Unbenannt'}“
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Bezeichnung, Preis, enthaltene Leistungen (mit Umfang) und Rollen.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {rolesForPackage(selected._id).length} {rolesForPackage(selected._id).length === 1 ? 'Rolle' : 'Rollen'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePackage(selected._id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        title="Paket entfernen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={CLS_LABEL}>Bezeichnung</label>
                      <input
                        value={selected.label}
                        onChange={(e) => updatePackage(selected._id, { label: e.target.value })}
                        className={CLS_INPUT}
                        placeholder="z. B. Premium"
                      />
                    </div>
                    <div>
                      <label className={CLS_LABEL}>Preis (€)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={selected.price}
                        onChange={(e) => updatePackage(selected._id, { price: e.target.value })}
                        className={CLS_INPUT}
                        placeholder="z.B. 9990"
                      />
                    </div>
                  </div>

                  {/* Leistungen */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Leistungen</p>
                        <p className="text-xs text-gray-500">Eine oder mehrere Leistungen aus dem Dienstkatalog – je mit Umfang.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addServiceRow(selected._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
                        disabled={services.length === 0}
                        title={services.length === 0 ? 'Zuerst im Tab „Leistungen“ Dienste anlegen' : 'Leistung hinzufügen'}
                      >
                        <Plus className="w-4 h-4" /> Leistung hinzufügen
                      </button>
                    </div>

                    {services.length === 0 && (
                      <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                        Kein Dienst im Katalog – lege zuerst im Tab „Leistungen“ Dienste an.
                      </p>
                    )}

                    {selected.services.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                        Noch keine Leistungen – füge die erste hinzu.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_110px_40px] gap-2 px-1 text-xs font-medium text-gray-500">
                          <span>Leistung</span>
                          <span className="text-center">Umfang</span>
                          <span />
                        </div>
                        {selected.services.map((s) => (
                          <div key={s._id} className="grid grid-cols-[1fr_110px_40px] gap-2 items-center">
                            <select
                              value={s.serviceId}
                              onChange={(e) => updateServiceRow(selected._id, s._id, { serviceId: e.target.value })}
                              className={CLS_INPUT}
                            >
                              <option value="">-- Leistung wählen --</option>
                              {services.map((svc) => (
                                <option key={svc.id} value={svc.id}>
                                  {svc.name}{svc.unit ? ` · ${UNIT_LABELS[svc.unit] || svc.unit}` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              value={s.quantity}
                              onChange={(e) => updateServiceRow(selected._id, s._id, { quantity: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm text-center text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Umfang (Menge der Leistungseinheiten)"
                            />
                            <button
                              type="button"
                              onClick={() => removeServiceRow(selected._id, s._id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-600 justify-self-end"
                              title="Leistung entfernen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rollen */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Rollen</p>
                        <p className="text-xs text-gray-500">Beliebig viele Rollen – nicht limitiert.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addRole(selected._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4" /> Rolle hinzufügen
                      </button>
                    </div>

                    {rolesForPackage(selected._id).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                        Noch keine Rollen – füge die erste hinzu.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_90px_40px] gap-2 px-1 text-xs font-medium text-gray-500">
                          <span>Rolle</span>
                          <span className="text-center">Anzahl</span>
                          <span />
                        </div>
                        {rolesForPackage(selected._id).map((r) => {
                          const isBase = TEAM_ROLES.some((t) => t.key === r.role)
                          return (
                            <div key={r._id} className="grid grid-cols-[1fr_90px_40px] gap-2 items-center">
                              {isBase ? (
                                <span className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md">{r.label || r.role}</span>
                              ) : (
                                <input
                                  value={r.label || ''}
                                  onChange={(e) => updateRole(selected._id, r._id, { label: e.target.value })}
                                  className={CLS_INPUT}
                                  placeholder="Rolle (z. B. Projektmanager)"
                                />
                              )}
                              <input
                                type="number"
                                min="1"
                                value={r.headcount}
                                onChange={(e) => updateRole(selected._id, r._id, { headcount: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm text-center text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title="Anzahl Mitarbeiter (Umfang)"
                              />
                              <button
                                type="button"
                                onClick={() => removeRole(selected._id, r._id)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 justify-self-end"
                                title="Rolle entfernen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> Gilt für alle Kunden mit diesem Paket.
                    </p>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

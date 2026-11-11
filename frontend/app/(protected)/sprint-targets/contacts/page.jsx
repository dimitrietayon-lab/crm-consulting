'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Search, Pencil, Trash2, X, Star, Mail, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

const EMPTY_CONTACT = {
  sprintTargetId: '',
  name: '',
  role: '',
  email: '',
  phone: '',
  linkedin: '',
  isPrimary: false,
  emailConsentAt: '',
  callConsentAt: '',
  notes: '',
}

function toDateInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function ContactModal({ contact, targets, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_CONTACT,
    ...(contact || {}),
    emailConsentAt: toDateInput(contact?.emailConsentAt),
    callConsentAt: toDateInput(contact?.callConsentAt),
  }))
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!form.sprintTargetId) {
      toast.error('Bitte einen Zielkunden wählen')
      return
    }
    if (!form.name.trim()) {
      toast.error('Name ist erforderlich')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        role: form.role || null,
        email: form.email || null,
        phone: form.phone || null,
        linkedin: form.linkedin || null,
        isPrimary: Boolean(form.isPrimary),
        emailConsentAt: form.emailConsentAt || null,
        callConsentAt: form.callConsentAt || null,
        notes: form.notes || null,
      }
      const saved = form.id
        ? await api.put(`/sprint-contacts/${form.id}`, payload)
        : await api.post('/sprint-contacts', { ...payload, sprintTargetId: form.sprintTargetId })
      toast.success(form.id ? 'Kontakt aktualisiert' : 'Kontakt angelegt')
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id) return
    if (!window.confirm(`Kontakt „${form.name}“ löschen?`)) return
    try {
      await api.delete(`/sprint-contacts/${form.id}`)
      toast.success('Kontakt gelöscht')
      onDeleted(form.id)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler beim Löschen')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className={CLS_LABEL}>Zielkunde</label>
              <select
                value={form.sprintTargetId}
                onChange={(e) => set('sprintTargetId', e.target.value)}
                className={CLS_INPUT}
                disabled={Boolean(form.id)}
              >
                <option value="">— bitte wählen —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.companyName}{t.status ? ` · ${t.status}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={CLS_LABEL}>Name</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className={CLS_INPUT} required />
              </div>
              <div>
                <label className={CLS_LABEL}>Rolle / Position</label>
                <input value={form.role || ''} onChange={(e) => set('role', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>E-Mail</label>
                <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Telefon</label>
                <input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>LinkedIn</label>
              <input value={form.linkedin || ''} onChange={(e) => set('linkedin', e.target.value)} className={CLS_INPUT} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={CLS_LABEL}>E-Mail-Einwilligung</label>
                <input type="date" value={form.emailConsentAt || ''} onChange={(e) => set('emailConsentAt', e.target.value)} className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Telefon-Einwilligung</label>
                <input type="date" value={form.callConsentAt || ''} onChange={(e) => set('callConsentAt', e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Notizen</label>
              <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={2} className={`${CLS_INPUT} resize-none`} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={Boolean(form.isPrimary)} onChange={(e) => set('isPrimary', e.target.checked)} />
              Hauptansprechpartner
            </label>
            <div className="flex justify-between gap-2 pt-2">
              {form.id ? (
                <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Löschen
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                  Abbrechen
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SprintContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [editing, setEditing] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [c, t] = await Promise.all([
        api.get('/sprint-contacts?limit=1000'),
        api.get('/sprint-targets'),
      ])
      setContacts(Array.isArray(c) ? c : [])
      setTargets(Array.isArray(t) ? t : [])
    } catch {
      toast.error('Fehler beim Laden der Kontakte')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts
      .filter((c) => !targetFilter || c.sprintTargetId === targetFilter)
      .filter((c) =>
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.sprintTarget?.companyName?.toLowerCase().includes(q)
      )
  }, [contacts, search, targetFilter])

  const primaryCount = useMemo(() => contacts.filter((c) => c.isPrimary).length, [contacts])
  const consentCount = useMemo(() => contacts.filter((c) => c.emailConsentAt).length, [contacts])

  function onSaved(saved) {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === saved.id)
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]
    })
  }

  function onDeleted(id) {
    setContacts((prev) => prev.filter((c) => c.id !== id))
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
            <h1 className="text-2xl font-bold text-gray-900">Kontakte</h1>
            <p className="text-sm text-gray-500">Ansprechpartner je Zielkunde inkl. Einwilligungen</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_CONTACT })}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Neuer Kontakt
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Kontakte</p>
          <p className="text-lg font-bold text-gray-900">{contacts.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Hauptansprechpartner</p>
          <p className="text-lg font-bold text-blue-700">{primaryCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">E-Mail-Einwilligung</p>
          <p className="text-lg font-bold text-green-700">{consentCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, E-Mail, Unternehmen …"
            className="w-72 border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 max-w-[280px]">
          <option value="">Alle Zielkunden</option>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.companyName}</option>)}
        </select>
        <span className="text-xs text-gray-500">{rows.length} Kontakte</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Noch keine Kontakte. Lege den ersten Ansprechpartner an.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Kontakt', 'Unternehmen', 'Erreichbarkeit', 'Einwilligung', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {c.isPrimary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-500">{c.role}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.sprintTarget ? (
                        <button onClick={() => router.push(`/sprint-targets/${c.sprintTargetId}`)} className="text-gray-800 hover:text-blue-700 hover:underline text-left">
                          {c.sprintTarget.companyName}
                        </button>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-0.5">
                        {c.email && (
                          <p className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Mail className="w-3 h-3 text-gray-400" /> {c.email}
                          </p>
                        )}
                        {c.phone && (
                          <p className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone className="w-3 h-3 text-gray-400" /> {c.phone}
                          </p>
                        )}
                        {!c.email && !c.phone && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      <p>E-Mail: {c.emailConsentAt ? formatDate(c.emailConsentAt) : '—'}</p>
                      <p>Telefon: {c.callConsentAt ? formatDate(c.callConsentAt) : '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setEditing(c)} className="p-1.5 text-gray-400 hover:text-blue-700 rounded" title="Bearbeiten">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ContactModal
          contact={editing.id ? editing : null}
          targets={targets}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}

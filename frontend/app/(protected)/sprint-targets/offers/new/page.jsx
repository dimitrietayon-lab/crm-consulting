'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { getSprintSettings } from '@/lib/sprintSettings'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function defaultValidUntil(days) {
  return isoDate(new Date(Date.now() + (Number(days) || 21) * 86400000))
}

function emptyItem() {
  return { description: '', quantity: 1, unitPrice: '' }
}

function lineTotal(item) {
  const q = Number(item.quantity) || 0
  const p = Number(item.unitPrice) || 0
  return Math.round(q * p * 100) / 100
}

function NewOfferContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [targets, setTargets] = useState([])
  const [sprintTargetId, setSprintTargetId] = useState(searchParams.get('target') || '')
  const [packages, setPackages] = useState([])
  const [pkg, setPkg] = useState('')
  const [validUntil, setValidUntil] = useState(() => defaultValidUntil(21))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [sendNow, setSendNow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const settings = getSprintSettings()
    setValidUntil(defaultValidUntil(settings.offerValidityDays))

    // Pakete dynamisch aus den Einstellungen (vom Admin verwaltet)
    const list = Array.isArray(settings.packages) ? settings.packages : []
    setPackages(list)
    setPkg((cur) => (list.some((p) => p.key === cur) ? cur : list[0]?.key || ''))

    // Auswahl aus der Proposals-Seite übernehmen
    try {
      const raw = window.sessionStorage.getItem('sprint_offer_items')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) {
          setItems(parsed.map((item) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
          })))
        }
        window.sessionStorage.removeItem('sprint_offer_items')
      }
    } catch {
      // ignorieren
    }
  }, [])

  const fetchTargets = useCallback(async () => {
    try {
      const data = await api.get('/sprint-targets')
      setTargets(Array.isArray(data) ? data : data?.data || [])
    } catch {
      toast.error('Zielkunden konnten nicht geladen werden')
    }
  }, [])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  // Paketauswahl: hinterlegten Paketpreis als erste Position übernehmen, wenn leer
  function applyPackage(next) {
    setPkg(next)
    const match = packages.find((p) => p && (p.key === next || p.id === next))
    if (match && match.price) {
      setItems((prev) => {
        const cleaned = prev.filter((i) => i.description || i.unitPrice)
        const base = {
          description: `Paket ${match.label || next}`,
          quantity: 1,
          unitPrice: String(match.price),
        }
        return cleaned.length ? [base, ...cleaned.slice(1)] : [base]
      })
    }
  }

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index) {
    setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== index)))
  }

  const total = useMemo(() => items.reduce((sum, item) => sum + lineTotal(item), 0), [items])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sprintTargetId) { toast.error('Zielkunde wählen'); return }
    const cleaned = items
      .filter((item) => String(item.description || '').trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      }))
    if (!cleaned.length) { toast.error('Mindestens eine Position angeben'); return }

    setSaving(true)
    try {
      const offer = await api.post('/sprint-offers', {
        sprintTargetId,
        package: pkg,
        validUntil,
        notes: notes || null,
        items: cleaned,
      })
      if (sendNow) {
        try {
          await api.post(`/sprint-offers/${offer.id}/send`, {})
          toast.success('Angebot erstellt und versendet')
        } catch (err) {
          toast.error(err.message || 'Angebot erstellt, Versand fehlgeschlagen')
        }
      } else {
        toast.success('Angebot als Entwurf erstellt')
      }
      router.push(`/sprint-targets/offers/${offer.id}`)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Speichern')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/proposals?tab=akquise')} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Neues Angebot</h1>
          <p className="text-sm text-gray-500">Zielkunde, Paket und Positionen erfassen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Zielkunde *</label>
              <select value={sprintTargetId} onChange={(e) => setSprintTargetId(e.target.value)} className={CLS_INPUT} required>
                <option value="">-- wählen --</option>
                {targets.filter((t) => t.status !== 'kein Interesse').map((t) => <option key={t.id} value={t.id}>{t.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className={CLS_LABEL}>Paket</label>
              <select value={pkg} onChange={(e) => applyPackage(e.target.value)} className={CLS_INPUT}>
                {packages.length === 0 && <option value="">-- kein Paket --</option>}
                {packages.map((p) => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Gültig bis</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Hinweise</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={CLS_INPUT} placeholder="Optional" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Positionen</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900">
              <Plus className="w-4 h-4" /> Position
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-6">Beschreibung</div>
              <div className="col-span-2">Menge</div>
              <div className="col-span-2">Einzelpreis</div>
              <div className="col-span-2 text-right">Summe</div>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  className={`${CLS_INPUT} col-span-6`}
                  placeholder="z.B. KI-Readiness Workshop"
                />
                <input
                  type="number" min="1" step="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  className={`${CLS_INPUT} col-span-2`}
                />
                <input
                  type="number" min="0" step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  className={`${CLS_INPUT} col-span-2`}
                  placeholder="0,00"
                />
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-sm text-gray-800">{formatCurrency(lineTotal(item))}</span>
                  <button type="button" onClick={() => removeItem(index)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Entfernen">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 mt-3 border-t border-gray-100">
            <div className="text-right">
              <p className="text-xs text-gray-500">Gesamtsumme</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(total)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="rounded border-gray-300" />
            Direkt versenden
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.push('/proposals?tab=akquise')} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : sendNow ? 'Erstellen & senden' : 'Als Entwurf speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function NewSprintOfferPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <NewOfferContent />
    </Suspense>
  )
}

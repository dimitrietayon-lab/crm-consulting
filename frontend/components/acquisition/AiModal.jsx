'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, Save, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

const KIND_LABEL = {
  research: 'KI-Recherche',
  email: 'KI-E-Mail-Entwurf',
  summary: 'KI-Zusammenfassung',
  nextsteps: 'KI: Nächste Schritte',
  usecases: 'KI: Use Cases',
  insights: 'KI-Insights',
}

// Einheitliches KI-Modal. Lädt je nach `kind` einen Text (oder Insights-Liste)
// aus /api/acquisition-ai und erlaubt Kopieren bzw. Speichern als Notiz.
export default function AiModal({ open, onClose, kind, targetId, contextNote, companyName }) {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!open || !kind) return
    setLoading(true)
    setError('')
    setText('')
    setItems([])
    try {
      if (kind === 'insights') {
        const data = await api.get('/acquisition-ai/insights')
        setItems(Array.isArray(data?.items) ? data.items : [])
      } else {
        const data = await api.post(`/acquisition-ai/${kind}`, {
          targetId,
          ...(contextNote ? { note: contextNote } : {}),
        })
        setText(data?.text || '')
      }
    } catch (err) {
      setError(err?.message || 'KI nicht verfügbar')
    } finally {
      setLoading(false)
    }
  }, [open, kind, targetId, contextNote])

  useEffect(() => { load() }, [load])

  if (!open) return null

  const result = items.length ? items.join('\n') : text

  async function copy() {
    try {
      await navigator.clipboard.writeText(result)
      toast.success('Kopiert')
    } catch {
      toast.error('Kopieren nicht möglich')
    }
  }

  async function saveAsNote() {
    if (!targetId || !result) return
    setSaving(true)
    try {
      await api.post(`/acquisition/${targetId}/activities`, {
        type: 'Note',
        summary: `${KIND_LABEL[kind] || 'KI'}\n\n${result}`,
      })
      toast.success('Als Notiz gespeichert')
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl my-8 bg-white rounded-xl border border-indigo-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">KI-Assistent</p>
            <h2 className="text-sm font-semibold text-gray-900">
              {KIND_LABEL[kind] || 'KI-Assistent'}
              {companyName ? <span className="text-gray-400 font-normal"> · {companyName}</span> : null}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 min-h-[120px]">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> KI erzeugt den Entwurf …
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {error}
            </div>
          ) : items.length ? (
            <ul className="space-y-1.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{text || '—'}</div>
          )}
          <p className="mt-3 text-[11px] text-gray-400">KI-Entwurf – vor Verwendung prüfen. Es werden keine Daten ohne Ihr Zutun versendet.</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={copy}
            disabled={loading || !!error || !result}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Copy className="w-3.5 h-3.5" /> Kopieren
          </button>
          {targetId && (
            <button
              type="button"
              onClick={saveAsNote}
              disabled={saving || loading || !!error || !result}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Als Notiz speichern
            </button>
          )}
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

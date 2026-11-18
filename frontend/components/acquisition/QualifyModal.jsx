'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { usePipelineFor } from '@/lib/usePipeline'
import { flagStatuses, stepBySlug } from '@/lib/pipelineLogic'

const CLS_INPUT = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const CLS_LABEL = 'block text-xs font-medium text-gray-500 mb-1'

/**
 * Qualifizierung & Übergabe an den Engagement Manager.
 * advanceTo erzwingt einen Ziel-Status (z. B. „Übergabe an Engagement Manager").
 */
export default function QualifyModal({ isOpen, target, targetId, onClose, onSaved, advanceTo = null }) {
  const pipeline = usePipelineFor(target)
  const today = () => new Date().toISOString().slice(0, 10)
  const [handoverDate, setHandoverDate] = useState(today())
  const [firstMeetingDate, setFirstMeetingDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setHandoverDate(target?.handoverDate ? target.handoverDate.split('T')[0] : today())
      setFirstMeetingDate(target?.firstMeetingDate ? target.firstMeetingDate.split('T')[0] : '')
      setNote('')
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!handoverDate) { toast.error('Übergabedatum erforderlich'); return }
    setSaving(true)
    try {
      const payload = {
        handoverDate,
        firstMeetingDate: firstMeetingDate || null,
      }
      // Status nur vorwärts setzen: Qualifizierung abgeschlossen → Übergabe an EM
      const advanced = [
        ...flagStatuses(pipeline, 'active'),
        ...flagStatuses(pipeline, 'won'),
        ...flagStatuses(pipeline, 'lost'),
      ].includes(target?.status)
      const handoverStatus = stepBySlug('uebergabe-an-engagement-manager', pipeline)?.status || 'Übergabe an Engagement Manager'
      if (advanceTo) payload.status = advanceTo
      else if (!advanced) payload.status = handoverStatus

      // Aktivität wird direkt darunter protokolliert → Server legt keine zweite an
      const updated = await api.put(`/acquisition/${targetId}`, { ...payload, activityLogged: true })
      const activity = await api.post(`/acquisition/${targetId}/activities`, {
        type: 'Meeting',
        date: new Date().toISOString(),
        summary: 'Qualifizierung abgeschlossen – Übergabe an Engagement Manager',
        nextSteps: note.trim() || null,
      })
      toast.success('Qualifiziert und übergeben')
      onSaved(updated, activity)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Fehler bei der Übergabe')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Qualifizieren &amp; übergeben</h2>
              <p className="text-sm text-gray-500">{target?.companyName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Übergabedatum <span className="text-red-500">*</span></label>
                <input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className={CLS_INPUT} required />
              </div>
              <div>
                <label className={CLS_LABEL}>Erstgespräch</label>
                <input type="date" value={firstMeetingDate} onChange={(e) => setFirstMeetingDate(e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Nächster Schritt</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={CLS_INPUT}
                placeholder="z.B. Erstgespräch am 05.11. vereinbaren"
              />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
              Übergabe wird als Aktivität protokolliert; der Status wechselt auf „Übergabe an Engagement Manager“, sofern er nicht weiter ist.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Speichern...' : 'Übergeben'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

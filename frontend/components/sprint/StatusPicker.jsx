'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { SPRINT_PHASES, STATUS_STYLES, phaseForStatus, statusLabel } from '@/lib/sprintOptions'

const dotClass = (status) => STATUS_STYLES[status]?.badge || 'bg-gray-400'

export default function StatusPicker({ value, onChange, disabled = false, placeholder = 'Status wählen' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const currentPhase = phaseForStatus(value)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (status) => {
    if (status !== value) onChange(status)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass(value)}`} />
          <span className="truncate font-medium">{value ? statusLabel(value) : placeholder}</span>
          {currentPhase && (
            <span className="hidden sm:inline text-xs text-gray-400 truncate">· {currentPhase.label}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full min-w-[17rem] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
        >
          <div className="max-h-80 overflow-y-auto py-1">
            {SPRINT_PHASES.map((phase) => (
              <div key={phase.key}>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {phase.label}
                </p>
                {phase.statuses.map((status) => {
                  const selected = status === value
                  return (
                    <button
                      key={status}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => select(status)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors ${
                        selected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass(status)}`} />
                      <span className="flex-1 truncate">{statusLabel(status)}</span>
                      {selected && <Check className="w-4 h-4 shrink-0 text-blue-600" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

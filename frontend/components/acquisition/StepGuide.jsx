'use client'

import { Check, Circle, ListChecks, Lock } from 'lucide-react'

// Leitfaden + Exit-Kriterien eines Akquise-Schritts.
// Auto-Kriterien erfüllen sich aus Zielkunde/Aktivitäten (nicht klickbar),
// manuelle Kriterien werden über stepChecks am Zielkunden abgehakt.
export default function StepGuide({ step, guideState, onToggle }) {
  if (!step) return null
  const guide = Array.isArray(step.guide) ? step.guide : []
  const state = guideState || { items: [], met: 0, total: 0, complete: true }

  return (
    <div className="space-y-3">
      {guide.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Leitfaden</h3>
          </div>
          <ol className="space-y-1.5">
            {guide.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {state.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">Exit-Kriterien</h3>
            </div>
            <span className={`text-[11px] font-semibold tabular-nums ${state.complete ? 'text-green-700' : 'text-amber-700'}`}>
              {state.met}/{state.total}
            </span>
          </div>

          <ul className="space-y-1.5">
            {state.items.map((item) => (
              <li key={item.k}>
                <button
                  type="button"
                  disabled={item.auto}
                  onClick={() => { if (!item.auto && onToggle) onToggle(step.status, item.k) }}
                  className={`w-full flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    item.auto ? 'cursor-default' : 'hover:bg-gray-50'
                  }`}
                  title={item.auto ? 'Wird automatisch aus den Daten geprüft' : 'Manuell abhaken'}
                >
                  {item.met ? (
                    <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  ) : item.auto ? (
                    <Lock className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-relaxed ${item.met ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                      {item.t}
                    </span>
                    {item.auto && (
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400 mt-0.5">automatisch</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {!state.complete && (
            <p className="mt-2.5 text-[11px] text-amber-700">
              {state.total - state.met} Kriteri{state.total - state.met === 1 ? 'um' : 'en'} noch offen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

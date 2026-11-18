'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, CircleSlash, Lock, Trophy } from 'lucide-react'
import { usePipelineFor } from '@/lib/usePipeline'
import {
  isStatusSelectable, nextUnlockedStatus, processProgress, statusLabel, stepByStatus,
} from '@/lib/pipelineLogic'

// Stufen-Leiste + Schritte-Abbildung direkt auf der Zielkunden-Seite.
// Oben je Stufe ein Reiter (erledigt / aktuell / offen), darunter die Schritte
// der gewählten Stufe (oder der Überblick). Jeder freigeschaltete Schritt
// öffnet seine eigene Schritt-Seite; dort wird gespeichert.
export default function StageStrip({ target }) {
  const router = useRouter()
  const pipeline = usePipelineFor(target)
  const current = target?.status || pipeline.steps[0]?.status || 'offen'
  const currentStep = stepByStatus(current, pipeline)
  const progress = processProgress(current, pipeline)
  const next = nextUnlockedStatus(current, pipeline)
  const nextStep = next ? pipeline.byStatus.get(next) : null
  const isWon = pipeline.wonStatuses.includes(current)
  const isLost = pipeline.lostStatuses.includes(current)

  const [tab, setTab] = useState(null)
  const active = tab || progress.stage?.key || pipeline.stages[0]?.key
  const activeStageIndex = pipeline.stages.findIndex((s) => s.key === active)

  const stepUrl = (step) => `/akquise/${target.id}/prozess/${step.slug}`

  function stageMeta(stageKey) {
    const steps = pipeline.stepsByStage.get(stageKey) || []
    const curOrder = currentStep ? currentStep.order : -1
    return {
      steps,
      done: steps.filter((s) => s.order < curOrder).length,
      isCurrent: steps.some((s) => s.status === current),
      total: steps.length,
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Stufen-Leiste */}
      <div className="flex items-stretch gap-1 px-2 pt-2 overflow-x-auto border-b border-gray-100">
        {pipeline.stages.map((stage, i) => {
          const meta = stageMeta(stage.key)
          const state = meta.isCurrent ? 'now' : meta.total > 0 && meta.done === meta.total ? 'done' : 'todo'
          const isActive = active === stage.key
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setTab(stage.key)}
              aria-current={isActive || undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2 min-w-[150px] text-left transition-colors ${
                isActive ? 'border-blue-600 bg-blue-50/60' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                state === 'done' ? 'bg-green-100 text-green-700'
                  : state === 'now' ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {state === 'done' ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold truncate ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                  {stage.label}
                </span>
                <span className="block text-[10px] text-gray-500 whitespace-nowrap">
                  {state === 'now' ? 'aktuell · ' : ''}{meta.done}/{meta.total} Schritte
                </span>
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setTab('ueberblick')}
          aria-current={active === 'ueberblick' || undefined}
          className={`ml-auto flex items-center px-3 py-2 rounded-t-lg border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            active === 'ueberblick' ? 'border-blue-600 bg-blue-50/60 text-blue-800' : 'border-transparent text-gray-500 hover:bg-gray-50'
          }`}
        >
          Überblick
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {active === 'ueberblick' ? (
          <div className="space-y-4">
            {isLost ? (
              <p className="text-[11px] text-gray-500">Prozess beendet – kein Abschluss</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                </div>
                <span className="text-[11px] font-medium text-gray-500 tabular-nums w-9 text-right">{progress.percent} %</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Aktueller Stand</p>
                <p className="text-sm font-semibold text-gray-900">
                  {isWon && <Trophy className="inline w-4 h-4 mr-1 -mt-0.5 text-green-700" />}
                  {isLost && <CircleSlash className="inline w-4 h-4 mr-1 -mt-0.5 text-red-600" />}
                  {statusLabel(current, pipeline)}
                </p>
                {progress.stage && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stufe {progress.currentStageIndex + 1} von {progress.stageCount} · {progress.stage.label}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push(`/akquise/${target.id}/prozess`)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shrink-0"
              >
                Prozess öffnen <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {nextStep && (
              <div className={`rounded-xl border p-3.5 ${nextStep.isLost ? 'border-red-200 bg-red-50/40' : 'border-blue-200 bg-blue-50/50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${nextStep.isLost ? 'text-red-700' : 'text-blue-700'}`}>
                  Nächster Schritt
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-600">
                    {statusLabel(current, pipeline)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white border border-blue-600">
                    {nextStep.label}
                  </span>
                </div>
                {nextStep.title && <p className="mt-2 text-sm font-semibold text-gray-900">{nextStep.title}</p>}
                {nextStep.description && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{nextStep.description}</p>}
                <button
                  type="button"
                  onClick={() => router.push(stepUrl(nextStep))}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Schritt öffnen <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-900">{pipeline.stages[activeStageIndex]?.label}</p>
              <p className="text-[11px] text-gray-500">Stufe {activeStageIndex + 1} von {pipeline.stages.length}</p>
            </div>

            {(pipeline.stepsByStage.get(active) || []).map((step, i) => {
              const isCurrent = step.status === current
              const done = currentStep ? step.order < currentStep.order : false
              const unlocked = isStatusSelectable(current, step.status, pipeline)
              const clickable = done || isCurrent || unlocked

              return (
                <button
                  key={step.status}
                  type="button"
                  disabled={!clickable}
                  onClick={() => router.push(stepUrl(step))}
                  title={clickable ? `Schritt öffnen: ${step.label}` : 'Noch gesperrt'}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    isCurrent ? 'border-blue-300 bg-blue-50/60'
                      : done ? 'border-green-100 bg-green-50/40 hover:bg-green-50'
                        : clickable ? 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'
                          : 'border-gray-100 bg-gray-50/50 opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      done ? 'bg-green-100 text-green-700'
                        : isCurrent ? 'bg-blue-600 text-white'
                          : clickable ? 'bg-white border border-gray-300 text-gray-500'
                            : 'bg-white border border-gray-200 text-gray-300'
                    }`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : clickable ? i + 1 : <Lock className="w-3 h-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-blue-900' : clickable ? 'text-gray-900' : 'text-gray-400'}`}>
                          {step.label}
                        </p>
                        {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 shrink-0">aktuell</span>}
                        {done && !isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 shrink-0">erledigt</span>}
                      </div>
                      {step.title && step.title !== step.label && (
                        <p className={`text-xs mt-0.5 ${clickable ? 'text-gray-500' : 'text-gray-400'}`}>{step.title}</p>
                      )}
                      {isCurrent && step.description && (
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{step.description}</p>
                      )}
                      {(step.requiredFields || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {step.requiredFields.map((f) => (
                            <span key={f.payload} className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] text-gray-600">
                              {f.label || f.payload}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

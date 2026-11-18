'use client'

import { useRouter } from 'next/navigation'
import { Activity, ArrowRight, Check, CircleSlash, Lock, Trophy } from 'lucide-react'
import { usePipelineFor } from '@/lib/usePipeline'
import {
  isStatusSelectable, nextUnlockedStatus, processProgress, statusLabel, stepByStatus, statusDot,
} from '@/lib/pipelineLogic'

// Übersicht des Akquise-Prozesses. Jeder freigeschaltete (oder bereits
// erreichte) Schritt verlinkt auf seine eigene Schritt-Seite; dort wird
// gespeichert und die Aktivität protokolliert.
export default function PhaseFlow({ target, onHandover, onLogActivity }) {
  const router = useRouter()
  const pipeline = usePipelineFor(target)
  const current = target?.status || pipeline.steps[0]?.status || 'offen'
  const currentStep = stepByStatus(current, pipeline)
  const progress = processProgress(current, pipeline)
  const next = nextUnlockedStatus(current, pipeline)
  const nextStep = next ? pipeline.byStatus.get(next) : null

  const isWon = pipeline.wonStatuses.includes(current)
  const isLost = pipeline.lostStatuses.includes(current)
  const isTerminal = isWon || isLost

  const stepUrl = (step) => `/akquise/${target.id}/prozess/${step.slug}`

  function Chip({ step }) {
    const isCurrent = step.status === current
    const allowed = isStatusSelectable(current, step.status, pipeline)
    const done = currentStep ? step.order < currentStep.order : false
    const clickable = allowed || done || isCurrent

    const cls = isCurrent
      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
      : !clickable
        ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
        : step.isLost
          ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
          : done
            ? 'bg-white text-green-700 border-green-200 hover:bg-green-50'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700'

    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => router.push(stepUrl(step))}
        title={clickable ? `Schritt öffnen: ${step.label}` : 'Noch gesperrt'}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${cls}`}
      >
        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
        {!isCurrent && !clickable && <Lock className="w-2.5 h-2.5" />}
        {done && !isCurrent && <Check className="w-2.5 h-2.5" />}
        {step.label}
      </button>
    )
  }

  /* ── Terminalzustand ──────────────────────────────────────── */
  if (isTerminal) {
    return (
      <div className={`rounded-xl border p-4 sm:p-5 ${isWon ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isWon ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {isWon ? <Trophy className="w-5 h-5" /> : <CircleSlash className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${isWon ? 'text-green-700' : 'text-red-700'}`}>
              Akquise abgeschlossen
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {isWon ? `Kunde gewonnen · ${statusLabel(current, pipeline)}` : `Kein Abschluss · ${statusLabel(current, pipeline)}`}
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              {isWon
                ? 'Account verknüpfen, Vertrag bzw. Projekt anlegen und an die Delivery übergeben.'
                : 'Der Zielkunde ist gesperrt – keine weitere Kontaktaufnahme (DSGVO Art. 21).'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onLogActivity && (
                <button
                  type="button"
                  onClick={() => onLogActivity('Note')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Activity className="w-3.5 h-3.5" /> Aktivität protokollieren
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(`/akquise/${target.id}/prozess`)}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Prozess ansehen
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      {/* Kopf + Fortschritt */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Akquise-Prozess</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Jeder Schritt hat eine eigene Seite – Statuswechsel erfolgen dort.</p>
        </div>
        <span className="text-[11px] font-medium text-gray-500 shrink-0 tabular-nums">
          {progress.stage ? `${progress.stage.label} · ${progress.percent} %` : '—'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-[11px] font-medium text-gray-500 tabular-nums w-9 text-right">{progress.percent} %</span>
      </div>

      {/* Phasen mit Schritten */}
      <div className="space-y-2.5">
        {pipeline.stages.map((stage, pi) => {
          const stageSteps = pipeline.stepsByStage.get(stage.key) || []
          if (!stageSteps.length) return null
          const isCurrentStage = progress.currentStageIndex === pi
          const isDoneStage = progress.currentStageIndex > pi
          return (
            <div
              key={stage.key}
              className={`rounded-lg border px-3 py-2.5 ${
                isCurrentStage ? 'border-blue-200 bg-blue-50/50'
                  : isDoneStage ? 'border-green-100 bg-green-50/40'
                    : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isCurrentStage ? 'bg-blue-600 text-white'
                    : isDoneStage ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDoneStage ? <Check className="w-3 h-3" /> : pi + 1}
                </span>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isCurrentStage ? 'text-blue-700' : isDoneStage ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {stage.label}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-7">
                {stageSteps.map((step) => <Chip key={step.status} step={step} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Nächster Schritt */}
      {nextStep && (
        <div className={`mt-3 rounded-xl border p-4 ${
          nextStep.isLost ? 'border-red-200 bg-red-50/40' : 'border-blue-200 bg-blue-50/50'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${
              nextStep.isLost ? 'text-red-700' : 'text-blue-700'
            }`}>
              Nächster Schritt
            </p>
            <span className="text-[11px] text-gray-500">{nextStep.stage?.label || nextStep.stageKey}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-600">
              {statusLabel(current, pipeline)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              nextStep.isWon ? 'bg-green-100 text-green-700 border-green-200'
                : nextStep.isLost ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-blue-600 text-white border-blue-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                nextStep.isWon || nextStep.isLost ? statusDot(nextStep.status, pipeline) : 'bg-white/80'
              }`} />
              {nextStep.label}
            </span>
          </div>
          {nextStep.title && <p className="mt-2 text-sm font-semibold text-gray-900">{nextStep.title}</p>}
          {nextStep.description && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{nextStep.description}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {nextStep.status === 'Übergabe an Engagement Manager' && onHandover ? (
              <button
                type="button"
                onClick={onHandover}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <ArrowRight className="w-4 h-4" /> Übergabe durchführen
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(stepUrl(nextStep))}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <ArrowRight className="w-4 h-4" /> Schritt öffnen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

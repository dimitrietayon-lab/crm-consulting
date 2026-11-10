'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Sparkles, Plus, RefreshCw, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const DIMENSIONS = [
  { key: 'dataAvailability', label: 'Datenverfügbarkeit' },
  { key: 'techStack',        label: 'Technologie-Stack' },
  { key: 'processMaturity',  label: 'Prozessreife' },
  { key: 'aiCompetency',     label: 'KI-Kompetenz' },
  { key: 'governance',       label: 'Governance & Compliance' },
  { key: 'strategy',         label: 'Strategie & Leadership' },
]

function ScoreBar({ label, value }) {
  const pct = value != null ? (value / 5) * 100 : 0
  const color =
    value == null ? 'bg-gray-200'
    : value >= 4 ? 'bg-green-500'
    : value >= 2.5 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">
          {value != null ? value.toFixed(1) : '—'} / 5
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ScoreRing({ score }) {
  const pct = score != null ? Math.min(Math.max(score / 5, 0), 1) : 0
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = score >= 4 ? '#22c55e' : score >= 2.5 ? '#f59e0b' : '#ef4444'
  const label = score >= 4 ? 'Bereit' : score >= 2.5 ? 'Entwicklung' : 'Früh'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="#e5e7eb" strokeWidth={12} />
        <circle
          cx={65} cy={65} r={r} fill="none"
          stroke={score != null ? color : '#e5e7eb'}
          strokeWidth={12}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
        <text x={65} y={61} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#111827">
          {score != null ? score.toFixed(1) : '—'}
        </text>
        <text x={65} y={78} textAnchor="middle" fontSize={11} fill="#6b7280">
          {label}
        </text>
      </svg>
      <p className="text-xs text-gray-500">KI-Readiness Score</p>
    </div>
  )
}

export default function AssessmentPage() {
  const { id } = useParams()
  const router = useRouter()
  const [target, setTarget] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [t, asses] = await Promise.all([
        api.get(`/sprint-targets/${id}`),
        api.get(`/sprint-assessments/target/${id}`),
      ])
      setTarget(t)
      const list = Array.isArray(asses) ? asses : []
      setAssessments(list)
      setCurrent(list[0] || null)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function createEmptyAssessment() {
    setCreating(true)
    try {
      const newAssessment = await api.post(`/sprint-assessments/target/${id}`, {})
      const list = [newAssessment, ...assessments]
      setAssessments(list)
      setCurrent(newAssessment)
      toast.success('Assessment erstellt')
    } catch (err) {
      toast.error(err.message || 'Fehler')
    } finally {
      setCreating(false)
    }
  }

  async function generateAssessment() {
    if (!current) {
      // Create first, then generate
      setCreating(true)
      try {
        const newAssessment = await api.post(`/sprint-assessments/target/${id}`, {})
        const list = [newAssessment, ...assessments]
        setAssessments(list)
        setCurrent(newAssessment)
        await doGenerate(newAssessment.id)
      } catch (err) {
        toast.error(err.message || 'Fehler')
      } finally {
        setCreating(false)
      }
      return
    }
    await doGenerate(current.id)
  }

  async function doGenerate(assessmentId) {
    setGenerating(true)
    try {
      const updated = await api.post(`/sprint-assessments/${assessmentId}/generate`, {})
      setAssessments((prev) => prev.map((a) => (a.id === assessmentId ? { ...a, ...updated } : a)))
      setCurrent((prev) => (prev?.id === assessmentId ? { ...prev, ...updated } : prev))
      toast.success('KI-Assessment generiert')
    } catch (err) {
      toast.error(err.message || 'Fehler beim Generieren')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/sprint-targets/${id}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">KI-Readiness Assessment</h1>
            {target && <p className="text-sm text-gray-500">{target.companyName}</p>}
          </div>
          {current && (
            <span className="ml-2 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
              Version {current.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {current && (
            <button
              onClick={async () => {
                try {
                  await api.download(`/sprint-assessments/${current.id}/pdf`, `Assessment-v${current.version}.pdf`)
                } catch (err) {
                  toast.error(err.message || 'PDF-Export fehlgeschlagen')
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}
          <button
            onClick={generateAssessment}
            disabled={generating || creating}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Analysiere...' : 'KI neu analysieren'}
          </button>
        </div>
      </div>

      {/* Versions-Chips */}
      {assessments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Versionen</span>
          {assessments.map((a) => (
            <button
              key={a.id}
              onClick={() => setCurrent(a)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                current?.id === a.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              v{a.version}
              <span className={`ml-1.5 text-xs ${current?.id === a.id ? 'text-white/70' : 'text-gray-400'}`}>
                {a.totalScore != null ? a.totalScore.toFixed(1) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Hero-Kopf */}
      {current && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Gesamtscore', value: current.totalScore != null ? `${current.totalScore.toFixed(1)} / 5` : '—' },
            { label: 'Generiert', value: current.generatedByAi ? 'KI-gestützt' : 'Manuell', hint: formatDate(current.updatedAt) },
            { label: 'Use Cases', value: (current.useCases || []).length },
            { label: 'Version', value: `v${current.version}`, hint: `${assessments.length} gesamt` },
          ].map(({ label, value, hint }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-base font-bold text-gray-900 truncate">{value}</p>
              {hint && <p className="text-[11px] text-gray-400 truncate">{hint}</p>}
            </div>
          ))}
        </div>
      )}

      {!current ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Sparkles className="w-10 h-10 text-violet-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Noch kein Assessment</h3>
          <p className="text-sm text-gray-500 mb-6">Erstelle ein KI-Assessment, um die Readiness dieses Unternehmens zu bewerten.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={createEmptyAssessment}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" /> Manuell erstellen
            </button>
            <button
              onClick={generateAssessment}
              disabled={generating || creating}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Analysiere...' : 'KI-Assessment generieren'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: dimensions + text */}
          <div className="lg:col-span-2 space-y-4">
            {/* Bar chart of dimensions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">6-Dimensionen-Analyse</h2>
              <div className="space-y-4">
                {DIMENSIONS.map(({ key, label }) => (
                  <ScoreBar key={key} label={label} value={current[key]} />
                ))}
              </div>
              {current.generatedByAi && (
                <p className="mt-3 text-xs text-violet-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> KI-generiert am {formatDate(current.updatedAt)}
                </p>
              )}
            </div>

            {/* Findings */}
            {current.findings && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Erkenntnisse</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{current.findings}</p>
              </div>
            )}

            {/* Recommendations */}
            {current.recommendations && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Empfehlungen</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{current.recommendations}</p>
              </div>
            )}
          </div>

          {/* Right: ring + use cases + history */}
          <div className="space-y-4">
            {/* Score ring */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex justify-center">
              <ScoreRing score={current.totalScore} />
            </div>

            {/* Use case candidates */}
            {current.useCases && current.useCases.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">Use Cases</h2>
                  <button
                    onClick={() => router.push(`/sprint-targets/${id}/proposals`)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Alle anzeigen →
                  </button>
                </div>
                <div className="space-y-2">
                  {current.useCases.slice(0, 4).map((uc) => (
                    <div key={uc.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          uc.priority === 'high' ? 'bg-red-100 text-red-700'
                          : uc.priority === 'medium' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {uc.priority}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{uc.type}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{uc.title}</p>
                      {uc.basis && <p className="text-xs text-gray-500 mt-0.5">Basis: {uc.basis}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Version history */}
            {assessments.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Versionshistorie</h2>
                <div className="space-y-1">
                  {assessments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setCurrent(a)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        current?.id === a.id ? 'bg-violet-50 text-violet-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>Version {a.version}</span>
                      <span className="text-xs text-gray-400">{formatDate(a.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

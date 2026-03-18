'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export default function SurveyPage() {
  const { token } = useParams()
  const [survey, setSurvey] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [score, setScore] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    apiFetch(`/satisfaction/respond/${token}`)
      .then((data) => { setSurvey(data.survey); setProject(data.project) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function submit() {
    if (score === null) return
    setSubmitting(true)
    try {
      await apiFetch(`/satisfaction/respond/${token}`, {
        method: 'POST',
        body: JSON.stringify({ score, feedback }),
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const scoreColor = score === null ? '' : score >= 9 ? 'text-green-600' : score >= 7 ? 'text-amber-500' : 'text-red-500'
  const scoreLabel = score === null ? '' : score >= 9 ? 'Sehr wahrscheinlich 😊' : score >= 7 ? 'Wahrscheinlich 🙂' : 'Eher unwahrscheinlich 😐'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <p className="text-gray-700 font-medium mb-2">
            {error === 'Survey already completed' ? 'Diese Umfrage wurde bereits ausgefüllt.' : 'Umfrage nicht gefunden.'}
          </p>
          <p className="text-sm text-gray-400">Vielen Dank für Ihre Zeit.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Vielen Dank!</h2>
          <p className="text-gray-500 text-sm">Ihr Feedback wurde erfolgreich übermittelt.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Kundenfeedback</p>
          <h1 className="text-xl font-bold text-gray-900">{project?.name}</h1>
          {project?.account && <p className="text-sm text-gray-500">{project.account.companyName}</p>}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Wie wahrscheinlich ist es, dass Sie uns einem Kollegen oder Partner weiterempfehlen würden?
            </p>
            <div className="flex gap-1 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setScore(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                    score === n
                      ? n >= 9 ? 'bg-green-500 text-white' : n >= 7 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
              <span>Sehr unwahrscheinlich</span>
              <span>Sehr wahrscheinlich</span>
            </div>
            {score !== null && (
              <p className={`text-sm font-medium mt-2 ${scoreColor}`}>{scoreLabel}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Was hat Ihnen besonders gut gefallen oder was können wir verbessern? (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Ihr Feedback..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={score === null || submitting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Wird gesendet...' : 'Feedback absenden'}
          </button>
        </div>
      </div>
    </div>
  )
}

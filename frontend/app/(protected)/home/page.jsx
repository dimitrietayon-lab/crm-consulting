'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, TrendingUp, Briefcase, BarChart2, Brain, Receipt, Users,
  ArrowRight, Loader2, Lock,
} from 'lucide-react'
import api from '@/lib/api'
import { getUser } from '@/lib/auth'

const ICON_MAP = {
  Building2, TrendingUp, Briefcase, BarChart2, Brain, Receipt, Users,
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   hover: 'hover:bg-blue-600' },
  green:  { bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  hover: 'hover:bg-green-600' },
  purple: { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', hover: 'hover:bg-purple-600' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', hover: 'hover:bg-orange-600' },
  pink:   { bg: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-200',   hover: 'hover:bg-pink-600' },
  amber:  { bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200',  hover: 'hover:bg-amber-600' },
  teal:   { bg: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   hover: 'hover:bg-teal-600' },
}

export default function HomePage() {
  const router = useRouter()
  const user = getUser()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/portal/my-modules')
      .then(setModules)
      .catch(() => setModules([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">
          Willkommen, {user?.name?.split(' ')[0] || 'Nutzer'}
        </h1>
        <p className="text-slate-500 mt-1">
          Wählen Sie ein Modul, auf das Sie Zugriff haben.
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lock className="w-16 h-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-600">Kein Zugriff</h2>
          <p className="text-slate-400 mt-2 max-w-sm">
            Ihnen wurde noch keine Rolle zugewiesen. Bitte kontaktieren Sie einen Administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {modules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] || Briefcase
            const colors = COLOR_MAP[mod.color] || COLOR_MAP.blue
            return (
              <button
                key={mod.key}
                onClick={() => router.push(`/home/${mod.key}`)}
                className={`group relative flex flex-col items-start p-6 rounded-2xl bg-white border ${colors.border} shadow-sm hover:shadow-lg transition-all duration-200 text-left`}
              >
                {/* Icon badge */}
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${colors.bg} text-white mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>

                {/* Module name */}
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {mod.name}
                </h2>

                {/* Description */}
                {mod.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                )}

                {/* Feature count */}
                <p className={`text-xs font-medium mt-3 ${colors.text}`}>
                  {mod.features?.length || 0} Funktion{mod.features?.length !== 1 ? 'en' : ''}
                </p>

                {/* Arrow */}
                <ArrowRight className={`absolute top-5 right-5 w-4 h-4 text-slate-300 group-hover:${colors.text} transition-colors`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

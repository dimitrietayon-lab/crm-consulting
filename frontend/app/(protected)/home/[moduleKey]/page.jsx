'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, TrendingUp, Briefcase, BarChart2, Brain, Receipt, Users,
  ArrowLeft, ExternalLink, Loader2, Lock,
  Clock, CalendarOff, FileSpreadsheet, ArrowDownToLine, Settings,
  FileText, FileCheck, Activity, CheckSquare, FolderOpen,
  GitBranch, Star, Shuffle, Shield, Newspaper, GraduationCap, SmilePlus,
} from 'lucide-react'
import api from '@/lib/api'

const ICON_MAP = {
  Building2, TrendingUp, Briefcase, BarChart2, Brain, Receipt, Users,
  Clock, CalendarOff, FileSpreadsheet, ArrowDownToLine, Settings,
  FileText, FileCheck, Activity, CheckSquare, FolderOpen,
  GitBranch, Star, Shuffle, Shield, Newspaper, GraduationCap, SmilePlus,
}

// Map feature keys to icons
const FEATURE_ICON_MAP = {
  accounts:          Building2,
  contacts:          Users,
  activities:        Activity,
  documents:         FolderOpen,
  pipeline:          TrendingUp,
  proposals:         FileText,
  contracts:         FileCheck,
  projects:          Briefcase,
  tasks:             CheckSquare,
  timesheets:        Clock,
  network:           GitBranch,
  key_accounts:      Star,
  cross_selling:     Shuffle,
  compliance:        Shield,
  ai_opportunities:  Brain,
  news_monitoring:   Newspaper,
  skills:            GraduationCap,
  satisfaction:      SmilePlus,
  expenses:          Receipt,
  invoices:          FileSpreadsheet,
  incoming_invoices: ArrowDownToLine,
  leave:             CalendarOff,
}

const MODULE_ICON_MAP = {
  Building2, TrendingUp, Briefcase, BarChart2, Brain, Receipt, Users,
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  green:  { bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  purple: { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  pink:   { bg: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700' },
  amber:  { bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  teal:   { bg: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700' },
}

export default function ModulePage() {
  const { moduleKey } = useParams()
  const router = useRouter()
  const [module, setModule] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/portal/my-modules')
      .then((mods) => {
        const found = mods.find((m) => m.key === moduleKey)
        setModule(found || null)
      })
      .catch(() => setModule(null))
      .finally(() => setLoading(false))
  }, [moduleKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center p-8">
        <Lock className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600">Kein Zugriff</h2>
        <p className="text-slate-400 mt-2">Sie haben keinen Zugriff auf dieses Modul.</p>
        <button onClick={() => router.push('/home')} className="mt-4 text-blue-600 hover:underline text-sm">
          Zurück zur Übersicht
        </button>
      </div>
    )
  }

  const ModuleIcon = MODULE_ICON_MAP[module.icon] || Briefcase
  const colors = COLOR_MAP[module.color] || COLOR_MAP.blue

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/home')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Alle Module
      </button>

      {/* Module header */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center justify-center w-14 h-14 rounded-2xl ${colors.bg} text-white`}>
          <ModuleIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{module.name}</h1>
          {module.description && (
            <p className="text-slate-500 text-sm mt-0.5">{module.description}</p>
          )}
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(module.features || []).map((feat) => {
          const FeatureIcon = FEATURE_ICON_MAP[feat.key] || ExternalLink

          const actions = []
          if (feat.canCreate) actions.push('Erstellen')
          if (feat.canEdit) actions.push('Bearbeiten')
          if (feat.canDelete) actions.push('Löschen')

          return (
            <Link
              key={feat.key}
              href={feat.route || '#'}
              className={`group flex flex-col p-5 rounded-xl bg-white border ${colors.border} shadow-sm hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${colors.light} ${colors.text}`}>
                  <FeatureIcon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{feat.name}</h3>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-slate-500" />
              </div>

              {/* Permission badges */}
              <div className="flex flex-wrap gap-1 mt-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>Lesen</span>
                {actions.map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {a}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

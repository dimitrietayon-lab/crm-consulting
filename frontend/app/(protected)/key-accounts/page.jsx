'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Star, TrendingUp, Calendar, User } from 'lucide-react'

function HealthCircle({ score }) {
  const color = score >= 70 ? 'text-green-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'
  const bgColor = score >= 70 ? 'bg-green-50' : score >= 40 ? 'bg-amber-50' : 'bg-red-50'
  const ringColor = score >= 70 ? 'ring-green-200' : score >= 40 ? 'ring-amber-200' : 'ring-red-200'
  return (
    <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center ${bgColor} ring-2 ${ringColor} shrink-0`}>
      <span className={`text-lg font-bold leading-none ${color}`}>{score}</span>
      <span className="text-xs text-gray-400 leading-none">/ 100</span>
    </div>
  )
}

export default function KeyAccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/key-accounts')
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
          <Star size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Key Accounts</h1>
          <p className="text-sm text-gray-500">{accounts.length} Key Accounts · Strategisches Account Management</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <Star size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium">Keine Key Accounts</p>
          <p className="text-sm text-gray-400 mt-1">Markieren Sie Accounts als Key Account in der Account-Übersicht</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Link
              key={acc.id}
              href={`/key-accounts/${acc.id}`}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <HealthCircle score={acc.healthScore} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 truncate">
                    {acc.companyName}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{acc.institutionType}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {acc.lastActivity && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={12} />
                    <span>Letzter Kontakt: {formatDate(acc.lastActivity)}</span>
                  </div>
                )}
                {acc.openPipeline > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <TrendingUp size={12} />
                    <span>Pipeline: {formatCurrency(acc.openPipeline)}</span>
                  </div>
                )}
                {acc.assignedConsultant && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User size={12} />
                    <span>{acc.assignedConsultant.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                {acc.latestNps !== null && acc.latestNps !== undefined ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    acc.latestNps >= 8 ? 'bg-green-100 text-green-800' :
                    acc.latestNps >= 6 ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    NPS: {acc.latestNps}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Kein NPS</span>
                )}
                <span className="text-xs text-gray-400 group-hover:text-amber-500 transition-colors">
                  Account-Plan →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

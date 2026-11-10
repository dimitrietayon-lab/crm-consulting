'use client'

import { useRouter } from 'next/navigation'

const ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/sprint-targets/dashboard' },
  { key: 'kanban', label: 'Zielkunden', href: '/sprint-targets' },
  { key: 'market', label: 'Marktauswahl', href: '/sprint-targets/market' },
  { key: 'capacity', label: 'Planung', href: '/sprint-targets/capacity' },
  { key: 'outreach', label: 'Outreach', href: '/sprint-targets/outreach' },
  { key: 'offers', label: 'Angebote', href: '/sprint-targets/offers' },
  { key: 'bafa', label: 'BAFA', href: '/sprint-targets/bafa' },
  { key: 'blocklist', label: 'Sperrliste', href: '/sprint-targets/blocklist' },
  { key: 'reporting', label: 'Reporting', href: '/sprint-targets/reporting' },
  { key: 'activities', label: 'Aktivitäten', href: '/sprint-targets/activities' },
  { key: 'import', label: 'Import', href: '/sprint-targets/import' },
  { key: 'settings', label: 'Einstellungen', href: '/sprint-targets/settings' },
]

export default function SprintNav({ active }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => router.push(item.href)}
          className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap transition-colors ${
            active === item.key
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

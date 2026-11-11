'use client'

// Einheitliche Tab-Leiste für zusammengeführte Seiten (CRM + Akquise).
export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-6">
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              active === t.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

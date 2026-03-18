'use client'

const HIERARCHY_LEVELS = ['C-Level', 'Managing Director', 'Project Lead', 'Specialist']

const LEVEL_CONFIG = {
  'C-Level': {
    color: 'bg-blue-600',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800',
    label: 'C-Level',
  },
  'Managing Director': {
    color: 'bg-purple-600',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100 text-purple-800',
    label: 'Managing Director',
  },
  'Project Lead': {
    color: 'bg-green-600',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeBg: 'bg-green-100 text-green-800',
    label: 'Project Lead',
  },
  Specialist: {
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badgeBg: 'bg-gray-100 text-gray-700',
    label: 'Specialist',
  },
}

export default function OrgChart({ contacts = [] }) {
  const grouped = HIERARCHY_LEVELS.reduce((acc, level) => {
    const found = contacts.filter((c) => c.hierarchyLevel === level)
    if (found.length > 0) acc[level] = found
    return acc
  }, {})

  const presentLevels = HIERARCHY_LEVELS.filter((l) => grouped[l])

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Keine Kontakte vorhanden
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {presentLevels.map((level, idx) => {
        const config = LEVEL_CONFIG[level]
        const levelContacts = grouped[level]
        const isLast = idx === presentLevels.length - 1

        return (
          <div key={level} className="relative">
            {/* Connector line going down */}
            {!isLast && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0.5 h-6 bg-gray-300 z-10" />
            )}

            {/* Level band */}
            <div className={`${config.bgColor} border ${config.borderColor} rounded-lg mb-6`}>
              {/* Level header */}
              <div className={`${config.color} rounded-t-lg px-4 py-2 flex items-center gap-2`}>
                <span className="text-white text-xs font-semibold uppercase tracking-wider">
                  {config.label}
                </span>
                <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                  {levelContacts.length}
                </span>
              </div>

              {/* Contact cards */}
              <div className="p-3 flex flex-wrap gap-3 justify-center">
                {levelContacts.map((contact) => (
                  <ContactCard key={contact.id || contact._id} contact={contact} config={config} />
                ))}
              </div>
            </div>

            {/* Arrow down connector */}
            {!isLast && (
              <div className="flex justify-center -mt-4 mb-2 relative z-20">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-gray-300" />
                  <svg
                    className="text-gray-400"
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="currentColor"
                  >
                    <path d="M0 0L5 6L10 0H0Z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ContactCard({ contact, config }) {
  const initials = contact.name
    ? contact.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <div
      className={`bg-white border ${config.borderColor} rounded-lg p-3 shadow-sm min-w-[140px] max-w-[200px] text-center hover:shadow-md transition-shadow`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center mx-auto mb-2`}
      >
        <span className="text-white text-sm font-semibold">{initials}</span>
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-gray-900 leading-tight">{contact.name}</p>

      {/* Title */}
      {contact.title && (
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{contact.title}</p>
      )}

      {/* Department */}
      {contact.department && (
        <p className={`text-xs mt-1 font-medium ${config.textColor}`}>{contact.department}</p>
      )}

      {/* Email */}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="block text-xs text-blue-600 hover:underline mt-1 truncate"
          title={contact.email}
        >
          {contact.email}
        </a>
      )}
    </div>
  )
}

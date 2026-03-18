'use client'

import {
  Users,
  Phone,
  Mail,
  Presentation,
  BookOpen,
  Globe,
  StickyNote,
} from 'lucide-react'

const TYPE_CONFIG = {
  Meeting: { icon: Users, color: 'blue', bg: 'bg-blue-100', text: 'text-blue-600' },
  'Phone Call': { icon: Phone, color: 'green', bg: 'bg-green-100', text: 'text-green-600' },
  Email: { icon: Mail, color: 'gray', bg: 'bg-gray-100', text: 'text-gray-600' },
  Presentation: {
    icon: Presentation,
    color: 'indigo',
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
  },
  Workshop: { icon: BookOpen, color: 'purple', bg: 'bg-purple-100', text: 'text-purple-600' },
  Conference: { icon: Globe, color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-600' },
  Note: { icon: StickyNote, color: 'slate', bg: 'bg-slate-100', text: 'text-slate-600' },
}

/**
 * ActivityTypeIcon
 * @param {string} type - one of Meeting | Phone Call | Email | Presentation | Workshop | Conference | Note
 * @param {string} size - 'sm' | 'md' | 'lg' (default 'md')
 * @param {boolean} showLabel - whether to render the label text alongside the icon
 */
export default function ActivityTypeIcon({ type, size = 'md', showLabel = false }) {
  const config = TYPE_CONFIG[type] || {
    icon: Mail,
    color: 'gray',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  }

  const Icon = config.icon

  const sizeClasses = {
    sm: { wrapper: 'w-7 h-7', icon: 'w-3.5 h-3.5', text: 'text-xs' },
    md: { wrapper: 'w-9 h-9', icon: 'w-4.5 h-4.5', icon2: 'w-[18px] h-[18px]', text: 'text-sm' },
    lg: { wrapper: 'w-11 h-11', icon: 'w-6 h-6', text: 'text-base' },
  }

  const sc = sizeClasses[size] || sizeClasses.md
  const iconClass = sc.icon2 || sc.icon

  if (showLabel) {
    return (
      <div className="inline-flex items-center gap-2">
        <div
          className={`${sc.wrapper} ${config.bg} rounded-full flex items-center justify-center shrink-0`}
        >
          <Icon className={`${iconClass} ${config.text}`} />
        </div>
        <span className={`${sc.text} font-medium ${config.text}`}>{type}</span>
      </div>
    )
  }

  return (
    <div
      className={`${sc.wrapper} ${config.bg} rounded-full flex items-center justify-center shrink-0`}
      title={type}
    >
      <Icon className={`${iconClass} ${config.text}`} />
    </div>
  )
}

export { TYPE_CONFIG }

'use client'

/**
 * EmptyState component
 *
 * Props:
 *   icon        {React component} - Lucide icon component (not rendered element)
 *   title       {string}          - Main empty state heading
 *   description {string}          - Explanatory sub-text
 *   action      {object}          - { label: string, onClick: function } – optional CTA button
 *   compact     {boolean}         - Smaller padding/font sizes for inline use
 */
export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
    >
      {Icon && (
        <div
          className={`flex items-center justify-center rounded-full bg-gray-100 mb-4 ${
            compact ? 'w-10 h-10' : 'w-14 h-14'
          }`}
        >
          <Icon
            className={`text-gray-400 ${compact ? 'w-5 h-5' : 'w-7 h-7'}`}
            strokeWidth={1.5}
          />
        </div>
      )}

      <h3
        className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}
      >
        {title}
      </h3>

      {description && (
        <p
          className={`text-gray-500 mt-1 max-w-sm ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`btn-primary mt-4 ${compact ? 'text-xs px-3 py-1.5' : ''}`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

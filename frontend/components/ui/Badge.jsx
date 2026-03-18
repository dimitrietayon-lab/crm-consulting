'use client'

/**
 * Badge component
 *
 * Props:
 *   children  {ReactNode}  - Badge label content
 *   variant   {string}     - default | success | warning | danger | info | purple | blue
 *   size      {string}     - sm | md  (default: md)
 *   dot       {boolean}    - Show a colored dot before the text
 */
const VARIANT_CLASSES = {
  default: 'bg-gray-100 text-gray-700 ring-gray-200',
  success: 'bg-green-50 text-green-700 ring-green-200',
  warning: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const DOT_COLORS = {
  default: 'bg-gray-400',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  slate: 'bg-slate-400',
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export default function Badge({ children, variant = 'default', size = 'md', dot = false }) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.default
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const dotColor = DOT_COLORS[variant] || DOT_COLORS.default

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset whitespace-nowrap ${variantClass} ${sizeClass}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      )}
      {children}
    </span>
  )
}

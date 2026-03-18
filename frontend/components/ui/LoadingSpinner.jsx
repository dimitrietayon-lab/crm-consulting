'use client'

/**
 * LoadingSpinner component
 *
 * Props:
 *   size    {string}  - sm | md | lg (default: md)
 *   center  {boolean} - If true, wraps in a centered flex container
 *   label   {string}  - Accessible screen-reader text (default: "Laden...")
 *   color   {string}  - Tailwind border-color class (default: border-blue-600)
 */
const SIZE_MAP = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
}

export default function LoadingSpinner({
  size = 'md',
  center = true,
  label = 'Laden...',
  color = 'border-blue-600',
}) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md

  const spinner = (
    <div
      role="status"
      aria-label={label}
      className={`animate-spin rounded-full border-gray-200 border-b-current ${sizeClass} ${color}`}
    />
  )

  if (!center) return spinner

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[4rem]">
      {spinner}
    </div>
  )
}

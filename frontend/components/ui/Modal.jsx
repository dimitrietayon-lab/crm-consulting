'use client'

import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-7xl',
  // Responsive: grow with breakpoints; full width on very small screens
  responsive: 'max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl',
}

/**
 * Reusable Modal component
 *
 * Props:
 *   isOpen   {boolean}   - Whether the modal is visible
 *   onClose  {function}  - Called when backdrop or X is clicked
 *   title    {string}    - Modal header title
 *   children {ReactNode} - Modal body content
 *   size     {string}    - sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl | 7xl | full | responsive | vw-<percent> (e.g., vw-70) (default: md)
 *   footer   {ReactNode} - Optional footer content (renders below body)
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  // Support percentage-based viewport widths via size strings like "vw-70"
  const isVw = typeof size === 'string' && size.startsWith('vw-')
  let widthStyle = undefined
  if (isVw) {
    const num = parseInt(size.split('-')[1], 10)
    if (!Number.isNaN(num)) {
      const clamped = Math.min(Math.max(num, 20), 100) // clamp to [20,100]
      // Subtract horizontal margins (mx-4 => 2rem total) at 100vw to avoid overflow
      const vwValue = clamped === 100 ? 'calc(100vw - 2rem)' : `${clamped}vw`
      widthStyle = { width: vwValue }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full mx-4 ${isVw ? '' : (SIZE_CLASSES[size] || SIZE_CLASSES.md)} animate-fade-in flex flex-col max-h-[90vh]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        style={widthStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2
            id="modal-title"
            className="text-base font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

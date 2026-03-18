'use client'

import { AlertTriangle, Trash2, CheckCircle, Info } from 'lucide-react'
import Modal from './Modal'

/**
 * ConfirmDialog component
 *
 * Props:
 *   isOpen       {boolean}   - Whether the dialog is visible
 *   onClose      {function}  - Called when cancelled or backdrop clicked
 *   onConfirm    {function}  - Called when confirm button is clicked
 *   title        {string}    - Dialog title
 *   message      {string}    - Confirmation message / body text
 *   confirmText  {string}    - Label for confirm button (default: "Bestätigen")
 *   cancelText   {string}    - Label for cancel button (default: "Abbrechen")
 *   variant      {string}    - 'danger' | 'warning' | 'info' | 'success'
 *                              danger  → red,   AlertTriangle, Trash2 default in button
 *                              warning → amber, AlertTriangle, no default icon
 *                              info    → blue,  Info, no default icon
 *                              success → green, CheckCircle, no default icon
 *   isDanger     {boolean}   - Legacy shorthand for variant='danger'
 *   confirmIcon  {Component} - Icon shown in confirm button; null = no icon,
 *                              undefined = use variant default
 *   loading      {boolean}   - If true, disables buttons and shows spinner
 */

const VARIANTS = {
  danger: {
    circle:       'bg-red-100',
    circleIcon:   AlertTriangle,
    circleColor:  'text-red-600',
    btn:          'bg-red-600 hover:bg-red-700',
    defaultIcon:  Trash2,
  },
  warning: {
    circle:       'bg-amber-100',
    circleIcon:   AlertTriangle,
    circleColor:  'text-amber-600',
    btn:          'bg-amber-600 hover:bg-amber-700',
    defaultIcon:  null,
  },
  info: {
    circle:       'bg-blue-100',
    circleIcon:   Info,
    circleColor:  'text-blue-600',
    btn:          'bg-blue-600 hover:bg-blue-700',
    defaultIcon:  null,
  },
  success: {
    circle:       'bg-green-100',
    circleIcon:   CheckCircle,
    circleColor:  'text-green-600',
    btn:          'bg-green-600 hover:bg-green-700',
    defaultIcon:  null,
  },
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Bestätigen',
  message = 'Sind Sie sicher?',
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  isDanger = false,
  variant,
  confirmIcon,
  loading = false,
}) {
  const v = VARIANTS[variant ?? (isDanger ? 'danger' : 'info')]
  const CircleIcon = v.circleIcon
  // confirmIcon=undefined → use variant default; confirmIcon=null → no icon; confirmIcon=Component → use it
  const BtnIcon = confirmIcon === undefined ? v.defaultIcon : confirmIcon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        {/* Icon */}
        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${v.circle}`}>
          <CircleIcon className={`w-6 h-6 ${v.circleColor}`} />
        </div>

        {/* Message */}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="btn-secondary flex-1 justify-center"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 justify-center inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v.btn}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Bitte warten...
            </span>
          ) : (
            <>
              {BtnIcon && <BtnIcon className="w-4 h-4 mr-1.5" />}
              {confirmText}
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}

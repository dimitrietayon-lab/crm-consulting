'use client'

import { useState } from 'react'

// Ponturo-Logo (Datei liegt unter frontend/public/ponturo-logo.png).
// Transparent – ohne Hintergrund-Kachel.
const PONTURO_LOGO_URL = '/ponturo-logo.png'

export default function PonturoLogo({ className = 'w-8 h-8' }) {
  const [failed, setFailed] = useState(false)

  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`} role="img" aria-label="Ponturo">
      {failed ? (
        <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11 8.5V23.5" stroke="#2563eb" strokeWidth="3.4" strokeLinecap="round" />
          <path
            d="M11 8.5H17.5C20.54 8.5 23 10.96 23 14C23 17.04 20.54 19.5 17.5 19.5H11"
            stroke="#2563eb"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <img
          src={PONTURO_LOGO_URL}
          alt="Ponturo"
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

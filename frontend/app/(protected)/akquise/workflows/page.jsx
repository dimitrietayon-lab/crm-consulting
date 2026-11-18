'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import WorkflowBuilder from '@/components/acquisition/WorkflowBuilder'

// Eigene Admin-Seite für die Akquise-Workflows. Kampagnen und die
// Schritt-Bibliothek bleiben in den Akquise-Einstellungen.
export default function WorkflowsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (getUser()?.role === 'admin') setAuthorized(true)
    else router.replace('/')
  }, [router])

  if (!authorized) return null

  return (
    <div className="p-6 max-w-6xl mx-auto group-data-[collapsed=true]/sidebar:max-w-none">
      <WorkflowBuilder />
    </div>
  )
}

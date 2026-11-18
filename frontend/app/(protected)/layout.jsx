'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'
import { primeSprintSettings } from '@/lib/acquisitionSettings'
import { primePipeline } from '@/lib/pipeline'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function ProtectedLayout({ children }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
    } else {
      setChecking(false)
      primeSprintSettings()
      primePipeline()
    }
    // Eingeklappten Sidebar-Zustand erst nach dem Mount lesen (Hydration).
    try {
      if (localStorage.getItem('sidebar_collapsed') === '1') setSidebarCollapsed(true)
    } catch {}
  }, [])

  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Wird geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className={`group/sidebar w-full mx-auto px-6 pt-5 pb-12 ${sidebarCollapsed ? 'max-w-none' : 'max-w-[1320px]'}`} data-collapsed={sidebarCollapsed ? 'true' : 'false'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

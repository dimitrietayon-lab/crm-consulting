'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, Search, X, CheckCheck, Clock, Zap, Calendar, DollarSign,
  AlertCircle, Info, CheckCircle, XCircle
} from 'lucide-react'
import { getUser as getAuthUser } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { api } from '@/lib/api'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/home': 'Übersicht',
  '/accounts': 'Accounts',
  '/contacts': 'Kontakte',
  '/pipeline': 'Pipeline',
  '/proposals': 'Angebote',
  '/projects': 'Projekte',
  '/activities': 'Aktivitäten',
  '/tasks': 'Aufgaben',
  '/documents': 'Dokumente',
  '/segments': 'Segmente',
  '/key-accounts': 'Key Account Management',
  '/cross-selling': 'Cross-Selling',
  '/compliance': 'Compliance',
  '/ai-opportunities': 'KI-Opportunities',
  '/news': 'News-Monitoring',
  '/skills': 'Skills',
  '/timesheets': 'Zeiterfassung',
  '/leave': 'Abwesenheiten',
  '/expenses': 'Reisekosten',
  '/invoices': 'Rechnungen',
  '/incoming-invoices': 'Eingangsrechnungen',
  '/workflows': 'Workflow-Automatisierung',
  '/admin': 'Administration',
  '/settings': 'Einstellungen',
  '/mein-bereich': 'Mein Bereich',
}

function getPageTitle(pathname) {
  if (pathname === '/workflows/new') return 'Neuer Workflow'
  if (/^\/workflows\/[^/]+\/edit$/.test(pathname)) return 'Workflow bearbeiten'
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const base = '/' + pathname.split('/').filter(Boolean)[0]
  return PAGE_TITLES[base] || 'CRM'
}

// Notification type → icon / color
const NOTIF_CONFIG = {
  workflow_success:    { icon: Zap,          color: 'text-violet-600', bg: 'bg-violet-50' },
  workflow_failed:     { icon: AlertCircle,  color: 'text-red-600',    bg: 'bg-red-50'    },
  timesheet_approved:  { icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
  timesheet_returned:  { icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
  leave_approved:      { icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
  leave_rejected:      { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
  expense_approved:    { icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
  expense_rejected:    { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
  expense_paid:        { icon: DollarSign,   color: 'text-blue-600',   bg: 'bg-blue-50'   },
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  return `vor ${Math.floor(h / 24)} d.`
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const user = getAuthUser()
  const title = getPageTitle(pathname)

  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/notifications')
      if (data) setNotifications(data)
    } catch {}
  }, [])

  // Initial load + poll every 30s
  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  async function markRead(id) {
    try {
      await api.put(`/notifications/${id}/read`, {})
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all', {})
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  async function deleteNotif(id, e) {
    e.stopPropagation()
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  function handleNotifClick(n) {
    if (!n.read) markRead(n.id)
    if (n.link) {
      router.push(n.link)
      setOpen(false)
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 justify-between shrink-0 z-50">
      {/* Left: Page title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right: Search + Notifications + User */}
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suchen..."
            className="pl-9 pr-4 py-1.5 text-sm bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent w-52 transition-all"
          />
        </div>

        {/* Notifications */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-[9999] overflow-visible">
              {/* Dropdown header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">Benachrichtigungen</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                      {unreadCount} neu
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <CheckCheck className="w-3 h-3" /> Alle lesen
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Keine Benachrichtigungen</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const cfg = NOTIF_CONFIG[n.type] || { icon: Info, color: 'text-gray-500', bg: 'bg-gray-50' }
                    const Icon = cfg.icon
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors
                          ${!n.read ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className={`p-1.5 rounded-xl ${cfg.bg} shrink-0 mt-0.5`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>
                              {n.title}
                            </p>
                            <button
                              onClick={(e) => deleteNotif(n.id, e)}
                              className="shrink-0 text-gray-300 hover:text-gray-500 ml-1 mt-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400 text-center">
                    {notifications.length} Benachrichtigung{notifications.length !== 1 ? 'en' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors">
            {getInitials(user?.name || user?.email || 'U')}
          </div>
          <span className="hidden md:block text-sm font-medium text-gray-700">
            {user?.name || 'Benutzer'}
          </span>
        </div>
      </div>
    </header>
  )
}

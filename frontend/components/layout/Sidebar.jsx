'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  FileText,
  Briefcase,
  Activity,
  CheckSquare,
  FolderOpen,
  LogOut,
  ChevronRight,
  Settings,
  FileCheck,
  Star,
  Shuffle,
  Shield,
  Brain,
  Newspaper,
  GraduationCap,
  SmilePlus,
  Clock,
  CalendarOff,
  Receipt,
  FileSpreadsheet,
  ArrowDownToLine,
  ShoppingCart,
  Home,
  UserCog,
  LayoutGrid,
  Zap,
  Calculator,
  Banknote,
} from 'lucide-react'
import { getUser, logout } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'

// Feature key → required permission key (matches portal feature keys from seed)
const FEATURE_GATES = {
  '/accounts':         'accounts',
  '/contacts':         'contacts',
  '/activities':       'activities',
  '/documents':        'documents',
  '/pipeline':         'pipeline',
  '/proposals':        'proposals',
  '/contracts':        'contracts',
  '/projects':         'projects',
  '/tasks':            'tasks',
  '/timesheets':       'timesheets',
  '/key-accounts':     'key_accounts',
  '/cross-selling':    'cross_selling',
  '/compliance':       'compliance',
  '/ai-opportunities': 'ai_opportunities',
  '/news':             'news_monitoring',
  '/skills':           'skills',
  '/expenses':         'expenses',
  '/material-costs':   'material_costs',
  '/invoices':         'invoices',
  '/incoming-invoices':'incoming_invoices',
  '/buchhaltung':      'buchhaltung',
  '/finanzplanung':    'finanzplanung',
  '/lohnverwaltung':   'lohnverwaltung',
  '/leave':            'leave',
  '/workflows':        'workflows',
}

const allNavGroups = [
  {
    label: 'Portal',
    items: [
      { label: 'Startseite',   href: '/home',         icon: Home,            alwaysShow: true },
      { label: 'Dashboard',    href: '/',             icon: LayoutDashboard, alwaysShow: true },
      { label: 'Mein Bereich', href: '/mein-bereich', icon: LayoutGrid,     alwaysShow: true },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Accounts',    href: '/accounts',    icon: Building2 },
      { label: 'Kontakte',    href: '/contacts',    icon: Users },
      { label: 'Aktivitäten', href: '/activities',  icon: Activity },
    ],
  },
  {
    label: 'Vertrieb',
    items: [
      { label: 'Pipeline',  href: '/pipeline',  icon: TrendingUp },
      { label: 'Angebote',  href: '/proposals', icon: FileText },
      { label: 'Verträge',  href: '/contracts', icon: FileCheck },
    ],
  },
  {
    label: 'PMO',
    items: [
      { label: 'Projekte',     href: '/projects',    icon: Briefcase },
      { label: 'Aufgaben',     href: '/tasks',       icon: CheckSquare },
      { label: 'Zeiterfassung',href: '/timesheets',  icon: Clock },
    ],
  },
  {
    label: 'Dokumente',
    items: [
      { label: 'Dokumente', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { label: 'Key Accounts', href: '/key-accounts',  icon: Star },
      { label: 'Cross-Selling',href: '/cross-selling', icon: Shuffle },
      { label: 'Compliance',   href: '/compliance',    icon: Shield },
    ],
  },
  {
    label: 'KI & Analyse',
    items: [
      { label: 'KI-Opportunities', href: '/ai-opportunities', icon: Brain },
      { label: 'News Monitoring',  href: '/news',             icon: Newspaper },
      { label: 'Skill-Matching',   href: '/skills',           icon: GraduationCap },
    ],
  },
  {
    label: 'Fi & Co',
    items: [
      { label: 'Reisekosten',         href: '/expenses',          icon: Receipt },
      { label: 'Materialkosten',      href: '/material-costs',    icon: ShoppingCart },
      { label: 'Ausgangsrechnungen',  href: '/invoices',          icon: FileSpreadsheet },
      { label: 'Eingangsrechnungen',  href: '/incoming-invoices', icon: ArrowDownToLine },
    ],
  },
  {
    label: 'Buchhaltung',
    items: [
      { label: 'Buchhaltung',    href: '/buchhaltung',   icon: Calculator },
      { label: 'Finanzplanung',  href: '/finanzplanung', icon: TrendingUp },
    ],
  },
  {
    label: 'Personal',
    items: [
      { label: 'Abwesenheiten',    href: '/leave',            icon: CalendarOff },
      { label: 'Lohnverwaltung',   href: '/lohnverwaltung',   icon: Banknote, alwaysShow: true },
    ],
  },
  {
    label: 'Automatisierung',
    items: [
      { label: 'Workflows', href: '/workflows', icon: Zap },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Einstellungen', href: '/settings', icon: Settings, alwaysShow: true },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const { can, loading: permsLoading } = usePermissions()

  function isActive(href) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  function isVisible(item) {
    if (item.alwaysShow) return true
    if (isAdmin) return true  // legacy admin sees everything
    const featureKey = FEATURE_GATES[item.href]
    if (!featureKey) return true
    if (permsLoading) return false
    return can(featureKey)
  }

  // Filter groups to only show groups that have at least one visible item
  const visibleGroups = allNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(isVisible),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="flex flex-col w-60 min-w-[240px] h-screen bg-slate-900 border-r border-slate-800 overflow-y-auto">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
          <Briefcase className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">Consulting Business Suite</p>
          <p className="text-slate-400 text-xs">Banken &amp; Versicherungen</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-slate-700'
                          : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors'
                      }
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Admin link — only for admins */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Admin
            </p>
            <ul>
              <li>
                <Link
                  href="/admin"
                  className={
                    isActive('/admin')
                      ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-slate-700'
                      : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors'
                  }
                >
                  <UserCog className={`w-4 h-4 shrink-0 ${isActive('/admin') ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>Benutzerverwaltung</span>
                  {isActive('/admin') && <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
            {getInitials(user?.name || user?.email || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || 'Benutzer'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.email || ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full mt-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
  Settings,
  FileCheck,
  Star,
  Shuffle,
  Shield,
  Brain,
  Newspaper,
  GraduationCap,
  Clock,
  CalendarOff,
  Receipt,
  FileSpreadsheet,
  ArrowDownToLine,
  ShoppingCart,
  Package,
  UserCog,
  LayoutGrid,
  Zap,
  Calculator,
  Banknote,
  Crosshair,
  ShieldCheck,
  Upload,
  ShieldAlert,
  Send,
  BarChart3,
  MapPin,
  CalendarClock,
} from 'lucide-react'
import { getUser, logout } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'
import { isPathHidden, CRM_PROFILE_EVENT } from '@/lib/crmProfile'

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
  // KI-Readiness Sprint — granulare Schlüssel; Fallback auf 'sprint_targets'
  '/sprint-targets':   'sprint_targets',
  '/sprint-targets/dashboard':  'sprint_dashboard',
  '/sprint-targets/import':     'sprint_import',
  '/sprint-targets/blocklist':  'sprint_blocklist',
  '/sprint-targets/activities': 'sprint_activities',
  '/sprint-targets/offers':     'sprint_offers',
  '/sprint-targets/outreach':   'sprint_outreach',
  '/sprint-targets/team':       'sprint_team',
  '/sprint-targets/reporting':  'sprint_reporting',
  '/sprint-targets/market':     'sprint_market',
  '/sprint-targets/capacity':   'sprint_capacity',
  '/sprint-targets/bafa':       'sprint_bafa',
  '/sprint-targets/contacts':   'sprint_contacts',
  '/sprint-targets/settings':   'sprint_settings',
}

// Gemeinsame Seiten (Aktivitäten/Aufgaben/Dokumente) sind jetzt EINE Seite mit
// Akquise-Filter. Rollen mit reinen Sprint-Rechten sollen sie weiterhin sehen.
const FEATURE_ALT_GATES = {
  '/activities': 'sprint_activities',
  '/tasks':      'sprint_targets',
  '/documents':  'sprint_targets',
  '/contacts':   'sprint_contacts',
  '/proposals':  'sprint_offers',
}

const ROLE_LABELS = {
  admin: 'Administrator',
  consultant: 'Berater',
  manager: 'Manager',
  viewer: 'Betrachter',
}

function featureKeyFor(href) {
  if (FEATURE_GATES[href]) return FEATURE_GATES[href]
  if (href.startsWith('/sprint-targets')) return 'sprint_targets'
  return null
}

// EIN Menü, nach Kundenlebenszyklus geordnet: Akquise (Sprint) → Kunden/Vertrieb
// (Sprint-Bestand) → Mandate → Analyse/Backoffice.
// CRM-Profil: Finanzen/Personal/Zeit/Automatisierung werden über `crmProfile`
// gefiltert – die Definitionen bleiben hier, damit ein Toggle sie wieder einblenden kann.
const NAV_GROUPS = [
  {
    label: 'Portal',
    items: [
      { label: 'Dashboard',    href: '/',             icon: LayoutDashboard, alwaysShow: true },
      { label: 'Mein Bereich', href: '/mein-bereich', icon: LayoutGrid, alwaysShow: true },
    ],
  },
  {
    label: 'Akquise',
    items: [
      { label: 'Zielkunden',    href: '/sprint-targets',            icon: Crosshair },
      { label: 'Outreach',      href: '/sprint-targets/outreach',   icon: Send },
      { label: 'Förderungen',   href: '/sprint-targets/bafa',       icon: Banknote },
      { label: 'Listen-Import', href: '/sprint-targets/import',     icon: Upload },
      { label: 'Sperrliste',    href: '/sprint-targets/blocklist',  icon: ShieldAlert },
    ],
  },
  {
    label: 'Akquise-Planung',
    items: [
      { label: 'Team',         href: '/sprint-targets/team',      icon: UserCog },
      { label: 'Marktauswahl', href: '/sprint-targets/market',    icon: MapPin },
      { label: 'Planung',      href: '/sprint-targets/capacity',  icon: CalendarClock },
      { label: 'Reporting',    href: '/sprint-targets/reporting', icon: BarChart3 },
    ],
  },
  {
    label: 'Kunden & Vertrieb',
    items: [
      { label: 'Accounts',     href: '/accounts',     icon: Building2 },
      { label: 'Kontakte',     href: '/contacts',     icon: Users },
      { label: 'Aktivitäten',  href: '/activities',   icon: Activity },
      { label: 'Deals',        href: '/pipeline',     icon: TrendingUp },
      { label: 'Angebote',     href: '/proposals',    icon: FileText },
      { label: 'Verträge',     href: '/contracts',    icon: FileCheck },
    ],
  },
  {
    label: 'Mandate',
    items: [
      { label: 'Projekte',      href: '/projects',   icon: Briefcase },
      { label: 'Aufgaben',      href: '/tasks',      icon: CheckSquare },
      { label: 'Zeiterfassung', href: '/timesheets', icon: Clock },
      { label: 'Dokumente',     href: '/documents',  icon: FolderOpen },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { label: 'Key Accounts',  href: '/key-accounts',  icon: Star },
      { label: 'Cross-Selling', href: '/cross-selling', icon: Shuffle },
      { label: 'Compliance',    href: '/compliance',    icon: Shield },
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
      { label: 'Buchhaltung',   href: '/buchhaltung',   icon: Calculator },
      { label: 'Finanzplanung', href: '/finanzplanung', icon: TrendingUp },
    ],
  },
  {
    label: 'Personal',
    items: [
      { label: 'Abwesenheiten', href: '/leave',          icon: CalendarOff },
      { label: 'Lohnverwaltung', href: '/lohnverwaltung', icon: Banknote, alwaysShow: true },
    ],
  },
  {
    label: 'Automatisierung',
    items: [
      { label: 'Workflows', href: '/workflows', icon: Zap },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const { can, loading: permsLoading, perms } = usePermissions()
  const [, setProfileTick] = useState(0)
  const [profileReady, setProfileReady] = useState(false)

  // CRM-Profil-Änderungen (gleicher Tab oder anderer Tab) sofort übernehmen
  useEffect(() => {
    setProfileReady(true)
    const bump = () => setProfileTick((v) => v + 1)
    window.addEventListener(CRM_PROFILE_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(CRM_PROFILE_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const SPRINT_SUBPAGES = new Set([
    'dashboard', 'me', 'import', 'blocklist', 'activities', 'offers',
    'outreach', 'team', 'reporting', 'market', 'capacity', 'bafa', 'settings', 'contacts',
    'tasks', 'documents',
  ])

  function isActive(href) {
    if (href === '/') return pathname === '/'
    if (href === '/sprint-targets') {
      if (pathname === href) return true
      // Detail pages (/sprint-targets/<id>, /sprint-targets/<id>/assessment) belong to Zielkunden
      const segment = pathname.split('/')[2]
      return Boolean(segment) && !SPRINT_SUBPAGES.has(segment)
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  function isVisible(item) {
    // CRM-Profil schneidet Module nur aus der Navigation – vor allen anderen Regeln.
    // Erst nach dem Mount lesen, damit Server- und Client-Render übereinstimmen.
    if (profileReady && isPathHidden(item.href)) return false
    if (item.alwaysShow) return true
    if (isAdmin) return true  // legacy admin sees everything
    const featureKey = featureKeyFor(item.href)
    if (!featureKey) return true
    if (permsLoading) return false
    if (can(featureKey)) return true
    // Gemeinsame Seiten: Sprint-Rollen behalten Zugriff über ihr Sprint-Recht.
    const altKey = FEATURE_ALT_GATES[item.href]
    if (altKey && can(altKey)) return true
    // Fallback: Rollen, die (noch) keine granularen sprint_*-Rechte haben, behalten
    // den bisherigen Zugriff über das Sammelrecht 'sprint_targets'.
    if ((featureKey.startsWith('sprint_') || altKey) && !hasGranularSprint && can('sprint_targets')) return true
    return false
  }

  const hasGranularSprint = Object.keys(perms || {}).some(
    (key) => key.startsWith('sprint_') && key !== 'sprint_targets' && perms[key]?.canView
  )

  const systemGroup = {
    label: 'System',
    items: [
      { label: 'Einstellungen', href: '/settings', icon: Settings, alwaysShow: true },
    ],
  }

  // Filter groups to only show groups that have at least one visible item
  const visibleGroups = [...NAV_GROUPS, systemGroup]
    .map((group) => ({
      ...group,
      items: group.items.filter(isVisible),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="flex flex-col w-60 min-w-[240px] h-screen bg-slate-900 border-r border-slate-800 overflow-y-auto">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
          <Briefcase className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-bold leading-tight truncate">CRM</p>
          <p className="text-slate-400 text-xs truncate">Consulting Business Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4">
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
                </Link>
              </li>
              <li>
                <Link
                  href="/crm-profil"
                  className={
                    isActive('/crm-profil')
                      ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-slate-700'
                      : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors'
                  }
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${isActive('/crm-profil') ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>CRM-Profil</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pakete-leistungen"
                  className={
                    isActive('/pakete-leistungen')
                      ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-slate-700'
                      : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors'
                  }
                >
                  <Package className={`w-4 h-4 shrink-0 ${isActive('/pakete-leistungen') ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>Pakete &amp; Leistungen</span>
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User section — eine Zeile wie Variante A */}
      <div className="px-3 py-3 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
            {getInitials(user?.name || user?.email || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || 'Benutzer'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {ROLE_LABELS[user?.role] || 'Benutzer'}
            </p>
          </div>
          <button
            onClick={logout}
            title="Abmelden"
            aria-label="Abmelden"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

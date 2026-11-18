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
  GitBranch,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getUser, logout } from '@/lib/auth'
import { getInitials } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'
import { isPathHidden, CRM_PROFILE_EVENT } from '@/lib/crmProfile'
import PonturoLogo from './PonturoLogo'

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
  '/team':             'projects',
  '/tasks':            'tasks',
  '/timesheets':       'timesheets',
  '/key-accounts':     'key_accounts',
  '/cross-selling':    'cross_selling',
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
  // Akquise — granulare Schlüssel; Fallback auf 'acquisition_targets'
  '/akquise':   'acquisition_targets',
  '/akquise/dashboard':  'acquisition_dashboard',
  '/akquise/import':     'acquisition_import',
  '/akquise/blocklist':  'acquisition_blocklist',
  '/akquise/activities': 'acquisition_activities',
  '/akquise/offers':     'acquisition_offers',
  '/akquise/outreach':   'acquisition_outreach',
  '/akquise/reporting':  'acquisition_reporting',
  '/akquise/market':     'acquisition_market',
  '/akquise/capacity':   'acquisition_capacity',
  '/akquise/bafa':       'acquisition_bafa',
  '/akquise/contacts':   'acquisition_contacts',
  '/akquise/settings':   'acquisition_settings',
}

// Gemeinsame Seiten (Aktivitäten/Aufgaben/Dokumente) sind jetzt EINE Seite mit
// Akquise-Filter. Rollen mit reinen Akquise-Rechten sollen sie weiterhin sehen.
const FEATURE_ALT_GATES = {
  '/activities': 'acquisition_activities',
  '/tasks':      'acquisition_targets',
  '/documents':  'acquisition_targets',
  '/contacts':   'acquisition_contacts',
  '/proposals':  'acquisition_offers',
}

// Übergangs-Fallback: bis die Portal-Rechte vollständig umgestellt sind, gilt
// ein altes sprint_*-Recht weiter (verhindert Aussperrung bei halbem Deploy).
function legacyAcquisitionKey(key) {
  if (!key) return null
  return key.startsWith('acquisition_') ? key.replace(/^acquisition_/, 'sprint_') : null
}

const ROLE_LABELS = {
  admin: 'Administrator',
  consultant: 'Berater',
  manager: 'Manager',
  viewer: 'Betrachter',
}

function featureKeyFor(href) {
  if (FEATURE_GATES[href]) return FEATURE_GATES[href]
  if (href.startsWith('/akquise')) return 'acquisition_targets'
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
      { label: 'Zielkunden',    href: '/akquise',            icon: Crosshair },
      { label: 'Outreach',      href: '/akquise/outreach',   icon: Send },
      { label: 'Förderungen',   href: '/akquise/bafa',       icon: Banknote },
      { label: 'Listen-Import', href: '/akquise/import',     icon: Upload },
      { label: 'Sperrliste',    href: '/akquise/blocklist',  icon: ShieldAlert },
    ],
  },
  {
    label: 'Akquise-Planung',
    items: [
      { label: 'Marktauswahl', href: '/akquise/market',    icon: MapPin },
      { label: 'Planung',      href: '/akquise/capacity',  icon: CalendarClock },
      { label: 'Reporting',    href: '/akquise/reporting', icon: BarChart3 },
      { label: 'Akquise-Workflows', href: '/akquise/workflows', icon: GitBranch, adminOnly: true },
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
      { label: 'Team',          href: '/team',       icon: Users },
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

export default function Sidebar({ collapsed = false, onToggleCollapsed }) {
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

  const AKQUISE_SUBPAGES = new Set([
    'dashboard', 'me', 'import', 'blocklist', 'activities', 'offers',
    'outreach', 'team', 'reporting', 'market', 'capacity', 'bafa', 'settings', 'contacts',
    'tasks', 'documents', 'workflows',
  ])

  function isActive(href) {
    if (href === '/') return pathname === '/'
    if (href === '/akquise') {
      if (pathname === href) return true
      // Detailseiten (/akquise/<id>, /akquise/<id>/prozess) gehören zu Zielkunden
      const segment = pathname.split('/')[2]
      return Boolean(segment) && !AKQUISE_SUBPAGES.has(segment)
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  function isVisible(item) {
    // CRM-Profil schneidet Module nur aus der Navigation – vor allen anderen Regeln.
    // Erst nach dem Mount lesen, damit Server- und Client-Render übereinstimmen.
    if (profileReady && isPathHidden(item.href)) return false
    if (item.alwaysShow) return true
    if (item.adminOnly && !isAdmin) return false
    if (isAdmin) return true  // legacy admin sees everything
    const featureKey = featureKeyFor(item.href)
    if (!featureKey) return true
    if (permsLoading) return false
    if (can(featureKey)) return true
    const legacyKey = legacyAcquisitionKey(featureKey)
    if (legacyKey && can(legacyKey)) return true
    // Gemeinsame Seiten: Akquise-Rollen behalten Zugriff über ihr Akquise-Recht.
    const altKey = FEATURE_ALT_GATES[item.href]
    if (altKey && can(altKey)) return true
    if (altKey && can(legacyAcquisitionKey(altKey))) return true
    // Fallback: Rollen ohne granulare Rechte behalten den Zugriff über das
    // Sammelrecht 'acquisition_targets' (bzw. das alte 'sprint_targets').
    if ((featureKey.startsWith('acquisition_') || altKey) && !hasGranularAcquisition) {
      if (can('acquisition_targets') || can('sprint_targets')) return true
    }
    return false
  }

  const hasGranularAcquisition = Object.keys(perms || {}).some(
    (key) =>
      (key.startsWith('acquisition_') || key.startsWith('sprint_')) &&
      key !== 'acquisition_targets' && key !== 'sprint_targets' &&
      perms[key]?.canView
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
    <aside className={`flex flex-col ${collapsed ? 'w-[76px]' : 'w-[248px]'} h-screen bg-slate-900 border-r border-slate-800 overflow-y-auto overflow-x-hidden transition-[width] duration-200 shrink-0`}>
      {/* Logo / Brand + Einklappen */}
      <div className={`flex items-center h-[62px] border-b border-slate-800 shrink-0 ${collapsed ? 'justify-between gap-1 px-1.5' : 'justify-between gap-3 px-4'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <PonturoLogo className="w-8 h-8" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-tight truncate">CRM</p>
              <p className="text-slate-400 text-xs truncate">Consulting Business Suite</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          className="flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-3.5 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[9px] font-bold text-slate-500 uppercase tracking-[0.09em]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={
                        active
                          ? `flex items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-white bg-slate-700 ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                          : `flex items-center gap-2.5 rounded-lg text-[12.5px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                      }
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
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
            {!collapsed && (
              <p className="px-2 mb-1 text-[9px] font-bold text-slate-500 uppercase tracking-[0.09em]">
                Admin
              </p>
            )}
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/admin"
                  title={collapsed ? 'Benutzerverwaltung' : undefined}
                  aria-label="Benutzerverwaltung"
                  className={
                    isActive('/admin')
                      ? `flex items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-white bg-slate-700 ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                      : `flex items-center gap-2.5 rounded-lg text-[12.5px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                  }
                >
                  <UserCog className={`w-4 h-4 shrink-0 ${isActive('/admin') ? 'text-blue-400' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">Benutzerverwaltung</span>}
                </Link>
              </li>
              <li>
                <Link
                  href="/crm-profil"
                  title={collapsed ? 'CRM-Profil' : undefined}
                  aria-label="CRM-Profil"
                  className={
                    isActive('/crm-profil')
                      ? `flex items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-white bg-slate-700 ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                      : `flex items-center gap-2.5 rounded-lg text-[12.5px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                  }
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${isActive('/crm-profil') ? 'text-blue-400' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">CRM-Profil</span>}
                </Link>
              </li>
              <li>
                <Link
                  href="/pakete-leistungen"
                  title={collapsed ? 'Pakete & Leistungen' : undefined}
                  aria-label="Pakete & Leistungen"
                  className={
                    isActive('/pakete-leistungen')
                      ? `flex items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-white bg-slate-700 ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                      : `flex items-center gap-2.5 rounded-lg text-[12.5px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center px-2 py-2' : 'px-2 py-1.5'}`
                  }
                >
                  <Package className={`w-4 h-4 shrink-0 ${isActive('/pakete-leistungen') ? 'text-blue-400' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">Pakete &amp; Leistungen</span>}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User section — eine Zeile wie Variante A */}
      <div className={`py-3 border-t border-slate-800 shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className={`flex items-center rounded-lg ${collapsed ? 'flex-col gap-2 px-1 py-1.5' : 'gap-2.5 px-2 py-1.5'}`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0" title={user?.name || user?.email || 'Benutzer'}>
            {getInitials(user?.name || user?.email || 'U')}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'Benutzer'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {ROLE_LABELS[user?.role] || 'Benutzer'}
              </p>
            </div>
          )}
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

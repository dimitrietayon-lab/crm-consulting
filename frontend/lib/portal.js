export const PORTALS = {
  crm: {
    id: 'crm',
    name: 'Ponturo CRM',
    shortName: 'CRM',
    subtitle: 'Consulting Business Suite',
    home: '/',
  },
  sprint: {
    id: 'sprint',
    name: 'KI-Readiness Sprint',
    shortName: 'KI-Readiness',
    subtitle: 'Sprint CRM',
    home: '/sprint-targets/dashboard',
  },
}

const STORAGE_KEY = 'crm_portal'

// Sprint-only paths force the sprint portal; the CRM start pages force CRM.
// Shared base routes (e.g. /contacts) keep the last selected portal.
export function portalForPath(pathname = '') {
  if (pathname.startsWith('/sprint-targets')) return 'sprint'
  if (pathname === '/' || pathname === '/crm-profil') return 'crm'
  return null
}

export function getStoredPortal() {
  if (typeof window === 'undefined') return 'crm'
  return window.localStorage.getItem(STORAGE_KEY) === 'sprint' ? 'sprint' : 'crm'
}

export function setStoredPortal(id) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, id === 'sprint' ? 'sprint' : 'crm')
}

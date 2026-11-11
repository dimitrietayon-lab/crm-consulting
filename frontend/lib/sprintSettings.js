import api from './api'

export const SPRINT_DEFAULTS = {
  linkedinQuota: 75,
  callsQuota: 100,
  hoursPerWeek: 8.4,
  offerValidityDays: 21,
  targetFirms: 878,
  teamCapacity: 10,
  revenueTarget: 500000,
  sprintName: 'Akquise',
  sprintStart: null,
  sprintEnd: null,
  packages: null,
  segments: null,
  notifications: null,
  bafaParams: null,
  linkedin: null,
}

const STORAGE_KEY = 'sprint_settings'

// In-Memory-Cache der Server-Einstellungen. Die synchrone API bleibt erhalten,
// damit bestehende Aufrufer unverändert funktionieren.
let cache = null

function readLocal() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getSprintSettings() {
  if (cache) return { ...SPRINT_DEFAULTS, ...cache }
  const local = readLocal()
  return local ? { ...SPRINT_DEFAULTS, ...local } : { ...SPRINT_DEFAULTS }
}

// Holt die Einstellungen einmalig vom Server (Aufruf im geschützten Layout).
export async function primeSprintSettings() {
  try {
    const data = await api.get('/sprint-settings')
    if (data && typeof data === 'object') {
      cache = data
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      }
      return { ...SPRINT_DEFAULTS, ...data }
    }
  } catch {
    // Server nicht erreichbar → Fallback auf Cache/localStorage
  }
  return getSprintSettings()
}

// Synchroner Setter: aktualisiert Cache + localStorage und persistiert asynchron.
export function saveSprintSettings(patch) {
  const next = { ...getSprintSettings(), ...patch }
  cache = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  api.put('/sprint-settings', next).catch(() => {})
  return next
}

// Für die Einstellungsseite: Serverstand erneut laden.
export async function refreshSprintSettings() {
  cache = null
  return primeSprintSettings()
}

// CRM-Profil: schneidet die Navigation auf den CRM-Kern zu.
// Ausgeblendete Module bleiben technisch vorhanden – nur die Navigation,
// die Startseite und einzelne Dashboard-Widgets blenden sie aus.

const STORAGE_KEY = 'crm_profile'
export const CRM_PROFILE_EVENT = 'crm-profile-changed'

// Die 12 Module, die im CRM-Profil standardmäßig ausgeblendet sind.
export const CRM_HIDDEN_MODULES = [
  { key: 'expenses',          label: 'Reisekosten',         group: 'Fi & Co',         route: '/expenses',          reason: 'Reisekostenabrechnung – kein Kundendialog' },
  { key: 'material_costs',    label: 'Materialkosten',      group: 'Fi & Co',         route: '/material-costs',    reason: 'Beschaffung – kein Kundendialog' },
  { key: 'invoices',          label: 'Ausgangsrechnungen',  group: 'Fi & Co',         route: '/invoices',          reason: 'Rechnungsstellung – Aufgabe der FiBu' },
  { key: 'incoming_invoices', label: 'Eingangsrechnungen',  group: 'Fi & Co',         route: '/incoming-invoices', reason: 'Kreditorenbuchhaltung' },
  { key: 'buchhaltung',       label: 'Buchhaltung',         group: 'Buchhaltung',     route: '/buchhaltung',       reason: 'Eigenes Finanzmodul' },
  { key: 'finanzplanung',     label: 'Finanzplanung',       group: 'Buchhaltung',     route: '/finanzplanung',     reason: 'FP&A – nicht kundenbezogen' },
  { key: 'leave',             label: 'Abwesenheiten',       group: 'Personal',        route: '/leave',             reason: 'HR-Prozess' },
  { key: 'lohnverwaltung',    label: 'Lohnverwaltung',      group: 'Personal',        route: '/lohnverwaltung',    reason: 'Payroll – HR-System' },
  { key: 'timesheets',        label: 'Zeiterfassung',       group: 'PMO',             route: '/timesheets',        reason: 'Abrechnung/PM – nicht im CRM-Profil' },
  { key: 'mein-bereich',      label: 'Mein Bereich',        group: 'Portal',          route: '/mein-bereich',      reason: 'Persönliche Übersicht ohne Kundenbezug' },
  { key: 'skills',            label: 'Skill-Matching',      group: 'KI & Analyse',    route: '/skills',            reason: 'Resourcenplanung, nicht Vertrieb' },
  { key: 'workflows',         label: 'Workflows',           group: 'Automatisierung', route: '/workflows',         reason: 'Technische Automatisierung' },
]

export const CRM_HIDDEN_KEYS = CRM_HIDDEN_MODULES.map((m) => m.key)

// Pfad → Profil-Schlüssel (für die Navigation)
export const CRM_PATH_KEYS = CRM_HIDDEN_MODULES.reduce((acc, m) => {
  acc[m.route] = m.key
  return acc
}, {})

function read() {
  if (typeof window === 'undefined') return [...CRM_HIDDEN_KEYS]
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...CRM_HIDDEN_KEYS]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.hidden) ? parsed.hidden : [...CRM_HIDDEN_KEYS]
  } catch {
    return [...CRM_HIDDEN_KEYS]
  }
}

export function getHiddenModules() {
  return read()
}

export function isModuleHidden(key) {
  if (!key) return false
  return read().includes(key)
}

export function isPathHidden(pathname) {
  const key = CRM_PATH_KEYS[pathname]
  return key ? isModuleHidden(key) : false
}

export function setHiddenModules(hidden) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hidden }))
  window.dispatchEvent(new Event(CRM_PROFILE_EVENT))
}

export function resetCrmProfile() {
  setHiddenModules(CRM_HIDDEN_KEYS)
}

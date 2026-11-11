export const TEAM_ROLES = [
  { key: 'lead', label: 'Lead Berater' },
  { key: 'ki', label: 'KI-Experte' },
  { key: 'sales', label: 'Vertrieb' },
]

// Zuweisungen eines Zielkunden je Rolle (Mehrfachzuweisung möglich)
export function assignmentsForRole(target, roleKey) {
  return (target?.assignments || []).filter((a) => a.role === roleKey)
}

// Effektiver Rollenbedarf eines Zielkunden:
// kundenspezifisch (roleRequirements) → sonst aus dem Paket → sonst alle Rollen
export function requiredRolesFor(target, roles, packageRoles = []) {
  const order = roles.map((r) => r.key)
  const label = (role) => roles.find((r) => r.key === role)?.label || role

  const explicit = (target?.roleRequirements || []).filter((r) => order.includes(r.role))
  const fromPackage = (packageRoles || []).filter(
    (r) => r.package === target?.package && order.includes(r.role)
  )
  const source = explicit.length
    ? explicit
    : fromPackage.length
      ? fromPackage
      : order.map((role) => ({ role, headcount: 1 }))

  return source
    .map((r) => ({ role: r.role, headcount: r.headcount || 1, label: label(r.role) }))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
}

// Basis-Rollen mit Bezeichnung aus der Rollenverwaltung (PortalRole) + freie,
// admin-definierte Rollen aus den Paketen.
export function resolveRoles(apiRoles) {
  const list = Array.isArray(apiRoles) ? apiRoles : []
  const base = TEAM_ROLES.map((r) => {
    const found = list.find((x) => x.key === r.key)
    return found?.label ? { ...r, label: found.label } : r
  })
  const custom = list
    .filter((x) => x && x.key && !TEAM_ROLES.some((b) => b.key === x.key))
    .map((x) => ({ key: x.key, label: x.label || x.key }))
  return [...base, ...custom]
}

export { STATUS_BADGE } from './sprintOptions'

export const PRIORITY_LABEL = { '1': 'Hoch', '2': 'Mittel', '3': 'Niedrig' }
export const PRIORITY_DOT = { '1': 'bg-red-500', '2': 'bg-yellow-500', '3': 'bg-gray-400' }

const COLORS = ['#7c3aed', '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#f43f5e', '#0891b2']

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function colorFor(id) {
  let sum = 0
  for (const ch of String(id || '')) sum += ch.charCodeAt(0)
  return COLORS[sum % COLORS.length]
}

export function utilState(util) {
  if (util > 100) return { label: 'Überlastet', bar: 'bg-red-500', text: 'text-red-600' }
  if (util >= 85) return { label: 'Fast ausgelastet', bar: 'bg-amber-500', text: 'text-amber-600' }
  return { label: 'Verfügbar', bar: 'bg-green-500', text: 'text-green-600' }
}

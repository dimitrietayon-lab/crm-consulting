// Auswertung der Exit-Kriterien eines Akquise-Schritts.
// Auto-Kriterien (`auto`) werden aus Zielkunde/Aktivitäten abgeleitet,
// alle übrigen werden manuell abgehakt (JSON `stepChecks` am Zielkunden).

export function autoExitMet(criterion, { target, activities, pendingActivityType }) {
  const auto = criterion?.auto
  if (!auto) return false
  const idx = auto.indexOf(':')
  const kind = idx >= 0 ? auto.slice(0, idx) : auto
  const key = idx >= 0 ? auto.slice(idx + 1) : ''

  if (kind === 'field') {
    const v = target?.[key]
    return v !== null && v !== undefined && v !== ''
  }
  if (kind === 'num') {
    const n = Number(target?.[key])
    return Number.isFinite(n) && n > 0
  }
  if (kind === 'activity') {
    if (pendingActivityType && pendingActivityType === key) return true
    return (activities || []).some((a) => a.type === key)
  }
  return false
}

export function exitState(step, { target, activities, checks, pendingActivityType }) {
  const list = Array.isArray(step?.exitCriteria) ? step.exitCriteria : []
  const statusChecks = (checks && checks[step?.status]) || {}
  const items = list.map((c) => {
    const auto = !!c.auto
    const met = auto
      ? autoExitMet(c, { target, activities, pendingActivityType })
      : statusChecks[c.k] === true
    return { ...c, auto, met }
  })
  const met = items.filter((i) => i.met).length
  return { items, met, total: items.length, complete: items.length === 0 || met === items.length }
}

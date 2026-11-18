// Zentrale Auswahllisten für den KI-Readiness-Sprint (Feedback 01.11.2026).
// Eine Quelle für Neuer-Zielkunde, Detailseite, Filter, Listen und Import.

// Einheitliche Branchenliste (CRM-Anzeige)
export const BRANCHEN = [
  'Banken',
  'Bau & Immobilien',
  'Bildung, Sport & Kultur',
  'Energie, Wasser & Entsorgung',
  'Gesundheit & Soziales',
  'Handel & Logistik',
  'Ingenieur- & Architekturbüros',
  'IT & Telekommunikation',
  'Marketing & Medien',
  'Maschinenbau & Elektro',
  'Personaldienstleister',
  'Rechts- & Steuerberatung, WP',
  'Übrige Industrie',
  'Versicherungen & Finanzvermittler',
  'Sonstige',
]

export const CONTACT_SOURCES = [
  'Bestandskunde',
  'Empfehlung',
  'Kaltakquise',
  'LinkedIn',
  'Messe / Event',
  'Netzwerk',
  'Recherche',
  'Selbsttest',
  'Vortrag',
  'Webinar',
  'Webseite-Anfrage',
  'Sonstiges',
]

// Weg der Datenschutz-Hinweise / Einwilligung
export const CONSENT_SOURCES = ['Website', 'Selbsttest', 'E-Mail', 'Gespräch', 'LinkedIn']

// Anlass für den telefonischen Erstkontakt im B2B (§ 7 UWG)
export const CALL_TRIGGERS = [
  'Neueinstellung / Stellenausschreibung',
  'Expansion / neuer Standort',
  'Messe- oder Veranstaltungsauftritt',
  'Pressemeldung / Medienbericht',
  'Neues Produkt / neue Leistung',
  'Umzug / Neubau',
  'Fusion / Übernahme',
  'Förderprogramm / Zuschuss',
  'Gesetzesänderung / Regulatorik',
  'Empfehlung / Kontakt über Dritte',
  'Sonstiges',
]

export const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
]

// Kanonisches Phasenmodell: jede Phase hat ihre eigenen Statuswerte.
// Die Abfolge ist zugleich die Sortier- und Stepper-Reihenfolge.
export const SPRINT_PHASES = [
  {
    key: 'lead',
    label: 'Lead-Gewinnung',
    statuses: ['offen', 'recherchiert', 'vernetzt', 'kontaktiert'],
  },
  {
    key: 'qualifizierung',
    label: 'Qualifizierung',
    statuses: ['Qualifizierungsgespräch', 'Qualifizierungsgespräch durchgeführt', 'Übergabe an Engagement Manager'],
  },
  {
    key: 'erstgespraech',
    label: 'Erstgespräch',
    statuses: ['Erstgespräch terminiert', 'Erstgespräch durchgeführt', 'Fragebogen geschickt'],
  },
  {
    key: 'angebot',
    label: 'Angebot',
    statuses: ['Angebot in Vorbereitung', 'Angebot versendet', 'Nachverhandlung'],
  },
  {
    key: 'abschluss',
    label: 'Abschluss',
    statuses: ['gewonnen', 'Folgeprojekt', 'Verlust', 'kein Interesse'],
  },
]

export const SPRINT_STATUSES = SPRINT_PHASES.flatMap((phase) => phase.statuses)

export const phaseForStatus = (status) =>
  SPRINT_PHASES.find((phase) => phase.statuses.includes(status)) || null

// Anzeige-Kurzformen für lange Statuswerte
export const STATUS_LABELS = {
  'Qualifizierungsgespräch': 'Qualifizierungsgespräch planen',
  'Übergabe an Engagement Manager': 'Übergabe an EM',
  'Erstgespräch terminiert': 'Erstgespräch geplant',
}

export const statusLabel = (status) => STATUS_LABELS[status] || status

// Linearer Ablauf ohne Abschluss-Verzweigungen (Verlust/kein Interesse/Folgeprojekt).
// Grundlage für Fortschrittsbalken in PhaseFlow und Zielkunden-Detailseite.
export const SPRINT_FLOW = SPRINT_PHASES
  .flatMap((phase) => phase.statuses)
  .filter((s) => !['Verlust', 'kein Interesse', 'Folgeprojekt'].includes(s))

// Fortschritt in Prozent entlang des linearen Ablaufs (0–100)
export function processProgress(status) {
  if (!status) return 0
  if (status === 'gewonnen') return 100
  if (['Verlust', 'kein Interesse', 'Folgeprojekt'].includes(status)) return 100
  const i = SPRINT_FLOW.indexOf(status)
  if (i < 0) return 0
  return SPRINT_FLOW.length > 1 ? Math.round((i / (SPRINT_FLOW.length - 1)) * 100) : 0
}

export const ACTIVE_STATUSES = [
  'Qualifizierungsgespräch',
  'Qualifizierungsgespräch durchgeführt',
  'Übergabe an Engagement Manager',
  'Erstgespräch terminiert',
  'Erstgespräch durchgeführt',
  'Fragebogen geschickt',
  'Angebot in Vorbereitung',
  'Angebot versendet',
  'Nachverhandlung',
]
// „Im Gespräch“ = Qualifizierung + Erstgespräch (ohne Angebotsphase)
export const IN_TALK_STATUSES = [
  'Qualifizierungsgespräch',
  'Qualifizierungsgespräch durchgeführt',
  'Übergabe an Engagement Manager',
  'Erstgespräch terminiert',
  'Erstgespräch durchgeführt',
  'Fragebogen geschickt',
]
// Angebote, die beim Kunden liegen
export const OFFER_SENT_STATUSES = ['Angebot versendet', 'Nachverhandlung']
export const OFFER_STATUSES = ['Angebot in Vorbereitung', ...OFFER_SENT_STATUSES]
export const WON_STATUSES = ['gewonnen', 'Folgeprojekt']
export const LOST_STATUSES = ['Verlust', 'kein Interesse']
export const EARLY_STATUSES = ['offen', 'recherchiert', 'vernetzt', 'kontaktiert']

export const isLostStatus = (status) => LOST_STATUSES.includes(status)

// ─── Prozess-Freischaltung (streng sequenziell) ──────────────────────────────
// Die Status einer Phase müssen in der definierten Reihenfolge durchlaufen
// werden (z. B. Erstgespräch geplant → durchgeführt → Fragebogen geschickt).
// Vorwärts ist nur der unmittelbar nächste Status erlaubt; die nächste Phase
// öffnet sich ausschließlich über ihren ersten Status und erst am Ende der
// aktuellen Phase. Rückschritte sind immer möglich, Verlust-Status ebenfalls.
export const WILDCARD_STATUSES = ['Verlust', 'kein Interesse']

// Einzige erlaubte Abkürzung: „Qualifizieren & übergeben“ führt aus der
// Lead-Phase direkt zur Übergabe an den Engagement Manager.
export const EXTRA_STATUS_TRANSITIONS = [
  'kontaktiert→Übergabe an Engagement Manager',
]

export function phaseIndexForStatus(status) {
  return SPRINT_PHASES.findIndex((p) => p.statuses.includes(status))
}

export function isStatusSelectable(currentStatus, targetStatus) {
  if (!targetStatus || !SPRINT_STATUSES.includes(targetStatus)) return false
  if (targetStatus === currentStatus) return true
  if (WILDCARD_STATUSES.includes(targetStatus)) return true
  if (EXTRA_STATUS_TRANSITIONS.includes(`${currentStatus}→${targetStatus}`)) return true
  const ci = phaseIndexForStatus(currentStatus)
  const ni = phaseIndexForStatus(targetStatus)
  if (ni < 0) return false
  if (ci < 0) return ni === 0
  if (ni < ci) return true // Rückschritt in eine frühere Phase
  if (ni === ci) {
    const list = SPRINT_PHASES[ci].statuses
    const curIdx = list.indexOf(currentStatus)
    const nextIdx = list.indexOf(targetStatus)
    return nextIdx <= curIdx || nextIdx === curIdx + 1
  }
  const currentPhase = SPRINT_PHASES[ci]
  const atPhaseEnd = currentStatus === currentPhase.statuses[currentPhase.statuses.length - 1]
  if (!(ni === ci + 1 && atPhaseEnd)) return false
  // Abschlussphase: alle Ausgänge (gewonnen/Folgeprojekt/…) wählbar,
  // Zwischenphasen: Einstieg nur über ihren ersten Status.
  if (ni === SPRINT_PHASES.length - 1) return true
  return SPRINT_PHASES[ni].statuses[0] === targetStatus
}

export function isPhaseUnlocked(currentStatus, phaseKey) {
  const ti = SPRINT_PHASES.findIndex((p) => p.key === phaseKey)
  if (ti < 0) return false
  const ci = phaseIndexForStatus(currentStatus)
  if (ci < 0) return ti === 0
  if (ti <= ci) return true
  const currentPhase = SPRINT_PHASES[ci]
  const atPhaseEnd = currentStatus === currentPhase.statuses[currentPhase.statuses.length - 1]
  return ti === ci + 1 && atPhaseEnd
}

// Kanban-Spaltenstile
export const STATUS_STYLES = {
  'offen':                   { header: 'bg-slate-600 text-white',  badge: 'bg-slate-500',  border: 'border-slate-200' },
  'recherchiert':            { header: 'bg-gray-600 text-white',   badge: 'bg-gray-500',   border: 'border-gray-200' },
  'vernetzt':                { header: 'bg-blue-600 text-white',   badge: 'bg-blue-500',   border: 'border-blue-200' },
  'kontaktiert':             { header: 'bg-indigo-600 text-white', badge: 'bg-indigo-500', border: 'border-indigo-200' },
  'Qualifizierungsgespräch': { header: 'bg-yellow-500 text-white', badge: 'bg-yellow-400', border: 'border-yellow-200' },
  'Qualifizierungsgespräch durchgeführt': { header: 'bg-yellow-700 text-white', badge: 'bg-yellow-600', border: 'border-yellow-200' },
  'Übergabe an Engagement Manager': { header: 'bg-amber-600 text-white', badge: 'bg-amber-500', border: 'border-amber-200' },
  'Erstgespräch terminiert':  { header: 'bg-teal-500 text-white',  badge: 'bg-teal-400',   border: 'border-teal-200' },
  'Erstgespräch durchgeführt':{ header: 'bg-teal-700 text-white',  badge: 'bg-teal-600',   border: 'border-teal-200' },
  'Fragebogen geschickt':     { header: 'bg-cyan-600 text-white',  badge: 'bg-cyan-500',   border: 'border-cyan-200' },
  'Angebot in Vorbereitung':  { header: 'bg-violet-500 text-white', badge: 'bg-violet-400', border: 'border-violet-200' },
  'Angebot versendet':        { header: 'bg-violet-700 text-white', badge: 'bg-violet-600', border: 'border-violet-200' },
  'Nachverhandlung':          { header: 'bg-purple-700 text-white', badge: 'bg-purple-600', border: 'border-purple-200' },
  'gewonnen':                { header: 'bg-green-600 text-white',  badge: 'bg-green-500',  border: 'border-green-200' },
  'Folgeprojekt':            { header: 'bg-emerald-600 text-white', badge: 'bg-emerald-500', border: 'border-emerald-200' },
  'Verlust':                 { header: 'bg-rose-700 text-white',   badge: 'bg-rose-600',   border: 'border-rose-200' },
  'kein Interesse':          { header: 'bg-red-600 text-white',    badge: 'bg-red-500',    border: 'border-red-200' },
}

// Phasenband über den Kanban-Spalten
export const PHASE_STYLES = {
  lead:           'bg-slate-100 text-slate-600 border-slate-200',
  qualifizierung: 'bg-amber-50 text-amber-700 border-amber-200',
  erstgespraech:  'bg-teal-50 text-teal-700 border-teal-200',
  angebot:        'bg-violet-50 text-violet-700 border-violet-200',
  abschluss:      'bg-green-50 text-green-700 border-green-200',
}

// Badge-Klassen (Tailwind) für Tabellen und Detailansichten
export const STATUS_BADGE = {
  'offen':                   'bg-slate-100 text-slate-700 border-slate-200',
  'recherchiert':            'bg-gray-100 text-gray-700 border-gray-200',
  'vernetzt':                'bg-blue-100 text-blue-700 border-blue-200',
  'kontaktiert':             'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Qualifizierungsgespräch': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Qualifizierungsgespräch durchgeführt': 'bg-yellow-200 text-yellow-800 border-yellow-300',
  'Übergabe an Engagement Manager': 'bg-amber-100 text-amber-700 border-amber-200',
  'Erstgespräch terminiert':   'bg-teal-50 text-teal-700 border-teal-200',
  'Erstgespräch durchgeführt': 'bg-teal-100 text-teal-800 border-teal-200',
  'Fragebogen geschickt':      'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Angebot in Vorbereitung':   'bg-violet-50 text-violet-700 border-violet-200',
  'Angebot versendet':         'bg-violet-100 text-violet-800 border-violet-200',
  'Nachverhandlung':           'bg-purple-100 text-purple-700 border-purple-200',
  'gewonnen':                'bg-green-100 text-green-700 border-green-200',
  'Folgeprojekt':            'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Verlust':                 'bg-rose-100 text-rose-700 border-rose-200',
  'kein Interesse':          'bg-red-100 text-red-700 border-red-200',
}

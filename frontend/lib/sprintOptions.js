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
    statuses: ['Qualifizierungsgespräch', 'Übergabe an Engagement Manager'],
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
  'Übergabe an Engagement Manager': 'Übergabe an EM',
}

export const statusLabel = (status) => STATUS_LABELS[status] || status

export const ACTIVE_STATUSES = [
  'Qualifizierungsgespräch',
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

// Kanban-Spaltenstile
export const STATUS_STYLES = {
  'offen':                   { header: 'bg-slate-600 text-white',  badge: 'bg-slate-500',  border: 'border-slate-200' },
  'recherchiert':            { header: 'bg-gray-600 text-white',   badge: 'bg-gray-500',   border: 'border-gray-200' },
  'vernetzt':                { header: 'bg-blue-600 text-white',   badge: 'bg-blue-500',   border: 'border-blue-200' },
  'kontaktiert':             { header: 'bg-indigo-600 text-white', badge: 'bg-indigo-500', border: 'border-indigo-200' },
  'Qualifizierungsgespräch': { header: 'bg-yellow-500 text-white', badge: 'bg-yellow-400', border: 'border-yellow-200' },
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

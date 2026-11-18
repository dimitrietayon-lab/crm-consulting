// Kanonische Akquise-Pipeline (Frontend-Fallback).
// Muss inhaltlich mit backend/prisma/pipeline-data.js übereinstimmen.
// Wird nur genutzt, wenn GET /api/acquisition-pipeline (noch) nichts liefert.

export const PIPELINE = {
  id: 'acq-pipeline-main',
  key: 'default',
  name: 'Akquise-Pipeline',
  description: 'Standard-Akquise-Workflow',
  active: true,
  isDefault: true,
}

export const STAGES = [
  { id: 'acq-stage-lead', key: 'lead', label: 'Lead-Gewinnung', order: 1 },
  { id: 'acq-stage-qualifizierung', key: 'qualifizierung', label: 'Qualifizierung', order: 2 },
  { id: 'acq-stage-erstgespraech', key: 'erstgespraech', label: 'Erstgespräch', order: 3 },
  { id: 'acq-stage-angebot', key: 'angebot', label: 'Angebot', order: 4 },
  { id: 'acq-stage-abschluss', key: 'abschluss', label: 'Abschluss', order: 5 },
]

export const LOSS_REASONS = ['Preis', 'Kein Bedarf', 'Wettbewerb', 'Timing', 'Budget', 'Sonstiges']

const STEP_DEFAULTS = {
  shortLabel: null,
  requiredFields: [],
  isClosing: false,
  outcome: null,
  isWildcard: false,
  isInTalk: false,
  isOffer: false,
  isOfferSent: false,
  isWon: false,
  isLost: false,
  isEarly: false,
  active: true,
}

// Leitfäden und Exit-Kriterien je Schritt (Spiegel von backend/prisma/pipeline-data.js).
const STEP_GUIDE = {
  'offen': {
    guide: ['Unternehmen und Anlass erfassen', 'Branche und Region prüfen', 'Ansprechpartner-Rolle festlegen'],
    exit: [{ k: 'created', t: 'Firma, Branche und Region erfasst', auto: 'field:companyName' }, { k: 'role', t: 'Ansprechpartner-Rolle benannt' }],
  },
  'recherchiert': {
    guide: ['KI-Recherche starten', 'KI-Initiativen und Schmerzpunkte sammeln', 'Entscheider-Rollen eingrenzen'],
    exit: [{ k: 'data', t: 'Branche und Mitarbeiterzahl erfasst', auto: 'num:numberOfEmployees' }, { k: 'pain', t: 'Schmerz-Hypothese notiert' }],
  },
  'vernetzt': {
    guide: ['Warmen Weg prüfen (Empfehlung, Event)', 'LinkedIn-Profil verifizieren', 'Kontaktanfrage senden'],
    exit: [{ k: 'person', t: 'Ansprechpartner identifiziert', auto: 'field:contactName' }, { k: 'way', t: 'Kontaktweg dokumentiert' }],
  },
  'kontaktiert': {
    guide: ['Anlass und Rechtsgrundlage klären (§ 7 UWG)', 'Genau einen Kanal pro Versuch nutzen', 'Ergebnis festhalten'],
    exit: [{ k: 'legal', t: 'Anruf-Trigger oder Einwilligung dokumentiert', auto: 'field:callTrigger' }, { k: 'contact', t: 'Kontakt-Aktivität mit Ergebnis', auto: 'activity:Call' }, { k: 'next', t: 'Nächster Schritt mit Datum gesetzt' }],
  },
  'Qualifizierungsgespräch': {
    guide: ['Teilnehmer und Agenda abstimmen', 'Termin im Kalender festhalten', 'Unterlagen vorbereiten'],
    exit: [{ k: 'date', t: 'Termin gesetzt', auto: 'field:firstMeetingDate' }, { k: 'attendees', t: 'Teilnehmer bestätigt' }],
  },
  'Qualifizierungsgespräch durchgeführt': {
    guide: ['Bedarf, Budget und Zeitrahmen klären', 'Entscheiderstruktur erfassen', 'Gesprächsnotiz festhalten'],
    exit: [{ k: 'date', t: 'Gesprächsdatum erfasst', auto: 'field:firstMeetingDate' }, { k: 'scope', t: 'Bedarf und Budget dokumentiert' }, { k: 'next', t: 'Nächster Schritt oder Übergabe vorbereitet' }],
  },
  'Übergabe an Engagement Manager': {
    guide: ['Kontext und Erkenntnisse zusammenfassen', 'Nächste Schritte mit dem EM abstimmen', 'Übergabeprotokoll anlegen'],
    exit: [{ k: 'done', t: 'Übergabe dokumentiert', auto: 'field:handoverDate' }, { k: 'em', t: 'EM bestätigt' }],
  },
  'Erstgespräch terminiert': {
    guide: ['Termin mit Kunde abstimmen', 'Teilnehmer festlegen', 'Agenda senden'],
    exit: [{ k: 'date', t: 'Termin gesetzt', auto: 'field:firstMeetingDate' }, { k: 'invite', t: 'Einladung verschickt' }],
  },
  'Erstgespräch durchgeführt': {
    guide: ['Ist-Situation aufnehmen', 'Readiness-Fragebogen ankündigen', 'Ergebnis festhalten'],
    exit: [{ k: 'held', t: 'Termin wahrgenommen', auto: 'activity:Meeting' }, { k: 'questionnaire', t: 'Fragebogen angekündigt' }],
  },
  'Fragebogen geschickt': {
    guide: ['Fragebogen personalisieren', 'Link senden', 'Rücklauf nachhalten'],
    exit: [{ k: 'sent', t: 'Fragebogen versendet', auto: 'activity:Email' }, { k: 'due', t: 'Rücklauf-Termin gesetzt' }],
  },
  'Angebot in Vorbereitung': {
    guide: ['Antworten auswerten', 'Use Cases ableiten', 'Paket, Leistungen und Preis zusammenstellen'],
    exit: [{ k: 'value', t: 'Angebotswert gesetzt', auto: 'num:offerValue' }, { k: 'usecases', t: 'Use Cases ausgewählt' }],
  },
  'Angebot versendet': {
    guide: ['Angebot finalisieren', 'An Kunden senden', 'Nachfass-Termin setzen'],
    exit: [{ k: 'sent', t: 'Angebot versendet', auto: 'field:offerDate' }, { k: 'valid', t: 'Gültigkeit gesetzt' }],
  },
  'Nachverhandlung': {
    guide: ['Rückmeldung einholen', 'Offene Fragen klären', 'Konditionen dokumentieren'],
    exit: [{ k: 'feedback', t: 'Rückmeldung dokumentiert', auto: 'activity:Call' }, { k: 'terms', t: 'Finale Konditionen festgehalten' }],
  },
  'gewonnen': {
    guide: ['Account verknüpfen', 'Vertrag bzw. Projekt anlegen', 'An Delivery übergeben'],
    exit: [{ k: 'date', t: 'Entscheidungsdatum gesetzt', auto: 'field:decisionDate' }, { k: 'value', t: 'Auftragswert gesetzt', auto: 'num:offerValue' }],
  },
  'Folgeprojekt': {
    guide: ['Folgeprojekt anlegen', 'Kick-off vereinbaren', 'Budget klären'],
    exit: [{ k: 'project', t: 'Projekt angelegt' }, { k: 'kickoff', t: 'Kick-off terminiert' }],
  },
  'Verlust': {
    guide: ['Verlustgrund dokumentieren', 'Learnings festhalten', 'Wiedervorlage prüfen'],
    exit: [{ k: 'reason', t: 'Verlustgrund gesetzt', auto: 'field:lossReason' }],
  },
  'kein Interesse': {
    guide: ['Absage dokumentieren', 'Kontaktsperre setzen', 'Datenminimierung prüfen'],
    exit: [{ k: 'reason', t: 'Grund dokumentiert', auto: 'field:lossReason' }, { k: 'block', t: 'Sperrliste-Eintrag bestätigt' }],
  },
}

export const STEPS = [
  { id: 'acq-step-offen', stageKey: 'lead', status: 'offen', slug: 'offen', label: 'offen', shortLabel: 'offen', order: 1, activityType: 'Note',
    title: 'Zielkunde anlegen', description: 'Neuen Zielkunden erfassen und der Akquise zuordnen.', isEarly: true },

  { id: 'acq-step-recherchiert', stageKey: 'lead', status: 'recherchiert', slug: 'recherchiert', label: 'recherchiert', shortLabel: 'recherchiert', order: 2, activityType: 'Note',
    title: 'Unternehmen recherchieren', description: 'Branche, Größe, KI-Initiativen und passende Entscheider recherchieren und erfassen.', isEarly: true },

  { id: 'acq-step-vernetzt', stageKey: 'lead', status: 'vernetzt', slug: 'vernetzt', label: 'vernetzt', shortLabel: 'vernetzt', order: 3, activityType: 'Note',
    title: 'Entscheider vernetzen', description: 'Ansprechpartner identifizieren und über LinkedIn oder das Netzwerk verbinden.', isEarly: true },

  { id: 'acq-step-kontaktiert', stageKey: 'lead', status: 'kontaktiert', slug: 'kontaktiert', label: 'kontaktiert', shortLabel: 'kontaktiert', order: 4, activityType: 'Call',
    title: 'Erstkontakt herstellen', description: 'Telefonisch oder per E-Mail kontaktieren – Anlass und Rechtsgrundlage nach § 7 UWG prüfen.', isEarly: true },

  { id: 'acq-step-qualifizierungsgespraech', stageKey: 'qualifizierung', status: 'Qualifizierungsgespräch', slug: 'qualifizierungsgespraech', label: 'Qualifizierungsgespräch planen', shortLabel: 'Qualifizierungsgespräch', order: 5, activityType: 'Meeting',
    title: 'Qualifizierungsgespräch planen', description: 'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
    requiredFields: [{ payload: 'firstMeetingDate', label: 'Termin Qualifizierungsgespräch', type: 'date' }], isInTalk: true },

  { id: 'acq-step-qualifizierungsgespraech-durchgefuehrt', stageKey: 'qualifizierung', status: 'Qualifizierungsgespräch durchgeführt', slug: 'qualifizierungsgespraech-durchgefuehrt', label: 'Qualifizierungsgespräch durchgeführt', shortLabel: 'Qualifizierungsgespräch durchgeführt', order: 6, activityType: 'Meeting',
    title: 'Qualifizierungsgespräch durchführen', description: 'Bedarf, Budget, Zeitrahmen und Entscheiderstruktur klären und das Gespräch dokumentieren.',
    requiredFields: [{ payload: 'firstMeetingDate', label: 'Datum Qualifizierungsgespräch', type: 'date' }], isInTalk: true },

  { id: 'acq-step-uebergabe-an-engagement-manager', stageKey: 'qualifizierung', status: 'Übergabe an Engagement Manager', slug: 'uebergabe-an-engagement-manager', label: 'Übergabe an EM', shortLabel: 'Übergabe an Engagement Manager', order: 7, activityType: 'Meeting',
    title: 'An Engagement Manager übergeben', description: 'Kontext, Erkenntnisse und nächste Schritte vollständig an den EM übergeben.', isInTalk: true },

  { id: 'acq-step-erstgespraech-terminiert', stageKey: 'erstgespraech', status: 'Erstgespräch terminiert', slug: 'erstgespraech-terminiert', label: 'Erstgespräch geplant', shortLabel: 'Erstgespräch terminiert', order: 8, activityType: 'Meeting',
    title: 'Erstgespräch planen', description: 'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
    requiredFields: [{ payload: 'firstMeetingDate', label: 'Termin Erstgespräch', type: 'date' }], isInTalk: true },

  { id: 'acq-step-erstgespraech-durchgefuehrt', stageKey: 'erstgespraech', status: 'Erstgespräch durchgeführt', slug: 'erstgespraech-durchgefuehrt', label: 'Erstgespräch durchgeführt', shortLabel: 'Erstgespräch durchgeführt', order: 9, activityType: 'Meeting',
    title: 'Erstgespräch durchführen', description: 'Termin wahrnehmen, Ist-Situation aufnehmen und den Readiness-Fragebogen ankündigen.',
    requiredFields: [{ payload: 'firstMeetingDate', label: 'Datum Erstgespräch', type: 'date' }], isInTalk: true },

  { id: 'acq-step-fragebogen-geschickt', stageKey: 'erstgespraech', status: 'Fragebogen geschickt', slug: 'fragebogen-geschickt', label: 'Fragebogen geschickt', shortLabel: 'Fragebogen geschickt', order: 10, activityType: 'Email',
    title: 'Fragebogen senden', description: 'Readiness-Fragebogen an den Kunden senden und den Rücklauf nachhalten.', isInTalk: true },

  { id: 'acq-step-angebot-in-vorbereitung', stageKey: 'angebot', status: 'Angebot in Vorbereitung', slug: 'angebot-in-vorbereitung', label: 'Angebot in Vorbereitung', shortLabel: 'Angebot in Vorbereitung', order: 11, activityType: 'Note',
    title: 'Angebot vorbereiten', description: 'Antworten auswerten, Use Cases ableiten und Paket, Leistungen und Preis zusammenstellen.',
    requiredFields: [{ payload: 'offerValue', label: 'Erwarteter Angebotswert (€)', type: 'number' }], isOffer: true },

  { id: 'acq-step-angebot-versendet', stageKey: 'angebot', status: 'Angebot versendet', slug: 'angebot-versendet', label: 'Angebot versendet', shortLabel: 'Angebot versendet', order: 12, activityType: 'Email',
    title: 'Angebot versenden', description: 'Angebot finalisieren und an den Kunden senden.',
    requiredFields: [{ payload: 'offerValue', label: 'Angebotswert (€)', type: 'number' }], isOffer: true, isOfferSent: true },

  { id: 'acq-step-nachverhandlung', stageKey: 'angebot', status: 'Nachverhandlung', slug: 'nachverhandlung', label: 'Nachverhandlung', shortLabel: 'Nachverhandlung', order: 13, activityType: 'Call',
    title: 'Angebot nachfassen', description: 'Rückmeldung einholen, offene Fragen klären und Konditionen verhandeln.', isOffer: true, isOfferSent: true },

  { id: 'acq-step-gewonnen', stageKey: 'abschluss', status: 'gewonnen', slug: 'gewonnen', label: 'gewonnen', shortLabel: 'gewonnen', order: 14, activityType: 'Note',
    title: 'Abschluss speichern', description: 'Kunde gewonnen: Account verknüpfen, Vertrag bzw. Projekt anlegen und an die Delivery übergeben.',
    requiredFields: [
      { payload: 'decisionDate', label: 'Entscheidungsdatum', type: 'date' },
      { payload: 'offerValue', label: 'Auftragswert (€)', type: 'number' },
    ], isClosing: true, outcome: 'won', isWon: true },

  { id: 'acq-step-folgeprojekt', stageKey: 'abschluss', status: 'Folgeprojekt', slug: 'folgeprojekt', label: 'Folgeprojekt', shortLabel: 'Folgeprojekt', order: 15, activityType: 'Note',
    title: 'Folgeprojekt starten', description: 'Folgeprojekt anlegen und den Kick-off mit dem Kunden vereinbaren.',
    isClosing: true, outcome: 'won', isWon: true },

  { id: 'acq-step-verlust', stageKey: 'abschluss', status: 'Verlust', slug: 'verlust', label: 'Verlust', shortLabel: 'Verlust', order: 16, activityType: 'Note',
    title: 'Verlust erfassen', description: 'Grund für den verlorenen Abschluss dokumentieren.',
    requiredFields: [{ payload: 'lossReason', label: 'Verlustgrund', type: 'select', options: LOSS_REASONS, required: true }],
    isClosing: true, outcome: 'lost', isWildcard: true, isLost: true },

  { id: 'acq-step-kein-interesse', stageKey: 'abschluss', status: 'kein Interesse', slug: 'kein-interesse', label: 'kein Interesse', shortLabel: 'kein Interesse', order: 17, activityType: 'Note',
    title: 'Kein Interesse erfassen', description: 'Absage dokumentieren – Kontaktsperre nach DSGVO wird gesetzt.',
    requiredFields: [{ payload: 'lossReason', label: 'Grund (optional)', type: 'select', options: LOSS_REASONS }],
    isClosing: true, outcome: 'lost', isWildcard: true, isLost: true },
].map((s) => ({
  ...STEP_DEFAULTS,
  ...s,
  guide: STEP_GUIDE[s.status] ? STEP_GUIDE[s.status].guide : [],
  exitCriteria: STEP_GUIDE[s.status] ? STEP_GUIDE[s.status].exit : [],
}))

export const TRANSITIONS = [
  { fromStatus: 'kontaktiert', toStatus: 'Übergabe an Engagement Manager' },
]

export const ACTIVITY_TYPE_BY_STATUS = STEPS.reduce((acc, s) => {
  acc[s.status] = s.activityType
  return acc
}, {})

// Schritt-Bibliothek (Spiegel von backend/prisma/pipeline-data.js).
const FRAGEBOGEN_SLUG = 'fragebogen-geschickt'

function toTemplate(step, { isStandard, ownerPipelineId = null }) {
  return {
    id: `acq-tpl-${step.slug}`,
    key: step.slug,
    label: step.label,
    shortLabel: step.shortLabel || null,
    activityType: step.activityType || 'Note',
    title: step.title || null,
    description: step.description || null,
    guide: step.guide || [],
    exitCriteria: step.exitCriteria || [],
    requiredFields: step.requiredFields || [],
    isEarly: !!step.isEarly,
    isInTalk: !!step.isInTalk,
    isOffer: !!step.isOffer,
    isOfferSent: !!step.isOfferSent,
    isWon: !!step.isWon,
    isLost: !!step.isLost,
    isWildcard: !!step.isWildcard,
    isClosing: !!step.isClosing,
    outcome: step.outcome || null,
    isStandard,
    ownerPipelineId,
    active: step.active !== false,
  }
}

export const STEP_TEMPLATES = [
  ...STEPS.filter((s) => s.slug !== FRAGEBOGEN_SLUG).map((s) => toTemplate(s, { isStandard: true })),
  ...STEPS.filter((s) => s.slug === FRAGEBOGEN_SLUG)
    .map((s) => toTemplate(s, { isStandard: false, ownerPipelineId: PIPELINE.id })),
]

export const KI_READINESS_CAMPAIGN = {
  id: 'acq-campaign-ki-readiness',
  key: 'ki-readiness',
  name: 'KI Readiness Sprint',
  description: 'KI-Readiness-Sprint – Standardkampagne auf der Haupt-Pipeline.',
  pipelineId: PIPELINE.id,
  isDefault: true,
  active: true,
}

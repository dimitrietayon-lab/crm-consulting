'use client'

import {
  Building2, TrendingUp, Briefcase, Receipt, Users, Settings2,
  TrendingDown, Calendar, RefreshCw, CalendarDays, CalendarCheck,
  BellRing, MousePointerClick, FileText, FileWarning, CalendarOff, Clock,
} from 'lucide-react'

const DC = {
  crm:       { label:'CRM',        bg:'bg-blue-100',   text:'text-blue-700',   border:'border-blue-300',   icon:Building2,  dot:'bg-blue-500'   },
  vertrieb:  { label:'Vertrieb',   bg:'bg-green-100',  text:'text-green-700',  border:'border-green-300',  icon:TrendingUp, dot:'bg-green-500'  },
  pmo:       { label:'PMO',        bg:'bg-purple-100', text:'text-purple-700', border:'border-purple-300', icon:Briefcase,  dot:'bg-purple-500' },
  fico:      { label:'Fi & Co',    bg:'bg-amber-100',  text:'text-amber-700',  border:'border-amber-300',  icon:Receipt,    dot:'bg-amber-500'  },
  personal:  { label:'Personal',   bg:'bg-teal-100',   text:'text-teal-700',   border:'border-teal-300',   icon:Users,      dot:'bg-teal-500'   },
  general:   { label:'Allgemein',  bg:'bg-slate-100',  text:'text-slate-700',  border:'border-slate-300',  icon:Settings2,  dot:'bg-slate-500'  },
}

// Full trigger registry — used in Step 2 cards and mini-flow diagram
const TRIGGER_CONFIG = {
  // ── Manuell ──────────────────────────────────────────────────────────────────
  manual: {
    label: 'Manuell', icon: MousePointerClick, category: 'manual',
    color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200',
    badge: null, timing: 'Auf Klick', desc: 'Workflow nur auf manuellen Klick ausführen',
  },
  // ── Zeitplan ─────────────────────────────────────────────────────────────────
  schedule_hourly: {
    label: 'Stündlich', icon: RefreshCw, category: 'schedule',
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    badge: 'Auto', timing: 'Jede Stunde :00', desc: 'Jede volle Stunde automatisch ausführen',
  },
  schedule_daily: {
    label: 'Täglich', icon: Calendar, category: 'schedule',
    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200',
    badge: 'Auto', timing: 'Tägl. 06:00', desc: 'Einmal täglich um 06:00 Uhr',
  },
  schedule_weekly: {
    label: 'Wöchentlich', icon: CalendarDays, category: 'schedule',
    color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200',
    badge: 'Auto', timing: 'Mo. 08:00', desc: 'Jeden Montag um 08:00 Uhr',
  },
  schedule_monthly: {
    label: 'Monatlich', icon: CalendarCheck, category: 'schedule',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200',
    badge: 'Auto', timing: '1. Mo. 09:00', desc: 'Am 1. jeden Monats um 09:00 Uhr',
  },
  // ── Ereignis-basiert ─────────────────────────────────────────────────────────
  account_no_activity: {
    label: 'Inaktiver Account', icon: Building2, category: 'event',
    color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    badge: 'Ereignis', timing: 'Tägl. 06:30', desc: 'Account hat seit N Tagen keine Aktivität',
  },
  deal_stuck: {
    label: 'Deal feststeckend', icon: TrendingDown, category: 'event',
    color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
    badge: 'Ereignis', timing: 'Tägl. 07:00', desc: 'Deal wurde seit N Tagen nicht aktualisiert',
  },
  nda_expiring: {
    label: 'NDA läuft ab', icon: FileWarning, category: 'event',
    color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    badge: 'Ereignis', timing: 'Tägl. 06:15', desc: 'NDA läuft in N Tagen ab',
  },
  proposal_expiring: {
    label: 'Angebot läuft ab', icon: FileText, category: 'event',
    color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    badge: 'Ereignis', timing: 'Tägl. 07:30', desc: 'Angebot läuft in N Tagen ab',
  },
  project_deadline: {
    label: 'Projektdeadline', icon: Briefcase, category: 'event',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200',
    badge: 'Ereignis', timing: 'Tägl. 06:45', desc: 'Projektdeadline in N Tagen erreicht',
  },
  timesheet_missing: {
    label: 'Fehlende Zeiterfassung', icon: Clock, category: 'event',
    color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200',
    badge: 'Ereignis', timing: 'Mo. 07:00', desc: 'Mitarbeiter hat keine Zeiterfassung eingereicht',
  },
  invoice_due_soon: {
    label: 'Rechnung bald fällig', icon: Receipt, category: 'event',
    color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
    badge: 'Ereignis', timing: 'Tägl. 08:00', desc: 'Rechnung fällig in N Tagen',
  },
  leave_pending_long: {
    label: 'Urlaubsantrag ausstehend', icon: CalendarOff, category: 'event',
    color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200',
    badge: 'Ereignis', timing: 'Mo. 09:00', desc: 'Urlaubsantrag wartet seit N Tagen',
  },
}
// Backward-compat alias for mini-flow diagram
const TRIGGER_INFO = Object.fromEntries(
  Object.entries(TRIGGER_CONFIG).map(([k, v]) => [k, { label: v.label, icon: v.badge ?? '▶', desc: v.timing }])
)

const DOMAIN_CONFIG = {
  crm: {
    triggers: [
      { type:'manual',              configFields:[] },
      { type:'schedule_daily',      configFields:[] },
      { type:'schedule_weekly',     configFields:[] },
      { type:'schedule_monthly',    configFields:[] },
      { type:'account_no_activity', configFields:[{ key:'days', label:'Tage ohne Aktivität', type:'number', default:30, min:1 }] },
      { type:'deal_stuck',          configFields:[{ key:'days', label:'Tage ohne Update',    type:'number', default:14, min:1 }] },
      { type:'nda_expiring',        configFields:[{ key:'days', label:'Ablauf in N Tagen',   type:'number', default:30, min:1 }] },
    ],
    conditionFields: [
      { field:'days_since_activity',   label:'Tage ohne Account-Aktivität',  type:'number' },
      { field:'deal.amount',           label:'Deal-Betrag (€)',               type:'number' },
      { field:'deal.stage',            label:'Deal-Phase',                    type:'select', options:['Qualified','Proposal','Negotiation','Closed Won','Closed Lost'] },
      { field:'nda.days_until_expiry', label:'NDA-Ablauf in N Tagen',         type:'number' },
      { field:'account.industry',      label:'Account-Branche',               type:'text' },
    ],
    actions: [
      { type:'check_stuck_deals',   label:'Feststeckende Deals prüfen', configFields:[
        { key:'days', label:'Tage ohne Update', type:'number', default:14 },
      ]},
      { type:'check_expiring_ndas', label:'Ablaufende NDAs prüfen', configFields:[
        { key:'days', label:'Ablauf in N Tagen', type:'number', default:30 },
      ]},
      { type:'generate_monthly_report', label:'CRM-Monatsbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Follow-up durchführen' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'Medium' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:7 },
      ]},
    ],
  },
  vertrieb: {
    triggers: [
      { type:'manual',            configFields:[] },
      { type:'schedule_daily',    configFields:[] },
      { type:'schedule_weekly',   configFields:[] },
      { type:'schedule_monthly',  configFields:[] },
      { type:'deal_stuck',        configFields:[{ key:'days', label:'Tage ohne Update',  type:'number', default:14, min:1 }] },
      { type:'proposal_expiring', configFields:[{ key:'days', label:'Ablauf in N Tagen', type:'number', default:14, min:1 }] },
      { type:'nda_expiring',      configFields:[{ key:'days', label:'Ablauf in N Tagen', type:'number', default:30, min:1 }] },
    ],
    conditionFields: [
      { field:'deal.amount',           label:'Deal-Betrag (€)',               type:'number' },
      { field:'deal.stage',            label:'Deal-Phase',                    type:'select', options:['Qualified','Proposal','Negotiation','Closed Won','Closed Lost'] },
      { field:'proposal.status',       label:'Angebotsstatus',                type:'select', options:['draft','sent','accepted','rejected'] },
      { field:'nda.days_until_expiry', label:'NDA-Ablauf in N Tagen',         type:'number' },
      { field:'days_since_activity',   label:'Tage ohne Account-Aktivität',   type:'number' },
    ],
    actions: [
      { type:'check_stuck_deals',       label:'Feststeckende Deals prüfen', configFields:[
        { key:'days', label:'Tage ohne Update', type:'number', default:14 },
      ]},
      { type:'check_proposal_expiring', label:'Ablaufende Angebote prüfen', configFields:[
        { key:'days', label:'Ablauf in N Tagen', type:'number', default:14 },
      ]},
      { type:'check_expiring_ndas',     label:'Ablaufende NDAs prüfen', configFields:[
        { key:'days', label:'Ablauf in N Tagen', type:'number', default:30 },
      ]},
      { type:'generate_monthly_report', label:'Vertriebs-Monatsbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Angebot nachfassen' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'High' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:7 },
      ]},
    ],
  },
  pmo: {
    triggers: [
      { type:'manual',             configFields:[] },
      { type:'schedule_daily',     configFields:[] },
      { type:'schedule_weekly',    configFields:[] },
      { type:'schedule_monthly',   configFields:[] },
      { type:'project_deadline',   configFields:[{ key:'days', label:'Deadline in N Tagen', type:'number', default:7, min:1 }] },
      { type:'timesheet_missing',  configFields:[] },
      { type:'leave_pending_long', configFields:[{ key:'days', label:'Wartet seit N Tagen', type:'number', default:3, min:1 }] },
    ],
    conditionFields: [
      { field:'project.status',         label:'Projektstatus',                 type:'select', options:['Active','On Hold','Completed'] },
      { field:'milestone.days_overdue', label:'Meilenstein überfällig (Tage)', type:'number' },
      { field:'task.priority',          label:'Aufgaben-Priorität',            type:'select', options:['Low','Medium','High','Critical'] },
      { field:'leave.days_pending',     label:'Urlaub offen seit N Tagen',     type:'number' },
    ],
    actions: [
      { type:'check_project_deadline',   label:'Projektdeadlines prüfen', configFields:[
        { key:'days', label:'Deadline in N Tagen', type:'number', default:7 },
      ]},
      { type:'check_overdue_milestones', label:'Überfällige Meilensteine prüfen', configFields:[] },
      { type:'check_pending_timesheets', label:'Fehlende Zeiterfassungen prüfen', configFields:[] },
      { type:'check_pending_leave',      label:'Offene Urlaubsanfragen prüfen', configFields:[
        { key:'days', label:'Offen seit N Tagen', type:'number', default:3 },
      ]},
      { type:'generate_monthly_report',  label:'PMO-Monatsbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Status-Review' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'Medium' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:3 },
      ]},
    ],
  },
  fico: {
    triggers: [
      { type:'manual',           configFields:[] },
      { type:'schedule_hourly',  configFields:[] },
      { type:'schedule_daily',   configFields:[] },
      { type:'schedule_weekly',  configFields:[] },
      { type:'schedule_monthly', configFields:[] },
      { type:'invoice_due_soon', configFields:[{ key:'days', label:'Fällig in N Tagen', type:'number', default:7, min:1 }] },
    ],
    conditionFields: [
      { field:'invoice.total',        label:'Rechnungsbetrag (€)',    type:'number' },
      { field:'invoice.days_overdue', label:'Rechnung überfällig (Tage)', type:'number' },
      { field:'expense.totalAmount',  label:'Reisekostenbetrag (€)',  type:'number' },
      { field:'invoice.status',       label:'Rechnungsstatus',        type:'select', options:['draft','sent','overdue','paid'] },
    ],
    actions: [
      { type:'check_invoice_due_soon',   label:'Bald fällige Rechnungen prüfen', configFields:[
        { key:'days', label:'Fällig in N Tagen', type:'number', default:7 },
      ]},
      { type:'mark_invoices_overdue',    label:'Rechnungen als überfällig markieren', configFields:[] },
      { type:'check_old_draft_invoices', label:'Alte Rechnungsentwürfe prüfen', configFields:[
        { key:'days', label:'Älter als N Tage', type:'number', default:30 },
      ]},
      { type:'check_expense_threshold',  label:'Hohe Reisekosten prüfen & Aufgabe erstellen', configFields:[
        { key:'threshold', label:'Schwellwert (€)', type:'number', default:1000 },
        { key:'taskTitle', label:'Aufgaben-Titel', type:'text', placeholder:'z.B. Reisekosten-Prüfung erforderlich' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'High' },
      ]},
      { type:'generate_monthly_report',  label:'Finanzbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Rechnung prüfen' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'High' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:2 },
      ]},
    ],
  },
  personal: {
    triggers: [
      { type:'manual',             configFields:[] },
      { type:'schedule_daily',     configFields:[] },
      { type:'schedule_weekly',    configFields:[] },
      { type:'schedule_monthly',   configFields:[] },
      { type:'leave_pending_long', configFields:[{ key:'days', label:'Wartet seit N Tagen', type:'number', default:3, min:1 }] },
      { type:'timesheet_missing',  configFields:[] },
    ],
    conditionFields: [
      { field:'leave.days_pending',  label:'Urlaub offen seit N Tagen', type:'number' },
      { field:'leave.type',          label:'Abwesenheitstyp',           type:'select', options:['vacation','sick','training','other'] },
      { field:'expense.totalAmount', label:'Reisekostenbetrag (€)',     type:'number' },
    ],
    actions: [
      { type:'check_pending_leave',      label:'Offene Urlaubsanfragen prüfen', configFields:[
        { key:'days', label:'Offen seit N Tagen', type:'number', default:3 },
      ]},
      { type:'check_pending_timesheets', label:'Fehlende Zeiterfassungen prüfen', configFields:[] },
      { type:'check_expense_threshold',  label:'Hohe Reisekosten prüfen & Aufgabe erstellen', configFields:[
        { key:'threshold', label:'Schwellwert (€)', type:'number', default:1000 },
        { key:'taskTitle', label:'Aufgaben-Titel', type:'text', placeholder:'z.B. Reisekosten-Prüfung erforderlich' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'High' },
      ]},
      { type:'generate_monthly_report',  label:'Personal-Monatsbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Abwesenheit genehmigen' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'Medium' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:1 },
      ]},
    ],
  },
  general: {
    triggers: [
      { type:'manual',              configFields:[] },
      { type:'schedule_hourly',     configFields:[] },
      { type:'schedule_daily',      configFields:[] },
      { type:'schedule_weekly',     configFields:[] },
      { type:'schedule_monthly',    configFields:[] },
      { type:'account_no_activity', configFields:[{ key:'days', label:'Tage ohne Aktivität', type:'number', default:30, min:1 }] },
      { type:'deal_stuck',          configFields:[{ key:'days', label:'Tage ohne Update',    type:'number', default:14, min:1 }] },
      { type:'nda_expiring',        configFields:[{ key:'days', label:'Ablauf in N Tagen',   type:'number', default:30, min:1 }] },
      { type:'proposal_expiring',   configFields:[{ key:'days', label:'Ablauf in N Tagen',   type:'number', default:14, min:1 }] },
      { type:'project_deadline',    configFields:[{ key:'days', label:'Deadline in N Tagen', type:'number', default:7,  min:1 }] },
      { type:'invoice_due_soon',    configFields:[{ key:'days', label:'Fällig in N Tagen',   type:'number', default:7,  min:1 }] },
      { type:'timesheet_missing',   configFields:[] },
      { type:'leave_pending_long',  configFields:[{ key:'days', label:'Wartet seit N Tagen', type:'number', default:3,  min:1 }] },
    ],
    conditionFields: [
      { field:'invoice.total',          label:'Rechnungsbetrag (€)',           type:'number' },
      { field:'invoice.days_overdue',   label:'Rechnung überfällig (Tage)',    type:'number' },
      { field:'expense.totalAmount',    label:'Reisekostenbetrag (€)',         type:'number' },
      { field:'leave.days_pending',     label:'Urlaub offen seit N Tagen',     type:'number' },
      { field:'days_since_activity',    label:'Tage ohne Account-Aktivität',   type:'number' },
      { field:'deal.amount',            label:'Deal-Betrag (€)',               type:'number' },
      { field:'deal.stage',             label:'Deal-Phase',                    type:'select', options:['Qualified','Proposal','Negotiation','Closed Won','Closed Lost'] },
      { field:'proposal.status',        label:'Angebotsstatus',                type:'select', options:['draft','sent','accepted','rejected'] },
      { field:'project.status',         label:'Projektstatus',                 type:'select', options:['Active','On Hold','Completed'] },
      { field:'milestone.days_overdue', label:'Meilenstein überfällig (Tage)', type:'number' },
      { field:'leave.type',             label:'Abwesenheitstyp',               type:'select', options:['vacation','sick','training','other'] },
      { field:'nda.days_until_expiry',  label:'NDA-Ablauf in N Tagen',         type:'number' },
    ],
    actions: [
      { type:'check_stuck_deals',        label:'Feststeckende Deals prüfen', configFields:[
        { key:'days', label:'Tage ohne Update', type:'number', default:14 },
      ]},
      { type:'check_proposal_expiring',  label:'Ablaufende Angebote prüfen', configFields:[
        { key:'days', label:'Ablauf in N Tagen', type:'number', default:14 },
      ]},
      { type:'check_expiring_ndas',      label:'Ablaufende NDAs prüfen', configFields:[
        { key:'days', label:'Ablauf in N Tagen', type:'number', default:30 },
      ]},
      { type:'check_project_deadline',   label:'Projektdeadlines prüfen', configFields:[
        { key:'days', label:'Deadline in N Tagen', type:'number', default:7 },
      ]},
      { type:'check_overdue_milestones', label:'Überfällige Meilensteine prüfen', configFields:[] },
      { type:'check_pending_timesheets', label:'Fehlende Zeiterfassungen prüfen', configFields:[] },
      { type:'check_pending_leave',      label:'Offene Urlaubsanfragen prüfen', configFields:[
        { key:'days', label:'Offen seit N Tagen', type:'number', default:3 },
      ]},
      { type:'check_invoice_due_soon',   label:'Bald fällige Rechnungen prüfen', configFields:[
        { key:'days', label:'Fällig in N Tagen', type:'number', default:7 },
      ]},
      { type:'mark_invoices_overdue',    label:'Rechnungen als überfällig markieren', configFields:[] },
      { type:'check_old_draft_invoices', label:'Alte Rechnungsentwürfe prüfen', configFields:[
        { key:'days', label:'Älter als N Tage', type:'number', default:30 },
      ]},
      { type:'check_expense_threshold',  label:'Hohe Reisekosten prüfen & Aufgabe erstellen', configFields:[
        { key:'threshold', label:'Schwellwert (€)', type:'number', default:1000 },
        { key:'taskTitle', label:'Aufgaben-Titel', type:'text', placeholder:'z.B. Reisekosten-Prüfung erforderlich' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'High' },
      ]},
      { type:'generate_monthly_report',  label:'Monatsbericht erstellen', configFields:[] },
      { type:'create_task', label:'Aufgabe erstellen', configFields:[
        { key:'title', label:'Titel', type:'text', required:true, placeholder:'z.B. Review durchführen' },
        { key:'priority', label:'Priorität', type:'select', options:['Low','Medium','High'], default:'Medium' },
        { key:'dueDays', label:'Fällig in N Tagen', type:'number', default:7 },
      ]},
    ],
  },
}

const OPERATORS = [
  { value:'gt', label:'> größer als' }, { value:'lt', label:'< kleiner als' },
  { value:'gte', label:'>= größer/gleich' }, { value:'lte', label:'<= kleiner/gleich' },
  { value:'eq', label:'= gleich' }, { value:'contains', label:'enthält' },
]

const TEMPLATES = [
  { domain:'fico', name:'Überfällige Rechnungen täglich markieren', description:'Prüft täglich alle Rechnungen und markiert sie automatisch als überfällig.',
    trigger:'schedule_daily', conditions:[], actions:[{ type:'mark_invoices_overdue', config:{} }] },
  { domain:'fico', name:'Alte Rechnungsentwürfe aufspüren', description:'Wöchentlich: Rechnungsentwürfe älter als 30 Tage werden gemeldet.',
    trigger:'schedule_weekly', conditions:[{ field:'invoice.total', operator:'gt', value:'0' }],
    actions:[{ type:'check_old_draft_invoices', config:{ days:30 } }] },
  { domain:'fico', name:'Monatsbericht automatisch erstellen', description:'Erstellt am 1. jeden Monats einen vollständigen Finanzbericht.',
    trigger:'schedule_monthly', conditions:[], actions:[{ type:'generate_monthly_report', config:{} }] },
  { domain:'pmo', name:'Wöchentliche Zeiterfassungs-Kontrolle', description:'Jeden Montag: Mitarbeiter ohne eingereichte Zeiterfassung werden ermittelt.',
    trigger:'schedule_weekly', conditions:[], actions:[{ type:'check_pending_timesheets', config:{} }] },
  { domain:'pmo', name:'Meilenstein-Überwachung täglich', description:'Täglich prüfen, ob Projektmeilensteine überfällig sind.',
    trigger:'schedule_daily', conditions:[], actions:[{ type:'check_overdue_milestones', config:{} }] },
  { domain:'personal', name:'Offene Urlaubsanfragen eskalieren', description:'Täglich: Urlaubsanfragen die > 3 Tage warten, werden als Aufgabe erstellt.',
    trigger:'schedule_daily', conditions:[{ field:'leave.days_pending', operator:'gt', value:'3' }],
    actions:[{ type:'check_pending_leave', config:{ days:3 } }, { type:'create_task', config:{ title:'Urlaubsantrag genehmigen', priority:'High', dueDays:1 } }] },
  { domain:'crm', name:'NDAs ablaufend benachrichtigen', description:'Wöchentlich: NDAs die in 30 Tagen ablaufen werden als Aufgabe markiert.',
    trigger:'schedule_weekly', conditions:[], actions:[{ type:'check_expiring_ndas', config:{ days:30 } }, { type:'create_task', config:{ title:'NDA verlängern', priority:'High', dueDays:14 } }] },
  { domain:'fico', name:'Hohe Reisekosten automatisch prüfen', description:'Täglich: Für jede neue Reisekostenabrechnung über 1.000€ wird einmalig eine Prüfungs-Aufgabe erstellt.',
    trigger:'schedule_daily', conditions:[], actions:[{ type:'check_expense_threshold', config:{ threshold:1000, taskTitle:'Reisekosten-Prüfung erforderlich', priority:'High' } }] },
  { domain:'general', name:'Vollständiger Wochenbericht', description:'Jeden Montag: Überfällige Meilensteine + fehlende Zeiterfassungen + Monatsbericht.',
    trigger:'schedule_weekly', conditions:[], actions:[{ type:'check_overdue_milestones', config:{} }, { type:'check_pending_timesheets', config:{} }, { type:'generate_monthly_report', config:{} }] },
]

export { DC, TRIGGER_CONFIG, TRIGGER_INFO, DOMAIN_CONFIG, OPERATORS, TEMPLATES }

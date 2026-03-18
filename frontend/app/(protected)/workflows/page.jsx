'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Zap, Plus, Play, Trash2, Edit2, CheckCircle, XCircle, Clock,
  ChevronRight, ChevronLeft, X, Loader2, ToggleLeft, ToggleRight,
  Building2, TrendingUp, Briefcase, Receipt, Users, Settings2,
  GitBranch, AlertCircle, Activity, TrendingDown, Copy, Search,
  Filter, Calendar, ArrowRight, Circle, CheckCircle2, SkipForward,
  RefreshCw, Timer, Layers, ChevronDown, CalendarDays, CalendarCheck,
  BellRing, MousePointerClick, FileText, FileWarning, CalendarOff,
  Repeat, RotateCcw, BadgeAlert
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'

// ─── Domain Config ─────────────────────────────────────────────────────────────
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

function fmtDuration(start, end) {
  if (!end) return '–'
  const ms = new Date(end) - new Date(start)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(date) {
  if (!date) return '–'
  const diff = Date.now() - new Date(date)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  return `vor ${Math.floor(h / 24)} Tagen`
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const [tab, setTab] = useState('workflows')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editWorkflow, setEditWorkflow] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function openBuilder(wf = null) { setEditWorkflow(wf); setShowBuilder(true) }
  function closeBuilder() { setShowBuilder(false); setEditWorkflow(null) }
  function onSaved() { closeBuilder(); setRefreshKey(k => k + 1) }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl">
              <Zap className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Workflow-Automatisierung</h1>
              <p className="text-xs text-gray-400">Prozesse automatisch ausführen, wenn Bedingungen erfüllt sind</p>
            </div>
          </div>
          <button onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm">
            <Plus className="w-4 h-4" /> Neuer Workflow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {[
            { key:'workflows', label:'Workflows', icon:Layers },
            { key:'monitoring', label:'Monitoring', icon:Activity },
            { key:'vorlagen', label:'Vorlagen', icon:Copy },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === key ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'workflows' && <WorkflowsTab key={refreshKey} onEdit={openBuilder} />}
        {tab === 'monitoring' && <MonitoringTab key={refreshKey} />}
        {tab === 'vorlagen' && <VorlagenTab onUse={(tpl) => openBuilder({ _template: tpl })} />}
      </div>

      {showBuilder && (
        <WorkflowBuilder editWorkflow={editWorkflow} onClose={closeBuilder} onSaved={onSaved} />
      )}
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.get('/workflows/stats').then(setStats).catch(() => {}) }, [])

  const cards = [
    { label:'Workflows gesamt', value: stats?.total ?? '–', icon: Layers,    color:'text-violet-600', bg:'bg-violet-50' },
    { label:'Aktiv',            value: stats?.active ?? '–', icon: ToggleRight, color:'text-green-600',  bg:'bg-green-50'  },
    { label:'Erfolgsrate',      value: stats ? `${stats.successRate}%` : '–', icon: CheckCircle2, color:'text-blue-600', bg:'bg-blue-50' },
    { label:'Läufe gesamt',     value: stats?.totalRuns ?? '–', icon: RefreshCw, color:'text-amber-600', bg:'bg-amber-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────
function WorkflowsTab({ onEdit }) {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    try { setWorkflows(await api.get('/workflows')) }
    catch {} finally { setLoading(false) }
  }

  async function toggleActive(wf) {
    try {
      const updated = await api.put(`/workflows/${wf.id}`, { isActive: !wf.isActive })
      setWorkflows(p => p.map(w => w.id === wf.id ? { ...w, isActive: updated.isActive } : w))
    } catch { toast.error('Fehler') }
  }

  async function runWorkflow(wf) {
    setRunning(r => ({ ...r, [wf.id]: true }))
    try {
      const res = await api.post(`/workflows/${wf.id}/run`, {})
      setRunResult({ workflow: wf, result: res.result, run: res.run })
      toast.success('Workflow ausgeführt')
      load()
    } catch (err) { toast.error(err.message || 'Ausführung fehlgeschlagen') }
    setRunning(r => ({ ...r, [wf.id]: false }))
  }

  async function duplicate(wf) {
    try {
      const payload = {
        name: `${wf.name} (Kopie)`, description: wf.description, domain: wf.domain,
        trigger: wf.trigger, triggerConfig: wf.triggerConfig, conditions: wf.conditions, actions: wf.actions,
      }
      await api.post('/workflows', payload)
      toast.success('Dupliziert')
      load()
    } catch { toast.error('Fehler') }
  }

  async function deleteWorkflow(id) {
    if (!confirm('Workflow löschen?')) return
    try { await api.delete(`/workflows/${id}`); setWorkflows(p => p.filter(w => w.id !== id)); toast.success('Gelöscht') }
    catch { toast.error('Fehler') }
  }

  const filtered = workflows.filter(wf => {
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDomain !== 'all' && wf.domain !== filterDomain) return false
    if (filterStatus === 'active' && !wf.isActive) return false
    if (filterStatus === 'inactive' && wf.isActive) return false
    return true
  })

  return (
    <div>
      <StatsBar />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Workflow suchen…"
            className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
            className="text-sm outline-none bg-transparent">
            <option value="all">Alle Domänen</option>
            {Object.entries(DC).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {[['all','Alle'],['active','Aktiv'],['inactive','Inaktiv']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors
                ${filterStatus === v ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 ml-auto">{filtered.length} von {workflows.length}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <Zap className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">Keine Workflows gefunden</p>
          <p className="text-sm text-gray-400 mt-1">Erstelle deinen ersten automatisierten Workflow</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(wf => (
            <WorkflowCard key={wf.id} wf={wf}
              onToggle={() => toggleActive(wf)}
              onRun={() => runWorkflow(wf)}
              onEdit={() => onEdit(wf)}
              onDuplicate={() => duplicate(wf)}
              onDelete={() => deleteWorkflow(wf.id)}
              running={running[wf.id]}
            />
          ))}
        </div>
      )}

      {runResult && <RunResultModal result={runResult} onClose={() => setRunResult(null)} />}
    </div>
  )
}

// ─── Workflow Card ────────────────────────────────────────────────────────────
function WorkflowCard({ wf, onToggle, onRun, onEdit, onDuplicate, onDelete, running }) {
  const domain = DC[wf.domain] || DC.general
  const domainCfg = DOMAIN_CONFIG[wf.domain] || DOMAIN_CONFIG.general
  const DomainIcon = domain.icon
  const triggerInfo = TRIGGER_INFO[wf.trigger] || { label: wf.trigger, icon: '▶', desc: '' }
  const actionsArray = Array.isArray(wf.actions) ? wf.actions : []
  const conditionsArray = Array.isArray(wf.conditions) ? wf.conditions : []
  const recentRuns = Array.isArray(wf.runs) ? wf.runs : []
  const isAutomatic = wf.trigger !== 'manual'

  return (
    <div className={`bg-white rounded-2xl border-2 flex flex-col transition-all hover:shadow-md
      ${wf.isActive ? domain.border : 'border-gray-100'}`}>

      {/* Card header */}
      <div className={`px-4 pt-4 pb-3 rounded-t-xl ${wf.isActive ? domain.bg.replace('100','50') : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg ${domain.bg} shrink-0 mt-0.5`}>
              <DomainIcon className={`w-3.5 h-3.5 ${domain.text}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{wf.name}</h3>
                {isAutomatic && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs rounded-full font-medium">
                    <Zap className="w-2.5 h-2.5" />Auto
                  </span>
                )}
              </div>
              {wf.description && <p className="text-xs text-gray-500 truncate mt-0.5">{wf.description}</p>}
            </div>
          </div>
          <button onClick={onToggle} className="shrink-0 mt-0.5" title={wf.isActive ? 'Deaktivieren' : 'Aktivieren'}>
            {wf.isActive
              ? <ToggleRight className="w-7 h-7 text-violet-600" />
              : <ToggleLeft className="w-7 h-7 text-gray-300" />}
          </button>
        </div>
      </div>

      {/* Mini-flow diagram */}
      <div className="px-4 py-3 flex items-center gap-1.5 flex-wrap border-b border-gray-100 overflow-hidden">
        {/* Trigger node */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${domain.bg} ${domain.text}`}>
          <span>{triggerInfo.icon}</span>
          <span>{triggerInfo.label}</span>
        </div>

        {conditionsArray.length > 0 && (
          <>
            <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-orange-50 text-orange-600">
              <AlertCircle className="w-3 h-3" />
              <span>{conditionsArray.length} Bed.</span>
            </div>
          </>
        )}

        {actionsArray.slice(0, 2).map((a, i) => {
          const allActions = [...(domainCfg.actions || []), ...DOMAIN_CONFIG.general.actions]
          const def = allActions.find(x => x.type === a.type)
          return (
            <span key={i} className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${domain.bg} ${domain.text}`}>
                {def?.label?.split(' ')[0] || a.type}
              </span>
            </span>
          )
        })}
        {actionsArray.length > 2 && (
          <span className="text-xs text-gray-400">+{actionsArray.length - 2}</span>
        )}
      </div>

      {/* Meta info */}
      <div className="px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-gray-400">
          {isAutomatic ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {triggerInfo.desc}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {timeAgo(wf.lastRunAt)}
            </span>
          )}
          {wf._count?.runs > 0 && (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              {wf._count.runs}×
            </span>
          )}
        </div>

        {/* Run history dots */}
        {recentRuns.length > 0 && (
          <div className="flex items-center gap-1">
            {recentRuns.slice(0, 5).map((r, i) => (
              <div key={i} title={r.status}
                className={`w-2 h-2 rounded-full ${
                  r.status === 'success' ? 'bg-green-400' :
                  r.status === 'failed'  ? 'bg-red-400'   :
                  r.status === 'skipped' ? 'bg-yellow-400' : 'bg-gray-300'
                }`} />
            ))}
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-3 pb-3 flex items-center gap-1.5 mt-auto">
        <button onClick={onRun} disabled={!wf.isActive || running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Ausführen
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button onClick={onDuplicate}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Duplizieren">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="ml-auto p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Monitoring Tab ───────────────────────────────────────────────────────────
function MonitoringTab() {
  const [stats, setStats] = useState(null)
  const [runs, setRuns] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    api.get('/workflows/stats').then(setStats).catch(() => {})
    api.get('/workflows/runs?limit=50').then(setRuns).catch(() => {})
  }, [])

  const filteredRuns = runs.filter(r => filterStatus === 'all' || r.status === filterStatus)
  const domainColors = { crm:'#3b82f6', vertrieb:'#22c55e', pmo:'#a855f7', fico:'#f59e0b', personal:'#14b8a6', general:'#64748b' }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" />Aktivität (letzte 7 Tage)
          </h3>
          {stats ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dailyActivity} barSize={16} barGap={2}>
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={d => d} formatter={(v, n) => [v, n === 'success' ? 'Erfolg' : n === 'failed' ? 'Fehler' : 'Übersprungen']} />
                <Bar dataKey="success" stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} />
                <Bar dataKey="skipped" stackId="a" fill="#fbbf24" />
                <Bar dataKey="failed"  stackId="a" fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>}
          <div className="flex gap-4 mt-2 justify-center">
            {[['bg-violet-500','Erfolg'],['bg-yellow-400','Übersprungen'],['bg-red-400','Fehler']].map(([bg,l]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-2.5 h-2.5 rounded-sm ${bg}`} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Domain distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />Domänen-Verteilung
          </h3>
          {stats?.domainDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.domainDistribution} dataKey="count" nameKey="domain" cx="50%" cy="50%" outerRadius={75} label={({ domain: d, percent }) => `${DC[d]?.label || d} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {stats.domainDistribution.map((e) => (
                    <Cell key={e.domain} fill={domainColors[e.domain] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, DC[n]?.label || n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Keine Daten</div>}
        </div>
      </div>

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Erfolgsrate', value:`${stats.successRate}%`, sub:'aller Läufe', color:'text-green-600', bg:'bg-green-50', icon:CheckCircle2 },
            { label:'⌀ Dauer', value:stats.avgDurationMs < 1000 ? `${stats.avgDurationMs}ms` : `${(stats.avgDurationMs/1000).toFixed(1)}s`, sub:'pro Ausführung', color:'text-blue-600', bg:'bg-blue-50', icon:Timer },
            { label:'Aktive Workflows', value:stats.active, sub:`von ${stats.total} gesamt`, color:'text-violet-600', bg:'bg-violet-50', icon:Zap },
            { label:'Läufe gesamt', value:stats.totalRuns, sub:'alle Zeit', color:'text-amber-600', bg:'bg-amber-50', icon:RefreshCw },
          ].map(({ label, value, sub, color, bg, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${bg}`}><Icon className={`w-4 h-4 ${color}`} /></div>
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent runs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />Ausführungsprotokoll
          </h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[['all','Alle'],['success','Erfolg'],['failed','Fehler'],['skipped','Übersprungen']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors
                  ${filterStatus === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {filteredRuns.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />Keine Einträge
            </div>
          ) : filteredRuns.map(run => {
            const domain = DC[run.workflow?.domain] || DC.general
            return (
              <div key={run.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 text-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${domain.dot}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{run.workflow?.name}</span>
                </div>
                <div className="w-28 shrink-0">
                  {run.status === 'success'  && <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" />Erfolg</span>}
                  {run.status === 'failed'   && <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3.5 h-3.5" />Fehler</span>}
                  {run.status === 'skipped'  && <span className="flex items-center gap-1 text-yellow-500 text-xs"><SkipForward className="w-3.5 h-3.5" />Übersprungen</span>}
                  {run.status === 'running'  && <span className="flex items-center gap-1 text-violet-500 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Läuft</span>}
                </div>
                <p className="text-xs text-gray-400 w-32 shrink-0 truncate">{run.summary || '–'}</p>
                <p className="text-xs font-mono text-gray-400 w-16 text-right shrink-0">{fmtDuration(run.startedAt, run.finishedAt)}</p>
                <p className="text-xs text-gray-400 w-32 text-right shrink-0">
                  {new Date(run.startedAt).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Vorlagen Tab ─────────────────────────────────────────────────────────────
function VorlagenTab({ onUse }) {
  const [activeDomain, setActiveDomain] = useState('all')
  const filtered = activeDomain === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.domain === activeDomain)

  return (
    <div>
      {/* Domain filter pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => setActiveDomain('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${activeDomain === 'all' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          Alle
        </button>
        {Object.entries(DC).map(([k, d]) => (
          <button key={k} onClick={() => setActiveDomain(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeDomain === k ? `${d.bg} ${d.text} ring-2 ring-current` : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <d.icon className="w-3.5 h-3.5" />{d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tpl, i) => {
          const domain = DC[tpl.domain] || DC.general
          const DomainIcon = domain.icon
          const trigInfo = TRIGGER_INFO[tpl.trigger] || { label: tpl.trigger, icon: '▶' }
          const isAuto = tpl.trigger !== 'manual'
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-xl ${domain.bg} shrink-0`}>
                  <DomainIcon className={`w-4 h-4 ${domain.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{tpl.name}</h3>
                    {isAuto && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs rounded-full"><Zap className="w-2.5 h-2.5" />Auto</span>}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${domain.bg} ${domain.text} font-medium`}>{domain.label}</span>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4 flex-1">{tpl.description}</p>

              {/* Mini flow */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap text-xs">
                <span className={`px-2 py-1 rounded-lg font-medium ${domain.bg} ${domain.text}`}>{trigInfo.icon} {trigInfo.label}</span>
                {tpl.conditions.length > 0 && (
                  <><ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className="px-2 py-1 rounded-lg font-medium bg-orange-50 text-orange-600">{tpl.conditions.length} Bed.</span></>
                )}
                {tpl.actions.slice(0,2).map((a, j) => {
                  const domCfg = DOMAIN_CONFIG[tpl.domain] || DOMAIN_CONFIG.general
                  const allA = [...(domCfg.actions || []), ...DOMAIN_CONFIG.general.actions]
                  const def = allA.find(x => x.type === a.type)
                  return (
                    <span key={j} className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className={`px-2 py-1 rounded-lg font-medium ${domain.bg} ${domain.text}`}>{def?.label?.split(' ')[0] || a.type}</span>
                    </span>
                  )
                })}
              </div>

              <button onClick={() => onUse(tpl)}
                className="w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
                Als Workflow verwenden
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 4-Step Workflow Builder ──────────────────────────────────────────────────
function WorkflowBuilder({ editWorkflow, onClose, onSaved }) {
  const isTemplate = editWorkflow?._template
  const tpl = isTemplate ? editWorkflow._template : null

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => {
    if (tpl) return { name: tpl.name, description: '', domain: tpl.domain, trigger: tpl.trigger, triggerConfig: {}, conditions: [...tpl.conditions], actions: [...tpl.actions] }
    if (editWorkflow && !isTemplate) return {
      name: editWorkflow.name || '', description: editWorkflow.description || '',
      domain: editWorkflow.domain || 'general', trigger: editWorkflow.trigger || 'manual',
      triggerConfig: editWorkflow.triggerConfig || {},
      conditions: Array.isArray(editWorkflow.conditions) ? editWorkflow.conditions : [],
      actions: Array.isArray(editWorkflow.actions) && editWorkflow.actions.length > 0
        ? editWorkflow.actions : editWorkflow.actionType ? [{ type: editWorkflow.actionType, config: editWorkflow.actionConfig || {} }] : [],
    }
    return { name:'', description:'', domain:'', trigger:'manual', triggerConfig:{}, conditions:[], actions:[] }
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const domainCfg = DOMAIN_CONFIG[form.domain] || null
  const canGo = { 1: !!(form.name.trim() && form.domain), 2: !!form.trigger, 3: true, 4: form.actions.length > 0 }

  const STEPS = [
    { n:1, label:'Allgemein', icon:Layers },
    { n:2, label:'Trigger',   icon:Zap },
    { n:3, label:'Bedingungen', icon:AlertCircle },
    { n:4, label:'Aktionen',  icon:Play },
  ]

  async function save() {
    if (!canGo[4]) return toast.error('Mindestens eine Aktion erforderlich')
    setSaving(true)
    try {
      const payload = { name:form.name, description:form.description||null, domain:form.domain, trigger:form.trigger, triggerConfig:form.triggerConfig, conditions:form.conditions, actions:form.actions }
      if (editWorkflow && !isTemplate) { await api.put(`/workflows/${editWorkflow.id}`, payload); toast.success('Aktualisiert') }
      else { await api.post('/workflows', payload); toast.success('Workflow erstellt') }
      onSaved()
    } catch (err) { toast.error(err.message || 'Fehler') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl"><Zap className="w-4 h-4 text-violet-600" /></div>
            <div>
              <h2 className="font-bold text-gray-900">{isTemplate ? 'Vorlage verwenden' : editWorkflow ? 'Workflow bearbeiten' : 'Neuer Workflow'}</h2>
              <p className="text-xs text-gray-400">{STEPS[step-1].label} — Schritt {step} von 4</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {/* Step bar */}
        <div className="flex px-6 py-3 gap-1 border-b border-gray-100 shrink-0">
          {STEPS.map((s) => {
            const StepIcon = s.icon
            const done = s.n < step
            const current = s.n === step
            return (
              <button key={s.n} onClick={() => { if (done || canGo[s.n-1]) setStep(s.n) }}
                className={`flex-1 flex flex-col items-center gap-1.5 py-1.5 rounded-xl transition-all
                  ${current ? 'bg-violet-50' : done ? 'cursor-pointer' : 'opacity-40 cursor-default'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                  ${done ? 'bg-violet-600' : current ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-gray-100'}`}>
                  {done ? <CheckCircle className="w-4 h-4 text-white" /> : <StepIcon className={`w-3.5 h-3.5 ${current ? 'text-violet-600' : 'text-gray-400'}`} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${current ? 'text-violet-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>{s.label}</span>
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow-Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="z.B. Überfällige Rechnungen täglich markieren"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                  placeholder="Was macht dieser Workflow?"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domäne *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(DC).map(([key, d]) => {
                    const Icon = d.icon
                    const sel = form.domain === key
                    return (
                      <button key={key} type="button"
                        onClick={() => { set('domain', key); set('trigger', 'manual'); set('actions', []) }}
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left transition-all
                          ${sel ? `${d.border} ${d.bg}` : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <div className={`p-1.5 rounded-lg ${sel ? 'bg-white/70' : d.bg}`}>
                          <Icon className={`w-4 h-4 ${d.text}`} />
                        </div>
                        <span className={`text-sm font-semibold ${sel ? d.text : 'text-gray-700'}`}>{d.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — redesigned trigger cards */}
          {step === 2 && domainCfg && (() => {
            const scheduled = domainCfg.triggers.filter(t => ['manual','schedule_hourly','schedule_daily','schedule_weekly','schedule_monthly'].includes(t.type))
            const events    = domainCfg.triggers.filter(t => !['manual','schedule_hourly','schedule_daily','schedule_weekly','schedule_monthly'].includes(t.type))
            const selTrig   = domainCfg.triggers.find(t => t.type === form.trigger)

            const TriggerCard = ({ t }) => {
              const cfg = TRIGGER_CONFIG[t.type] || { label: t.type, icon: Zap, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200', timing: '', desc: '', badge: null }
              const Icon = cfg.icon
              const sel = form.trigger === t.type
              return (
                <button type="button"
                  onClick={() => { set('trigger', t.type); set('triggerConfig', {}) }}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all flex items-start gap-3
                    ${sel ? `${cfg.border} ${cfg.bg}` : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${sel ? 'bg-white/80 shadow-sm' : cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${sel ? cfg.color : 'text-gray-800'}`}>{cfg.label}</span>
                      {cfg.badge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                          ${cfg.badge === 'Ereignis' ? 'bg-orange-100 text-orange-600' : 'bg-violet-100 text-violet-600'}`}>
                          {cfg.badge === 'Ereignis' ? <BellRing className="w-2.5 h-2.5 inline mr-0.5" /> : <Zap className="w-2.5 h-2.5 inline mr-0.5" />}
                          {cfg.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
                    <p className={`text-xs font-medium mt-1 ${sel ? cfg.color : 'text-gray-400'}`}>{cfg.timing}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center mt-1
                    ${sel ? `border-current ${cfg.color}` : 'border-gray-300'}`}>
                    {sel && <div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />}
                  </div>
                </button>
              )
            }

            return (
              <div className="space-y-5">
                {/* Zeitplan section */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Zeitplan-basiert</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {scheduled.map(t => <TriggerCard key={t.type} t={t} />)}
                  </div>
                </div>

                {/* Event section */}
                {events.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Ereignis-basiert</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {events.map(t => <TriggerCard key={t.type} t={t} />)}
                    </div>
                  </div>
                )}

                {/* Config fields for selected trigger */}
                {selTrig?.configFields?.length > 0 && (
                  <div className={`p-4 rounded-xl border-2 ${TRIGGER_CONFIG[form.trigger]?.border || 'border-violet-200'} ${TRIGGER_CONFIG[form.trigger]?.bg || 'bg-violet-50'}`}>
                    <p className="text-xs font-semibold text-gray-600 mb-3">Konfiguration: {TRIGGER_CONFIG[form.trigger]?.label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selTrig.configFields.map(cf => (
                        <div key={cf.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{cf.label}</label>
                          <input type={cf.type === 'number' ? 'number' : 'text'} min={cf.min}
                            value={form.triggerConfig[cf.key] ?? cf.default ?? ''}
                            onChange={e => set('triggerConfig', { ...form.triggerConfig, [cf.key]: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Step 3 */}
          {step === 3 && domainCfg && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-700">
                <strong>Bedingungen prüfen:</strong> Der Workflow wird nur ausgeführt, wenn alle Bedingungen erfüllt sind. Ohne Bedingungen läuft er immer.
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Bedingungen <span className="font-normal text-gray-400">(optional)</span></p>
                {domainCfg.conditionFields.length > 0 && (
                  <button type="button" onClick={() => set('conditions', [...form.conditions, { field:'', operator:'gt', value:'' }])}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700">
                    <Plus className="w-3.5 h-3.5" /> Bedingung
                  </button>
                )}
              </div>
              {domainCfg.conditionFields.length === 0 ? (
                <div className="py-10 text-center text-gray-400 border-2 border-dashed rounded-xl">Keine Bedingungsfelder für diese Domäne</div>
              ) : form.conditions.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Keine Bedingungen — Workflow läuft immer</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <select value={cond.field} onChange={e => { const u=[...form.conditions]; u[i]={...u[i],field:e.target.value}; set('conditions',u) }}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm min-w-0">
                        <option value="">Feld wählen…</option>
                        {domainCfg.conditionFields.map(cf => <option key={cf.field} value={cf.field}>{cf.label}</option>)}
                      </select>
                      <select value={cond.operator} onChange={e => { const u=[...form.conditions]; u[i]={...u[i],operator:e.target.value}; set('conditions',u) }}
                        className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <input value={cond.value} placeholder="Wert"
                        onChange={e => { const u=[...form.conditions]; u[i]={...u[i],value:e.target.value}; set('conditions',u) }}
                        className="w-24 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                      <button type="button" onClick={() => set('conditions', form.conditions.filter((_,j)=>j!==i))}
                        className="text-red-400 hover:text-red-600 p-1 shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && domainCfg && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Aktionen *</p>
                  <p className="text-xs text-gray-400">Sequenzielle Ausführung in dieser Reihenfolge</p>
                </div>
                <button type="button" onClick={() => set('actions', [...form.actions, { type:'', config:{} }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700">
                  <Plus className="w-3.5 h-3.5" /> Aktion
                </button>
              </div>

              {form.actions.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-xl">
                  <Zap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Noch keine Aktionen</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.actions.map((action, i) => {
                    const actionDef = domainCfg.actions.find(a => a.type === action.type)
                    return (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i+1}</div>
                          <select value={action.type}
                            onChange={e => { const u=[...form.actions]; u[i]={type:e.target.value,config:{}}; set('actions',u) }}
                            className="flex-1 border border-gray-300 rounded-xl px-2.5 py-1.5 text-sm">
                            <option value="">Aktion wählen…</option>
                            {domainCfg.actions.map(a => <option key={a.type} value={a.type}>{a.label}</option>)}
                          </select>
                          <button type="button" onClick={() => set('actions', form.actions.filter((_,j)=>j!==i))}
                            className="text-red-400 hover:text-red-600 p-1 shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        {actionDef?.configFields?.length > 0 && (
                          <div className="grid grid-cols-2 gap-3 pl-8">
                            {actionDef.configFields.map(cf => (
                              <div key={cf.key} className={cf.type === 'text' ? 'col-span-2' : ''}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{cf.label}{cf.required?' *':''}</label>
                                {cf.type === 'select' ? (
                                  <select value={action.config[cf.key] ?? cf.default ?? ''}
                                    onChange={e => { const u=[...form.actions]; u[i]={...u[i],config:{...u[i].config,[cf.key]:e.target.value}}; set('actions',u) }}
                                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm">
                                    {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <input type={cf.type === 'number' ? 'number' : 'text'} placeholder={cf.placeholder || ''}
                                    value={action.config[cf.key] ?? cf.default ?? ''}
                                    onChange={e => { const u=[...form.actions]; u[i]={...u[i],config:{...u[i].config,[cf.key]:e.target.value}}; set('actions',u) }}
                                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Flow preview */}
              {form.domain && form.trigger && form.actions.some(a => a.type) && (
                <div className="mt-4 p-3 bg-violet-50 rounded-xl border border-violet-100">
                  <p className="text-xs font-medium text-violet-700 mb-2">Workflow-Vorschau:</p>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className={`px-2 py-1 rounded-lg font-medium ${DC[form.domain]?.bg} ${DC[form.domain]?.text}`}>
                      {TRIGGER_INFO[form.trigger]?.icon} {TRIGGER_INFO[form.trigger]?.label || form.trigger}
                    </span>
                    {form.conditions.filter(c => c.field).map((c, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-violet-400" />
                        <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-600 font-medium">{c.field} {c.operator} {c.value}</span>
                      </span>
                    ))}
                    {form.actions.filter(a => a.type).map((a, i) => {
                      const def = (DOMAIN_CONFIG[form.domain]?.actions || []).find(x => x.type === a.type)
                      return (
                        <span key={i} className="flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-violet-400" />
                          <span className={`px-2 py-1 rounded-lg font-medium ${DC[form.domain]?.bg} ${DC[form.domain]?.text}`}>✓ {def?.label || a.type}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
          <button onClick={() => step > 1 ? setStep(step-1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
            <ChevronLeft className="w-4 h-4" />{step === 1 ? 'Abbrechen' : 'Zurück'}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{step}/4</span>
            {step < 4 ? (
              <button onClick={() => canGo[step] && setStep(step+1)} disabled={!canGo[step]}
                className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors">
                Weiter <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving || !canGo[4]}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editWorkflow && !isTemplate ? 'Aktualisieren' : 'Workflow erstellen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Run Result Modal ─────────────────────────────────────────────────────────
function RunResultModal({ result, onClose }) {
  const { workflow, result: r, run } = result
  const domain = DC[workflow?.domain] || DC.general
  const skipped = r?.skipped
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {skipped
              ? <><SkipForward className="w-5 h-5 text-yellow-500" /><h3 className="font-semibold">Übersprungen</h3></>
              : <><CheckCircle className="w-5 h-5 text-green-500" /><h3 className="font-semibold">Ausgeführt</h3></>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${domain.bg}`}><Zap className={`w-4 h-4 ${domain.text}`} /></div>
            <div>
              <p className="font-semibold text-gray-900">{workflow?.name}</p>
              <p className="text-xs text-gray-400">Dauer: {fmtDuration(run?.startedAt, run?.finishedAt)} · {r?.count ?? 0} Einträge bearbeitet</p>
            </div>
          </div>
          <div className={`rounded-xl p-3 text-sm ${skipped ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
            {r?.summary}
          </div>
          {Array.isArray(r?.results) && r.results.length > 1 && (
            <div className="space-y-2">
              {r.results.map((res, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Aktion {i+1}</p>
                  <p className="text-gray-700">{res.summary}</p>
                  {Array.isArray(res.items) && res.items.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {res.items.slice(0,4).map((item, j) => (
                        <p key={j} className="text-xs text-gray-500 truncate">• {item.name||item.title||item.account||item.number||JSON.stringify(item)}</p>
                      ))}
                      {res.items.length > 4 && <p className="text-xs text-gray-400">…und {res.items.length-4} weitere</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {r?.data && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(r.data).map(([k,v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-xs text-gray-400 capitalize">{k.replace(/([A-Z])/g,' $1')}</p>
                  <p className="font-bold text-gray-800">{typeof v === 'number' ? v.toLocaleString('de-DE') : String(v)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">Schließen</button>
        </div>
      </div>
    </div>
  )
}

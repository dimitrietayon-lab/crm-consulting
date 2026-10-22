'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Zap, Plus, Play, CheckCircle, ChevronRight, ChevronLeft, X, Loader2,
  AlertCircle, Layers, BellRing, ArrowRight,
} from 'lucide-react'
import {
  DC, TRIGGER_CONFIG, TRIGGER_INFO, DOMAIN_CONFIG, OPERATORS,
} from '@/lib/workflow-config'

export default function WorkflowBuilder({ editWorkflow, onClose, onSaved }) {
  const isTemplate = editWorkflow?._template
  const tpl = isTemplate ? editWorkflow._template : null

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => {
    if (tpl) return { name: tpl.name, description: tpl.description || '', domain: tpl.domain, trigger: tpl.trigger, triggerConfig: {}, conditions: [...tpl.conditions], actions: [...tpl.actions] }
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
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">

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

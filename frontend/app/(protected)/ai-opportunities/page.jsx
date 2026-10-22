'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Brain, RefreshCw, ThumbsUp, EyeOff, ChevronDown, ChevronUp, Sparkles,
  FileText, X, CheckCircle, Target, Lightbulb,
  Users, TrendingUp, Shield, ListChecks, Printer, ExternalLink, Briefcase, AlertTriangle
} from 'lucide-react'

const CATEGORY_LABELS = {
  'cross-sell': 'Cross-Sell',
  upsell: 'Upsell',
  'new-service': 'Neuer Service',
  renewal: 'Verlängerung',
}

const CATEGORY_COLORS = {
  'cross-sell': 'bg-blue-100 text-blue-800',
  upsell: 'bg-purple-100 text-purple-800',
  'new-service': 'bg-green-100 text-green-800',
  renewal: 'bg-amber-100 text-amber-800',
}

const TRIGGER_LABELS = {
  gap: 'White-Space',
  news: 'Nachrichten',
  renewal: 'Vertragsende',
  nps: 'NPS',
  peer: 'Peers',
  timing: 'Timing',
}

const STATUS_COLORS = {
  new: 'bg-gray-100 text-gray-600',
  interesting: 'bg-green-100 text-green-700',
  ignored: 'bg-red-50 text-red-500',
}

const ROLE_LABELS = {
  topic: 'Fachbeleg',
  timing: 'Anlass — kein Fachbeleg für den Service',
}

function EvidenceBlock({ opp }) {
  const crm = opp.scoreBreakdown?.crmEvidence || []
  const sources = Array.isArray(opp.sources) ? opp.sources.filter((s) => s?.url) : []
  const newsFit = opp.scoreBreakdown?.newsFit
  if (!crm.length && !sources.length && !newsFit) return null

  return (
    <div className="mt-3 space-y-2">
      {newsFit === 'none' && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          Keine themenpassende öffentliche Quelle. Der Vorschlag beruht auf CRM-Belegen, nicht auf diesem Nachrichtentitel.
        </p>
      )}
      {crm.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">CRM-Belege</p>
          <ul className="space-y-1">
            {crm.map((item, i) => (
              <li key={i} className="text-xs text-gray-600 leading-snug pl-2 border-l-2 border-slate-200">
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sources.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Quellen mit Beleg</p>
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.url} className="text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.role === 'topic' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {ROLE_LABELS[s.role] || 'Quelle'}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:underline inline-flex items-center gap-1 min-w-0"
                  >
                    <ExternalLink size={11} className="flex-shrink-0" />
                    <span className="truncate">{s.title || s.source || s.url}</span>
                  </a>
                </div>
                {s.quote && (
                  <p className="mt-0.5 text-gray-500 italic leading-snug">„{s.quote}“</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceBar({ value, breakdown }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'
  const trigger = breakdown?.trigger
  const w = breakdown?.weights || { gap: 0.4, news: 0.3, timing: 0.2, peer: 0.1 }
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-500 w-8">{pct}%</span>
      </div>
      {breakdown && (
        <p className="text-[10px] text-gray-400 mt-1">
          Score{trigger ? ` · ${TRIGGER_LABELS[trigger] || trigger}` : ''}:
          {' '}Lücke {Math.round((breakdown.gap || 0) * w.gap * 100)}
          {' · '}News {Math.round((breakdown.news || 0) * w.news * 100)}
          {' · '}Timing {Math.round((breakdown.timing || 0) * w.timing * 100)}
          {' · '}Peers {Math.round((breakdown.peer || 0) * w.peer * 100)}
        </p>
      )}
    </div>
  )
}

function ReportSection({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-gray-100 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-violet-600 flex-shrink-0" />
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function exportReport(report, opp, accountName) {
  const catLabel = CATEGORY_LABELS[opp.category] || opp.category
  const serviceName = opp.service?.name || report.service?.name
  const confidence = Math.round((opp.confidence || 0) * 100)
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const sourceList = Array.isArray(report.sources) ? report.sources : (Array.isArray(opp.sources) ? opp.sources : [])

  const section = (title, content) => content ? `
    <div class="section">
      <h3>${title}</h3>
      <p>${content}</p>
    </div>` : ''

  const crmItems = opp.scoreBreakdown?.crmEvidence || []
  const crmHtml = crmItems.length ? `
    <div class="section">
      <h3>CRM-Belege</h3>
      <ol>${crmItems.map((c) => `<li>${c.text}</li>`).join('')}</ol>
    </div>` : ''

  const steps = report.nextSteps?.length ? `
    <div class="section">
      <h3>Nächste Schritte</h3>
      <ol>${report.nextSteps.map((s) => `<li>${s}</li>`).join('')}</ol>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>${report.title || opp.suggestion}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px 48px; font-size: 13px; line-height: 1.6; }
  .header { border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 28px; }
  .meta { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #ede9fe; color: #6d28d9; }
  .conf { font-size: 11px; color: #6b7280; }
  h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .account { font-size: 12px; color: #6b7280; }
  .date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .summary-box { background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; }
  .summary-box p { color: #374151; font-size: 13px; }
  .section { margin-bottom: 18px; }
  .section h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7c3aed; margin-bottom: 6px; }
  .section p, .section ol, .section li { color: #374151; }
  ol { padding-left: 18px; }
  ol li { margin-bottom: 4px; }
  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { padding: 24px 32px; } }
</style>
</head>
<body>
<div class="header">
  <div class="meta">
    <span class="badge">${catLabel}</span>
    ${serviceName ? `<span class="badge">${serviceName}</span>` : ''}
    <span class="conf">Score: ${confidence}%</span>
  </div>
  <h1>${report.title || opp.suggestion}</h1>
  <p class="account">${accountName}</p>
  <p class="date">Erstellt am ${today}</p>
</div>

${report.summary ? `<div class="summary-box"><p>${report.summary}</p></div>` : ''}

${section('Aktuelle Situation', report.situation)}
${section('Opportunity', report.opportunity)}
${section('Strategische Begründung', report.rationale)}
${section('Ansprachestrategie', report.approach)}
${steps}
${section('Erwarteter Mehrwert', report.value)}
${section('Risiken & Einwände', report.risks)}
${crmHtml}
${sourceList.length ? `
    <div class="section">
      <h3>Quellen mit Beleg</h3>
      <ol>${sourceList.map((s) => `<li><strong>${s.role === 'timing' ? 'Anlass' : 'Fachbeleg'}:</strong> ${s.title || s.url}${s.quote ? ` — „${s.quote}“` : ''}${s.url ? ` (${s.url})` : ''}</li>`).join('')}</ol>
    </div>` : ''}

<div class="footer">
  <span>CRM Consulting – Vertriebsbericht</span>
  <span>${today}</span>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

function ReportModal({ opp, accountName, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.post(`/ai-opportunities/${opp.id}/report`, {})
      .then(setReport)
      .catch((err) => {
        toast.error(err.message || 'Fehler beim Generieren des Berichts')
        onClose()
      })
      .finally(() => setLoading(false))
  }, [opp.id])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-violet-600 font-medium uppercase tracking-wide">
                {CATEGORY_LABELS[opp.category] || opp.category}
              </p>
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {loading ? 'Bericht wird generiert…' : (report?.title || opp.suggestion)}
              </h3>
              <p className="text-xs text-gray-400">{accountName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <RefreshCw size={28} className="animate-spin text-violet-400" />
              <p className="text-sm">KI analysiert und erstellt Bericht…</p>
            </div>
          ) : report ? (
            <>
              {/* Confidence badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[opp.category] || 'bg-gray-100 text-gray-600'}`}>
                  {CATEGORY_LABELS[opp.category] || opp.category}
                </span>
                <span className="text-xs text-gray-500">
                  Score: <strong>{Math.round((opp.confidence || 0) * 100)}%</strong>
                  {opp.scoreBreakdown?.trigger && (
                    <> · {TRIGGER_LABELS[opp.scoreBreakdown.trigger] || opp.scoreBreakdown.trigger}</>
                  )}
                </span>
                {opp.service?.name && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {opp.service.name}
                  </span>
                )}
              </div>

              {/* Summary */}
              {report.summary && (
                <ReportSection icon={Sparkles} title="Executive Summary" className="bg-violet-50 border-violet-100">
                  <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
                </ReportSection>
              )}

              {/* Situation */}
              {report.situation && (
                <ReportSection icon={Target} title="Aktuelle Situation">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.situation}</p>
                </ReportSection>
              )}

              {/* Opportunity */}
              {report.opportunity && (
                <ReportSection icon={TrendingUp} title="Opportunity">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.opportunity}</p>
                </ReportSection>
              )}

              {/* Rationale */}
              {report.rationale && (
                <ReportSection icon={Lightbulb} title="Strategische Begründung">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.rationale}</p>
                </ReportSection>
              )}

              {/* Approach */}
              {report.approach && (
                <ReportSection icon={Users} title="Ansprachestrategie">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.approach}</p>
                </ReportSection>
              )}

              {/* Next steps */}
              {report.nextSteps?.length > 0 && (
                <ReportSection icon={ListChecks} title="Nächste Schritte">
                  <ul className="space-y-1.5">
                    {report.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {/* Value */}
              {report.value && (
                <ReportSection icon={CheckCircle} title="Erwarteter Mehrwert">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.value}</p>
                </ReportSection>
              )}

              {/* Risks */}
              {report.risks && (
                <ReportSection icon={Shield} title="Risiken & Einwände">
                  <p className="text-sm text-gray-600 leading-relaxed">{report.risks}</p>
                </ReportSection>
              )}

              <EvidenceBlock opp={{ ...opp, sources: report.sources || opp.sources, scoreBreakdown: report.scoreBreakdown || opp.scoreBreakdown }} />
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <button
            onClick={() => exportReport(report, opp, accountName)}
            disabled={!report}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={14} />
            Exportieren / Drucken
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountOpportunities({ account }) {
  const [opps, setOpps] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [creatingId, setCreatingId] = useState(null)
  const [reportOpp, setReportOpp] = useState(null)

  async function generate() {
    setGenerating(true)
    setExpanded(true)
    try {
      const data = await api.post(`/ai-opportunities/${account.id}/generate`)
      setOpps(data)
      toast.success(`${data.length} Opportunities generiert`)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Generieren')
    } finally {
      setGenerating(false)
    }
  }

  async function load() {
    if (opps !== null) return
    try {
      const data = await api.get(`/ai-opportunities/${account.id}`)
      setOpps(data)
    } catch {
      setOpps([])
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.put(`/ai-opportunities/${id}/status`, { status })
      setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    } catch {
      toast.error('Fehler beim Aktualisieren')
    }
  }

  async function createDeal(opp) {
    setCreatingId(opp.id)
    try {
      const data = await api.post(`/ai-opportunities/${opp.id}/create-deal`)
      setOpps((prev) => prev.map((o) => (o.id === opp.id ? { ...o, ...data.opportunity } : o)))
      toast.success(data.alreadyExisted ? 'Deal existiert bereits' : 'Deal in der Pipeline angelegt')
    } catch (err) {
      toast.error(err.message || 'Deal konnte nicht angelegt werden')
    } finally {
      setCreatingId(null)
    }
  }

  function toggle() {
    if (!expanded) load()
    setExpanded(!expanded)
  }

  const activeOpps = opps?.filter((o) => o.status !== 'ignored') || []
  const hasNew = opps?.some((o) => o.status === 'new')

  return (
    <>
      {reportOpp && (
        <ReportModal
          opp={reportOpp}
          accountName={account.companyName}
          onClose={() => setReportOpp(null)}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={toggle} className="flex items-center gap-3 flex-1 text-left">
            <div>
              <p className="font-medium text-gray-900">{account.companyName}</p>
              <p className="text-xs text-gray-400">{account.institutionType}</p>
            </div>
            {opps !== null && (
              <span className="ml-2 text-xs text-gray-500">
                {activeOpps.length} Vorschläge
              </span>
            )}
            {hasNew && (
              <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title="Neue Vorschläge" />
            )}
            {expanded ? <ChevronUp size={16} className="ml-auto text-gray-400" /> : <ChevronDown size={16} className="ml-auto text-gray-400" />}
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {generating ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {generating ? 'Analysiere Katalog & News...' : 'Analysieren'}
          </button>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 px-4 pb-4">
            {opps === null ? (
              <p className="text-sm text-gray-400 pt-3">Laden...</p>
            ) : opps.length === 0 ? (
              <p className="text-sm text-gray-400 pt-3">Noch keine Opportunities generiert. Klicken Sie auf "Analysieren".</p>
            ) : (
              <div className="space-y-3 pt-3">
                {opps.map((opp) => (
                  <div
                    key={opp.id}
                    className={`rounded-lg border p-3 ${opp.status === 'ignored' ? 'opacity-40' : ''} border-gray-100`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {opp.category && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[opp.category] || 'bg-gray-100 text-gray-600'}`}>
                              {CATEGORY_LABELS[opp.category] || opp.category}
                            </span>
                          )}
                          {opp.service?.name && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {opp.service.name}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[opp.status]}`}>
                            {opp.status === 'new' ? 'Neu' : opp.status === 'interesting' ? 'Interessant' : 'Ignoriert'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{opp.suggestion}</p>
                        {opp.reasoning && (
                          <p className="text-xs text-gray-500 mt-0.5">{opp.reasoning}</p>
                        )}
                        {opp.confidence != null && (
                          <div className="mt-2">
                            <ConfidenceBar value={opp.confidence} breakdown={opp.scoreBreakdown} />
                          </div>
                        )}
                        <EvidenceBlock opp={opp} />
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setReportOpp(opp)}
                          className="p-1.5 rounded hover:bg-violet-50 text-violet-500"
                          title="Bericht erstellen"
                        >
                          <FileText size={14} />
                        </button>
                        {opp.dealId ? (
                          <Link
                            href={`/pipeline/${opp.dealId}`}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                            title="Deal öffnen"
                          >
                            <Briefcase size={14} />
                          </Link>
                        ) : (
                          <button
                            onClick={() => createDeal(opp)}
                            disabled={creatingId === opp.id || opp.status === 'ignored'}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-40"
                            title="Als Deal anlegen"
                          >
                            {creatingId === opp.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Briefcase size={14} />
                            )}
                          </button>
                        )}
                        {opp.status !== 'interesting' && (
                          <button
                            onClick={() => updateStatus(opp.id, 'interesting')}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"
                            title="Interessant"
                          >
                            <ThumbsUp size={14} />
                          </button>
                        )}
                        {opp.status !== 'ignored' && (
                          <button
                            onClick={() => updateStatus(opp.id, 'ignored')}
                            className="p-1.5 rounded hover:bg-red-50 text-red-400"
                            title="Ignorieren"
                          >
                            <EyeOff size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function AiOpportunitiesPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/accounts')
      .then((data) => {
        const accs = data?.accounts || data || []
        setAccounts(Array.isArray(accs) ? accs : [])
      })
      .catch(() => toast.error('Fehler beim Laden der Accounts'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = accounts.filter((a) =>
    a.companyName.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
          <Brain size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KI-Opportunity-Erkennung</h1>
          <p className="text-sm text-gray-500">Nur fachlich passende Quellen mit Zitat — CRM-Belege sind getrennt sichtbar</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Account suchen..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 max-w-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-sm text-gray-500">{filtered.length} Accounts</span>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">Laden...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((account) => (
            <AccountOpportunities key={account.id} account={account} />
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400">Keine Accounts gefunden</div>
          )}
        </div>
      )}
    </div>
  )
}

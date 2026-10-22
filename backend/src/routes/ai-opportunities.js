const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { callActiveLlm } = require('../lib/llm')
const {
  loadOpportunityContext,
  buildCrmBlock,
  buildCatalogBlock,
  formatArticles,
  groundSources,
  findService,
  allowedIds,
  parseJsonArray,
  scoreOpportunity,
} = require('../lib/opportunity-context')

const SERVICE_INCLUDE = { select: { id: true, name: true, category: true } }
const DEAL_INCLUDE = { select: { id: true, title: true, stage: true } }
const OPP_INCLUDE = { service: SERVICE_INCLUDE, deal: DEAL_INCLUDE }

function normalizeOpportunities(rawList, ctx) {
  const { catalog, used, missing, articles } = ctx
  const seenServices = new Set()
  const result = []

  for (const raw of rawList) {
    const categoryRaw = ['cross-sell', 'upsell', 'new-service', 'renewal'].includes(raw.category)
      ? raw.category
      : 'cross-sell'
    const service = catalog.length ? findService(raw, catalog) : null
    if (catalog.length && !service) continue
    if (service && seenServices.has(service.id)) continue

    const onUsed = service && used.some((s) => s.id === service.id)
    const onMissing = service && missing.some((s) => s.id === service.id)
    let category = categoryRaw
    if (onUsed && !onMissing && (category === 'cross-sell' || category === 'new-service')) {
      category = 'upsell'
    }

    const allowed = catalog.length ? allowedIds(category, used, missing) : null
    if (allowed && service && !allowed.has(service.id)) continue
    if (service) seenServices.add(service.id)

    const sources = groundSources(raw, articles, service)
    const scored = scoreOpportunity({ service, category, sources }, ctx)
    const newsFit = scored.scoreBreakdown.newsFit
    let reasoning = String(raw.reasoning || '').trim() || null
    if (newsFit === 'none' && reasoning) {
      reasoning = `${reasoning}\n\nHinweis: Keine themenpassende öffentliche Quelle für diesen Service — Vorschlag stützt sich auf CRM-Belege.`
    }
    result.push({
      suggestion: String(raw.suggestion || '').trim(),
      reasoning,
      confidence: scored.confidence,
      scoreBreakdown: scored.scoreBreakdown,
      category,
      serviceId: service?.id || null,
      sources,
    })
    if (result.length >= 5) break
  }

  return result.filter((o) => o.suggestion).sort((a, b) => b.confidence - a.confidence)
}

function parseJsonObject(raw) {
  const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned.startsWith('{') ? cleaned : (cleaned.match(/\{[\s\S]*\}/) || ['{}'])[0])
  } catch {
    return null
  }
}

// GET /api/ai-opportunities – all opportunities (overview)
router.get('/', async (req, res) => {
  try {
    const opps = await prisma.aiOpportunity.findMany({
      where: req.query.status ? { status: req.query.status } : {},
      include: {
        account: { select: { companyName: true, institutionType: true } },
        service: SERVICE_INCLUDE,
        deal: DEAL_INCLUDE,
      },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    })
    res.json(opps)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ai-opportunities/:accountId – list saved opportunities
router.get('/:accountId', async (req, res) => {
  try {
    const opps = await prisma.aiOpportunity.findMany({
      where: { accountId: req.params.accountId },
      include: OPP_INCLUDE,
      orderBy: { generatedAt: 'desc' },
    })
    res.json(opps)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai-opportunities/:accountId/generate – generate via active LLM
router.post('/:accountId/generate', async (req, res) => {
  try {
    const ctx = await loadOpportunityContext(prisma, req.params.accountId)
    if (!ctx) return res.status(404).json({ error: 'Account not found' })

    const newsBlock = formatArticles(ctx.articles)
    const prompt = `Du bist ein erfahrener Unternehmensberater. Schlage 3-5 konkrete Opportunities vor.

HARTE REGELN:
- Für "cross-sell" und "new-service" darfst du NUR Services aus dem White-Space-Katalog wählen (Feld serviceId = die angegebene ID).
- Für "upsell" und "renewal" darfst du NUR bereits genutzte Katalog-Services wählen.
- Erfinde keine Services, die nicht im Katalog stehen.
- Bevorzuge Services, für die "passende Quellen" gelistet sind.
- Eine Quelle darf NUR zitiert werden, wenn du ein wörtliches Zitat aus Titel oder Zusammenfassung angibst.
- role "topic": die Quelle muss den Service fachlich belegen (nicht nur den Firmennamen nennen).
- role "timing": nur für Strategie/Upsell als Anlass (z.B. Ergebniszahlen). NICHT für DORA/Regulierung, wenn der Artikel davon nicht handelt.
- Wenn keine fachlich passende Quelle existiert: sources leer lassen. Behaupte dann NICHT, Nachrichten würden den Service stützen.
- Stütze reasoning auf CRM-Belege und nur auf wirklich passende Quellen. Keine erfundenen Fakten.
- Wiederhole keine Angebote, die laut Verlustgründen bereits gescheitert sind.
- Kein confidence-Feld — der Score wird serverseitig berechnet.

${buildCrmBlock(ctx)}

${buildCatalogBlock(ctx)}

=== Aktuelle öffentliche Informationen ===
Quelle: ${ctx.newsOrigin === 'stored' ? 'gespeicherte NewsItems' : ctx.newsOrigin === 'live-fallback' ? 'Live-Nachrichten (kein gespeicherter Bestand)' : 'keine'}
${newsBlock}

Antworte NUR mit einem JSON-Array (kein Markdown, kein Text davor/danach):
[
  {
    "serviceId": "id-aus-dem-katalog",
    "suggestion": "Konkrete Empfehlung in einem Satz",
    "reasoning": "Begründung nur mit CRM-Belegen und fachlich passenden Quellen",
    "category": "cross-sell | upsell | new-service | renewal",
    "sources": [
      { "id": 1, "role": "topic", "quote": "wörtliches Zitat aus Titel oder Zusammenfassung der Quelle" }
    ]
  }
]`

    const raw = (await callActiveLlm(prompt, { maxTokens: 2000 })).trim()
    const parsed = parseJsonArray(raw)
    if (!parsed) return res.status(500).json({ error: 'KI hat ungültiges JSON geliefert' })

    const opportunities = normalizeOpportunities(parsed, ctx)
    if (!opportunities.length) {
      return res.status(422).json({
        error: 'Keine gültigen Katalog-Opportunities. Prüfen Sie White-Space und Service-Katalog.',
      })
    }

    await prisma.aiOpportunity.deleteMany({
      where: { accountId: req.params.accountId, status: 'new' },
    })

    const created = await prisma.$transaction(
      opportunities.map((o) =>
        prisma.aiOpportunity.create({
          data: {
            accountId: req.params.accountId,
            serviceId: o.serviceId,
            suggestion: o.suggestion,
            reasoning: o.reasoning,
            confidence: o.confidence,
            scoreBreakdown: o.scoreBreakdown,
            category: o.category,
            sources: o.sources,
            status: 'new',
          },
          include: OPP_INCLUDE,
        })
      )
    )

    res.json(created)
  } catch (err) {
    console.error('AI opportunity generation error:', err)
    res.status(err.message?.includes('aktive KI-Verbindung') ? 503 : 500).json({ error: err.message })
  }
})

// PUT /api/ai-opportunities/:id/status – mark interesting / ignored
router.put('/:id/status', async (req, res) => {
  const { status } = req.body
  if (!['new', 'interesting', 'ignored'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  try {
    const opp = await prisma.aiOpportunity.update({
      where: { id: req.params.id },
      data: { status },
      include: OPP_INCLUDE,
    })
    res.json(opp)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai-opportunities/:id/report – generate a detailed sales report for one opportunity
router.post('/:id/report', async (req, res) => {
  try {
    const opp = await prisma.aiOpportunity.findUnique({
      where: { id: req.params.id },
      include: { account: true, service: SERVICE_INCLUDE, deal: DEAL_INCLUDE },
    })
    if (!opp) return res.status(404).json({ error: 'Nicht gefunden' })

    const ctx = await loadOpportunityContext(prisma, opp.accountId)
    if (!ctx) return res.status(404).json({ error: 'Account not found' })

    const newsBlock = formatArticles(ctx.articles)
    const storedSources = Array.isArray(opp.sources) ? opp.sources : []
    const sourceBlock = storedSources.length
      ? storedSources.map((s) => `- ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')
      : '(Keine gespeicherten Quellen an dieser Opportunity)'

    const prompt = `Du bist ein Senior-Berater und erstellst einen professionellen Vertriebsbericht.

Stütze den Bericht auf CRM-Daten, den Service-Katalog und die genannten Quellen. Erfinde keine Fakten. Verweise konkret auf Quellen-URLs wo möglich.

${buildCrmBlock(ctx)}

${buildCatalogBlock(ctx)}

=== Zugeordneter Katalog-Service ===
${opp.service ? `${opp.service.name}${opp.service.category ? ` [${opp.service.category}]` : ''}` : 'Nicht zugeordnet'}

=== Quellen dieser Opportunity ===
${sourceBlock}

=== Aktuelle öffentliche Informationen ===
${newsBlock}

=== Identifizierte Opportunity ===
- Kategorie: ${opp.category}
- Empfehlung: ${opp.suggestion}
- KI-Begründung: ${opp.reasoning}
- Konfidenz: ${Math.round((opp.confidence || 0) * 100)}%${opp.scoreBreakdown?.trigger ? ` (Treiber: ${opp.scoreBreakdown.trigger})` : ''}

Erstelle einen vollständigen, professionellen Vertriebsbericht auf Deutsch.
Antworte NUR mit JSON (kein Markdown, kein Text davor/danach):
{
  "title": "Prägnanter Berichtstitel (max. 10 Wörter)",
  "summary": "Executive Summary: Kernaussage der Opportunity in 2-3 Sätzen",
  "situation": "Aktuelle Situation des Accounts — Stärken, Herausforderungen, relevante Entwicklungen (3-4 Sätze)",
  "opportunity": "Detaillierte Beschreibung was konkret angeboten werden soll und warum jetzt der richtige Zeitpunkt ist (3-4 Sätze)",
  "rationale": "Strategische Begründung — warum dieser Client, warum dieser Service, warum jetzt (2-3 Sätze)",
  "approach": "Empfohlene Ansprachestrategie und Verkaufsansatz (3-4 Sätze)",
  "nextSteps": ["Konkreter Schritt 1", "Konkreter Schritt 2", "Konkreter Schritt 3", "Konkreter Schritt 4"],
  "value": "Erwarteter Mehrwert und Nutzen für den Kunden (quantitativ und qualitativ, 2-3 Sätze)",
  "risks": "Mögliche Risiken oder Einwände und wie man damit umgeht (2-3 Sätze)"
}`

    const raw = (await callActiveLlm(prompt, { maxTokens: 2000 })).trim()
    const report = parseJsonObject(raw) || {
      title: opp.suggestion,
      summary: opp.reasoning || '',
      situation: '',
      opportunity: opp.suggestion,
      rationale: opp.reasoning || '',
      approach: '',
      nextSteps: [],
      value: '',
      risks: '',
    }

    res.json({
      ...report,
      oppId: opp.id,
      accountName: ctx.account.companyName,
      category: opp.category,
      confidence: opp.confidence,
      scoreBreakdown: opp.scoreBreakdown,
      service: opp.service,
      sources: storedSources,
    })
  } catch (err) {
    console.error('Report generation error:', err)
    res.status(err.message?.includes('aktive KI-Verbindung') ? 503 : 500).json({ error: err.message })
  }
})

const TRIGGER_NOTES = {
  gap: 'White-Space / Coverage-Gap',
  news: 'Nachrichten-Trigger',
  renewal: 'Vertragsende / Renewal',
  nps: 'NPS',
  peer: 'Peer-Adoption',
  timing: 'Timing',
}

// POST /api/ai-opportunities/:id/create-deal – convert opportunity into a Cross-Selling deal
router.post('/:id/create-deal', async (req, res) => {
  try {
    const opp = await prisma.aiOpportunity.findUnique({
      where: { id: req.params.id },
      include: { account: true, service: SERVICE_INCLUDE, deal: DEAL_INCLUDE },
    })
    if (!opp) return res.status(404).json({ error: 'Nicht gefunden' })

    if (opp.dealId && opp.deal) {
      return res.json({ deal: opp.deal, opportunity: opp, alreadyExisted: true })
    }

    const serviceType = opp.service?.category || opp.service?.name
    if (!serviceType) {
      return res.status(400).json({ error: 'Kein Katalog-Service zugeordnet — bitte neu analysieren' })
    }

    const trigger = opp.scoreBreakdown?.trigger
    const notes = [
      `Erzeugt aus KI-Opportunity (${opp.category || 'cross-sell'}).`,
      trigger ? `Haupttreiber: ${TRIGGER_NOTES[trigger] || trigger}` : null,
      opp.reasoning,
    ].filter(Boolean).join('\n\n')

    const deal = await prisma.deal.create({
      data: {
        title: (opp.suggestion || '').slice(0, 180) || `Cross-Selling: ${serviceType} – ${opp.account.companyName}`,
        accountId: opp.accountId,
        serviceType,
        source: 'Cross-Selling',
        stage: 'First Contact',
        notes,
        assignedToId: req.user?.id || null,
      },
    })

    const opportunity = await prisma.aiOpportunity.update({
      where: { id: opp.id },
      data: {
        dealId: deal.id,
        status: opp.status === 'ignored' ? 'ignored' : 'interesting',
      },
      include: OPP_INCLUDE,
    })

    res.status(201).json({ deal, opportunity, alreadyExisted: false })
  } catch (err) {
    console.error('Create deal from opportunity error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

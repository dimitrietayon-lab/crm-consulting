const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { callActiveLlm } = require('../lib/llm')
const { searchCompanyContext, formatNewsContext } = require('../lib/news-agent')

// GET /api/ai-opportunities/:accountId – list saved opportunities
router.get('/:accountId', async (req, res) => {
  try {
    const opps = await prisma.aiOpportunity.findMany({
      where: { accountId: req.params.accountId },
      orderBy: { generatedAt: 'desc' },
    })
    res.json(opps)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai-opportunities/:accountId/generate – generate via Claude
router.post('/:accountId/generate', async (req, res) => {

  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.accountId },
      include: {
        deals: { orderBy: { createdAt: 'desc' }, take: 10 },
        projects: { orderBy: { createdAt: 'desc' }, take: 5 },
        npsScores: { orderBy: { date: 'desc' }, take: 3 },
      },
    })
    if (!account) return res.status(404).json({ error: 'Account not found' })

    const usedServices = [...new Set(account.deals.map((d) => d.serviceType).filter(Boolean))]
    const wonDeals = account.deals.filter((d) => d.stage === 'Closed Won')
    const openPipeline = account.deals
      .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
      .reduce((s, d) => s + (d.value || 0), 0)
    const latestNps = account.npsScores[0]?.score ?? null
    const activeProjects = account.projects.filter((p) => p.status === 'Active').length

    // Fetch real public information about the company in parallel with DB work
    const newsArticles = await searchCompanyContext(account.companyName, account.institutionType).catch(() => [])
    const newsBlock = formatNewsContext(newsArticles)

    const prompt = `Du bist ein erfahrener Unternehmensberater. Analysiere diesen Client und schlage 3-5 konkrete Cross-Selling- oder Upselling-Opportunities vor.

Stütze deine Analyse auf die echten aktuellen Informationen aus öffentlichen Quellen (Nachrichten, Geschäftsberichte, Pressemitteilungen) sowie auf die CRM-Daten. Nenne konkrete Bezüge zu den Quellen wo möglich.

=== CRM-Daten ===
- Name: ${account.companyName}
- Branche: ${account.institutionType}
- Land: ${account.country || 'Nicht angegeben'}
- Mitarbeiter: ${account.numberOfEmployees || 'Unbekannt'}
- AuM / Bilanzsumme: ${account.aum ? account.aum + ' Mrd.' : 'Unbekannt'}
- Bereits genutzte Services: ${usedServices.length ? usedServices.join(', ') : 'Keine'}
- Abgeschlossene Deals: ${wonDeals.length}
- Offene Pipeline: ${openPipeline.toLocaleString('de-DE')} €
- Aktive Projekte: ${activeProjects}
- Letzter NPS: ${latestNps ?? 'Kein NPS verfügbar'}
- Regulatorischer Status: ${account.regulatoryStatus || 'Unbekannt'}
- Basel IV / Solvency II: ${account.baselIVStatus || account.solvencyIIStatus || 'Unbekannt'}

=== Aktuelle öffentliche Informationen (Nachrichten, Berichte, Pressemitteilungen) ===
${newsBlock}

Antworte NUR mit einem JSON-Array (kein Markdown, kein Text davor/danach):
[
  {
    "suggestion": "Konkrete Empfehlung in einem Satz",
    "reasoning": "Begründung warum dieser Client davon profitieren würde",
    "confidence": 0.85,
    "category": "cross-sell | upsell | new-service | renewal"
  }
]`

    const raw = (await callActiveLlm(prompt, { maxTokens: 1024 })).trim()
    let opportunities
    try {
      opportunities = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return res.status(500).json({ error: 'Claude returned invalid JSON' })
      opportunities = JSON.parse(match[0])
    }

    // Delete previous "new" opportunities and save fresh ones
    await prisma.aiOpportunity.deleteMany({
      where: { accountId: req.params.accountId, status: 'new' },
    })

    const created = await prisma.$transaction(
      opportunities.map((o) =>
        prisma.aiOpportunity.create({
          data: {
            accountId: req.params.accountId,
            suggestion: o.suggestion,
            reasoning: o.reasoning,
            confidence: o.confidence,
            category: o.category,
            status: 'new',
          },
        })
      )
    )

    res.json(created)
  } catch (err) {
    console.error('AI opportunity generation error:', err)
    res.status(500).json({ error: err.message })
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
    })
    res.json(opp)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ai-opportunities – all opportunities (overview)
router.get('/', async (req, res) => {
  try {
    const opps = await prisma.aiOpportunity.findMany({
      where: req.query.status ? { status: req.query.status } : {},
      include: { account: { select: { companyName: true, institutionType: true } } },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    })
    res.json(opps)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai-opportunities/:id/report – generate a detailed sales report for one opportunity
router.post('/:id/report', async (req, res) => {
  try {
    const opp = await prisma.aiOpportunity.findUnique({
      where: { id: req.params.id },
      include: {
        account: {
          include: {
            deals:     { orderBy: { createdAt: 'desc' }, take: 10 },
            projects:  { orderBy: { createdAt: 'desc' }, take: 5  },
            npsScores: { orderBy: { date: 'desc' },      take: 3  },
          },
        },
      },
    })
    if (!opp) return res.status(404).json({ error: 'Nicht gefunden' })

    const acc = opp.account
    const wonDeals      = acc.deals.filter((d) => d.stage === 'Closed Won')
    const activeProj    = acc.projects.filter((p) => p.status === 'Active')
    const usedServices  = [...new Set(acc.deals.map((d) => d.serviceType).filter(Boolean))]
    const latestNps     = acc.npsScores[0]?.score ?? null
    const openPipeline  = acc.deals
      .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
      .reduce((s, d) => s + (d.value || 0), 0)

    // Fetch real public information to ground the report in actual facts
    const newsArticles = await searchCompanyContext(acc.companyName, acc.institutionType).catch(() => [])
    const newsBlock = formatNewsContext(newsArticles)

    const prompt = `Du bist ein Senior-Berater und erstellst einen professionellen Vertriebsbericht für eine identifizierte Opportunity.

Stütze den Bericht auf die echten aktuellen Informationen aus öffentlichen Quellen (Nachrichten, Geschäftsberichte, Pressemitteilungen) sowie auf die CRM-Daten. Verweise konkret auf aktuelle Ereignisse, Zahlen oder Entwicklungen aus den Quellen.

=== CRM-Daten ===
Account: ${acc.companyName}
Branche: ${acc.institutionType} | Land: ${acc.country || 'Unbekannt'} | Mitarbeiter: ${acc.numberOfEmployees || 'Unbekannt'}
AuM/Bilanzsumme: ${acc.aum ? acc.aum + ' Mrd. €' : 'Unbekannt'}
Bereits genutzte Services: ${usedServices.length ? usedServices.join(', ') : 'Keine'}
Abgeschlossene Deals: ${wonDeals.length} | Offene Pipeline: ${openPipeline.toLocaleString('de-DE')} €
Aktive Projekte: ${activeProj.length} | Letzter NPS: ${latestNps ?? 'Nicht verfügbar'}
Regulatorischer Status: ${acc.regulatoryStatus || 'Unbekannt'}
Basel IV / Solvency II: ${acc.baselIVStatus || acc.solvencyIIStatus || 'Unbekannt'}

=== Aktuelle öffentliche Informationen (Nachrichten, Geschäftsberichte, Pressemitteilungen) ===
${newsBlock}

=== Identifizierte Opportunity ===
- Kategorie: ${opp.category}
- Empfehlung: ${opp.suggestion}
- KI-Begründung: ${opp.reasoning}
- Konfidenz: ${Math.round((opp.confidence || 0) * 100)}%

Erstelle einen vollständigen, professionellen Vertriebsbericht auf Deutsch. Beziehe aktuelle Nachrichten und öffentliche Fakten explizit ein.
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

    const raw = (await callActiveLlm(prompt, { maxTokens: 1800 })).trim()
    let report
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
      report = JSON.parse(clean.startsWith('{') ? clean : (clean.match(/\{[\s\S]*\}/) || ['{}'])[0])
    } catch {
      report = {
        title: opp.suggestion,
        summary: opp.reasoning || '',
        situation: '', opportunity: opp.suggestion, rationale: opp.reasoning || '',
        approach: '', nextSteps: [], value: '', risks: '',
      }
    }

    res.json({ ...report, oppId: opp.id, accountName: acc.companyName, category: opp.category, confidence: opp.confidence })
  } catch (err) {
    console.error('Report generation error:', err)
    res.status(err.message?.includes('aktive KI-Verbindung') ? 503 : 500).json({ error: err.message })
  }
})

module.exports = router

const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const cron = require('node-cron')

const prisma = new PrismaClient()
const { callActiveLlm } = require('../lib/llm')
const { runNewsAgent } = require('../lib/news-agent')

async function classifyWithLlm(title, snippet, accountName) {
  const prompt = `Klassifiziere diesen Nachrichtenartikel für den Beratungskontext von ${accountName}.

Titel: ${title}
Inhalt: ${snippet}

Antworte NUR mit JSON (kein Text davor/danach):
{
  "sentiment": "opportunity | risk | neutral",
  "summary": "1-2 Sätze Zusammenfassung auf Deutsch",
  "reason": "Kurze Begründung der Klassifikation"
}`

  const raw = (await callActiveLlm(prompt, { maxTokens: 256 })).trim()
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { sentiment: 'neutral', summary: snippet, reason: '' }
  }
}

async function fetchAndStoreNews() {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) {
    console.log('[News] NEWS_API_KEY not set, skipping fetch')
    return
  }

  // Get accounts with keywords + global keywords
  const [accounts, globalKeywords] = await Promise.all([
    prisma.account.findMany({
      select: { id: true, companyName: true },
      include: { monitoringKeywords: true },
    }),
    prisma.monitoringKeyword.findMany({ where: { global: true } }),
  ])

  for (const account of accounts) {
    const keywords = [
      ...account.monitoringKeywords.map((k) => k.keyword),
      ...globalKeywords.map((k) => k.keyword),
      account.companyName,
    ]

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&language=de&pageSize=5&sortBy=publishedAt&apiKey=${apiKey}`
        const resp = await fetch(url)
        if (!resp.ok) continue
        const data = await resp.json()

        for (const article of data.articles || []) {
          // Skip if already stored
          const existing = await prisma.newsItem.findFirst({
            where: { url: article.url },
          })
          if (existing) continue

          let classification = { sentiment: 'neutral', summary: article.description || article.title, reason: '' }
          try {
            classification = await classifyWithLlm(
              article.title,
              article.description || '',
              account.companyName
            )
          } catch {
            // fall through with neutral if no LLM configured
          }

          await prisma.newsItem.create({
            data: {
              accountId: account.id,
              title: article.title,
              url: article.url,
              source: article.source?.name,
              publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
              summary: classification.summary,
              sentiment: classification.sentiment,
              sentimentReason: classification.reason,
            },
          })
        }
      } catch (err) {
        console.error(`[News] Error fetching for ${account.companyName}/${keyword}:`, err.message)
      }
    }
  }

  console.log('[News] Fetch complete')
}

// Daily cron at 07:00
cron.schedule('0 7 * * *', () => {
  console.log('[News] Daily cron triggered')
  fetchAndStoreNews().catch(console.error)
})

// GET /api/news – all news, filterable
router.get('/', async (req, res) => {
  try {
    const where = {}
    if (req.query.accountId) where.accountId = req.query.accountId
    if (req.query.sentiment) where.sentiment = req.query.sentiment

    const items = await prisma.newsItem.findMany({
      where,
      include: { account: { select: { companyName: true, institutionType: true } } },
      orderBy: { fetchedAt: 'desc' },
      take: parseInt(req.query.limit) || 50,
    })
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/news/account/:accountId – news for account
router.get('/account/:accountId', async (req, res) => {
  try {
    const items = await prisma.newsItem.findMany({
      where: { accountId: req.params.accountId },
      orderBy: { fetchedAt: 'desc' },
      take: 20,
    })
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/news/keywords – list keywords
router.get('/keywords', async (req, res) => {
  try {
    const keywords = await prisma.monitoringKeyword.findMany({
      include: { account: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(keywords)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/news/keywords – add keyword
router.post('/keywords', async (req, res) => {
  const { keyword, accountId, global: isGlobal } = req.body
  if (!keyword) return res.status(400).json({ error: 'keyword required' })
  try {
    const kw = await prisma.monitoringKeyword.create({
      data: { keyword, accountId: accountId || null, global: isGlobal || false },
    })
    res.json(kw)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/news/keywords/:id
router.delete('/keywords/:id', async (req, res) => {
  try {
    await prisma.monitoringKeyword.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/news/fetch – manual trigger (NewsAPI)
router.post('/fetch', async (req, res) => {
  if (!process.env.NEWS_API_KEY) {
    return res.status(503).json({ error: 'NEWS_API_KEY not configured' })
  }
  res.json({ message: 'News-Abruf gestartet' })
  fetchAndStoreNews().catch(console.error)
})

// POST /api/news/agent-fetch – AI agent (Google News RSS, no API key needed)
router.post('/agent-fetch', async (req, res) => {
  try {
    const activeLlm = await prisma.llmConfig.findFirst({ where: { isActive: true } })
    if (!activeLlm) {
      return res.status(503).json({ error: 'Keine aktive KI-Verbindung konfiguriert. Bitte unter Einstellungen → KI-Verbindung eine Verbindung aktivieren.' })
    }
    const { accountIds, timeRange, dateFrom, dateTo, language, topics, customKeywords } = req.body
    res.json({ message: 'KI-Agent gestartet' })
    runNewsAgent({ accountIds: accountIds?.length ? accountIds : null, timeRange, dateFrom, dateTo, language, topics, customKeywords }).catch(console.error)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

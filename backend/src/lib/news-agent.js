/**
 * lib/news-agent.js
 * AI agent that uses tool calling to search Google News RSS and classify
 * articles for each account. No external search API key required —
 * uses freely available RSS feeds from Google News.
 *
 * Supports Claude, OpenAI, Azure OpenAI, Gemini.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── RSS parser (no extra packages) ──────────────────────────────────────────

function extractTag(xml, tag) {
  // Matches CDATA or plain content
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const m = xml.match(cdataRe) || xml.match(plainRe)
  return m ? m[1].trim() : ''
}

function parseRSS(xml) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
    const block = m[1]
    const title  = extractTag(block, 'title')
    const url    = extractTag(block, 'link')
    const source = (block.match(/<source[^>]*>([^<]*)<\/source>/) || [])[1]?.trim() || null
    const pubRaw = extractTag(block, 'pubDate')

    let publishedAt = null
    if (pubRaw) {
      try { publishedAt = new Date(pubRaw).toISOString() } catch {}
    }

    if (title && url) items.push({ title, url, source, publishedAt, description: '' })
  }
  return items
}

const RSS_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; CRM-NewsBot/1.0)' }

// ─── Date range helper ────────────────────────────────────────────────────────

function fmtDate(d) { return d.toISOString().split('T')[0] }

function calcDateRange({ timeRange = 'week', dateFrom = null, dateTo = null } = {}) {
  if (timeRange === 'custom' && dateFrom && dateTo) {
    return { from: new Date(dateFrom + 'T00:00:00'), to: new Date(dateTo + 'T23:59:59') }
  }
  const now = new Date()
  const from = new Date(now)
  if (timeRange === 'day')   from.setDate(now.getDate() - 1)
  else if (timeRange === 'month') from.setMonth(now.getMonth() - 1)
  else from.setDate(now.getDate() - 7) // week default
  return { from, to: now }
}

function bingFreshness(timeRange, dateFrom, dateTo) {
  if (timeRange === 'day') return 'Day'
  if (timeRange === 'month') return 'Month'
  if (timeRange === 'custom' && dateFrom && dateTo) {
    const days = (new Date(dateTo) - new Date(dateFrom)) / 86400000
    return days <= 1 ? 'Day' : days <= 7 ? 'Week' : 'Month'
  }
  return 'Week'
}

// ─── Source 1: Google News RSS ────────────────────────────────────────────────

async function searchGoogleNews(query, language = 'de', dateFrom = null, dateTo = null) {
  const lang = language === 'de' ? 'de&gl=DE&ceid=DE:de' : 'en&gl=US&ceid=US:en'
  let q = query
  if (dateFrom) q += ` after:${fmtDate(dateFrom)}`
  if (dateTo)   q += ` before:${fmtDate(dateTo)}`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${lang}&num=6`
  const res = await fetch(url, { headers: RSS_HEADERS })
  if (!res.ok) throw new Error(`Google News ${res.status}`)
  return parseRSS(await res.text())
}

// ─── Source 2: Bing News RSS ──────────────────────────────────────────────────

async function searchBingNews(query, language = 'de', timeRange = 'week', dateFrom = null, dateTo = null) {
  const mkt = language === 'de' ? 'de-DE' : 'en-US'
  const freshness = bingFreshness(timeRange, dateFrom, dateTo)
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${mkt}&count=6&freshness=${freshness}`
  const res = await fetch(url, { headers: RSS_HEADERS })
  if (!res.ok) throw new Error(`Bing News ${res.status}`)
  return parseRSS(await res.text())
}

// ─── Combined search (parallel, deduplicated, multi-language) ─────────────────

async function searchAllSources(query, language = 'de', timeRange = 'week', dateFrom = null, dateTo = null) {
  const langs = language === 'both' ? ['de', 'en'] : [language]

  const promises = langs.flatMap((lang) => [
    searchGoogleNews(query, lang, dateFrom, dateTo),
    searchBingNews(query, lang, timeRange, dateFrom, dateTo),
  ])

  const settled = await Promise.allSettled(promises)
  const seen = new Set()
  const results = []

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url)
          results.push(item)
        }
      }
    } else {
      console.warn('[NewsAgent] Source error:', r.reason?.message)
    }
  }

  return results.slice(0, 12)
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

const TOOL_NAME = 'search_news'
const TOOL_DESCRIPTION =
  'Sucht aktuelle Nachrichtenartikel bei Google News zu einem Thema. Nutze gezielte Suchbegriffe.'
const TOOL_PARAMS = {
  type: 'object',
  properties: {
    query:    { type: 'string', description: 'Suchanfrage, z.B. Firmenname, Thema, Regulierung' },
    language: { type: 'string', description: '"de" für Deutsch, "en" für Englisch', enum: ['de', 'en'] },
  },
  required: ['query'],
}

// ─── Tool executor ────────────────────────────────────────────────────────────

// Injected per-run so tool calls respect the user's chosen settings
let _runConfig = {}

async function executeTool(input) {
  const { language = 'de', timeRange = 'week', dateFrom = null, dateTo = null } = _runConfig
  return searchAllSources(input.query, input.language || language, timeRange, dateFrom, dateTo)
}

// ─── Claude agent loop ────────────────────────────────────────────────────────

async function runAgentClaude(cfg, prompt) {
  const tools = [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: TOOL_PARAMS }]
  let messages = [{ role: 'user', content: prompt }]
  const collectedArticles = []

  for (let round = 0; round < 6; round++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: cfg.model || 'claude-sonnet-4-6', max_tokens: 2048, tools, messages }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Claude Fehler')

    messages.push({ role: 'assistant', content: data.content })

    if (data.stop_reason === 'tool_use') {
      const toolResults = []
      for (const block of data.content) {
        if (block.type !== 'tool_use' || block.name !== TOOL_NAME) continue
        try {
          const articles = await executeTool(block.input)
          collectedArticles.push(...articles)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(articles) })
        } catch (err) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, is_error: true, content: err.message })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    } else {
      const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      return { finalText: text, collectedArticles }
    }
  }
  return { finalText: '', collectedArticles }
}

// ─── OpenAI / Azure OpenAI agent loop ─────────────────────────────────────────

async function runAgentOpenAI(cfg, prompt) {
  const tools = [{ type: 'function', function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: TOOL_PARAMS } }]
  const isAzure = cfg.provider === 'azure_openai'
  const url = isAzure
    ? `${(cfg.endpoint || '').replace(/\/$/, '')}/openai/deployments/${cfg.deploymentName}/chat/completions?api-version=${cfg.apiVersion || '2024-02-01'}`
    : 'https://api.openai.com/v1/chat/completions'
  const headers = isAzure
    ? { 'api-key': cfg.apiKey, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' }

  let messages = [{ role: 'user', content: prompt }]
  const collectedArticles = []

  for (let round = 0; round < 6; round++) {
    const body = { messages, tools, tool_choice: 'auto', max_tokens: 2048 }
    if (!isAzure) body.model = cfg.model || 'gpt-4o'

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI Fehler')

    const msg = data.choices[0].message
    messages.push(msg)

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        try {
          const input = JSON.parse(tc.function.arguments)
          const articles = await executeTool(input)
          collectedArticles.push(...articles)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(articles) })
        } catch (err) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: `Fehler: ${err.message}` })
        }
      }
    } else {
      return { finalText: msg.content || '', collectedArticles }
    }
  }
  return { finalText: '', collectedArticles }
}

// ─── Gemini agent loop ────────────────────────────────────────────────────────

async function runAgentGemini(cfg, prompt) {
  const model = cfg.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`
  const tools = [{ functionDeclarations: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: TOOL_PARAMS }] }]

  let contents = [{ role: 'user', parts: [{ text: prompt }] }]
  const collectedArticles = []

  for (let round = 0; round < 6; round++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, tools }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler')

    const parts = data.candidates?.[0]?.content?.parts || []
    contents.push({ role: 'model', parts })

    const funcCalls = parts.filter((p) => p.functionCall)
    if (funcCalls.length) {
      const responseParts = []
      for (const p of funcCalls) {
        try {
          const articles = await executeTool(p.functionCall.args)
          collectedArticles.push(...articles)
          responseParts.push({ functionResponse: { name: p.functionCall.name, response: { results: articles } } })
        } catch (err) {
          responseParts.push({ functionResponse: { name: p.functionCall.name, response: { error: err.message } } })
        }
      }
      contents.push({ role: 'user', parts: responseParts })
    } else {
      const text = parts.filter((p) => p.text).map((p) => p.text).join('')
      return { finalText: text, collectedArticles }
    }
  }
  return { finalText: '', collectedArticles }
}

const TOPIC_LABELS = {
  regulation: 'Regulierung & Compliance (BaFin, Basel, Solvency, DSGVO)',
  market:     'Markt & Wettbewerb (Marktanteile, neue Anbieter, Preisdruck)',
  esg:        'ESG & Nachhaltigkeit (Klimaziele, Taxonomie, Greenwashing)',
  tech:       'Technologie & Innovation (KI, Digitalisierung, Cybersecurity)',
  ma:         'M&A & Übernahmen (Fusionen, Beteiligungen, Partnerschaften)',
  finance:    'Finanzen & Ergebnisse (Quartalsbericht, Gewinn, Rating)',
  people:     'Personal & Management (Vorstandswechsel, Stellenabbau)',
  risk:       'Risikomanagement (Kreditrisiko, Liquidität, Stress-Test)',
}

const TIME_LABEL = { day: 'letzten 24 Stunden', week: 'letzten 7 Tage', month: 'letzten 30 Tage' }

// ─── Run agent for one account ────────────────────────────────────────────────

async function runAgentForAccount(cfg, account, globalKeywords, runConfig = {}) {
  const { language = 'de', timeRange = 'week', topics = [], customKeywords = [], dateFrom = null, dateTo = null } = runConfig

  const keywords = [
    account.companyName,
    ...account.monitoringKeywords.map((k) => k.keyword),
    ...globalKeywords.map((k) => k.keyword),
    ...customKeywords,
  ]

  const topicContext = topics.length > 0
    ? `\nFokus-Themen für diese Suche:\n${topics.map((t) => `- ${TOPIC_LABELS[t] || t}`).join('\n')}`
    : ''

  const langNote = language === 'both'
    ? 'Suche auf Deutsch UND Englisch (nutze language="de" und language="en").'
    : language === 'en' ? 'Suche auf Englisch (language="en").' : 'Suche auf Deutsch (language="de").'

  const timeContext = timeRange === 'custom' && dateFrom && dateTo
    ? `vom ${dateFrom} bis ${dateTo}`
    : TIME_LABEL[timeRange] || 'letzten 7 Tage'

  const prompt = `Du bist ein News-Recherche-Agent für das CRM-System eines Beratungsunternehmens.

Aufgabe: Recherchiere Nachrichten der ${timeContext} für den Account "${account.companyName}" (Branche: ${account.institutionType || 'Finanzdienstleistungen'}).
WICHTIG: Nur Artikel aus diesem Zeitraum aufnehmen. Artikel mit Datum außerhalb dieses Zeitraums weglassen.

Suchbegriffe: ${keywords.slice(0, 8).join(', ')}
${topicContext}

${langNote}
Führe 3-5 gezielte Suchanfragen mit dem search_news Tool durch — variiere die Suchbegriffe für maximale Abdeckung.

Antworte nach den Suchen NUR mit einem JSON-Array ohne Markdown oder sonstigen Text:
[
  {
    "title": "Artikeltitel",
    "url": "https://...",
    "source": "quellname",
    "publishedAt": "ISO-Datum oder null",
    "summary": "1-2 Sätze Zusammenfassung auf Deutsch",
    "sentiment": "opportunity",
    "sentimentReason": "Warum opportunity/risk/neutral für diesen Account"
  }
]

Erlaubte sentiment-Werte: "opportunity", "risk", "neutral"
Nur relevante Artikel aufnehmen. Maximal 10 Artikel.`

  // Inject run config so tool calls use correct language/timeRange
  _runConfig = runConfig

  let result
  switch (cfg.provider) {
    case 'claude':
      result = await runAgentClaude(cfg, prompt)
      break
    case 'openai':
    case 'azure_openai':
      result = await runAgentOpenAI(cfg, prompt)
      break
    case 'gemini':
      result = await runAgentGemini(cfg, prompt)
      break
    default:
      throw new Error(`Unbekannter Provider: ${cfg.provider}`)
  }

  const { finalText, collectedArticles } = result

  // Parse classified JSON from LLM final message
  let classified = []
  try {
    const clean = finalText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    const jsonStr = clean.startsWith('[') ? clean : (clean.match(/\[[\s\S]*\]/) || ['[]'])[0]
    classified = JSON.parse(jsonStr)
  } catch {
    // Fallback: use raw collected articles with neutral sentiment
    classified = collectedArticles.slice(0, 8).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt,
      summary: a.title,
      sentiment: 'neutral',
      sentimentReason: '',
    }))
  }

  // Calculate date range for filtering
  const { from: rangeFrom, to: rangeTo } = calcDateRange(runConfig)

  // Store new articles only
  let stored = 0
  const seen = new Set()
  for (const art of Array.isArray(classified) ? classified : []) {
    if (!art.url || seen.has(art.url)) continue
    seen.add(art.url)

    const existing = await prisma.newsItem.findFirst({ where: { url: art.url } })
    if (existing) continue

    try {
      let pubDate = null
      if (art.publishedAt && art.publishedAt !== 'null') {
        try { pubDate = new Date(art.publishedAt) } catch {}
      }

      // Skip articles whose date is outside the requested range
      if (pubDate && (pubDate < rangeFrom || pubDate > rangeTo)) {
        console.log(`[NewsAgent] Skipping out-of-range: ${art.title?.slice(0, 60)} (${art.publishedAt})`)
        continue
      }

      await prisma.newsItem.create({
        data: {
          accountId: account.id,
          title: art.title || '(Kein Titel)',
          url: art.url,
          source: art.source || null,
          publishedAt: pubDate,
          summary: art.summary || '',
          sentiment: ['opportunity', 'risk', 'neutral'].includes(art.sentiment) ? art.sentiment : 'neutral',
          sentimentReason: art.sentimentReason || '',
        },
      })
      stored++
    } catch (err) {
      console.error(`[NewsAgent] DB-Fehler für ${art.url}:`, err.message)
    }
  }

  return stored
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the news agent.
 * @param {Object} config
 * @param {string[]|null} config.accountIds     - null = all accounts
 * @param {string}        config.timeRange      - 'day' | 'week' | 'month' | 'custom'
 * @param {string|null}   config.dateFrom       - YYYY-MM-DD, used when timeRange='custom'
 * @param {string|null}   config.dateTo         - YYYY-MM-DD, used when timeRange='custom'
 * @param {string}        config.language       - 'de' | 'en' | 'both'
 * @param {string[]}      config.topics         - topic ids to focus on
 * @param {string[]}      config.customKeywords - extra search terms
 */
async function runNewsAgent(config = {}) {
  const { accountIds = null, timeRange = 'week', dateFrom = null, dateTo = null, language = 'de', topics = [], customKeywords = [] } = config

  const cfg = await prisma.llmConfig.findFirst({ where: { isActive: true } })
  if (!cfg) throw new Error('Keine aktive KI-Verbindung konfiguriert')

  const where = accountIds?.length ? { id: { in: accountIds } } : {}
  const [accounts, globalKeywords] = await Promise.all([
    prisma.account.findMany({
      where,
      select: { id: true, companyName: true, institutionType: true, monitoringKeywords: true },
    }),
    prisma.monitoringKeyword.findMany({ where: { global: true } }),
  ])

  const runConfig = { timeRange, dateFrom, dateTo, language, topics, customKeywords }
  let total = 0

  for (const account of accounts) {
    try {
      const count = await runAgentForAccount(cfg, account, globalKeywords, runConfig)
      total += count
      console.log(`[NewsAgent] ${account.companyName}: ${count} neue Artikel`)
    } catch (err) {
      console.error(`[NewsAgent] Fehler für ${account.companyName}:`, err.message)
    }
  }

  console.log(`[NewsAgent] Fertig — ${total} Artikel gespeichert`)
  return total
}

// ─── Company context search (for AI Opportunities) ────────────────────────────

/**
 * Fetches real public information about a company from multiple search queries.
 * Used to ground AI opportunity analysis in actual recent data.
 *
 * @param {string} companyName
 * @param {string} industry  - e.g. 'Bank', 'Versicherung'
 * @returns {Promise<Array>} up to 20 deduplicated articles
 */
async function searchCompanyContext(companyName, industry = '') {
  const year = new Date().getFullYear()
  const prevYear = year - 1

  const queries = [
    // Recent company news
    companyName,
    // Annual / quarterly reports
    `"${companyName}" Geschäftsbericht OR Jahresbericht OR "annual report" ${prevYear} OR ${year}`,
    // Financial performance
    `"${companyName}" Ergebnis OR Umsatz OR Gewinn OR Quartalsbericht ${year}`,
    // Strategy & transformation
    `"${companyName}" Strategie OR Transformation OR Investition OR Partnerschaft`,
    // Regulatory pressure specific to the industry
    industry ? `"${industry}" Regulierung OR Compliance OR BaFin OR DSGVO ${year}` : null,
  ].filter(Boolean)

  const seen = new Set()
  const results = []

  // Run all queries in parallel; a source failure doesn't abort the rest
  await Promise.allSettled(
    queries.map(async (q) => {
      // Use searchAllSources with 'month' range so we get recent data
      const items = await searchAllSources(q, 'de', 'month').catch(() => [])
      for (const item of items) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url)
          results.push(item)
        }
      }
    })
  )

  // Sort by date descending (nulls last), cap at 20
  return results
    .sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0
      if (!a.publishedAt) return 1
      if (!b.publishedAt) return -1
      return new Date(b.publishedAt) - new Date(a.publishedAt)
    })
    .slice(0, 20)
}

/**
 * Format context articles as a compact text block for LLM prompts.
 */
function formatNewsContext(articles) {
  if (!articles.length) return '(Keine aktuellen öffentlichen Informationen gefunden)'
  return articles.map((a) => {
    const date = a.publishedAt ? a.publishedAt.split('T')[0] : 'Datum unbekannt'
    const src  = a.source ? ` | ${a.source}` : ''
    return `• [${date}${src}] ${a.title}`
  }).join('\n')
}

module.exports = { runNewsAgent, searchCompanyContext, formatNewsContext }

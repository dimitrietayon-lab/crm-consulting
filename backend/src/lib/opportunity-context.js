const { searchCompanyContext } = require('./news-agent')

function norm(value) {
  return String(value || '').toLowerCase().trim()
}

function usedLabels(account) {
  const labels = new Set()
  for (const deal of account.deals || []) {
    if (deal.serviceType) labels.add(norm(deal.serviceType))
  }
  for (const project of account.projects || []) {
    if (project.projectType) labels.add(norm(project.projectType))
  }
  return labels
}

function matchesLabel(service, labels) {
  const name = norm(service.name)
  const category = norm(service.category)
  for (const label of labels) {
    if (!label) continue
    if (label === name || label === category) return true
    if (name && (label.includes(name) || name.includes(label))) return true
    if (category && (label.includes(category) || category.includes(label))) return true
  }
  return false
}

function splitCatalog(catalog, labels) {
  const used = []
  const missing = []
  for (const service of catalog) {
    if (matchesLabel(service, labels)) used.push(service)
    else missing.push(service)
  }
  return { used, missing }
}

function formatServiceLine(service, articles) {
  const cat = service.category ? ` [${service.category}]` : ''
  const desc = service.description ? ` — ${service.description}` : ''
  const hits = matchingSourceIndexes(service, articles)
  const news = hits.length ? ` | passende Quellen: [${hits.join('], [')}]` : ' | passende Quellen: keine'
  return `- ${service.id} | ${service.name}${cat}${desc}${news}`
}

function toIsoDate(value) {
  if (!value) return 'Datum unbekannt'
  try {
    return new Date(value).toISOString().split('T')[0]
  } catch {
    return 'Datum unbekannt'
  }
}

function articlesFromNewsItems(items) {
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
    summary: item.summary || '',
    sentiment: item.sentiment || '',
  }))
}

function formatArticles(articles) {
  if (!articles.length) return '(Keine aktuellen öffentlichen Informationen gefunden)'
  return articles.map((article, index) => {
    const date = toIsoDate(article.publishedAt)
    const src = article.source || 'Quelle unbekannt'
    const lines = [`[${index + 1}] ${date} | ${src} | ${article.title}`]
    if (article.summary) lines.push(`    Zusammenfassung: ${String(article.summary).slice(0, 400)}`)
    if (article.sentiment) lines.push(`    Sentiment: ${article.sentiment}`)
    if (article.url) lines.push(`    URL: ${article.url}`)
    return lines.join('\n')
  }).join('\n\n')
}

const STOP_TOKENS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines',
  'für', 'mit', 'von', 'im', 'in', 'auf', 'ist', 'sind', 'the', 'and', 'for', 'with',
  'assessment', 'review', 'workshop', 'framework', 'management', 'analyse', 'analysis',
  'service', 'end', 'to', 'of', 'für', 'support', 'planung', 'planning',
])

function compactText(value) {
  return norm(value).replace(/[^a-z0-9äöüß]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function serviceKeywords(service) {
  if (!service) return []
  const raw = `${service.name || ''} ${service.category || ''} ${service.description || ''}`
  return [...new Set(
    raw.split(/[^a-zA-ZäöüÄÖÜß0-9]+/)
      .map(norm)
      .filter((t) => t.length >= 4 && !STOP_TOKENS.has(t))
  )]
}

function articleText(article) {
  return `${article.title || ''} ${article.summary || ''}`
}

function articleFitsTopic(article, service) {
  const hay = compactText(articleText(article))
  if (!hay) return false
  return serviceKeywords(service).some((k) => hay.includes(k))
}

function quoteMatchesArticle(quote, article) {
  const q = compactText(quote)
  if (q.length < 18) return false
  const hay = compactText(articleText(article))
  if (!hay) return false
  if (hay.includes(q)) return true
  const words = q.split(' ')
  if (words.length < 4) return false
  const windowSize = Math.min(6, words.length)
  for (let i = 0; i <= words.length - windowSize; i++) {
    const slice = words.slice(i, i + windowSize).join(' ')
    if (slice.length >= 18 && hay.includes(slice)) return true
  }
  return false
}

function isRegulatoryService(service) {
  const blob = `${service?.name || ''} ${service?.category || ''}`
  return /dora|basel|solvency|regul|compliance|bafin|ict|dsgvo|nfrd|csrd/i.test(blob)
}

function matchingSourceIndexes(service, articles) {
  const indexes = []
  ;(articles || []).forEach((article, i) => {
    if (articleFitsTopic(article, service)) indexes.push(i + 1)
  })
  return indexes
}

function sourcePayload(article, role, quote) {
  const excerpt = String(quote || article.summary || article.title || '').slice(0, 280)
  return {
    title: article.title,
    url: article.url,
    source: article.source || null,
    publishedAt: article.publishedAt || null,
    sentiment: article.sentiment || null,
    role,
    quote: excerpt,
  }
}

function citedEntries(raw) {
  if (Array.isArray(raw?.sources) && raw.sources.length) return raw.sources
  return (raw?.sourceIds || []).map((id) => ({ id }))
}

function groundSources(raw, articles, service) {
  const seen = new Set()
  const result = []

  const push = (article, role, quote) => {
    if (!article?.url || seen.has(article.url)) return
    seen.add(article.url)
    result.push(sourcePayload(article, role, quote))
  }

  for (const article of articles || []) {
    if (result.filter((s) => s.role === 'topic').length >= 3) break
    if (articleFitsTopic(article, service)) {
      push(article, 'topic', article.summary || article.title)
    }
  }

  for (const entry of citedEntries(raw)) {
    const index = Number(entry.id ?? entry.sourceId) - 1
    if (!Number.isInteger(index) || index < 0 || index >= (articles || []).length) continue
    const article = articles[index]
    const quote = entry.quote || ''
    if (!quoteMatchesArticle(quote, article)) continue

    if (articleFitsTopic(article, service)) {
      push(article, 'topic', quote)
      continue
    }

    const role = entry.role === 'timing' ? 'timing' : 'topic'
    if (role !== 'timing') continue
    if (isRegulatoryService(service)) continue
    push(article, 'timing', quote)
  }

  return result.slice(0, 5)
}

function buildCrmEvidence(ctx, service, category) {
  const items = []
  if (!service) return items

  const onMissing = ctx.missing.some((s) => s.id === service.id)
  const onUsed = ctx.used.some((s) => s.id === service.id)
  if (onMissing) {
    items.push({
      kind: 'gap',
      text: `„${service.name}“ ist über Deals/Projekte nicht abgedeckt (White-Space).`,
    })
  } else if (onUsed) {
    items.push({
      kind: 'coverage',
      text: `„${service.name}“ ist bereits im Einsatz — Kategorie ${category === 'renewal' ? 'Verlängerung' : 'Upsell'}.`,
    })
  }

  const peer = (ctx.peers || []).find((p) => p.service.id === service.id)
  if (peer?.peerTotal) {
    items.push({
      kind: 'peer',
      text: `${peer.peerCount} von ${peer.peerTotal} ähnlichen Accounts (Branche: ${ctx.account.institutionType}) nutzen diesen Service.`,
    })
  }

  if (ctx.latestNps != null) {
    items.push({
      kind: 'nps',
      text: `Letzter NPS: ${ctx.latestNps}${ctx.latestNpsComment ? ` — „${ctx.latestNpsComment}“` : ''}.`,
    })
  }

  const plan = ctx.account.accountPlan
  if (plan?.strategicGoals || plan?.ourPositioning) {
    items.push({
      kind: 'plan',
      text: [plan.ourPositioning && `Positionierung: ${plan.ourPositioning}`, plan.strategicGoals && `Ziele: ${plan.strategicGoals}`]
        .filter(Boolean)
        .join(' '),
    })
  }

  const soon = (ctx.contracts || []).find((c) => {
    const dates = [c.renewalReminder, c.endDate].filter(Boolean)
    return dates.some((d) => {
      const days = (new Date(d).getTime() - Date.now()) / 86400000
      return days >= -30 && days <= 365
    })
  })
  if (soon) {
    items.push({
      kind: 'contract',
      text: `Vertrag${soon.endDate ? ` endet ${toIsoDate(soon.endDate)}` : ''}${soon.renewalReminder ? `, Reminder ${toIsoDate(soon.renewalReminder)}` : ''}.`,
    })
  }

  return items
}

function findService(raw, catalog) {
  if (!catalog.length) return null
  const byId = new Map(catalog.map((s) => [s.id, s]))
  if (raw.serviceId && byId.has(raw.serviceId)) return byId.get(raw.serviceId)

  const needle = norm(raw.serviceId || raw.serviceName || raw.suggestion)
  if (!needle) return null
  return catalog.find((s) => {
    const name = norm(s.name)
    const category = norm(s.category)
    return needle === name || needle === category || needle.includes(name) || name.includes(needle)
  }) || null
}

function allowedIds(category, used, missing) {
  if (category === 'upsell' || category === 'renewal') {
    return new Set((used.length ? used : [...used, ...missing]).map((s) => s.id))
  }
  return new Set((missing.length ? missing : used).map((s) => s.id))
}

function parseJsonArray(raw) {
  const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

async function peerAdoption(prisma, account, missing) {
  if (!missing.length || !account.institutionType) return []
  const similar = await prisma.account.findMany({
    where: { institutionType: account.institutionType, id: { not: account.id } },
    include: {
      deals: { select: { serviceType: true } },
      projects: { select: { projectType: true } },
    },
  })
  const peerCount = similar.length
  if (!peerCount) return []

  return missing.map((service) => {
    const count = similar.filter((peer) => matchesLabel(service, usedLabels(peer))).length
    return { service, peerCount: count, peerTotal: peerCount }
  }).sort((a, b) => b.peerCount - a.peerCount)
}

async function loadOpportunityContext(prisma, accountId) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      deals: { orderBy: { createdAt: 'desc' }, take: 10 },
      projects: { orderBy: { createdAt: 'desc' }, take: 5 },
      npsScores: { orderBy: { date: 'desc' }, take: 3 },
      accountPlan: { include: { actions: { where: { done: false }, take: 8, orderBy: { dueDate: 'asc' } } } },
    },
  })
  if (!account) return null

  const [catalog, newsItems] = await Promise.all([
    prisma.serviceCatalog.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.newsItem.findMany({
      where: { accountId },
      orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
      take: 15,
    }),
  ])

  const labels = usedLabels(account)
  const { used, missing } = splitCatalog(catalog, labels)
  const [peers, contracts, lostDeals] = await Promise.all([
    peerAdoption(prisma, account, missing),
    prisma.contract.findMany({
      where: { accountId },
      orderBy: { endDate: 'asc' },
      take: 8,
    }),
    prisma.deal.findMany({
      where: { accountId, stage: 'Closed Lost', NOT: { lossReason: null } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { title: true, serviceType: true, lossReason: true },
    }),
  ])

  let articles = articlesFromNewsItems(newsItems)
  let newsOrigin = 'stored'
  if (!articles.length) {
    articles = await searchCompanyContext(account.companyName, account.institutionType).catch(() => [])
    newsOrigin = articles.length ? 'live-fallback' : 'none'
  }

  const usedServices = [...new Set(account.deals.map((d) => d.serviceType).filter(Boolean))]
  const wonDeals = account.deals.filter((d) => d.stage === 'Closed Won')
  const openPipeline = account.deals
    .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
    .reduce((sum, deal) => sum + (deal.value || 0), 0)
  const latestNpsRow = account.npsScores[0] || null

  return {
    account,
    catalog,
    used,
    missing,
    peers,
    articles,
    newsOrigin,
    usedServices,
    wonDeals,
    openPipeline,
    contracts,
    lostDeals,
    latestNps: latestNpsRow?.score ?? null,
    latestNpsComment: latestNpsRow?.comment || null,
    activeProjects: account.projects.filter((p) => p.status === 'Active').length,
  }
}

function buildCrmBlock(ctx) {
  const {
    account, usedServices, wonDeals, openPipeline, latestNps, latestNpsComment,
    activeProjects, used, missing, peers, contracts, lostDeals,
  } = ctx
  const peerLines = peers.length
    ? peers.map((p) => `- ${p.service.name}: ${p.peerCount} von ${p.peerTotal} ähnlichen Accounts`).join('\n')
    : '(Keine Peer-Daten)'

  const plan = account.accountPlan
  const planBlock = plan
    ? `=== Account-Plan ===
- Positionierung: ${plan.ourPositioning || 'Nicht hinterlegt'}
- Strategische Ziele: ${plan.strategicGoals || 'Nicht hinterlegt'}
- Offene Aktionen: ${plan.actions?.length ? plan.actions.map((a) => a.description).join('; ') : 'Keine'}`
    : '=== Account-Plan ===\n(Kein Account-Plan hinterlegt)'

  const contractLines = (contracts || []).length
    ? contracts.map((c) => {
      const end = c.endDate ? toIsoDate(c.endDate) : 'ohne Enddatum'
      const remind = c.renewalReminder ? `, Reminder ${toIsoDate(c.renewalReminder)}` : ''
      const val = c.value != null ? `, ${Number(c.value).toLocaleString('de-DE')} €` : ''
      return `- Vertrag bis ${end}${remind}${val}`
    }).join('\n')
    : '(Keine Verträge)'

  const lostLines = (lostDeals || []).length
    ? lostDeals.map((d) => `- ${d.title}${d.serviceType ? ` [${d.serviceType}]` : ''}: ${d.lossReason}`).join('\n')
    : '(Keine dokumentierten Verlustgründe)'

  const npsLine = latestNps == null
    ? 'Kein NPS verfügbar'
    : `${latestNps}${latestNpsComment ? ` — „${latestNpsComment}"` : ''}`

  return `=== CRM-Daten ===
- Name: ${account.companyName}
- Branche: ${account.institutionType}
- Land: ${account.country || 'Nicht angegeben'}
- Mitarbeiter: ${account.numberOfEmployees || 'Unbekannt'}
- AuM / Bilanzsumme: ${account.aum ? account.aum + ' Mrd.' : 'Unbekannt'}
- Bereits genutzte Services (Deals): ${usedServices.length ? usedServices.join(', ') : 'Keine'}
- Abgedeckte Katalog-Services: ${used.length ? used.map((s) => s.name).join(', ') : 'Keine'}
- White-Space (nicht abgedeckt): ${missing.length ? missing.map((s) => s.name).join(', ') : 'Keiner — alle Katalog-Services sind abgedeckt'}
- Abgeschlossene Deals: ${wonDeals.length}
- Offene Pipeline: ${openPipeline.toLocaleString('de-DE')} €
- Aktive Projekte: ${activeProjects}
- Letzter NPS: ${npsLine}
- Regulatorischer Status: ${account.regulatoryStatus || 'Unbekannt'}
- Basel IV / Solvency II: ${account.baselIVStatus || account.solvencyIIStatus || 'Unbekannt'}

${planBlock}

=== Verträge / Renewal ===
${contractLines}

=== Verlorene Deals (nicht wiederholen) ===
${lostLines}

=== Peer-Adoption fehlender Services (gleiche Branche) ===
${peerLines}`
}

function buildCatalogBlock(ctx) {
  const { missing, used, catalog } = ctx
  if (!catalog.length) {
    return '=== Service-Katalog ===\n(Kein Katalog gepflegt — schlage nur allgemein plausible Beratungsleistungen vor.)'
  }
  const missingBlock = missing.length
    ? missing.map((s) => formatServiceLine(s, ctx.articles)).join('\n')
    : '(leer — alle Services sind bereits im Einsatz; nur Upsell/Renewal erlaubt)'
  const usedBlock = used.length ? used.map((s) => formatServiceLine(s, ctx.articles)).join('\n') : '(keine)'
  return `=== Service-Katalog: White-Space (für cross-sell / new-service) ===
${missingBlock}

=== Service-Katalog: bereits genutzt (nur upsell / renewal) ===
${usedBlock}`
}

const SCORE_WEIGHTS = { gap: 0.4, news: 0.3, timing: 0.2, peer: 0.1 }

function round2(n) {
  return Math.round(n * 100) / 100
}

function gapScore(service, used, missing, category) {
  if (!service) return 0.4
  if (missing.some((s) => s.id === service.id)) return 1
  if (used.some((s) => s.id === service.id)) return category === 'renewal' ? 0.7 : 0.45
  return 0.3
}

function newsScore(sources) {
  const topic = (sources || []).filter((s) => s.role === 'topic')
  if (!topic.length) return 0
  let base = Math.min(1, topic.length / 3)
  const sentiments = topic.map((s) => norm(s.sentiment))
  if (sentiments.some((s) => s.includes('neg'))) base = Math.min(1, base + 0.2)
  else if (sentiments.some((s) => s.includes('pos'))) base = Math.min(1, base + 0.1)
  return base
}

function renewalUrgency(contracts) {
  let best = 0
  const now = Date.now()
  for (const contract of contracts || []) {
    for (const raw of [contract.renewalReminder, contract.endDate]) {
      if (!raw) continue
      const days = (new Date(raw).getTime() - now) / 86400000
      if (days < -30) continue
      if (days < 0) best = Math.max(best, 0.85)
      else if (days <= 90) best = Math.max(best, 1)
      else if (days <= 180) best = Math.max(best, 0.6)
      else if (days <= 365) best = Math.max(best, 0.3)
    }
  }
  return best
}

function npsUrgency(score) {
  if (score == null) return 0.25
  if (score <= 6) return 0.85
  if (score <= 8) return 0.5
  return 0.35
}

function peerScore(service, peers) {
  const row = (peers || []).find((p) => p.service.id === service?.id)
  if (!row || !row.peerTotal) return 0
  return row.peerCount / row.peerTotal
}

function scoreOpportunity({ service, category, sources }, ctx) {
  const gap = gapScore(service, ctx.used, ctx.missing, category)
  const news = newsScore(sources)
  const renewal = renewalUrgency(ctx.contracts)
  const nps = npsUrgency(ctx.latestNps)
  const timing = Math.max(renewal, nps)
  const peer = peerScore(service, ctx.peers)
  const topicCount = (sources || []).filter((s) => s.role === 'topic').length
  const newsFit = topicCount >= 2 ? 'strong' : topicCount === 1 ? 'weak' : 'none'

  const weighted = {
    gap: gap * SCORE_WEIGHTS.gap,
    news: news * SCORE_WEIGHTS.news,
    timing: timing * SCORE_WEIGHTS.timing,
    peer: peer * SCORE_WEIGHTS.peer,
  }
  const total = weighted.gap + weighted.news + weighted.timing + weighted.peer

  let trigger = 'gap'
  let triggerWeight = weighted.gap
  for (const [key, value] of Object.entries(weighted)) {
    if (value > triggerWeight) {
      trigger = key
      triggerWeight = value
    }
  }
  if (trigger === 'timing') trigger = renewal >= nps ? 'renewal' : 'nps'

  return {
    confidence: round2(Math.min(1, Math.max(0, total))),
    scoreBreakdown: {
      gap: round2(gap),
      news: round2(news),
      timing: round2(timing),
      peer: round2(peer),
      weights: SCORE_WEIGHTS,
      trigger,
      newsFit,
      crmEvidence: buildCrmEvidence(ctx, service, category),
    },
  }
}

module.exports = {
  loadOpportunityContext,
  buildCrmBlock,
  buildCatalogBlock,
  formatArticles,
  groundSources,
  findService,
  allowedIds,
  parseJsonArray,
  scoreOpportunity,
  SCORE_WEIGHTS,
}

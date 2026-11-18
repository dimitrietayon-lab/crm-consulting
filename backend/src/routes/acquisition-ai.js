/**
 * acquisition-ai.js
 * KI-Unterstützung für die Akquise: Recherche, E-Mail-Entwurf,
 * Zusammenfassung, nächste Schritte, Use Cases und Insights.
 * Nutzt die aktive KI-Verbindung (lib/llm, callActiveLlm).
 */

const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const { callActiveLlm } = require('../lib/llm')
const { getPipelineForTarget } = require('../lib/acquisitionPipeline')
const { aggregateFlagSets } = require('../lib/acquisitionStatuses')

const prisma = new PrismaClient()

const MAX_CONTEXT_ACTIVITIES = 12

function dateStr(value) {
  if (!value) return '—'
  try { return new Date(value).toISOString().slice(0, 10) } catch { return '—' }
}

function euro(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}

async function loadTarget(id) {
  return prisma.acquisitionTarget.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], take: 5 },
      activities: { orderBy: { date: 'desc' }, take: MAX_CONTEXT_ACTIVITIES },
      offers: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })
}

function buildContext(target) {
  const contacts = (target.contacts || []).map((c) =>
    `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.email ? `, ${c.email}` : ''}`
  )
  const activities = (target.activities || []).map((a) =>
    `- ${dateStr(a.date)} ${a.type}${a.summary ? `: ${String(a.summary).replace(/\s+/g, ' ').slice(0, 240)}` : ''}`
  )
  const offers = (target.offers || []).map((o) =>
    `- ${o.offerNumber}: ${euro(o.value)} · ${o.status}${o.validUntil ? ` · gültig bis ${dateStr(o.validUntil)}` : ''}`
  )
  const step = getPipelineForTarget(target).byStatus.get(target.status)

  return [
    `Unternehmen: ${target.companyName}`,
    `Branche: ${target.segment || '—'}`,
    `Region: ${target.postalCode ? `${target.postalCode} ` : ''}${target.location || '—'}${target.bundesland ? `, ${target.bundesland}` : ''}`,
    `Mitarbeiter: ${target.numberOfEmployees ?? '—'}`,
    `Priorität: ${target.priority || '—'} · Paket: ${target.package || '—'}`,
    `Aktueller Schritt: ${step?.label || target.status}`,
    `Angebotswert: ${euro(target.offerValue)} · Selbsttest-Score: ${target.selfTestScore ?? '—'}`,
    `Ansprechpartner (primär): ${target.contactName || '—'}${target.contactTitle ? `, ${target.contactTitle}` : ''}`,
    target.nextStep ? `Nächster Schritt: ${target.nextStep} (${dateStr(target.nextStepDue)})` : 'Nächster Schritt: —',
    target.notes ? `Notizen: ${String(target.notes).replace(/\s+/g, ' ').slice(0, 600)}` : 'Notizen: —',
    contacts.length ? `Kontakte:\n${contacts.join('\n')}` : 'Kontakte: —',
    activities.length ? `Letzte Aktivitäten:\n${activities.join('\n')}` : 'Letzte Aktivitäten: —',
    offers.length ? `Angebote:\n${offers.join('\n')}` : 'Angebote: —',
  ].join('\n')
}

function requireTarget(req, res, next) {
  if (!req.body || typeof req.body.targetId !== 'string' || !req.body.targetId) {
    return res.status(400).json({ error: 'targetId fehlt' })
  }
  next()
}

function fail(res, err) {
  const msg = err?.message || 'KI-Fehler'
  if (/Keine aktive KI-Verbindung/.test(msg)) return res.status(503).json({ error: msg })
  return res.status(502).json({ error: msg })
}

async function generate(res, target, prompt, maxTokens) {
  try {
    const text = (await callActiveLlm(prompt, { maxTokens })).trim()
    return res.json({ text, targetId: target.id, companyName: target.companyName })
  } catch (err) {
    return fail(res, err)
  }
}

// POST /api/acquisition-ai/research
router.post('/research', requireTarget, async (req, res) => {
  try {
    const target = await loadTarget(req.body.targetId)
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' })
    const prompt = `Du bist ein erfahrener B2B-Vertriebsstratege im Bereich KI-Readiness-Beratung. Erstelle auf Basis der folgenden Daten ein kurzes Recherche-Profil (max. 250 Wörter, Deutsch, Du-Form vermeiden, Sie-Form ok). Gliedere in: 1) Unternehmensprofil, 2) Mögliche KI-Ansatzpunkte, 3) Schmerzpunkte/Hypothesen, 4) Entscheider-Rollen, 5) Nächste Recherchefrage. Erfinde keine Fakten; kennzeichne Annahmen als Hypothese.\n\nDATEN:\n${buildContext(target)}`
    return await generate(res, target, prompt, 900)
  } catch (err) {
    return fail(res, err)
  }
})

// POST /api/acquisition-ai/email
router.post('/email', requireTarget, async (req, res) => {
  try {
    const target = await loadTarget(req.body.targetId)
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' })
    const sender = req.user?.name || 'Ihr innolab Team'
    const prompt = `Du schreibst eine kalte B2B-E-Mail (Deutsch, Sie-Form, max. 160 Wörter) für einen KI-Readiness-Sprint. Ausgabeformat exakt:\nBetreff: <Betreff>\n\n<E-Mail-Text>\n\nAbsender: ${sender} (innolab)\nBeziehe dich auf Branche, Anlass und einen konkreten Nutzen. Nenne genau einen Terminvorschlag (in 5 Werktagen). Keine Floskeln, keine erfundenen Referenzen. Prüfe § 7 UWG: Der Text dient als Entwurf, der Versand erfolgt nur mit Einwilligung.\n\nDATEN:\n${buildContext(target)}`
    return await generate(res, target, prompt, 700)
  } catch (err) {
    return fail(res, err)
  }
})

// POST /api/acquisition-ai/summary
router.post('/summary', requireTarget, async (req, res) => {
  try {
    const target = await loadTarget(req.body.targetId)
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' })
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 3000) : ''
    const prompt = `Fasse den Akquise-Stand des folgenden Zielkunden in max. 180 Wörtern zusammen (Deutsch). Gliedere in: Kernaussagen, offene Punkte, Risiken, Empfehlung für den nächsten Schritt. Erfinde nichts.\n\nDATEN:\n${buildContext(target)}${note ? `\n\nZusätzliche Notiz zu diesem Schritt:\n${note}` : ''}`
    return await generate(res, target, prompt, 800)
  } catch (err) {
    return fail(res, err)
  }
})

// POST /api/acquisition-ai/nextsteps
router.post('/nextsteps', requireTarget, async (req, res) => {
  try {
    const target = await loadTarget(req.body.targetId)
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' })
    const prompt = `Schlage genau drei konkrete nächste Schritte für diesen Akquise-Zielkunden vor (Deutsch). Format: je eine Zeile\n1. <Schritt> — <Begründung>\n2. ...\n3. ...\nBeachte den aktuellen Schritt und die letzten Aktivitäten; kein Schritt darf die Pipeline-Reihenfolge überspringen.\n\nDATEN:\n${buildContext(target)}`
    return await generate(res, target, prompt, 500)
  } catch (err) {
    return fail(res, err)
  }
})

// POST /api/acquisition-ai/usecases
router.post('/usecases', requireTarget, async (req, res) => {
  try {
    const target = await loadTarget(req.body.targetId)
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' })
    const prompt = `Erstelle 4 bis 6 KI-Use-Cases für diesen Zielkunden (Deutsch). Format: je eine Zeile\n- <Titel> — <Beschreibung> — <erwarteter Nutzen>\nPasse die Vorschläge an Branche und Unternehmensgröße an. Keine erfundenen Zahlen, Nutzen qualitativ beschreiben.\n\nDATEN:\n${buildContext(target)}`
    return await generate(res, target, prompt, 700)
  } catch (err) {
    return fail(res, err)
  }
})

// GET /api/acquisition-ai/insights — deterministische Kennzahlen-Hinweise
router.get('/insights', async (req, res) => {
  try {
    const pipeline = aggregateFlagSets()
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 86400000)
    const items = []

    const targets = await prisma.acquisitionTarget.findMany({
      select: { status: true, segment: true, nextStepDue: true, nextStep: true, companyName: true },
    })
    const openTargets = targets.filter((t) => !pipeline.wonStatuses.includes(t.status) && !pipeline.lostStatuses.includes(t.status))

    const overdue = openTargets.filter((t) => t.nextStepDue && new Date(t.nextStepDue) < now)
    if (overdue.length) items.push(`${overdue.length} überfällige Wiedervorlage(n) – z. B. ${overdue.slice(0, 3).map((t) => t.companyName).join(', ')}.`)

    const dueSoon = openTargets.filter((t) => t.nextStepDue && new Date(t.nextStepDue) >= now && new Date(t.nextStepDue) <= in7)
    if (dueSoon.length) items.push(`${dueSoon.length} Wiedervorlage(n) in den nächsten 7 Tagen.`)

    const won = targets.filter((t) => pipeline.wonStatuses.includes(t.status))
    const lost = targets.filter((t) => pipeline.lostStatuses.includes(t.status))
    const decided = won.length + lost.length
    if (decided > 0) items.push(`Conversion: ${Math.round((won.length / decided) * 100)} % (${won.length} gewonnen / ${decided} entschieden).`)

    const segWon = won.reduce((acc, t) => {
      const key = t.segment || 'ohne Branche'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const topSeg = Object.entries(segWon).sort((a, b) => b[1] - a[1])[0]
    if (topSeg) items.push(`Stärkste Branche bei Gewinnen: ${topSeg[0]} (${topSeg[1]}).`)

    const stale = await prisma.acquisitionOffer.findMany({
      where: {
        status: 'sent',
        sentAt: { lt: new Date(now.getTime() - 14 * 86400000) },
      },
      select: { offerNumber: true, sentAt: true },
    })
    if (stale.length) items.push(`${stale.length} Angebot(e) seit über 14 Tagen ohne Rückmeldung – nachfassen.`)

    const blocklistCount = await prisma.acquisitionBlocklist.count()
    if (blocklistCount) items.push(`${blocklistCount} Eintrag/Einträge auf der Kontaktsperrliste (DSGVO).`)

    if (!items.length) items.push('Keine Auffälligkeiten – Pipeline, Wiedervorlagen und Angebote sind aktuell.')

    res.json({ items, generatedAt: now.toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

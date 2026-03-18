const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const { callActiveLlm } = require('../lib/llm')

const prisma = new PrismaClient()

// GET /api/skills/areas
router.get('/areas', async (req, res) => {
  try {
    const areas = await prisma.skillArea.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
    res.json(areas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/skills/areas
router.post('/areas', async (req, res) => {
  const { name, category, description } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  try {
    const area = await prisma.skillArea.create({ data: { name, category, description } })
    res.json(area)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Skill already exists' })
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/skills/areas/:id
router.delete('/areas/:id', async (req, res) => {
  try {
    await prisma.skillArea.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/skills/matrix – all users × skills
router.get('/matrix', async (req, res) => {
  try {
    const [users, areas] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, role: true, skills: { include: { skillArea: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.skillArea.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    ])
    res.json({ users, areas })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/skills/users/:userId
router.get('/users/:userId', async (req, res) => {
  try {
    const skills = await prisma.userSkill.findMany({
      where: { userId: req.params.userId },
      include: { skillArea: true },
      orderBy: { skillArea: { name: 'asc' } },
    })
    res.json(skills)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/skills/users/:userId – add or update skill
router.post('/users/:userId', async (req, res) => {
  const { skillAreaId, level, yearsExp } = req.body
  if (!skillAreaId) return res.status(400).json({ error: 'skillAreaId required' })
  try {
    const skill = await prisma.userSkill.upsert({
      where: { userId_skillAreaId: { userId: req.params.userId, skillAreaId } },
      create: { userId: req.params.userId, skillAreaId, level: level || 1, yearsExp },
      update: { level: level || 1, yearsExp },
      include: { skillArea: true },
    })
    res.json(skill)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/skills/users/:userId/:skillAreaId
router.delete('/users/:userId/:skillAreaId', async (req, res) => {
  try {
    await prisma.userSkill.delete({
      where: { userId_skillAreaId: { userId: req.params.userId, skillAreaId: req.params.skillAreaId } },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/skills/extract – LLM extracts required skills from project brief
router.post('/extract', async (req, res) => {
  const { projectId, brief } = req.body
  if (!brief) return res.status(400).json({ error: 'brief required' })

  try {
    const areas = await prisma.skillArea.findMany()
    const areaNames = areas.map((a) => a.name).join(', ')

    const prompt = `Analysiere diese Projektbeschreibung und identifiziere die benötigten Berater-Skills.

Projektbeschreibung:
${brief}

Verfügbare Skills in unserem Katalog: ${areaNames}

Antworte NUR mit JSON (kein Text davor/danach):
[
  {
    "skillName": "Name des Skills aus dem Katalog oder neuer Name",
    "level": 3,
    "importance": "required | nice-to-have"
  }
]

Wichtig: Verwende bevorzugt Skill-Namen aus dem Katalog. level 1-5 (1=Grundkenntnisse, 5=Experte).`

    const raw = (await callActiveLlm(prompt, { maxTokens: 512 })).trim()
    let extracted
    try {
      extracted = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      extracted = match ? JSON.parse(match[0]) : []
    }

    if (projectId) {
      await prisma.staffingRequest.create({
        data: { projectId, requiredSkills: extracted, extractedFrom: brief.substring(0, 500) },
      })
    }

    res.json(extracted)
  } catch (err) {
    console.error('Skill extraction error:', err)
    res.status(err.message?.includes('aktive KI-Verbindung') ? 503 : 500).json({ error: err.message })
  }
})

// POST /api/skills/ai-match – LLM analyses full consultant pool and returns ranked recommendations
router.post('/ai-match', async (req, res) => {
  const { brief, projectId } = req.body
  if (!brief) return res.status(400).json({ error: 'brief required' })

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, role: true,
        skills: { include: { skillArea: true } },
      },
      orderBy: { name: 'asc' },
    })

    const consultantProfiles = users.map((u) => {
      const skillList = u.skills.length
        ? u.skills.map((s) => `  - ${s.skillArea.name}: Level ${s.level}${s.yearsExp ? ` (${s.yearsExp} Jahre)` : ''}`).join('\n')
        : '  - Noch keine Skills eingetragen'
      return `${u.name} (${u.role}):\n${skillList}`
    }).join('\n\n')

    const prompt = `Du bist ein erfahrener Staffing-Manager in einer Beratungsgesellschaft.

Analysiere diese Projektanforderungen und empfehle die passendsten Berater aus unserem Team.

Projekt-Brief:
${brief}

Beraterteam mit Skills:
${consultantProfiles}

Antworte NUR mit JSON (kein Markdown, kein Text davor/danach):
{
  "summary": "2-3 Sätze über die Kernkompetenz-Anforderungen des Projekts",
  "requiredSkills": [
    { "skillName": "Skill", "level": 3, "importance": "required | nice-to-have" }
  ],
  "rankings": [
    {
      "userId": "ID des Beraters",
      "name": "Name",
      "score": 85,
      "recommendation": "1-2 Sätze warum dieser Berater gut passt",
      "strengths": ["Stärke 1", "Stärke 2"],
      "gaps": ["Fehlende Kompetenz"]
    }
  ]
}

Regeln:
- score: 0–100 (Passgenauigkeit zum Projekt)
- Nur Berater mit score >= 20 aufnehmen
- Sortiere rankings nach score absteigend
- strengths und gaps jeweils max. 3 Punkte`

    const raw = (await callActiveLlm(prompt, { maxTokens: 1500 })).trim()
    let result
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/,'')
      result = JSON.parse(clean.startsWith('{') ? clean : (clean.match(/\{[\s\S]*\}/) || ['{}'])[0])
    } catch {
      result = { summary: '', requiredSkills: [], rankings: [] }
    }

    // Save staffing request if project given
    if (projectId && result.requiredSkills?.length) {
      await prisma.staffingRequest.create({
        data: { projectId, requiredSkills: result.requiredSkills, extractedFrom: brief.substring(0, 500) },
      }).catch(() => {})
    }

    res.json(result)
  } catch (err) {
    console.error('AI match error:', err)
    res.status(err.message?.includes('aktive KI-Verbindung') ? 503 : 500).json({ error: err.message })
  }
})

// GET /api/skills/match/:projectId – find consultants matching a staffing request
router.get('/match/:projectId', async (req, res) => {
  try {
    const staffing = await prisma.staffingRequest.findFirst({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!staffing || !staffing.requiredSkills) {
      return res.json({ matches: [], message: 'No staffing request found for this project' })
    }

    const required = staffing.requiredSkills
    const skillNames = required.map((r) => r.skillName)

    const areas = await prisma.skillArea.findMany({ where: { name: { in: skillNames } } })
    const areaIds = areas.map((a) => a.id)

    if (!areaIds.length) return res.json({ matches: [], required })

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        skills: {
          where: { skillAreaId: { in: areaIds } },
          include: { skillArea: true },
        },
      },
    })

    const matches = users
      .map((u) => {
        let score = 0
        const matched = []
        const missing = []

        for (const req of required) {
          const userSkill = u.skills.find((s) => s.skillArea.name === req.skillName)
          if (userSkill && userSkill.level >= (req.level || 1)) {
            score += req.importance === 'required' ? 2 : 1
            matched.push({ skill: req.skillName, level: userSkill.level })
          } else if (req.importance === 'required') {
            missing.push(req.skillName)
          }
        }

        return { user: u, score, matched, missing }
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)

    res.json({ matches, required })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/skills/staffing/:projectId – get staffing request
router.get('/staffing/:projectId', async (req, res) => {
  try {
    const request = await prisma.staffingRequest.findFirst({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(request)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

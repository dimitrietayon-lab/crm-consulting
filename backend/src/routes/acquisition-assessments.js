const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { runReadinessAssessment } = require('../lib/readiness-api');
const { sendPdf } = require('../lib/pdf');
const { buildAssessmentPdf } = require('../lib/pdf/acquisition-assessment');

const prisma = new PrismaClient();

// GET /api/acquisition-assessments/target/:targetId
router.get('/target/:targetId', async (req, res) => {
  try {
    const assessments = await prisma.acquisitionAssessment.findMany({
      where: { acquisitionTargetId: req.params.targetId },
      orderBy: { createdAt: 'desc' },
      include: { useCases: true },
    });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-assessments/target/:targetId
router.post('/target/:targetId', async (req, res) => {
  try {
    const { version, totalScore, dataAvailability, techStack, processMaturity,
            aiCompetency, governance, strategy, findings, recommendations } = req.body;

    // Calculate version number
    const existing = await prisma.acquisitionAssessment.count({
      where: { acquisitionTargetId: req.params.targetId },
    });

    const assessment = await prisma.acquisitionAssessment.create({
      data: {
        acquisitionTargetId: req.params.targetId,
        version: version || existing + 1,
        totalScore: totalScore ? Number(totalScore) : null,
        dataAvailability: dataAvailability ? Number(dataAvailability) : null,
        techStack: techStack ? Number(techStack) : null,
        processMaturity: processMaturity ? Number(processMaturity) : null,
        aiCompetency: aiCompetency ? Number(aiCompetency) : null,
        governance: governance ? Number(governance) : null,
        strategy: strategy ? Number(strategy) : null,
        findings: findings || null,
        recommendations: recommendations || null,
        generatedByAi: false,
      },
      include: { useCases: true },
    });
    res.status(201).json(assessment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-assessments/:id
router.put('/:id', async (req, res) => {
  try {
    const { totalScore, dataAvailability, techStack, processMaturity,
            aiCompetency, governance, strategy, findings, recommendations } = req.body;

    const data = {};
    if (totalScore !== undefined) data.totalScore = totalScore ? Number(totalScore) : null;
    if (dataAvailability !== undefined) data.dataAvailability = dataAvailability ? Number(dataAvailability) : null;
    if (techStack !== undefined) data.techStack = techStack ? Number(techStack) : null;
    if (processMaturity !== undefined) data.processMaturity = processMaturity ? Number(processMaturity) : null;
    if (aiCompetency !== undefined) data.aiCompetency = aiCompetency ? Number(aiCompetency) : null;
    if (governance !== undefined) data.governance = governance ? Number(governance) : null;
    if (strategy !== undefined) data.strategy = strategy ? Number(strategy) : null;
    if (findings !== undefined) data.findings = findings || null;
    if (recommendations !== undefined) data.recommendations = recommendations || null;

    const assessment = await prisma.acquisitionAssessment.update({
      where: { id: req.params.id },
      data,
      include: { useCases: true },
    });
    res.json(assessment);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Assessment nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-assessments/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.acquisitionAssessment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Assessment nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-assessments/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const assessment = await prisma.acquisitionAssessment.findUnique({
      where: { id: req.params.id },
      include: {
        useCases: { orderBy: { createdAt: 'asc' } },
        acquisitionTarget: { select: { companyName: true, segment: true } },
      },
    });
    if (!assessment) return res.status(404).json({ error: 'Assessment nicht gefunden' });

    const doc = buildAssessmentPdf(assessment);
    const company = assessment.acquisitionTarget?.companyName || 'Zielkunde';
    sendPdf(res, doc, `Assessment-${company}-v${assessment.version}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-assessments/:id/generate — run assessment via KI-Readiness platform API
router.post('/:id/generate', async (req, res) => {
  try {
    const assessment = await prisma.acquisitionAssessment.findUnique({
      where: { id: req.params.id },
      include: { acquisitionTarget: true },
    });
    if (!assessment) return res.status(404).json({ error: 'Assessment nicht gefunden' });

    let result;
    try {
      result = await runReadinessAssessment(assessment.acquisitionTarget);
    } catch (apiErr) {
      return res
        .status(apiErr.status || 502)
        .json({ error: apiErr.message });
    }

    const updated = await prisma.acquisitionAssessment.update({
      where: { id: req.params.id },
      data: {
        dataAvailability: result.dataAvailability,
        techStack: result.techStack,
        processMaturity: result.processMaturity,
        aiCompetency: result.aiCompetency,
        governance: result.governance,
        strategy: result.strategy,
        findings: result.findings,
        recommendations: result.recommendations,
        totalScore: result.totalScore,
        generatedByAi: true,
      },
    });

    const useCases = await Promise.all(
      result.useCases.map((uc) =>
        prisma.useCaseCandidate.create({
          data: { assessmentId: req.params.id, ...uc },
        })
      )
    );

    res.json({ ...updated, useCases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-assessments/:id/proposals
router.get('/:id/proposals', async (req, res) => {
  try {
    const useCases = await prisma.useCaseCandidate.findMany({
      where: { assessmentId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(useCases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-assessments/:id/proposals
router.post('/:id/proposals', async (req, res) => {
  try {
    const { title, description, priority, type, feasibility, estimatedValue, basis } = req.body;
    const uc = await prisma.useCaseCandidate.create({
      data: {
        assessmentId: req.params.id,
        title: title || 'Use Case',
        description: description || null,
        priority: priority || 'medium',
        type: type || 'implementierung',
        feasibility: feasibility || null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        basis: basis || null,
      },
    });
    res.status(201).json(uc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-assessments/proposals/:id
router.put('/proposals/:id', async (req, res) => {
  try {
    const { title, description, priority, type, feasibility, estimatedValue, basis } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (priority !== undefined) data.priority = priority;
    if (type !== undefined) data.type = type;
    if (feasibility !== undefined) data.feasibility = feasibility || null;
    if (estimatedValue !== undefined) data.estimatedValue = estimatedValue ? Number(estimatedValue) : null;
    if (basis !== undefined) data.basis = basis || null;

    const uc = await prisma.useCaseCandidate.update({
      where: { id: req.params.id },
      data,
    });
    res.json(uc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-assessments/proposals/:id
router.delete('/proposals/:id', async (req, res) => {
  try {
    await prisma.useCaseCandidate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

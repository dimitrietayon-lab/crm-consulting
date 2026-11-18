/**
 * seed-pipeline.js
 * Seeds the definierbare Akquise-Pipeline (mehrere Workflows), die
 * Schritt-Bibliothek und die KI-Readiness-Kampagne (idempotent, upsert).
 * Run: node prisma/seed-pipeline.js
 */
const { PrismaClient } = require('@prisma/client');
const {
  PIPELINE, STAGES, STEPS, TRANSITIONS, STEP_TEMPLATES, KI_READINESS_CAMPAIGN,
} = require('./pipeline-data');

const prisma = new PrismaClient();

const TEMPLATE_DATA = (t) => ({
  key: t.key,
  label: t.label,
  shortLabel: t.shortLabel,
  activityType: t.activityType,
  title: t.title,
  description: t.description,
  guide: t.guide,
  exitCriteria: t.exitCriteria,
  requiredFields: t.requiredFields,
  isEarly: t.isEarly,
  isInTalk: t.isInTalk,
  isOffer: t.isOffer,
  isOfferSent: t.isOfferSent,
  isWon: t.isWon,
  isLost: t.isLost,
  isWildcard: t.isWildcard,
  isClosing: t.isClosing,
  outcome: t.outcome,
  isStandard: t.isStandard,
  ownerPipelineId: t.ownerPipelineId,
  active: t.active,
});

async function main() {
  console.log('Seeding Akquise-Pipeline...');

  const pipeline = await prisma.acquisitionPipeline.upsert({
    where: { key: PIPELINE.key },
    update: {
      name: PIPELINE.name,
      description: PIPELINE.description,
      active: PIPELINE.active,
      isDefault: PIPELINE.isDefault,
    },
    create: {
      id: PIPELINE.id,
      key: PIPELINE.key,
      name: PIPELINE.name,
      description: PIPELINE.description,
      active: PIPELINE.active,
      isDefault: PIPELINE.isDefault,
    },
  });

  // ─── Schritt-Bibliothek ───────────────────────────────────────────────────
  const templateIdByKey = {};
  for (const t of STEP_TEMPLATES) {
    const row = await prisma.acquisitionStepTemplate.upsert({
      where: { key: t.key },
      update: TEMPLATE_DATA(t),
      create: { id: t.id, ...TEMPLATE_DATA(t) },
    });
    templateIdByKey[t.key] = row.id;
  }
  console.log(`  ✓ ${STEP_TEMPLATES.length} Step-Templates`);

  const stageIdByKey = {};
  for (const stage of STAGES) {
    const row = await prisma.acquisitionPipelineStage.upsert({
      where: { pipelineId_key: { pipelineId: pipeline.id, key: stage.key } },
      update: { label: stage.label, order: stage.order },
      create: { id: stage.id, pipelineId: pipeline.id, key: stage.key, label: stage.label, order: stage.order },
    });
    stageIdByKey[stage.key] = row.id;
  }
  console.log(`  ✓ ${STAGES.length} Stages`);

  for (const step of STEPS) {
    const stageId = stageIdByKey[step.stage] || step.stageId;
    const data = {
      pipelineId: pipeline.id,
      stageId,
      templateId: templateIdByKey[step.slug] || null,
      slug: step.slug,
      label: step.label,
      shortLabel: step.shortLabel,
      order: step.order,
      activityType: step.activityType,
      title: step.title,
      description: step.description,
      requiredFields: step.requiredFields,
      guide: step.guide || [],
      exitCriteria: step.exitCriteria || [],
      isClosing: step.isClosing,
      outcome: step.outcome,
      isWildcard: step.isWildcard,
      isInTalk: step.isInTalk,
      isOffer: step.isOffer,
      isOfferSent: step.isOfferSent,
      isWon: step.isWon,
      isLost: step.isLost,
      isEarly: step.isEarly,
      active: step.active,
    };
    await prisma.acquisitionPipelineStep.upsert({
      where: { pipelineId_status: { pipelineId: pipeline.id, status: step.status } },
      update: data,
      create: { id: step.id, status: step.status, ...data },
    });
  }
  console.log(`  ✓ ${STEPS.length} Steps`);

  for (const t of TRANSITIONS) {
    await prisma.acquisitionPipelineTransition.upsert({
      where: {
        pipelineId_fromStatus_toStatus: {
          pipelineId: pipeline.id,
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
        },
      },
      update: {},
      create: { pipelineId: pipeline.id, fromStatus: t.fromStatus, toStatus: t.toStatus },
    });
  }
  console.log(`  ✓ ${TRANSITIONS.length} Transitions`);

  // ─── Kampagne (KI Readiness Sprint) ───────────────────────────────────────
  const service = KI_READINESS_CAMPAIGN.serviceNameMatch
    ? await prisma.serviceCatalog.findFirst({
      where: { name: { contains: KI_READINESS_CAMPAIGN.serviceNameMatch, mode: 'insensitive' } },
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    : null;
  const setting = await prisma.acquisitionSetting.findUnique({
    where: { id: 'singleton' },
    select: { startDate: true, endDate: true },
  }).catch(() => null);

  await prisma.acquisitionCampaign.upsert({
    where: { key: KI_READINESS_CAMPAIGN.key },
    update: {
      name: KI_READINESS_CAMPAIGN.name,
      description: KI_READINESS_CAMPAIGN.description,
      pipelineId: pipeline.id,
      serviceId: service?.id || undefined,
      isDefault: KI_READINESS_CAMPAIGN.isDefault,
      active: KI_READINESS_CAMPAIGN.active,
    },
    create: {
      id: KI_READINESS_CAMPAIGN.id,
      key: KI_READINESS_CAMPAIGN.key,
      name: KI_READINESS_CAMPAIGN.name,
      description: KI_READINESS_CAMPAIGN.description,
      pipelineId: pipeline.id,
      serviceId: service?.id || null,
      startDate: setting?.startDate || null,
      endDate: setting?.endDate || null,
      isDefault: KI_READINESS_CAMPAIGN.isDefault,
      active: KI_READINESS_CAMPAIGN.active,
    },
  });
  console.log('  ✓ Kampagne: KI Readiness Sprint');

  console.log('Pipeline seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

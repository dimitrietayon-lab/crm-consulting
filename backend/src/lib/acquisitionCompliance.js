// DSGVO Art. 21: Widerspruch gegen Direktwerbung ist unbedingt zu beachten.
// Der Sperr-Status ist Workflow-abhängig (Flag isLost/isWildcard – im
// Standard-Workflow "kein Interesse"). Zusätzlich zählt jeder Sperrlisten-
// Eintrag, damit auch manuell erfasste Sperrvermerke greifen.
const { getPipelineForTarget } = require('./acquisitionPipeline');
const { isBlockStatus } = require('./acquisitionStatuses');

const LEGAL_SUFFIXES = /\b(gmbh|mbh|ag|kg|kgaa|ohg|gbr|se|ug|co|ek|ev|holding|gruppe|group)\b/g;

function normalizeCompany(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gibt die Sperrbegründung zurück – oder null, wenn kontaktiert werden darf.
// `pipeline` ist optional; ohne Angabe wird sie über den Zielkunden aufgelöst.
async function contactBlockReason(prisma, target, pipeline) {
  const t = target || {};
  const p = pipeline || getPipelineForTarget(t);
  if (t.status && isBlockStatus(t.status, p)) {
    return `Widerspruch (Status „${t.status}“)`;
  }
  const normalizedName = normalizeCompany(t.companyName);
  if (!normalizedName) return null;
  const entry = await prisma.acquisitionBlocklist.findFirst({
    where: { normalizedName },
    select: { reason: true },
  });
  return entry ? entry.reason || 'Sperrlisten-Eintrag' : null;
}

module.exports = { normalizeCompany, contactBlockReason };

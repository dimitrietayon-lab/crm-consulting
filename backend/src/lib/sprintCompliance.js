// DSGVO Art. 21: Widerspruch gegen Direktwerbung ist unbedingt zu beachten.
// "kein Interesse" ist dieser Widerspruch; zusätzlich zählt jeder Sperrlisten-Eintrag,
// damit auch manuell erfasste Sperrvermerke greifen.
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
async function contactBlockReason(prisma, { companyName, status } = {}) {
  if (status === 'kein Interesse') return 'Widerspruch (Status „kein Interesse“)';
  const normalizedName = normalizeCompany(companyName);
  if (!normalizedName) return null;
  const entry = await prisma.sprintBlocklist.findFirst({
    where: { normalizedName },
    select: { reason: true },
  });
  return entry ? entry.reason || 'Sperrlisten-Eintrag' : null;
}

module.exports = { normalizeCompany, contactBlockReason };

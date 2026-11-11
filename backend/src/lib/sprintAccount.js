// Zielkunde ↔ CRM-Account: Die Verknüpfung entsteht erst mit dem Abschluss.
// Vorher ist der Zielkunde ein reiner Interessent ohne CRM-Account.

// Sprint-Segment → CRM-Institutionstyp (CRM-Accounts sind auf Banken/Versicherer ausgelegt)
const SEGMENT_INSTITUTION_TYPES = {
  Banken: 'Private Bank',
  'Versicherungen & Finanzvermittler': 'Insurance (Non-Life)',
};

// Verknüpft den Zielkunden mit einem bestehenden Account (gleicher Name)
// oder legt ihn neu an. Erwartet mindestens { id, companyName }.
async function linkAccountOnWin(prisma, target) {
  if (!target || target.accountId) return null;

  const existing = await prisma.account.findFirst({
    where: { companyName: { equals: target.companyName, mode: 'insensitive' } },
    select: { id: true },
  });

  let accountId = existing?.id;
  if (!accountId) {
    const account = await prisma.account.create({
      data: {
        companyName: target.companyName,
        institutionType: SEGMENT_INSTITUTION_TYPES[target.segment] || 'Other',
        country: 'Deutschland',
        website: target.website || null,
        numberOfEmployees: target.numberOfEmployees || null,
        notes: `Aus der Akquise übernommen (Status: ${target.status || 'gewonnen'}).`,
      },
      select: { id: true },
    });
    accountId = account.id;
  }

  await prisma.sprintTarget.update({ where: { id: target.id }, data: { accountId } });
  return accountId;
}

module.exports = { linkAccountOnWin };

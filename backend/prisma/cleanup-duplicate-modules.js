/**
 * cleanup-duplicate-modules.js
 * Deletes PortalModule records that have no features (empty duplicates).
 * Run: node prisma/cleanup-duplicate-modules.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const modules = await prisma.portalModule.findMany({
    include: { _count: { select: { features: true } } },
  });

  const empty = modules.filter(m => m._count.features === 0);

  if (empty.length === 0) {
    console.log('Keine leeren Module gefunden.');
    return;
  }

  for (const m of empty) {
    await prisma.portalModule.delete({ where: { id: m.id } });
    console.log(`Gelöscht: "${m.name}" (id: ${m.id})`);
  }

  console.log(`${empty.length} leere(s) Modul(e) gelöscht.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * seed-portal.js
 * Seeds PortalModule + PortalFeature records that map 1:1 to the sidebar navigation.
 * Safe to run multiple times (uses upsert).
 *
 * Run: node prisma/seed-portal.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODULES = [
  {
    key: 'crm',
    name: 'CRM',
    order: 1,
    features: [
      { key: 'accounts',   name: 'Accounts',     route: '/accounts',   order: 1 },
      { key: 'contacts',   name: 'Kontakte',      route: '/contacts',   order: 2 },
      { key: 'activities', name: 'Aktivitäten',   route: '/activities', order: 3 },
    ],
  },
  {
    key: 'vertrieb',
    name: 'Vertrieb',
    order: 2,
    features: [
      { key: 'pipeline',  name: 'Pipeline',  route: '/pipeline',  order: 1 },
      { key: 'proposals', name: 'Angebote',  route: '/proposals', order: 2 },
      { key: 'contracts', name: 'Verträge',  route: '/contracts', order: 3 },
    ],
  },
  {
    key: 'pmo',
    name: 'PMO',
    order: 3,
    features: [
      { key: 'projects',   name: 'Projekte',      route: '/projects',   order: 1 },
      { key: 'tasks',      name: 'Aufgaben',       route: '/tasks',      order: 2 },
      { key: 'timesheets', name: 'Zeiterfassung',  route: '/timesheets', order: 3 },
    ],
  },
  {
    key: 'dokumente',
    name: 'Dokumente',
    order: 4,
    features: [
      { key: 'documents', name: 'Dokumente', route: '/documents', order: 1 },
    ],
  },
  {
    key: 'analyse',
    name: 'Analyse',
    order: 5,
    features: [
      { key: 'key_accounts',  name: 'Key Accounts',  route: '/key-accounts',  order: 1 },
      { key: 'cross_selling', name: 'Cross-Selling', route: '/cross-selling', order: 2 },
      { key: 'compliance',    name: 'Compliance',    route: '/compliance',    order: 3 },
    ],
  },
  {
    key: 'ki_analyse',
    name: 'KI & Analyse',
    order: 6,
    features: [
      { key: 'ai_opportunities', name: 'KI-Opportunities', route: '/ai-opportunities', order: 1 },
      { key: 'news_monitoring',  name: 'News Monitoring',  route: '/news',              order: 2 },
      { key: 'skills',           name: 'Skill-Matching',   route: '/skills',            order: 3 },
    ],
  },
  {
    key: 'fi_co',
    name: 'Fi & Co',
    order: 7,
    features: [
      { key: 'expenses',          name: 'Reisekosten',          route: '/expenses',          order: 1 },
      { key: 'material_costs',    name: 'Materialkosten',       route: '/material-costs',    order: 2 },
      { key: 'invoices',          name: 'Ausgangsrechnungen',   route: '/invoices',          order: 3 },
      { key: 'incoming_invoices', name: 'Eingangsrechnungen',   route: '/incoming-invoices', order: 4 },
    ],
  },
  {
    key: 'buchhaltung',
    name: 'Buchhaltung',
    order: 8,
    features: [
      { key: 'buchhaltung',   name: 'Buchhaltung',   route: '/buchhaltung',   order: 1 },
      { key: 'finanzplanung', name: 'Finanzplanung', route: '/finanzplanung', order: 2 },
    ],
  },
  {
    key: 'personal',
    name: 'Personal',
    order: 9,
    features: [
      { key: 'leave',           name: 'Abwesenheiten',  route: '/leave',           order: 1 },
      { key: 'lohnverwaltung',  name: 'Lohnverwaltung', route: '/lohnverwaltung',  order: 2 },
    ],
  },
  {
    key: 'automatisierung',
    name: 'Automatisierung',
    order: 10,
    features: [
      { key: 'workflows', name: 'Workflows', route: '/workflows', order: 1 },
    ],
  },
  {
    key: 'genehmigungen',
    name: 'Genehmigungen',
    order: 11,
    features: [
      { key: 'leave_approve',          name: 'Urlaub genehmigen',                       route: '/leave',          order: 1 },
      { key: 'timesheet_approve',      name: 'Zeiterfassung genehmigen (Team-Leiter)',   route: '/timesheets',     order: 2 },
      { key: 'timesheet_approve_cc',   name: 'Zeiterfassung genehmigen (CC-Leiter)',     route: '/timesheets',     order: 3 },
      { key: 'expense_approve',        name: 'Reisekosten genehmigen',                  route: '/expenses',       order: 4 },
      { key: 'material_approve',       name: 'Materialkosten genehmigen',               route: '/material-costs', order: 5 },
      { key: 'expense_approve_cc',     name: 'Reisekosten genehmigen (CC-Leiter)',       route: '/expenses',       order: 6 },
      { key: 'material_approve_cc',    name: 'Materialkosten genehmigen (CC-Leiter)',    route: '/material-costs', order: 7 },
      { key: 'invoice_approve_cc',     name: 'Ausgangsrechnungen genehmigen (CC-Leiter)', route: '/invoices',      order: 8 },
      { key: 'expense_pre_approve',   name: 'Reisekosten vorgenehmigen (Team-Leiter)',       route: '/expenses',       order: 9 },
      { key: 'material_pre_approve',  name: 'Materialkosten vorgenehmigen (Team-Leiter)',     route: '/material-costs', order: 10 },
      { key: 'invoice_pre_approve',   name: 'Ausgangsrechnungen vorgenehmigen (Team-Leiter)', route: '/invoices',       order: 11 },
    ],
  },
];

async function main() {
  console.log('Seeding portal modules & features...');

  // Remove features and modules that no longer exist in the current MODULES definition
  const allFeatureKeys = MODULES.flatMap((m) => m.features.map((f) => f.key));
  const allModuleKeys  = MODULES.map((m) => m.key);

  const deleted = await prisma.portalFeature.deleteMany({
    where: { key: { notIn: allFeatureKeys } },
  });
  if (deleted.count > 0) console.log(`  ✗ Removed ${deleted.count} stale feature(s)`);

  const deletedMods = await prisma.portalModule.deleteMany({
    where: { key: { notIn: allModuleKeys } },
  });
  if (deletedMods.count > 0) console.log(`  ✗ Removed ${deletedMods.count} stale module(s)`);

  for (const mod of MODULES) {
    const module = await prisma.portalModule.upsert({
      where: { key: mod.key },
      update: { name: mod.name, order: mod.order },
      create: { key: mod.key, name: mod.name, order: mod.order },
    });

    for (const feat of mod.features) {
      await prisma.portalFeature.upsert({
        where: { key: feat.key },
        update: { name: feat.name, route: feat.route, order: feat.order, moduleId: module.id },
        create: { key: feat.key, name: feat.name, route: feat.route, order: feat.order, moduleId: module.id },
      });
    }

    console.log(`  ✓ ${mod.name} (${mod.features.length} Features)`);
  }

  console.log('Portal seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

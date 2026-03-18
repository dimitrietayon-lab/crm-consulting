/**
 * Portal RBAC seed — run with: node prisma/portal-seed.js
 * Creates modules, features, roles, and role-permission mappings.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding portal RBAC data...');

  // ─── Modules ────────────────────────────────────────────────────────────────
  const moduleData = [
    { key: 'crm',        name: 'CRM',            icon: 'Building2',       color: 'blue',    description: 'Accounts, Kontakte, Aktivitäten & Dokumente', order: 1 },
    { key: 'vertrieb',   name: 'Vertrieb',        icon: 'TrendingUp',      color: 'green',   description: 'Pipeline, Angebote & Verträge', order: 2 },
    { key: 'pmo',        name: 'PMO',             icon: 'Briefcase',       color: 'purple',  description: 'Projekte, Aufgaben & Zeiterfassung', order: 3 },
    { key: 'analyse',    name: 'Analyse',         icon: 'BarChart2',       color: 'orange',  description: 'Netzwerk, Key Accounts, Cross-Selling & Compliance', order: 4 },
    { key: 'ki',         name: 'KI & Insights',   icon: 'Brain',           color: 'pink',    description: 'KI-Opportunities, News-Monitoring & Skill-Matching', order: 5 },
    { key: 'fico',       name: 'Fi & Co',         icon: 'Receipt',         color: 'amber',   description: 'Reisekosten, Rechnungen & Eingangsrechnungen', order: 6 },
    { key: 'personal',        name: 'Personal',        icon: 'Users',           color: 'teal',    description: 'Abwesenheiten, Urlaubsguthaben & Feiertage', order: 7 },
    { key: 'automatisierung', name: 'Automatisierung', icon: 'Zap',             color: 'violet',  description: 'Workflow-Automatisierung & Prozesssteuerung', order: 8 },
  ];

  const modules = {};
  for (const m of moduleData) {
    modules[m.key] = await prisma.portalModule.upsert({
      where: { key: m.key },
      create: m,
      update: { name: m.name, icon: m.icon, color: m.color, description: m.description, order: m.order },
    });
    console.log(`  Module: ${m.name}`);
  }

  // ─── Features ───────────────────────────────────────────────────────────────
  const featureData = [
    // CRM
    { moduleKey: 'crm', key: 'accounts',         name: 'Accounts',          route: '/accounts',         order: 1 },
    { moduleKey: 'crm', key: 'contacts',          name: 'Kontakte',          route: '/contacts',         order: 2 },
    { moduleKey: 'crm', key: 'activities',        name: 'Aktivitäten',       route: '/activities',       order: 3 },
    { moduleKey: 'crm', key: 'documents',         name: 'Dokumente',         route: '/documents',        order: 4 },
    // Vertrieb
    { moduleKey: 'vertrieb', key: 'pipeline',     name: 'Pipeline',          route: '/pipeline',         order: 1 },
    { moduleKey: 'vertrieb', key: 'proposals',    name: 'Angebote',          route: '/proposals',        order: 2 },
    { moduleKey: 'vertrieb', key: 'contracts',    name: 'Verträge',          route: '/contracts',        order: 3 },
    // PMO
    { moduleKey: 'pmo', key: 'projects',          name: 'Projekte',          route: '/projects',         order: 1 },
    { moduleKey: 'pmo', key: 'tasks',             name: 'Aufgaben',          route: '/tasks',            order: 2 },
    { moduleKey: 'pmo', key: 'timesheets',        name: 'Zeiterfassung',     route: '/timesheets',       order: 3 },
    // Analyse
    { moduleKey: 'analyse', key: 'network',       name: 'Netzwerk',          route: '/network',          order: 1 },
    { moduleKey: 'analyse', key: 'key_accounts',  name: 'Key Accounts',      route: '/key-accounts',     order: 2 },
    { moduleKey: 'analyse', key: 'cross_selling', name: 'Cross-Selling',     route: '/cross-selling',    order: 3 },
    { moduleKey: 'analyse', key: 'compliance',    name: 'Compliance',        route: '/compliance',       order: 4 },
    // KI
    { moduleKey: 'ki', key: 'ai_opportunities',   name: 'KI-Opportunities',  route: '/ai-opportunities', order: 1 },
    { moduleKey: 'ki', key: 'news_monitoring',    name: 'News Monitoring',   route: '/news',             order: 2 },
    { moduleKey: 'ki', key: 'skills',             name: 'Skill-Matching',    route: '/skills',           order: 3 },
    { moduleKey: 'ki', key: 'satisfaction',       name: 'Zufriedenheit',     route: '/satisfaction',     order: 4 },
    // Fi & Co
    { moduleKey: 'fico', key: 'expenses',         name: 'Reisekosten',       route: '/expenses',         order: 1 },
    { moduleKey: 'fico', key: 'invoices',         name: 'Ausgangsrechnungen',route: '/invoices',         order: 2 },
    { moduleKey: 'fico', key: 'incoming_invoices',name: 'Eingangsrechnungen',route: '/incoming-invoices',order: 3 },
    // Personal
    { moduleKey: 'personal',        key: 'leave',      name: 'Abwesenheiten', route: '/leave',      order: 1 },
    // Automatisierung
    { moduleKey: 'automatisierung', key: 'workflows',   name: 'Workflows',     route: '/workflows',  order: 1 },
  ];

  const features = {};
  for (const f of featureData) {
    const { moduleKey, ...data } = f;
    features[f.key] = await prisma.portalFeature.upsert({
      where: { key: f.key },
      create: { ...data, moduleId: modules[moduleKey].id },
      update: { name: data.name, route: data.route, order: data.order },
    });
  }
  console.log(`  Created/updated ${featureData.length} features`);

  // ─── Roles ──────────────────────────────────────────────────────────────────
  const roleData = [
    { name: 'Administrator',    description: 'Vollzugriff auf alle Module', isSystem: true },
    { name: 'Senior Consultant',description: 'Zugriff auf CRM, Vertrieb, PMO und Analyse' },
    { name: 'Consultant',       description: 'Zugriff auf CRM, PMO und Personal' },
    { name: 'Finance Manager',  description: 'Zugriff auf Fi & Co und PMO' },
    { name: 'Viewer',           description: 'Nur-Lese-Zugriff auf CRM' },
  ];

  const roles = {};
  for (const r of roleData) {
    roles[r.name] = await prisma.portalRole.upsert({
      where: { name: r.name },
      create: r,
      update: { description: r.description, isSystem: r.isSystem || false },
    });
    console.log(`  Role: ${r.name}`);
  }

  // ─── Role Permissions ────────────────────────────────────────────────────────

  async function setPermissions(roleName, permList) {
    const roleId = roles[roleName].id;
    // Delete existing
    await prisma.portalRolePermission.deleteMany({ where: { roleId } });
    // Create new
    const data = permList.map(([featureKey, canView, canCreate, canEdit, canDelete]) => ({
      roleId,
      featureId: features[featureKey].id,
      canView: !!canView,
      canCreate: !!canCreate,
      canEdit: !!canEdit,
      canDelete: !!canDelete,
    }));
    await prisma.portalRolePermission.createMany({ data });
  }

  const all = Object.keys(features);
  const allFull = all.map((k) => [k, true, true, true, true]);

  // Administrator: full access
  await setPermissions('Administrator', allFull);

  // Senior Consultant: CRM + Vertrieb + PMO + Analyse (read/create/edit, no delete for finance)
  await setPermissions('Senior Consultant', [
    ['accounts',          1,1,1,0],
    ['contacts',          1,1,1,0],
    ['activities',        1,1,1,0],
    ['documents',         1,1,1,0],
    ['pipeline',          1,1,1,0],
    ['proposals',         1,1,1,0],
    ['contracts',         1,1,0,0],
    ['projects',          1,1,1,0],
    ['tasks',             1,1,1,1],
    ['timesheets',        1,1,1,0],
    ['network',           1,0,0,0],
    ['key_accounts',      1,1,1,0],
    ['cross_selling',     1,0,0,0],
    ['compliance',        1,1,1,0],
    ['expenses',          1,1,1,0],
    ['leave',             1,1,1,0],
    ['workflows',         1,1,1,0],
  ]);

  // Consultant: CRM + PMO + Personal (own work)
  await setPermissions('Consultant', [
    ['accounts',          1,0,0,0],
    ['contacts',          1,0,0,0],
    ['activities',        1,1,1,0],
    ['documents',         1,1,0,0],
    ['projects',          1,0,0,0],
    ['tasks',             1,1,1,0],
    ['timesheets',        1,1,1,0],
    ['expenses',          1,1,1,0],
    ['leave',             1,1,0,0],
  ]);

  // Finance Manager: Fi & Co + PMO read
  await setPermissions('Finance Manager', [
    ['projects',          1,0,0,0],
    ['timesheets',        1,0,0,0],
    ['expenses',          1,1,1,1],
    ['invoices',          1,1,1,1],
    ['incoming_invoices', 1,1,1,1],
    ['leave',             1,0,0,0],
    ['workflows',         1,1,1,0],
  ]);

  // Viewer: CRM read-only
  await setPermissions('Viewer', [
    ['accounts',          1,0,0,0],
    ['contacts',          1,0,0,0],
    ['activities',        1,0,0,0],
    ['documents',         1,0,0,0],
  ]);

  console.log('  Role permissions set');
  console.log('Portal RBAC seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

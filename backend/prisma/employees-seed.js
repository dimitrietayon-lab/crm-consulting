/**
 * Employee seed — run with: node prisma/employees-seed.js
 * Creates 58 new employees (60 total incl. existing 2), 5 CCs, 10 teams.
 * Half (30) are assigned to a CC + team; half (30) are unassigned.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const HASH = bcrypt.hashSync('consultant123', 10);

// ─── Competence Centers ────────────────────────────────────────────────────────
const CC_DATA = [
  { key: 'core',     name: 'Core Solutions',       description: 'Kernbanking & Versicherungslösungen' },
  { key: 'anal',     name: 'Analytical Solutions',  description: 'Risiko- & Performance-Analysen' },
  { key: 'biztech',  name: 'Business Technologies', description: 'Digitale Transformation & Enterprise Architecture' },
  { key: 'data',     name: 'Data & AI Solutions',   description: 'Data Engineering & künstliche Intelligenz' },
  { key: 'inno',     name: 'Innovation Lab',        description: 'FinTech & RegTech Innovation' },
];

// ─── Teams per CC ──────────────────────────────────────────────────────────────
const TEAM_DATA = {
  core:    ['Banking Core', 'Insurance Core'],
  anal:    ['Risk Analytics', 'Performance Analytics'],
  biztech: ['Digital Transformation', 'Enterprise Architecture'],
  data:    ['Data Engineering', 'AI & Machine Learning'],
  inno:    ['FinTech Innovation', 'RegTech'],
};

// ─── CC Heads (report to admin / Geschäftsführer) ─────────────────────────────
const CC_HEADS = [
  { key: 'core',    name: 'Thomas Wagner',    email: 'thomas.wagner@crm.de' },
  { key: 'anal',    name: 'Sandra Hoffmann',  email: 'sandra.hoffmann@crm.de' },
  { key: 'biztech', name: 'Michael Becker',   email: 'michael.becker@crm.de' },
  { key: 'data',    name: 'Julia Schneider',  email: 'julia.schneider@crm.de' },
  { key: 'inno',    name: 'Markus Fischer',   email: 'markus.fischer@crm.de' },
];

// ─── Team Leads (report to CC head) ───────────────────────────────────────────
const TEAM_LEADS = [
  { team: 'Banking Core',            name: 'Christian Müller',   email: 'christian.mueller@crm.de' },
  { team: 'Insurance Core',          name: 'Laura Krause',       email: 'laura.krause@crm.de' },
  { team: 'Risk Analytics',          name: 'Patrick Richter',    email: 'patrick.richter@crm.de' },
  { team: 'Performance Analytics',   name: 'Nicole Meyer',       email: 'nicole.meyer@crm.de' },
  { team: 'Digital Transformation',  name: 'Andreas Wolf',       email: 'andreas.wolf@crm.de' },
  { team: 'Enterprise Architecture', name: 'Stefanie Braun',     email: 'stefanie.braun@crm.de' },
  { team: 'Data Engineering',        name: 'Robert Keller',      email: 'robert.keller@crm.de' },
  { team: 'AI & Machine Learning',   name: 'Hannah Schulz',      email: 'hannah.schulz@crm.de' },
  { team: 'FinTech Innovation',      name: 'David Klein',        email: 'david.klein@crm.de' },
  { team: 'RegTech',                 name: 'Katharina Lange',    email: 'katharina.lange@crm.de' },
];

// ─── Team Members (report to team lead) ───────────────────────────────────────
// 15 members distributed across 10 teams (~1-2 per team)
const TEAM_MEMBERS = [
  { team: 'Banking Core',            name: 'Felix Zimmermann',  email: 'felix.zimmermann@crm.de' },
  { team: 'Banking Core',            name: 'Lena Schwarz',      email: 'lena.schwarz@crm.de' },
  { team: 'Insurance Core',          name: 'Jonas Koch',        email: 'jonas.koch@crm.de' },
  { team: 'Insurance Core',          name: 'Marie Bauer',       email: 'marie.bauer@crm.de' },
  { team: 'Risk Analytics',          name: 'Maximilian Huber',  email: 'maximilian.huber@crm.de' },
  { team: 'Risk Analytics',          name: 'Sophie Weber',      email: 'sophie.weber@crm.de' },
  { team: 'Performance Analytics',   name: 'Florian Schmitt',   email: 'florian.schmitt@crm.de' },
  { team: 'Performance Analytics',   name: 'Emily Hartmann',    email: 'emily.hartmann@crm.de' },
  { team: 'Digital Transformation',  name: 'Tobias Schäfer',    email: 'tobias.schaefer@crm.de' },
  { team: 'Digital Transformation',  name: 'Lisa Kramer',       email: 'lisa.kramer@crm.de' },
  { team: 'Enterprise Architecture', name: 'Philipp Lehmann',   email: 'philipp.lehmann@crm.de' },
  { team: 'Enterprise Architecture', name: 'Anna Pohl',         email: 'anna.pohl@crm.de' },
  { team: 'Data Engineering',        name: 'Tim Neumann',       email: 'tim.neumann@crm.de' },
  { team: 'Data Engineering',        name: 'Julia Lorenz',      email: 'julia.lorenz@crm.de' },
  { team: 'AI & Machine Learning',   name: 'Leon Werner',       email: 'leon.werner@crm.de' },
];

// ─── Unassigned employees (30) ─────────────────────────────────────────────────
const UNASSIGNED = [
  { name: 'Niklas Engel',       email: 'niklas.engel@crm.de' },
  { name: 'Clara Vogt',         email: 'clara.vogt@crm.de' },
  { name: 'Simon Bergmann',     email: 'simon.bergmann@crm.de' },
  { name: 'Lea Brandt',         email: 'lea.brandt@crm.de' },
  { name: 'Fabian Sauer',       email: 'fabian.sauer@crm.de' },
  { name: 'Mia König',          email: 'mia.koenig@crm.de' },
  { name: 'Sebastian Kühn',     email: 'sebastian.kuehn@crm.de' },
  { name: 'Jana Roth',          email: 'jana.roth@crm.de' },
  { name: 'Kevin Walter',       email: 'kevin.walter@crm.de' },
  { name: 'Nora Haas',          email: 'nora.haas@crm.de' },
  { name: 'Marco Peters',       email: 'marco.peters@crm.de' },
  { name: 'Sarah Franke',       email: 'sarah.franke@crm.de' },
  { name: 'Daniel Hofmann',     email: 'daniel.hofmann@crm.de' },
  { name: 'Celine Möller',      email: 'celine.moeller@crm.de' },
  { name: 'Alexander Maier',    email: 'alexander.maier@crm.de' },
  { name: 'Luisa Herrmann',     email: 'luisa.herrmann@crm.de' },
  { name: 'Dominik Friedrich',  email: 'dominik.friedrich@crm.de' },
  { name: 'Alina Böhm',         email: 'alina.boehm@crm.de' },
  { name: 'Christoph Günther',  email: 'christoph.guenther@crm.de' },
  { name: 'Vanessa Fuchs',      email: 'vanessa.fuchs@crm.de' },
  { name: 'Jens Schreiber',     email: 'jens.schreiber@crm.de' },
  { name: 'Lara Bremer',        email: 'lara.bremer@crm.de' },
  { name: 'Stephan Kaiser',     email: 'stephan.kaiser@crm.de' },
  { name: 'Zara Hahn',          email: 'zara.hahn@crm.de' },
  { name: 'Oliver Stein',       email: 'oliver.stein@crm.de' },
  { name: 'Melanie Vogel',      email: 'melanie.vogel@crm.de' },
  { name: 'Johannes Beck',      email: 'johannes.beck@crm.de' },
  { name: 'Nina Schuster',      email: 'nina.schuster@crm.de' },
  { name: 'Erik Dietrich',      email: 'erik.dietrich@crm.de' },
  { name: 'Tanja Wolf',         email: 'tanja.wolf@crm.de' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function upsertUser(data) {
  return prisma.user.upsert({
    where: { email: data.email },
    create: { ...data, password: HASH },
    update: { name: data.name },
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding employees, competence centers and teams...\n');

  // Get admin user (Geschäftsführer)
  const admin = await prisma.user.findUnique({ where: { email: 'admin@crm.de' } });
  if (!admin) {
    console.error('admin@crm.de not found — run the main seed first!');
    process.exit(1);
  }
  console.log(`✓ Geschäftsführer: ${admin.name}`);

  // ── 1. Competence Centers ──────────────────────────────────────────────────
  const ccs = {};
  for (const cc of CC_DATA) {
    ccs[cc.key] = await prisma.competenceCenter.upsert({
      where: { name: cc.name },
      create: { name: cc.name, description: cc.description },
      update: { description: cc.description },
    });
  }
  console.log(`✓ ${CC_DATA.length} Competence Centers`);

  // ── 2. CC Heads ───────────────────────────────────────────────────────────
  const ccHeads = {};
  for (const h of CC_HEADS) {
    const user = await upsertUser({ name: h.name, email: h.email, role: 'consultant' });
    // Set manager = admin (Geschäftsführer), update CC head
    await prisma.user.update({ where: { id: user.id }, data: { managerId: admin.id } });
    await prisma.competenceCenter.update({ where: { id: ccs[h.key].id }, data: { headId: user.id } });
    ccHeads[h.key] = user;
  }
  console.log(`✓ ${CC_HEADS.length} CC-Leiter`);

  // ── 3. Teams ──────────────────────────────────────────────────────────────
  const teams = {};
  for (const [ccKey, teamNames] of Object.entries(TEAM_DATA)) {
    for (const teamName of teamNames) {
      teams[teamName] = await prisma.team.upsert({
        where: { name: teamName },
        create: { name: teamName, competenceCenterId: ccs[ccKey].id },
        update: { competenceCenterId: ccs[ccKey].id },
      });
    }
  }
  console.log(`✓ ${Object.keys(teams).length} Teams`);

  // ── 4. Team Leads ─────────────────────────────────────────────────────────
  // Find which CC a team belongs to
  const teamToCCKey = {};
  for (const [ccKey, teamNames] of Object.entries(TEAM_DATA)) {
    for (const t of teamNames) teamToCCKey[t] = ccKey;
  }

  const teamLeads = {};
  for (const tl of TEAM_LEADS) {
    const ccKey = teamToCCKey[tl.team];
    const ccHead = ccHeads[ccKey];
    const user = await upsertUser({ name: tl.name, email: tl.email, role: 'consultant' });
    await prisma.user.update({ where: { id: user.id }, data: { managerId: ccHead.id } });
    // Set as team leader
    await prisma.team.update({ where: { id: teams[tl.team].id }, data: { leaderId: user.id } });
    // Add to team as member
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: teams[tl.team].id, userId: user.id } },
      create: { teamId: teams[tl.team].id, userId: user.id },
      update: {},
    });
    teamLeads[tl.team] = user;
  }
  console.log(`✓ ${TEAM_LEADS.length} Team-Leiter`);

  // ── 5. Team Members ───────────────────────────────────────────────────────
  for (const tm of TEAM_MEMBERS) {
    const teamLead = teamLeads[tm.team];
    const user = await upsertUser({ name: tm.name, email: tm.email, role: 'consultant' });
    await prisma.user.update({ where: { id: user.id }, data: { managerId: teamLead.id } });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: teams[tm.team].id, userId: user.id } },
      create: { teamId: teams[tm.team].id, userId: user.id },
      update: {},
    });
  }
  console.log(`✓ ${TEAM_MEMBERS.length} Team-Mitglieder`);

  // ── 6. Unassigned employees ───────────────────────────────────────────────
  for (const u of UNASSIGNED) {
    await upsertUser({ name: u.name, email: u.email, role: 'consultant' });
  }
  console.log(`✓ ${UNASSIGNED.length} nicht zugeordnete Mitarbeiter`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = await prisma.user.count();
  console.log(`\n✅ Fertig! ${total} Benutzer insgesamt in der Datenbank.`);
  console.log('\nStruktur:');
  console.log('  Geschäftsführer: admin@crm.de');
  console.log('  5 CC-Leiter     → berichten an Geschäftsführer');
  console.log('  10 Team-Leiter  → berichten an CC-Leiter');
  console.log('  15 Mitarbeiter  → berichten an Team-Leiter, in Teams eingeteilt');
  console.log('  30 ohne Zuordnung (noch zuzuteilen)');
  console.log('\n  Passwort für alle neuen Nutzer: consultant123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

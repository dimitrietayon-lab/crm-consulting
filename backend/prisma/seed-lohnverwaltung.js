/**
 * seed-lohnverwaltung.js
 * Seeds EmployeeSalary configs + 4 PayrollRuns (3 finalized + 1 draft).
 * Safe to run multiple times (uses upsert / skipDuplicates).
 *
 * Run: node prisma/seed-lohnverwaltung.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Approximate German tax rates by Steuerklasse
const TAX_RATES = { 1: 0.25, 2: 0.22, 3: 0.15, 4: 0.25, 5: 0.35, 6: 0.40 };
const SV_RATE = 0.205;

function calcNet(gross, taxClass) {
  const rate = TAX_RATES[taxClass] ?? 0.25;
  const incomeTax   = Math.round(gross * rate * 100) / 100;
  const socialSec   = Math.round(gross * SV_RATE * 100) / 100;
  const net         = Math.max(Math.round((gross - incomeTax - socialSec) * 100) / 100, 0);
  return { incomeTax, socialSecurity: socialSec, net };
}

// Salary config per role (used as fallback if user doesn't have one already)
const ROLE_DEFAULTS = {
  admin:      { baseSalary: 7500, contractType: 'fulltime', hoursPerWeek: 40, taxClass: 1 },
  consultant: { baseSalary: 6200, contractType: 'fulltime', hoursPerWeek: 40, taxClass: 1 },
  manager:    { baseSalary: 8500, contractType: 'fulltime', hoursPerWeek: 40, taxClass: 3 },
  hr:         { baseSalary: 5800, contractType: 'fulltime', hoursPerWeek: 40, taxClass: 1 },
  finance:    { baseSalary: 6000, contractType: 'fulltime', hoursPerWeek: 40, taxClass: 1 },
};

// Some variety — override specific users with custom data
const USER_OVERRIDES = [
  { index: 0, baseSalary: 9200, contractType: 'fulltime',  hoursPerWeek: 40, taxClass: 3 },
  { index: 1, baseSalary: 5200, contractType: 'parttime',  hoursPerWeek: 20, taxClass: 2 },
  { index: 2, baseSalary: 6800, contractType: 'fulltime',  hoursPerWeek: 40, taxClass: 1 },
  { index: 3, baseSalary: 4500, contractType: 'minijob',   hoursPerWeek: 10, taxClass: 6 },
  { index: 4, baseSalary: 7200, contractType: 'fulltime',  hoursPerWeek: 40, taxClass: 4 },
  { index: 5, baseSalary: 5500, contractType: 'parttime',  hoursPerWeek: 30, taxClass: 1 },
];

async function main() {
  console.log('Seeding Lohnverwaltung...\n');

  // ── 1. Fetch all users ─────────────────────────────────────────────────
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  if (users.length === 0) {
    console.error('No users found. Run the main seed first: node prisma/seed.js');
    process.exit(1);
  }
  console.log(`Found ${users.length} users.\n`);

  // ── 2. Upsert EmployeeSalary for each user ─────────────────────────────
  const salaryMap = {}; // userId → { baseSalary, taxClass }

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const override = USER_OVERRIDES[i];
    const roleDefault = ROLE_DEFAULTS[user.role] ?? ROLE_DEFAULTS.consultant;

    const cfg = override
      ? { ...roleDefault, ...override }
      : roleDefault;

    const salary = await prisma.employeeSalary.upsert({
      where: { userId: user.id },
      update: {
        baseSalary:   cfg.baseSalary,
        contractType: cfg.contractType,
        hoursPerWeek: cfg.hoursPerWeek,
        taxClass:     cfg.taxClass,
      },
      create: {
        userId:       user.id,
        baseSalary:   cfg.baseSalary,
        contractType: cfg.contractType,
        hoursPerWeek: cfg.hoursPerWeek,
        taxClass:     cfg.taxClass,
        validFrom:    new Date('2024-01-01'),
      },
    });

    salaryMap[user.id] = { baseSalary: salary.baseSalary, taxClass: salary.taxClass };
    console.log(`  ✓ Gehalt konfiguriert: ${user.name} → ${salary.baseSalary.toLocaleString('de-DE')} € (StKl. ${salary.taxClass})`);
  }

  // ── 3. Create payroll runs ─────────────────────────────────────────────
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  // Build list: 3 past months (finalized) + current month (draft)
  const runsToCreate = [];
  for (let offset = 3; offset >= 0; offset--) {
    let month = currentMonth - offset;
    let year  = currentYear;
    if (month <= 0) { month += 12; year -= 1; }
    runsToCreate.push({ year, month, status: offset === 0 ? 'draft' : 'finalized' });
  }

  // Bonus pool: add a small random bonus to some entries for variety
  const BONUS_CHANCE = 0.3;
  function randomBonus(base) {
    if (Math.random() > BONUS_CHANCE) return 0;
    return Math.round((base * (0.02 + Math.random() * 0.05)) / 50) * 50; // 2–7 % rounded to 50 €
  }

  console.log('\nErstelle Abrechnungsläufe...\n');

  for (const { year, month, status } of runsToCreate) {
    // Check if run already exists
    const existing = await prisma.payrollRun.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing) {
      console.log(`  ⏭  ${month.toString().padStart(2,'0')}/${year} — bereits vorhanden, übersprungen.`);
      continue;
    }

    const entries = users.map((user) => {
      const { baseSalary, taxClass } = salaryMap[user.id];
      const bonus      = status === 'finalized' ? randomBonus(baseSalary) : 0;
      const deductions = 0;
      const gross      = baseSalary + bonus - deductions;
      const { incomeTax, socialSecurity, net } = calcNet(gross, taxClass);
      return {
        userId:        user.id,
        baseSalary,
        bonus,
        deductions,
        grossSalary:   gross,
        incomeTax,
        socialSecurity,
        netSalary:     net,
      };
    });

    const totalGross = entries.reduce((s, e) => s + e.grossSalary, 0);
    const totalNet   = entries.reduce((s, e) => s + e.netSalary, 0);

    await prisma.payrollRun.create({
      data: {
        year,
        month,
        status,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet:   Math.round(totalNet   * 100) / 100,
        notes: status === 'draft' ? 'Aktueller Monat — noch nicht finalisiert' : null,
        entries: { create: entries },
      },
    });

    const label = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][month - 1];
    console.log(
      `  ✓ ${label} ${year} [${status === 'finalized' ? 'Finalisiert' : 'Entwurf   '}]` +
      `  ${entries.length} Einträge` +
      `  Brutto: ${totalGross.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €` +
      `  Netto: ${totalNet.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
    );
  }

  console.log('\nLohnverwaltung seed abgeschlossen.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

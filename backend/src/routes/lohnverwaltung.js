const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helpers
async function hasAccess(user) {
  if (user.role === 'admin') return true;
  // Check if user's portal role has view permission for 'lohnverwaltung'
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      portalRole: {
        select: {
          permissions: {
            where: { feature: { key: 'lohnverwaltung' }, canView: true },
            select: { id: true },
          },
        },
      },
    },
  });
  return (u?.portalRole?.permissions?.length ?? 0) > 0;
}

// ─── Deutsche Lohnsteuer & Sozialversicherung 2025 ─────────────────────────
// Lohnsteuer-Näherung nach Steuerklasse
const TAX_RATES = { 1: 0.25, 2: 0.22, 3: 0.15, 4: 0.25, 5: 0.35, 6: 0.40 };

// Sozialversicherungs-Beitragssätze 2025 (AN-Anteil)
const RV_RATE   = 0.093;   // Rentenversicherung
const AV_RATE   = 0.013;   // Arbeitslosenversicherung
const KV_BASE   = 0.073;   // Krankenversicherung Basisbeitrag AN
const PV_RATE   = 0.017;   // Pflegeversicherung
const PV_KL_ADD = 0.0035;  // Kinderlosenzuschlag Pflegeversicherung

// Beitragsbemessungsgrenzen 2025 (monatlich)
const BBG_RV_AV = 8050;    // RV / AV
const BBG_KV_PV = 5512.50; // KV / PV

function calcPayroll(gross, cfg = {}) {
  const {
    taxClass               = 1,
    kvZusatzbeitrag        = 1.7,  // in % — AN+AG teilen 50/50
    pvKinderlos            = false,
    kirchensteuerPflichtig = false,
    kirchensteuerSatz      = 9,    // 8 = BY/BW, 9 = Rest
    bvvBeitrag             = 0,
  } = cfg;

  const basisRV = Math.min(gross, BBG_RV_AV);
  const basisKV = Math.min(gross, BBG_KV_PV);

  const rentenversicherung       = Math.round(basisRV * RV_RATE * 100) / 100;
  const arbeitslosenversicherung = Math.round(basisRV * AV_RATE * 100) / 100;
  const kvRate = KV_BASE + (kvZusatzbeitrag / 2) / 100;  // AN zahlt halben Zusatzbeitrag
  const krankenversicherung      = Math.round(basisKV * kvRate * 100) / 100;
  const pvRate = PV_RATE + (pvKinderlos ? PV_KL_ADD : 0);
  const pflegeversicherung       = Math.round(basisKV * pvRate * 100) / 100;

  const incomeTax    = Math.round(gross * (TAX_RATES[taxClass] ?? 0.25) * 100) / 100;
  const kirchensteuer = kirchensteuerPflichtig
    ? Math.round(incomeTax * (kirchensteuerSatz / 100) * 100) / 100
    : 0;

  const bvv = parseFloat(bvvBeitrag) || 0;

  const socialSecurity = Math.round(
    (rentenversicherung + krankenversicherung + pflegeversicherung + arbeitslosenversicherung) * 100
  ) / 100;

  const net = Math.max(
    gross - incomeTax - kirchensteuer - socialSecurity - bvv,
    0
  );

  return {
    incomeTax,
    kirchensteuer,
    rentenversicherung,
    krankenversicherung,
    pflegeversicherung,
    arbeitslosenversicherung,
    socialSecurity,
    bvv,
    netSalary: Math.round(net * 100) / 100,
  };
}

// Auto-salary:
//   1. Lineare Interpolation Erfahrung (0–20 Jahre) innerhalb der Tarifspanne
//   2. × Bildungs-Multiplikator
//   3. × Stunden-Faktor (hoursPerWeek / 40 Vollzeit)
const MAX_EXP_YEARS   = 20;
const VOLLZEIT_STUNDEN = 40;
const BILDUNG_MULTIPLIKATOREN = {
  ausbildung: 1.00,  // Berufsausbildung – Basis
  bachelor:   1.05,  // Bachelor / FH      +5 %
  master:     1.12,  // Master / Diplom    +12 %
  promotion:  1.20,  // Dr. / PhD          +20 %
};

function calcAutoSalary(tarifGruppe, erfahrungJahre, bildungsgrad, hoursPerWeek) {
  if (!tarifGruppe?.minSalary) return null;
  const min = tarifGruppe.minSalary;
  const max = tarifGruppe.maxSalary ?? min;
  const ratio        = Math.min((erfahrungJahre ?? 0) / MAX_EXP_YEARS, 1);
  const erfahrungsBasis = min + ratio * (max - min);
  const bildungsMult = BILDUNG_MULTIPLIKATOREN[bildungsgrad] ?? 1.0;
  const stundenFaktor = Math.min((hoursPerWeek ?? VOLLZEIT_STUNDEN) / VOLLZEIT_STUNDEN, 1);
  return Math.round(erfahrungsBasis * bildungsMult * stundenFaktor);
}

// ─── Dashboard Overview ────────────────────────────────────────────────────

router.get('/overview', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    const year = now.getFullYear();

    // Last 6 finalized payroll runs
    const runs = await prisma.payrollRun.findMany({
      where: { year, status: 'finalized' },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const employeeCount = await prisma.user.count();
    const configuredCount = await prisma.employeeSalary.count();

    // Current month run
    const currentRun = await prisma.payrollRun.findUnique({
      where: { year_month: { year, month: now.getMonth() + 1 } },
      include: { entries: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    res.json({ runs, employeeCount, configuredCount, currentRun });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Employee Salary Config ────────────────────────────────────────────────

router.get('/mitarbeiter', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        salary: true,
        tarifGruppeId: true,
        tarifGruppe: { select: { id: true, name: true } },
      },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/mitarbeiter/:userId', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { userId } = req.params;
    const {
      contractType, hoursPerWeek, taxClass, notes, validFrom,
      salaryMode, erfahrungJahre, tarifGruppeId, bildungsgrad, monthlyBonus,
      kvZusatzbeitrag, pvKinderlos, kirchensteuerPflichtig, kirchensteuerSatz, bvvBeitrag,
    } = req.body;
    let { baseSalary } = req.body;

    // If tarifGruppeId provided, update it on the user
    if (tarifGruppeId !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { tarifGruppeId: tarifGruppeId || null },
      });
    }

    // Auto-calculation: derive baseSalary from TarifGruppe + Erfahrungsjahre
    const mode = salaryMode || 'manual';
    if (mode === 'auto') {
      const resolvedGroupId = tarifGruppeId !== undefined
        ? tarifGruppeId
        : (await prisma.user.findUnique({ where: { id: userId }, select: { tarifGruppeId: true } }))?.tarifGruppeId;

      if (resolvedGroupId) {
        const group = await prisma.tarifGruppe.findUnique({ where: { id: resolvedGroupId } });
        const calculated = calcAutoSalary(group, parseFloat(erfahrungJahre ?? 0), bildungsgrad, parseFloat(hoursPerWeek ?? VOLLZEIT_STUNDEN));
        if (calculated !== null) baseSalary = calculated;
      }
    }

    const svFields = {
      kvZusatzbeitrag:        kvZusatzbeitrag        != null ? parseFloat(kvZusatzbeitrag)        : undefined,
      pvKinderlos:            pvKinderlos            != null ? !!pvKinderlos                       : undefined,
      kirchensteuerPflichtig: kirchensteuerPflichtig != null ? !!kirchensteuerPflichtig            : undefined,
      kirchensteuerSatz:      kirchensteuerSatz      != null ? parseFloat(kirchensteuerSatz)       : undefined,
      bvvBeitrag:             bvvBeitrag             != null ? parseFloat(bvvBeitrag)              : undefined,
    };
    // Strip undefined values
    Object.keys(svFields).forEach(k => svFields[k] === undefined && delete svFields[k]);

    const salary = await prisma.employeeSalary.upsert({
      where: { userId },
      update: {
        baseSalary:     parseFloat(baseSalary),
        monthlyBonus:   monthlyBonus != null ? parseFloat(monthlyBonus) : 0,
        salaryMode:     mode,
        erfahrungJahre: erfahrungJahre != null ? parseFloat(erfahrungJahre) : null,
        bildungsgrad:   bildungsgrad || null,
        contractType:   contractType || 'fulltime',
        hoursPerWeek:   parseFloat(hoursPerWeek) || 40,
        taxClass:       parseInt(taxClass) || 1,
        notes,
        ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
        ...svFields,
      },
      create: {
        userId,
        baseSalary:     parseFloat(baseSalary) || 0,
        monthlyBonus:   monthlyBonus != null ? parseFloat(monthlyBonus) : 0,
        salaryMode:     mode,
        erfahrungJahre: erfahrungJahre != null ? parseFloat(erfahrungJahre) : null,
        bildungsgrad:   bildungsgrad || null,
        contractType:   contractType || 'fulltime',
        hoursPerWeek:   parseFloat(hoursPerWeek) || 40,
        taxClass:       parseInt(taxClass) || 1,
        notes,
        validFrom:      validFrom ? new Date(validFrom) : new Date(),
        ...svFields,
      },
    });

    res.json(salary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Payroll Runs ──────────────────────────────────────────────────────────

router.get('/abrechnungen', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const runs = await prisma.payrollRun.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { entries: true } },
      },
    });

    res.json(runs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create/open a payroll run for a given year+month — auto-fills from EmployeeSalary
router.post('/abrechnungen', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month required' });

    // Check if run already exists
    const existing = await prisma.payrollRun.findUnique({
      where: { year_month: { year: parseInt(year), month: parseInt(month) } },
    });
    if (existing) return res.status(409).json({ error: 'Abrechnung für diesen Monat existiert bereits' });

    // Get all active employees with salary config
    const salaries = await prisma.employeeSalary.findMany({
      include: { user: { select: { id: true, name: true } } },
    });

    const active = salaries;

    // Build entries — monthly bonus from EmployeeSalary is pre-filled as bonus
    const entries = active.map((s) => {
      const bonus = s.monthlyBonus ?? 0;
      const gross = s.baseSalary + bonus;
      const result = calcPayroll(gross, {
        taxClass:               s.taxClass,
        kvZusatzbeitrag:        s.kvZusatzbeitrag,
        pvKinderlos:            s.pvKinderlos,
        kirchensteuerPflichtig: s.kirchensteuerPflichtig,
        kirchensteuerSatz:      s.kirchensteuerSatz,
        bvvBeitrag:             s.bvvBeitrag,
      });
      return {
        userId:                  s.userId,
        baseSalary:              s.baseSalary,
        bonus,
        deductions:              0,
        grossSalary:             gross,
        incomeTax:               result.incomeTax,
        kirchensteuer:           result.kirchensteuer,
        rentenversicherung:      result.rentenversicherung,
        krankenversicherung:     result.krankenversicherung,
        pflegeversicherung:      result.pflegeversicherung,
        arbeitslosenversicherung:result.arbeitslosenversicherung,
        socialSecurity:          result.socialSecurity,
        bvv:                     result.bvv,
        netSalary:               result.netSalary,
      };
    });

    const totalGross = entries.reduce((a, e) => a + e.grossSalary, 0);
    const totalNet = entries.reduce((a, e) => a + e.netSalary, 0);

    const run = await prisma.payrollRun.create({
      data: {
        year: parseInt(year),
        month: parseInt(month),
        totalGross,
        totalNet,
        entries: { create: entries },
      },
      include: {
        entries: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    res.status(201).json(run);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/abrechnungen/:id', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params.id },
      include: {
        entries: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true, role: true,
                salary: true, // current salary config for sync-status detection
              },
            },
          },
          orderBy: { user: { name: 'asc' } },
        },
      },
    });

    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update a single entry (bonus / deductions / notes) — recalculates net
router.put('/abrechnungen/:id/entries/:entryId', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } });
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.status === 'finalized') return res.status(400).json({ error: 'Abrechnung ist bereits finalisiert' });

    const entry = await prisma.payrollEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const salary = await prisma.employeeSalary.findUnique({ where: { userId: entry.userId } });

    const baseSalary = parseFloat(req.body.baseSalary ?? entry.baseSalary);
    const bonus      = parseFloat(req.body.bonus      ?? entry.bonus);
    const deductions = parseFloat(req.body.deductions ?? entry.deductions);
    const gross = baseSalary + bonus - deductions;

    const result = calcPayroll(gross, {
      taxClass:               salary?.taxClass,
      kvZusatzbeitrag:        salary?.kvZusatzbeitrag,
      pvKinderlos:            salary?.pvKinderlos,
      kirchensteuerPflichtig: salary?.kirchensteuerPflichtig,
      kirchensteuerSatz:      salary?.kirchensteuerSatz,
      bvvBeitrag:             salary?.bvvBeitrag,
    });

    const updated = await prisma.payrollEntry.update({
      where: { id: req.params.entryId },
      data: {
        baseSalary,
        bonus,
        deductions,
        grossSalary:             gross,
        incomeTax:               result.incomeTax,
        kirchensteuer:           result.kirchensteuer,
        rentenversicherung:      result.rentenversicherung,
        krankenversicherung:     result.krankenversicherung,
        pflegeversicherung:      result.pflegeversicherung,
        arbeitslosenversicherung:result.arbeitslosenversicherung,
        socialSecurity:          result.socialSecurity,
        bvv:                     result.bvv,
        netSalary:               result.netSalary,
        notes:                   req.body.notes ?? entry.notes,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Sync all entries of a draft run from current EmployeeSalary config
// Keeps custom deductions; resets baseSalary + bonus from config; adds missing employees
router.put('/abrechnungen/:id/sync', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params.id },
      include: { entries: true },
    });
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status === 'finalized') return res.status(400).json({ error: 'Finalisierte Abrechnung kann nicht synchronisiert werden' });

    const salaries = await prisma.employeeSalary.findMany({
      include: { user: { select: { id: true } } },
    });

    for (const s of salaries) {
      const bonus      = s.monthlyBonus ?? 0;
      const existing   = run.entries.find(e => e.userId === s.userId);
      const deductions = existing?.deductions ?? 0;
      const gross      = s.baseSalary + bonus - deductions;
      const result = calcPayroll(gross, {
        taxClass:               s.taxClass,
        kvZusatzbeitrag:        s.kvZusatzbeitrag,
        pvKinderlos:            s.pvKinderlos,
        kirchensteuerPflichtig: s.kirchensteuerPflichtig,
        kirchensteuerSatz:      s.kirchensteuerSatz,
        bvvBeitrag:             s.bvvBeitrag,
      });

      const entryData = {
        baseSalary:              s.baseSalary,
        bonus,
        grossSalary:             gross,
        incomeTax:               result.incomeTax,
        kirchensteuer:           result.kirchensteuer,
        rentenversicherung:      result.rentenversicherung,
        krankenversicherung:     result.krankenversicherung,
        pflegeversicherung:      result.pflegeversicherung,
        arbeitslosenversicherung:result.arbeitslosenversicherung,
        socialSecurity:          result.socialSecurity,
        bvv:                     result.bvv,
        netSalary:               result.netSalary,
      };

      if (existing) {
        await prisma.payrollEntry.update({
          where: { id: existing.id },
          data: entryData,
        });
      } else {
        await prisma.payrollEntry.create({
          data: {
            payrollRunId: run.id,
            userId:       s.userId,
            deductions:   0,
            ...entryData,
          },
        });
      }
    }

    // Recalculate run totals
    const allEntries = await prisma.payrollEntry.findMany({ where: { payrollRunId: run.id } });
    const totalGross = allEntries.reduce((a, e) => a + e.grossSalary, 0);
    const totalNet   = allEntries.reduce((a, e) => a + e.netSalary,   0);

    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data:  { totalGross, totalNet },
      include: {
        entries: {
          include: { user: { select: { id: true, name: true, email: true, role: true, salary: true } } },
          orderBy: { user: { name: 'asc' } },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Finalize a payroll run — recalculates totals and locks it
router.put('/abrechnungen/:id/finalize', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params.id },
      include: { entries: true },
    });
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status === 'finalized') return res.status(400).json({ error: 'Already finalized' });

    const totalGross = run.entries.reduce((a, e) => a + e.grossSalary, 0);
    const totalNet = run.entries.reduce((a, e) => a + e.netSalary, 0);

    const updated = await prisma.payrollRun.update({
      where: { id: req.params.id },
      data: { status: 'finalized', totalGross, totalNet },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reopen a finalized run (admin only)
router.put('/abrechnungen/:id/reopen', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.payrollRun.update({
      where: { id: req.params.id },
      data: { status: 'draft' },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Tarifgruppen ─────────────────────────────────────────────────────────────

// List all Tarifgruppen (with user count)
router.get('/tarifgruppen', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const groups = await prisma.tarifGruppe.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create Tarifgruppe
router.post('/tarifgruppen', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { name, description, minSalary, maxSalary } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const group = await prisma.tarifGruppe.create({
      data: {
        name: name.trim(),
        description: description || null,
        minSalary: minSalary ? parseFloat(minSalary) : null,
        maxSalary: maxSalary ? parseFloat(maxSalary) : null,
      },
      include: { _count: { select: { users: true } } },
    });

    res.status(201).json(group);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Eine Tarifgruppe mit diesem Namen existiert bereits' });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update Tarifgruppe
router.put('/tarifgruppen/:id', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { name, description, minSalary, maxSalary } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });

    const group = await prisma.tarifGruppe.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        description: description || null,
        minSalary: minSalary ? parseFloat(minSalary) : null,
        maxSalary: maxSalary ? parseFloat(maxSalary) : null,
      },
      include: { _count: { select: { users: true } } },
    });

    res.json(group);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Eine Tarifgruppe mit diesem Namen existiert bereits' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tarifgruppe nicht gefunden' });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Tarifgruppe
router.delete('/tarifgruppen/:id', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    // Unassign users first
    await prisma.user.updateMany({
      where: { tarifGruppeId: req.params.id },
      data: { tarifGruppeId: null },
    });

    await prisma.tarifGruppe.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tarifgruppe nicht gefunden' });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get users of a Tarifgruppe
router.get('/tarifgruppen/:id/mitarbeiter', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const users = await prisma.user.findMany({
      where: { tarifGruppeId: req.params.id },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Assign Tarifgruppe to a user (or remove: tarifGruppeId = null)
router.put('/mitarbeiter/:userId/tarifgruppe', async (req, res) => {
  try {
    if (!await hasAccess(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { tarifGruppeId } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { tarifGruppeId: tarifGruppeId || null },
      select: { id: true, name: true, email: true, tarifGruppeId: true },
    });

    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Gehaltszettel (own payslips — any authenticated user) ────────────────────

router.get('/gehaltszettel', async (req, res) => {
  try {
    const entries = await prisma.payrollEntry.findMany({
      where: {
        userId:      req.user.id,
        payrollRun:  { status: 'finalized' },
      },
      include: {
        payrollRun: { select: { id: true, year: true, month: true, status: true } },
        user:       { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        { payrollRun: { year:  'desc' } },
        { payrollRun: { month: 'desc' } },
      ],
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { validate, sendInvalid } = require('../lib/validate');
const { sendPdf, date: pdfDate } = require('../lib/pdf');
const { buildBafaPdf } = require('../lib/pdf/bafa-report');
const { buildReportPdf } = require('../lib/pdf/sprint-report');
const { normalizeCompany, contactBlockReason } = require('../lib/sprintCompliance');

const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const ALLOWED_FIELDS = [
  'companyName', 'location', 'street', 'postalCode', 'bundesland', 'segment', 'priority', 'package',
  'numberOfEmployees', 'sizeCheckedAt', 'status', 'contactSource', 'ponturoRelationship',
  'contactName', 'contactTitle', 'contactLinkedIn', 'callAttempts', 'callTrigger',
  'emailAllowed', 'handoverDate', 'firstMeetingDate', 'offerPackage', 'offerValue',
  'offerDate', 'bafaDate', 'bafaStatus', 'result', 'lossReason', 'notes', 'accountId',
  'contactEmail', 'revenue', 'website', 'wzCode', 'emailConsentAt', 'emailConsentSource',
  'emailConsentRevokedAt', 'callConsentAt', 'callConsentSource', 'privacyNoticeAt',
  'privacyNoticeSource', 'selfTestScore', 'selfTestDate', 'selfTestLink',
  'decisionDate', 'nextStep', 'nextStepDue',
  'fundingAmount', 'offerValidUntil', 'bafaApprovedAmount', 'bafaSubmittedAt', 'bafaNotes',
];

// Kanonisches Phasen-/Statusmodell: jede Phase hat eigene Statuswerte.
// Phasen: Lead-Gewinnung → Qualifizierung → Erstgespräch → Angebot → Abschluss.
const SPRINT_STATUSES = [
  'offen', 'recherchiert', 'vernetzt', 'kontaktiert',
  'Qualifizierungsgespräch', 'Übergabe an Engagement Manager',
  'Erstgespräch terminiert', 'Erstgespräch durchgeführt', 'Fragebogen geschickt',
  'Angebot in Vorbereitung', 'Angebot versendet', 'Nachverhandlung',
  'gewonnen', 'Folgeprojekt', 'Verlust', 'kein Interesse',
];
const SPRINT_STATUS_SET = new Set(SPRINT_STATUSES);
const ACTIVE_STATUSES = [
  'Qualifizierungsgespräch', 'Übergabe an Engagement Manager',
  'Erstgespräch terminiert', 'Erstgespräch durchgeführt', 'Fragebogen geschickt',
  'Angebot in Vorbereitung', 'Angebot versendet', 'Nachverhandlung',
];
const ACTIVE_STATUS_SET = new Set(ACTIVE_STATUSES);
const WON_STATUSES = ['gewonnen', 'Folgeprojekt'];
const WON_STATUS_SET = new Set(WON_STATUSES);
const LOST_STATUSES = ['Verlust', 'kein Interesse'];
const LOST_STATUS_SET = new Set(LOST_STATUSES);
// "Im Gespräch" = aktive Phasen Qualifizierung + Erstgespräch (ohne Angebotsphase)
const IN_TALK_STATUSES = [
  'Qualifizierungsgespräch', 'Übergabe an Engagement Manager',
  'Erstgespräch terminiert', 'Erstgespräch durchgeführt', 'Fragebogen geschickt',
];
// Angebote, die beim Kunden liegen (versendet + Nachverhandlung)
const OFFER_SENT_STATUSES = ['Angebot versendet', 'Nachverhandlung'];
const OFFER_SENT_STATUS_SET = new Set(OFFER_SENT_STATUSES);
const OFFER_STATUSES = ['Angebot in Vorbereitung', ...OFFER_SENT_STATUSES];
const countInTalk = (counts) => IN_TALK_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
const countWon = (counts) => WON_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
const countStatuses = (counts, statuses) => statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

// Zuordnung der Sprint-Rollen auf die Einträge der Rollenverwaltung (PortalRole)
const SPRINT_ROLE_IDS = {
  lead: 'sprint-role-lead',
  ki: 'sprint-role-ki',
  sales: 'sprint-role-sales',
};

const SPRINT_ROLE_KEYS = new Set(Object.keys(SPRINT_ROLE_IDS));

const SPRINT_PACKAGES = ['compact', 'standard', 'premium'];

const TEAM_SLOTS = [
  { key: 'lead', label: 'Lead Berater' },
  { key: 'ki', label: 'KI-Experte' },
  { key: 'sales', label: 'Vertrieb' },
];

const DATE_FIELDS = [
  'sizeCheckedAt', 'handoverDate', 'firstMeetingDate', 'offerDate', 'bafaDate',
  'emailConsentAt', 'emailConsentRevokedAt', 'callConsentAt', 'privacyNoticeAt',
  'selfTestDate', 'decisionDate', 'nextStepDue', 'offerValidUntil', 'bafaSubmittedAt',
];

const SORTABLE_FIELDS = new Set([
  'companyName', 'status', 'priority', 'offerValue', 'numberOfEmployees',
  'callAttempts', 'updatedAt', 'createdAt',
]);

// Query-Werte können als Wiederholung (?status=a&status=b) oder CSV (?status=a,b) kommen
function toArray(value) {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => String(v).trim()).filter(Boolean);
}

// Ergänzt abgeleitete Listenfelder (letzte Aktivität, Zuweisungsanzahl)
async function enrichTargets(targets) {
  if (!targets.length) return targets;
  const ids = targets.map((t) => t.id);
  const [activityAgg, assignmentAgg] = await Promise.all([
    prisma.activity.groupBy({
      by: ['sprintTargetId'],
      where: { sprintTargetId: { in: ids } },
      _max: { date: true },
      _count: { _all: true },
    }),
    prisma.sprintAssignment.groupBy({
      by: ['sprintTargetId'],
      where: { sprintTargetId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const lastActivity = new Map(activityAgg.map((r) => [r.sprintTargetId, r._max.date]));
  const activityCount = new Map(activityAgg.map((r) => [r.sprintTargetId, r._count._all]));
  const assignmentCount = new Map(assignmentAgg.map((r) => [r.sprintTargetId, r._count._all]));

  return targets.map((t) => ({
    ...t,
    assignmentCount: assignmentCount.get(t.id) || 0,
    activityCount: activityCount.get(t.id) || 0,
    assessmentCount: t._count?.assessments ?? 0,
    lastActivityAt: lastActivity.get(t.id) || null,
  }));
}

function sanitize(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      const val = body[field] ?? null;
      data[field] = val === '' ? null : val;
    }
  }
  for (const f of DATE_FIELDS) {
    if (data[f] !== undefined && data[f] !== null) {
      data[f] = new Date(data[f]);
    }
  }
  if (data.numberOfEmployees !== undefined && data.numberOfEmployees !== null) {
    data.numberOfEmployees = Number(data.numberOfEmployees);
  }
  if (data.callAttempts !== undefined && data.callAttempts !== null) {
    data.callAttempts = Number(data.callAttempts);
  }
  if (data.offerValue !== undefined && data.offerValue !== null) {
    data.offerValue = Number(data.offerValue);
  }
  for (const f of ['revenue', 'fundingAmount', 'bafaApprovedAmount', 'selfTestScore']) {
    if (data[f] !== undefined && data[f] !== null) {
      data[f] = Number(data[f]);
    }
  }
  return data;
}

// GET /api/sprint-targets/stats/summary — must be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const [targets, blocklistCount, assessedRows, upcomingCount] = await Promise.all([
      prisma.sprintTarget.findMany({
        select: { status: true, offerValue: true },
      }),
      prisma.sprintBlocklist.count(),
      prisma.sprintAssessment.groupBy({ by: ['sprintTargetId'] }),
      prisma.activity.count({
        where: { sprintTargetId: { not: null }, date: { gte: now, lte: in7 } },
      }),
    ]);

    const counts = {};
    let pipelineValue = 0;
    let wonValue = 0;

    for (const t of targets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
      if (ACTIVE_STATUS_SET.has(t.status) || WON_STATUS_SET.has(t.status)) {
        pipelineValue += t.offerValue || 0;
      }
      if (WON_STATUS_SET.has(t.status)) {
        wonValue += t.offerValue || 0;
      }
    }

    const total = targets.length;
    const imGespraech = countInTalk(counts);
    const angebote = countStatuses(counts, OFFER_STATUSES);
    const gewonnen = countWon(counts);
    const verloren = LOST_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
    const konversion =
      gewonnen + verloren > 0
        ? Math.round((gewonnen / (gewonnen + verloren)) * 100)
        : 0;
    const assessedTargets = assessedRows.length;

    res.json({
      total, imGespraech, angebote, gewonnen, wonValue, pipelineValue, konversion, counts,
      blocklistCount,
      assessments: {
        targets: assessedTargets,
        coverage: total ? Math.round((assessedTargets / total) * 100) : 0,
      },
      upcoming: { next7Days: upcomingCount },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets
router.get('/', async (req, res) => {
  try {
    const { q, sort, page, pageSize, paginate } = req.query;
    const statuses = toArray(req.query.status);
    const priorities = toArray(req.query.priority);
    const bundeslaender = toArray(req.query.bundesland);
    const segments = toArray(req.query.segment);

    const where = {};
    if (statuses.length) where.status = { in: statuses };
    if (priorities.length) where.priority = { in: priorities };
    if (bundeslaender.length) where.bundesland = { in: bundeslaender };

    const and = [];
    if (segments.length) {
      and.push({
        OR: segments.map((s) => ({ segment: { contains: s, mode: 'insensitive' } })),
      });
    }
    if (q) {
      and.push({
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const sortParam = sort || '-updatedAt';
    const desc = sortParam.startsWith('-');
    const sortField = desc ? sortParam.slice(1) : sortParam;
    const orderBy = SORTABLE_FIELDS.has(sortField)
      ? { [sortField]: desc ? 'desc' : 'asc' }
      : { updatedAt: 'desc' };

    const shouldPaginate = paginate === 'true' || page !== undefined || pageSize !== undefined;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 50));

    const [total, rows] = await Promise.all([
      prisma.sprintTarget.count({ where }),
      prisma.sprintTarget.findMany({
        where,
        orderBy,
        ...(shouldPaginate ? { skip: (pageNum - 1) * size, take: size } : {}),
        include: {
          account: { select: { id: true, companyName: true } },
          _count: { select: { assessments: true, activities: true } },
        },
      }),
    ]);

    const targets = await enrichTargets(rows);

    if (sortField === 'lastActivityAt') {
      targets.sort((a, b) => {
        const av = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bv = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return desc ? bv - av : av - bv;
      });
    }

    if (shouldPaginate) {
      return res.json({
        data: targets,
        total,
        page: pageNum,
        pageSize: size,
        totalPages: Math.max(1, Math.ceil(total / size)),
      });
    }
    res.json(targets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/dashboard/summary — Kennzahlen, Agenda, Team, Top-Zielkunden
router.get('/dashboard/summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7 = new Date(startOfDay.getTime() + 7 * 86400000);

    const [targets, upcomingActivities, upcomingMeetings, members, assignments, topTargets, blocklistCount] =
      await Promise.all([
        prisma.sprintTarget.findMany({ select: { status: true, offerValue: true, callAttempts: true } }),
        prisma.activity.findMany({
          where: { sprintTargetId: { not: null }, date: { gte: startOfDay, lte: in7 } },
          orderBy: { date: 'asc' },
          take: 20,
          select: {
            id: true, type: true, date: true, summary: true, nextSteps: true,
            sprintTarget: { select: { id: true, companyName: true, status: true, priority: true } },
          },
        }),
        prisma.sprintTarget.findMany({
          where: { firstMeetingDate: { gte: startOfDay, lte: in7 } },
          orderBy: { firstMeetingDate: 'asc' },
          select: { id: true, companyName: true, firstMeetingDate: true, status: true },
        }),
        prisma.user.findMany({
          select: { id: true, name: true, portalRole: { select: { name: true } } },
          orderBy: { name: 'asc' },
        }),
        prisma.sprintAssignment.findMany({ select: { userId: true, role: true, sprintTargetId: true } }),
        prisma.sprintTarget.findMany({
          where: { status: { notIn: LOST_STATUSES } },
          orderBy: [{ priority: 'asc' }, { offerValue: 'desc' }],
          take: 5,
          select: {
            id: true, companyName: true, status: true, priority: true, segment: true,
            offerValue: true, callAttempts: true, contactName: true,
          },
        }),
        prisma.sprintBlocklist.count(),
      ]);

    const counts = {};
    let pipelineValue = 0;
    let wonValue = 0;
    for (const t of targets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
      if (ACTIVE_STATUS_SET.has(t.status) || WON_STATUS_SET.has(t.status)) pipelineValue += t.offerValue || 0;
      if (WON_STATUS_SET.has(t.status)) wonValue += t.offerValue || 0;
    }
    const won = countWon(counts);
    const lost = LOST_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);

    // Teamauslastung: Zuweisungen je Mitarbeiter (Kapazität folgt in Phase 2 aus den Settings)
    const capacity = 10;
    const byUser = new Map();
    for (const a of assignments) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, { total: 0, roles: {} });
      const entry = byUser.get(a.userId);
      entry.total += 1;
      entry.roles[a.role] = (entry.roles[a.role] || 0) + 1;
    }
    const teamMembers = members
      .map((m) => {
        const load = byUser.get(m.id) || { total: 0, roles: {} };
        return {
          id: m.id,
          name: m.name,
          portalRole: m.portalRole?.name || null,
          assignments: load.total,
          roles: load.roles,
          utilization: Math.min(100, Math.round((load.total / capacity) * 100)),
        };
      })
      .filter((m) => m.assignments > 0)
      .sort((a, b) => b.assignments - a.assignments);

    const agenda = [
      ...upcomingActivities.map((a) => ({
        id: `activity-${a.id}`,
        kind: 'activity',
        type: a.type,
        title: a.summary || a.nextSteps || a.type,
        date: a.date,
        targetId: a.sprintTarget?.id || null,
        companyName: a.sprintTarget?.companyName || null,
        status: a.sprintTarget?.status || null,
      })),
      ...upcomingMeetings.map((t) => ({
        id: `meeting-${t.id}`,
        kind: 'firstMeeting',
        type: 'Meeting',
        title: 'Erstgespräch',
        date: t.firstMeetingDate,
        targetId: t.id,
        companyName: t.companyName,
        status: t.status,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      sprint: {
        total: targets.length,
        active: ACTIVE_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0),
        won,
        lost,
        pipelineValue,
        wonValue,
        conversion: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      },
      agenda,
      team: {
        capacity,
        members: teamMembers,
        totalAssignments: assignments.length,
      },
      topTargets,
      alerts: {
        blocklistCount,
        callLimitReached: targets.filter(
          (t) => (t.callAttempts || 0) >= 3 && !WON_STATUS_SET.has(t.status) && !LOST_STATUS_SET.has(t.status)
        ).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets
router.post('/', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.companyName) return res.status(400).json({ error: 'companyName ist erforderlich' });
    if (!data.segment) return res.status(400).json({ error: 'segment ist erforderlich' });

    const target = await prisma.sprintTarget.create({
      data,
      include: { account: { select: { id: true, companyName: true } } },
    });
    res.status(201).json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Listen-Import ────────────────────────────────────────────────────────────

const COLUMN_ALIASES = {
  companyName:        ['unternehmen', 'unternehmensname', 'firma', 'name', 'company', 'companyname'],
  location:           ['ort', 'standort', 'stadt', 'location'],
  street:             ['straße', 'strasse', 'street', 'adresse', 'anschrift'],
  postalCode:         ['plz', 'postleitzahl', 'postalcode', 'zip'],
  bundesland:         ['bundesland', 'land'],
  segment:            ['segment', 'branche', 'sektor'],
  priority:           ['priorität', 'prioritaet', 'prio', 'priority'],
  numberOfEmployees:  ['mitarbeiter', 'mitarbeitende', 'mitarbeiterzahl', 'employees', 'größe', 'groesse'],
  contactName:        ['ansprechpartner', 'kontakt', 'contact'],
  contactTitle:       ['position', 'titel', 'funktion'],
  contactLinkedIn:    ['linkedin'],
  contactSource:      ['quelle', 'herkunft', 'source'],
  wzCode:             ['wz', 'wzcode', 'wz2008', 'wznr', 'wirtschaftszweig', 'branchencode'],
  notes:              ['notiz', 'notizen', 'notes', 'hinweis'],
};

const FIELD_LABELS = {
  companyName: 'Unternehmen', location: 'Ort', street: 'Straße', postalCode: 'PLZ',
  bundesland: 'Bundesland', segment: 'Branche',
  priority: 'Priorität', numberOfEmployees: 'Mitarbeiter', contactName: 'Ansprechpartner',
  contactTitle: 'Position', contactLinkedIn: 'LinkedIn', contactSource: 'Quelle',
  wzCode: 'WZ 2008', notes: 'Notizen',
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function decodeCsv(buffer) {
  if (!buffer) return '';
  const hasBom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
  const utf8 = buffer.toString('utf8');
  if (hasBom || !utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    return utf8;
  }
}

function parseCsv(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolons >= commas ? ';' : ',';

  const records = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) records.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) records.push(row);

  const headers = (records.shift() || []).map((h) => h.trim());
  const rows = records.map((record) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (record[idx] ?? '').trim(); });
    return obj;
  });

  return { headers, rows };
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

function matchRating(a, b) {
  if (!a || !b) return null;
  if (a === b) return 'exakt';
  if (a.startsWith(b + ' ') || b.startsWith(a + ' ')) return 'hoch';
  const max = Math.max(a.length, b.length);
  const score = 1 - levenshtein(a, b) / max;
  if (score >= 0.86) return 'hoch';
  if (score >= 0.7) return 'mittel';
  return null;
}

function parsePriority(value) {
  const v = String(value || '').toLowerCase().trim();
  if (!v) return null;
  if (v.startsWith('1') || v.startsWith('p1') || v.includes('hoch')) return '1';
  if (v.startsWith('2') || v.startsWith('p2') || v.includes('mittel')) return '2';
  if (v.startsWith('3') || v.startsWith('p3') || v.includes('niedrig')) return '3';
  return null;
}

function parseWzPattern(pattern) {
  const set = new Set();
  for (const part of String(pattern || '').split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d{2})\s*[-–]\s*(\d{2})$/);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) {
        set.add(String(n).padStart(2, '0'));
      }
    } else {
      const digits = trimmed.replace(/[^\d]/g, '');
      if (digits.length >= 2) set.add(digits.slice(0, 2));
    }
  }
  return set;
}

function matchWz(rawCode, mappings) {
  const digits = String(rawCode || '').replace(/[^\d]/g, '');
  if (digits.length < 2) return null;
  const prefix = digits.slice(0, 2);
  return mappings.find((m) => m.prefixes.has(prefix)) || null;
}

function buildTargetData(row, { source, sourceDate, defaults }) {
  const data = {};
  if (row.companyName) data.companyName = row.companyName;
  if (row.location) data.location = row.location;
  if (row.street) data.street = row.street;
  if (row.postalCode) data.postalCode = row.postalCode;
  if (row.bundesland) data.bundesland = row.bundesland;
  if (row.wzCode) data.wzCode = row.wzCode;
  if (row.segment) data.segment = row.segment;
  else if (defaults) data.segment = 'Sonstige';
  const prio = parsePriority(row.priority);
  if (prio) data.priority = prio;
  else if (defaults) data.priority = '3';
  const employees = parseInt(String(row.numberOfEmployees || '').replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(employees) && employees > 0) data.numberOfEmployees = employees;
  if (row.contactName) data.contactName = row.contactName;
  if (row.contactTitle) data.contactTitle = row.contactTitle;
  if (row.contactLinkedIn) data.contactLinkedIn = row.contactLinkedIn;
  if (row.contactSource || source) data.contactSource = row.contactSource || source;
  if (row.notes) data.notes = row.notes;
  if (sourceDate && !Number.isNaN(sourceDate.getTime())) data.sizeCheckedAt = sourceDate;
  if (defaults) data.status = 'offen';
  return data;
}

async function analyzeCsv(text) {
  const { headers, rows } = parseCsv(text);

  const fieldToColumn = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!fieldToColumn[field] && aliases.some((a) => normalizeHeader(a) === norm)) {
        fieldToColumn[field] = header;
      }
    }
  }

  const [targets, accounts, blocked, wzRows] = await Promise.all([
    prisma.sprintTarget.findMany({ select: { id: true, companyName: true, status: true } }),
    prisma.account.findMany({ select: { id: true, companyName: true } }),
    prisma.sprintBlocklist.findMany({ select: { id: true, companyName: true, reason: true } }),
    prisma.sprintWzMapping.findMany({
      select: { wzCode: true, segment: true, priority: true },
      orderBy: { priority: 'asc' },
    }),
  ]);

  const wzMappings = wzRows.map((m) => ({
    segment: m.segment,
    priority: m.priority,
    wzCode: m.wzCode,
    prefixes: parseWzPattern(m.wzCode),
  }));

  const targetIndex = targets.map((t) => ({ kind: 'sprintTarget', ...t, norm: normalizeCompany(t.companyName) }));
  const accountIndex = accounts.map((a) => ({ kind: 'account', ...a, norm: normalizeCompany(a.companyName) }));
  const candidates = [...targetIndex, ...accountIndex];
  const blockedIndex = blocked.map((b) => ({ ...b, norm: normalizeCompany(b.companyName) }));

  const analyzed = rows.map((rawRow, idx) => {
    const mapped = {};
    for (const [field, column] of Object.entries(fieldToColumn)) {
      mapped[field] = (rawRow[column] || '').trim();
    }
    // WZ-Zuordnung: Segment/Priorität ergänzen, wenn die Zeile sie nicht liefert
    let wzMatch = null;
    if (mapped.wzCode) {
      const hit = matchWz(mapped.wzCode, wzMappings);
      if (hit) {
        wzMatch = { wzCode: hit.wzCode, segment: hit.segment, priority: hit.priority };
        if (!mapped.segment) mapped.segment = hit.segment;
        if (!mapped.priority) mapped.priority = String(hit.priority);
      }
    }

    const companyName = mapped.companyName || '';
    const norm = normalizeCompany(companyName);

    let status = 'new';
    let match = null;

    if (norm) {
      let blockedMatch = null;
      for (const b of blockedIndex) {
        const rating = matchRating(norm, b.norm);
        if (rating === 'exakt' || rating === 'hoch') { blockedMatch = b; break; }
      }
      if (blockedMatch) {
        status = 'blocked';
        match = { kind: 'blocklist', id: blockedMatch.id, name: blockedMatch.companyName, rating: 'exakt', reason: blockedMatch.reason };
      } else {
        let best = null;
        for (const c of candidates) {
          const rating = matchRating(norm, c.norm);
          if (!rating) continue;
          const rank = rating === 'exakt' ? 3 : rating === 'hoch' ? 2 : 1;
          if (!best || rank > best.rank) best = { ...c, rating, rank };
        }
        if (best) {
          status = 'duplicate';
          match = { kind: best.kind, id: best.id, name: best.companyName, rating: best.rating };
        }
      }
    }

    return { row: idx + 1, ...mapped, companyName, status, match, wzMatch, norm };
  });

  const summary = {
    rows: analyzed.length,
    blocked: analyzed.filter((r) => r.status === 'blocked').length,
    duplicates: analyzed.filter((r) => r.status === 'duplicate').length,
    new: analyzed.filter((r) => r.status === 'new').length,
  };

  const mapping = Object.entries(fieldToColumn).map(([field, column]) => ({
    field, column, label: FIELD_LABELS[field] || field,
  }));

  return { headers, mapping, summary, rows: analyzed };
}

function stripInternal(rows) {
  return rows.map(({ norm, ...rest }) => rest);
}

// POST /api/sprint-targets/import/preview
router.post('/import/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV-Datei fehlt' });
    const analysis = await analyzeCsv(decodeCsv(req.file.buffer));
    if (analysis.rows.length === 0) return res.status(400).json({ error: 'Keine Datenzeilen in der Datei' });
    if (!analysis.mapping.some((m) => m.field === 'companyName')) {
      return res.status(400).json({ error: 'Spalte "Unternehmen" (bzw. Name/Firma/Company) nicht gefunden' });
    }
    res.json({ ...analysis, rows: stripInternal(analysis.rows) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/import/commit
router.post('/import/commit', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV-Datei fehlt' });

    let decisions = {};
    if (req.body.decisions) {
      try { decisions = JSON.parse(req.body.decisions); } catch { decisions = {}; }
    }

    const source = (req.body.source || '').trim();
    const sourceDate = req.body.sourceDate ? new Date(req.body.sourceDate) : null;

    const analysis = await analyzeCsv(decodeCsv(req.file.buffer));
    let created = 0, merged = 0, skipped = 0, blocked = 0;
    const errors = [];

    for (const row of analysis.rows) {
      if (!row.companyName) { skipped++; continue; }
      if (row.status === 'blocked') { blocked++; continue; }

      const decision = decisions[row.row] || (row.status === 'duplicate' ? 'merge' : 'create');
      if (decision === 'skip') { skipped++; continue; }

      try {
        if (decision === 'merge' && row.match?.kind === 'sprintTarget') {
          const data = buildTargetData(row, { source, sourceDate, defaults: false });
          await prisma.sprintTarget.update({ where: { id: row.match.id }, data });
          merged++;
        } else if (decision === 'merge' && row.match?.kind === 'account') {
          const data = buildTargetData(row, { source, sourceDate, defaults: true });
          await prisma.sprintTarget.create({ data: { ...data, accountId: row.match.id } });
          created++;
        } else {
          const data = buildTargetData(row, { source, sourceDate, defaults: true });
          await prisma.sprintTarget.create({ data });
          created++;
        }
      } catch (err) {
        errors.push({ row: row.row, companyName: row.companyName, error: err.message });
      }
    }

    res.json({ created, merged, skipped, blocked, errors, summary: analysis.summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sperrliste ───────────────────────────────────────────────────────────────

// GET /api/sprint-targets/blocklist
router.get('/blocklist', async (req, res) => {
  try {
    const { q } = req.query;
    const where = q ? { companyName: { contains: q, mode: 'insensitive' } } : {};
    const entries = await prisma.sprintBlocklist.findMany({
      where,
      orderBy: { blockedAt: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/blocklist
router.post('/blocklist', async (req, res) => {
  try {
    const { companyName, reason, contactName, notes, blockedAt } = req.body;
    if (!companyName || !String(companyName).trim()) {
      return res.status(400).json({ error: 'Unternehmen ist erforderlich' });
    }
    const entry = await prisma.sprintBlocklist.create({
      data: {
        companyName: String(companyName).trim(),
        normalizedName: normalizeCompany(companyName),
        reason: reason || null,
        contactName: contactName || null,
        notes: notes || null,
        blockedAt: blockedAt ? new Date(blockedAt) : new Date(),
      },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/blocklist/:id
router.put('/blocklist/:id', async (req, res) => {
  try {
    const { companyName, reason, contactName, notes, blockedAt } = req.body;
    const data = {};
    if (companyName !== undefined) {
      data.companyName = String(companyName).trim();
      data.normalizedName = normalizeCompany(companyName);
    }
    if (reason !== undefined) data.reason = reason || null;
    if (contactName !== undefined) data.contactName = contactName || null;
    if (notes !== undefined) data.notes = notes || null;
    if (blockedAt !== undefined) data.blockedAt = blockedAt ? new Date(blockedAt) : new Date();
    const entry = await prisma.sprintBlocklist.update({ where: { id: req.params.id }, data });
    res.json(entry);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-targets/blocklist/:id
router.delete('/blocklist/:id', async (req, res) => {
  try {
    await prisma.sprintBlocklist.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Reporting ────────────────────────────────────────────────────────────────

// Berechnet die Reporting-Kennzahlen — genutzt von JSON- und PDF-Endpunkt
async function computeReportingSummary(query = {}) {
    const parseDate = (value, endOfDay = false) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      if (endOfDay) d.setHours(23, 59, 59, 999);
      return d;
    };
    const from = parseDate(query.from);
    const to = parseDate(query.to, true);
    const dateRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;

    const targetWhere = dateRange ? { createdAt: dateRange } : {};
    const activityWhere = { sprintTargetId: { not: null }, ...(dateRange ? { date: dateRange } : {}) };
    const assessmentWhere = dateRange ? { createdAt: dateRange } : {};

    const [targets, activities, blocklistCount, assessmentRows, members, assignments] = await Promise.all([
      prisma.sprintTarget.findMany({
        where: targetWhere,
        select: {
          id: true, status: true, priority: true, segment: true, bundesland: true,
          offerValue: true, offerDate: true, result: true, callAttempts: true, createdAt: true,
          lossReason: true, contactSource: true,
        },
      }),
      prisma.activity.findMany({
        where: activityWhere,
        select: { type: true, date: true, createdById: true },
      }),
      prisma.sprintBlocklist.count(),
      prisma.sprintAssessment.findMany({ where: assessmentWhere, select: { sprintTargetId: true } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.sprintAssignment.findMany({ select: { userId: true, sprintTargetId: true } }),
    ]);

    const byStatus = {};
    const byPriority = {};
    const bySegment = {};
    const byBundesland = {};
    const byLossReason = {};
    const byChannel = {};
    let pipelineValue = 0;
    let wonValue = 0;
    let offersCount = 0;
    let offersValue = 0;
    let pendingDaysSum = 0;
    let pendingCount = 0;

    for (const t of targets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.segment) bySegment[t.segment] = (bySegment[t.segment] || 0) + 1;
      if (t.bundesland) byBundesland[t.bundesland] = (byBundesland[t.bundesland] || 0) + 1;
      if (t.lossReason) byLossReason[t.lossReason] = (byLossReason[t.lossReason] || 0) + 1;
      if (t.contactSource) byChannel[t.contactSource] = (byChannel[t.contactSource] || 0) + 1;

      if (t.offerValue) {
        offersCount++;
        offersValue += t.offerValue;
      }
      if (ACTIVE_STATUS_SET.has(t.status) || WON_STATUS_SET.has(t.status)) {
        pipelineValue += t.offerValue || 0;
      }
      if (WON_STATUS_SET.has(t.status)) wonValue += t.offerValue || 0;
      if (OFFER_SENT_STATUS_SET.has(t.status) && t.offerDate) {
        pendingDaysSum += Math.max(0, Math.round((Date.now() - new Date(t.offerDate).getTime()) / 86400000));
        pendingCount++;
      }
    }

    const won = countWon(byStatus);
    const lost = LOST_STATUSES.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    const nowTs = Date.now();
    const byType = {};
    let last7 = 0;
    let last30 = 0;
    for (const a of activities) {
      byType[a.type] = (byType[a.type] || 0) + 1;
      const age = (nowTs - new Date(a.date).getTime()) / 86400000;
      if (age <= 7) last7++;
      if (age <= 30) last30++;
    }

    // Team-Performance: Zuweisungen je Mitarbeiter (Targets des Zeitraums), gewonnene Kunden und Aktivitäten
    const targetById = new Map(targets.map((t) => [t.id, t]));
    const memberName = Object.fromEntries(members.map((m) => [m.id, m.name]));
    const teamMap = new Map();
    const ensureMember = (id) => {
      if (!teamMap.has(id)) {
        teamMap.set(id, { userId: id, name: memberName[id] || 'Unbekannt', assigned: 0, won: 0, wonValue: 0, activities: 0 });
      }
      return teamMap.get(id);
    };
    for (const a of assignments) {
      const target = targetById.get(a.sprintTargetId);
      if (!target) continue;
      const entry = ensureMember(a.userId);
      entry.assigned += 1;
      if (WON_STATUS_SET.has(target.status)) {
        entry.won += 1;
        entry.wonValue += target.offerValue || 0;
      }
    }
    for (const a of activities) {
      if (a.createdById) ensureMember(a.createdById).activities += 1;
    }
    const teamPerformance = [...teamMap.values()].sort((a, b) => b.wonValue - a.wonValue || b.assigned - a.assigned);

    const revenueTarget = Math.max(0, Number(query.revenueTarget) || 500000);
    const assessedTargets = new Set(assessmentRows.map((r) => r.sprintTargetId)).size;

    const segmentList = Object.entries(bySegment)
      .map(([segment, count]) => ({ segment, count }))
      .sort((a, b) => b.count - a.count);
    const bundeslandList = Object.entries(byBundesland)
      .map(([bundesland, count]) => ({ bundesland, count }))
      .sort((a, b) => b.count - a.count);
    const lossReasonList = Object.entries(byLossReason)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    const channelList = Object.entries(byChannel)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: targets.length,
      period: { from, to },
      byStatus,
      byPriority,
      segmentList,
      bundeslandList,
      lossReasonList,
      channelList,
      teamPerformance,
      pipelineValue,
      wonValue,
      revenue: {
        target: revenueTarget,
        achieved: wonValue,
        percent: revenueTarget ? Math.min(100, Math.round((wonValue / revenueTarget) * 100)) : 0,
      },
      assessments: {
        total: assessmentRows.length,
        targets: assessedTargets,
        coverage: targets.length ? Math.round((assessedTargets / targets.length) * 100) : 0,
      },
      offers: {
        count: offersCount,
        value: offersValue,
        pending: countStatuses(byStatus, OFFER_SENT_STATUSES),
        accepted: won,
        rejected: lost,
        avgPendingDays: pendingCount ? Math.round(pendingDaysSum / pendingCount) : 0,
      },
      winRate,
      activities: { total: activities.length, last7, last30, byType },
      blocklist: blocklistCount,
    };
}

// GET /api/sprint-targets/reporting/summary
router.get('/reporting/summary', async (req, res) => {
  try {
    res.json(await computeReportingSummary(req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/reporting/pdf
router.get('/reporting/pdf', async (req, res) => {
  try {
    const summary = await computeReportingSummary(req.query);
    const period = summary.period || {};
    const subtitle = period.from || period.to
      ? `Zeitraum ${period.from ? pdfDate(period.from) : '…'} – ${period.to ? pdfDate(period.to) : '…'}`
      : 'Zielkunden, Pipeline und Aktivitäten';
    const doc = buildReportPdf(summary, { subtitle });
    sendPdf(res, doc, `Sprint-Reporting-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Team & Zuweisung ─────────────────────────────────────────────────────────

// GET /api/sprint-targets/team/overview — Mitglieder + Zuweisungen je Zielkunde
router.get('/team/overview', async (req, res) => {
  try {
    const [members, targets, portalRoles, packageRoles] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true,
          portalRole: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.sprintTarget.findMany({
        select: {
          id: true, companyName: true, segment: true, status: true, priority: true,
          package: true, offerValue: true, offerDate: true,
          assignments: { select: { id: true, userId: true, role: true } },
          roleRequirements: { select: { role: true, headcount: true } },
          _count: { select: { assessments: true } },
        },
        orderBy: [{ priority: 'asc' }, { companyName: 'asc' }],
      }),
      prisma.portalRole.findMany({
        where: { id: { in: Object.values(SPRINT_ROLE_IDS) } },
        select: { id: true, name: true },
      }),
      prisma.sprintPackageRole.findMany({
        select: { package: true, role: true, headcount: true },
      }),
    ]);
    const roleName = Object.fromEntries(portalRoles.map((r) => [r.id, r.name]));
    const roles = TEAM_SLOTS.map((slot) => ({
      ...slot,
      label: roleName[SPRINT_ROLE_IDS[slot.key]] || slot.label,
    }));
    res.json({ members, targets, roles, packageRoles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/package-roles — Rollenbedarf je Paket
router.get('/package-roles', async (req, res) => {
  try {
    const rows = await prisma.sprintPackageRole.findMany({
      orderBy: [{ package: 'asc' }, { role: 'asc' }],
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/package-roles/:package — Rollen + Umfang je Paket ersetzen
router.put('/package-roles/:package', async (req, res) => {
  try {
    const pkg = req.params.package;
    if (!SPRINT_PACKAGES.includes(pkg)) return res.status(400).json({ error: 'Unbekanntes Paket' });
    if (!Array.isArray(req.body.roles)) return res.status(400).json({ error: 'roles erforderlich' });

    const byRole = new Map();
    for (const r of req.body.roles) {
      if (!SPRINT_ROLE_KEYS.has(r.role)) continue;
      const headcount = Math.max(0, Number(r.headcount) || 0);
      if (headcount > 0) byRole.set(r.role, headcount);
    }

    await prisma.$transaction([
      prisma.sprintPackageRole.deleteMany({ where: { package: pkg } }),
      prisma.sprintPackageRole.createMany({
        data: [...byRole.entries()].map(([role, headcount]) => ({ package: pkg, role, headcount })),
      }),
    ]);

    const rows = await prisma.sprintPackageRole.findMany({ where: { package: pkg } });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/team/roles/:targetId — Rollenbedarf eines Zielkunden setzen
router.put('/team/roles/:targetId', async (req, res) => {
  try {
    const targetId = req.params.targetId;
    if (!Array.isArray(req.body.roles)) return res.status(400).json({ error: 'roles erforderlich' });

    const target = await prisma.sprintTarget.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const byRole = new Map();
    for (const r of req.body.roles) {
      if (!SPRINT_ROLE_KEYS.has(r.role)) continue;
      byRole.set(r.role, Math.max(1, Number(r.headcount) || 1));
    }

    await prisma.$transaction([
      prisma.sprintTargetRole.deleteMany({ where: { sprintTargetId: targetId } }),
      prisma.sprintTargetRole.createMany({
        data: [...byRole.entries()].map(([role, headcount]) => ({
          sprintTargetId: targetId,
          role,
          headcount,
        })),
      }),
    ]);

    const rows = await prisma.sprintTargetRole.findMany({ where: { sprintTargetId: targetId } });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/team/assign — Mitarbeiter einem Zielkunden in einer Rolle zuweisen
router.post('/team/assign', async (req, res) => {
  try {
    const { targetId, userId, role } = req.body;
    if (!targetId || !userId) return res.status(400).json({ error: 'targetId und userId erforderlich' });
    if (!SPRINT_ROLE_KEYS.has(role)) return res.status(400).json({ error: 'Ungültige Rolle' });

    const target = await prisma.sprintTarget.findUnique({
      where: { id: targetId },
      select: { status: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    if (LOST_STATUS_SET.has(target.status)) {
      return res.status(400).json({ error: 'Zielkunde ist abgeschlossen (Verlust/kein Interesse)' });
    }

    const existing = await prisma.sprintAssignment.findUnique({
      where: { sprintTargetId_userId_role: { sprintTargetId: targetId, userId, role } },
    });
    const assignment = existing || await prisma.sprintAssignment.create({
      data: { sprintTargetId: targetId, userId, role },
    });
    res.status(existing ? 200 : 201).json(assignment);
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Ungültige Benutzerzuordnung' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-targets/team/assign/:id — Zuweisung entfernen
router.delete('/team/assign/:id', async (req, res) => {
  try {
    await prisma.sprintAssignment.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Zuweisung nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/team/bulk-assign — offene Zuweisungen einer Rolle vergeben
router.post('/team/bulk-assign', async (req, res) => {
  try {
    const { role, userId } = req.body;
    if (!SPRINT_ROLE_KEYS.has(role)) return res.status(400).json({ error: 'Ungültige Rolle' });
    if (!userId) return res.status(400).json({ error: 'userId erforderlich' });

    const targets = await prisma.sprintTarget.findMany({
      where: { status: { notIn: LOST_STATUSES }, assignments: { none: { role } } },
      select: { id: true },
    });
    const result = await prisma.sprintAssignment.createMany({
      data: targets.map((t) => ({ sprintTargetId: t.id, userId, role })),
      skipDuplicates: true,
    });
    res.json({ updated: result.count });
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Ungültige Benutzerzuordnung' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Team: Mitglied anlegen / entlasten ──────────────────────────────────────

// POST /api/sprint-targets/team/members — neues Teammitglied anlegen
const TEAM_MEMBER_SCHEMA = {
  name: { type: 'string', required: true, nullable: false, maxLength: 200, label: 'Name' },
  email: { type: 'email', required: true, maxLength: 200, label: 'E-Mail' },
  password: { type: 'string', required: true, nullable: false, minLength: 6, maxLength: 200, label: 'Passwort' },
  portalRoleId: { type: 'string', maxLength: 100, label: 'Rolle' },
};

router.post('/team/members', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, TEAM_MEMBER_SCHEMA);
    if (sendInvalid(res, errors)) return;

    const email = value.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'E-Mail wird bereits verwendet' });

    const user = await prisma.user.create({
      data: {
        name: value.name,
        email,
        password: await bcrypt.hash(value.password, 10),
        role: 'consultant',
        portalRoleId: value.portalRoleId || null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        portalRole: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/team/release — Zuweisungen entlasten
// Body: { userId?, targetId?, role? } — mindestens userId oder targetId
const TEAM_RELEASE_SCHEMA = {
  userId: { type: 'string', maxLength: 100, label: 'Benutzer' },
  targetId: { type: 'string', maxLength: 100, label: 'Zielkunde' },
  role: { type: 'enum', values: SPRINT_ROLE_KEYS, label: 'Rolle' },
};

router.post('/team/release', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, TEAM_RELEASE_SCHEMA);
    if (sendInvalid(res, errors)) return;
    if (!value.userId && !value.targetId) {
      return res.status(400).json({ error: 'userId oder targetId erforderlich' });
    }

    const where = {};
    if (value.userId) where.userId = value.userId;
    if (value.targetId) where.sprintTargetId = value.targetId;
    if (value.role) where.role = value.role;

    const result = await prisma.sprintAssignment.deleteMany({ where });
    res.json({ released: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BAFA ────────────────────────────────────────────────────────────────────

const BAFA_FIELDS = [
  'bafaStatus', 'bafaDate', 'bafaSubmittedAt', 'bafaApprovedAmount', 'bafaNotes', 'fundingAmount',
];

const BAFA_DOC_STATUS = new Set(['offen', 'angefordert', 'erhalten', 'geprüft']);

function pickBafa(body) {
  const data = {};
  for (const f of BAFA_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f] ?? null;
  }
  for (const f of ['bafaDate', 'bafaSubmittedAt']) {
    if (data[f]) data[f] = toDate(data[f]);
  }
  for (const f of ['bafaApprovedAmount', 'fundingAmount']) {
    if (data[f] !== undefined && data[f] !== null) {
      const n = Number(data[f]);
      data[f] = Number.isFinite(n) ? n : null;
    }
  }
  return data;
}

// GET /api/sprint-targets/:id/bafa
router.get('/:id/bafa', async (req, res) => {
  try {
    const target = await prisma.sprintTarget.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        companyName: true,
        location: true,
        contactName: true,
        segment: true,
        status: true,
        offerPackage: true,
        offerValue: true,
        offerValidUntil: true,
        bafaStatus: true,
        bafaDate: true,
        bafaSubmittedAt: true,
        bafaApprovedAmount: true,
        bafaNotes: true,
        fundingAmount: true,
      },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const [documents, settings] = await Promise.all([
      prisma.sprintBafaDocument.findMany({
        where: { sprintTargetId: req.params.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.sprintSetting.findUnique({ where: { id: 'singleton' }, select: { bafaParams: true } }),
    ]);

    res.json({ target, documents, bafaParams: settings?.bafaParams || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/:id/bafa
router.put('/:id/bafa', async (req, res) => {
  try {
    const data = pickBafa(req.body || {});
    const target = await prisma.sprintTarget.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        bafaStatus: true,
        bafaDate: true,
        bafaSubmittedAt: true,
        bafaApprovedAmount: true,
        bafaNotes: true,
        fundingAmount: true,
      },
    });
    res.json(target);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/:id/bafa/documents
router.post('/:id/bafa/documents', async (req, res) => {
  try {
    const { name, status, fileUrl, notes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Dokumentname ist erforderlich' });
    }
    const target = await prisma.sprintTarget.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const doc = await prisma.sprintBafaDocument.create({
      data: {
        sprintTargetId: req.params.id,
        name: String(name).trim(),
        status: BAFA_DOC_STATUS.has(status) ? status : 'offen',
        fileUrl: fileUrl || null,
        notes: notes || null,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/bafa/documents/:docId
router.put('/bafa/documents/:docId', async (req, res) => {
  try {
    const { name, status, fileUrl, notes } = req.body || {};
    const data = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Dokumentname ist erforderlich' });
      data.name = String(name).trim();
    }
    if (status !== undefined) {
      if (!BAFA_DOC_STATUS.has(status)) return res.status(400).json({ error: 'Ungültiger Dokumentstatus' });
      data.status = status;
    }
    if (fileUrl !== undefined) data.fileUrl = fileUrl || null;
    if (notes !== undefined) data.notes = notes || null;

    const doc = await prisma.sprintBafaDocument.update({
      where: { id: req.params.docId },
      data,
    });
    res.json(doc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-targets/bafa/documents/:docId
router.delete('/bafa/documents/:docId', async (req, res) => {
  try {
    await prisma.sprintBafaDocument.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/:id/bafa/pdf
router.get('/:id/bafa/pdf', async (req, res) => {
  try {
    const target = await prisma.sprintTarget.findUnique({
      where: { id: req.params.id },
      select: {
        companyName: true,
        location: true,
        contactName: true,
        segment: true,
        offerValue: true,
        bafaStatus: true,
        bafaDate: true,
        bafaSubmittedAt: true,
        bafaApprovedAmount: true,
        bafaNotes: true,
        fundingAmount: true,
      },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const documents = await prisma.sprintBafaDocument.findMany({
      where: { sprintTargetId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    const doc = buildBafaPdf(target, documents);
    sendPdf(res, doc, `BAFA-${target.companyName || 'Zielkunde'}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/:id
router.get('/:id', async (req, res) => {
  try {
    const target = await prisma.sprintTarget.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { useCases: true } } },
        },
      },
    });
    if (!target) return res.status(404).json({ error: 'SprintTarget nicht gefunden' });
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-targets/:id
router.put('/:id', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (data.callAttempts !== undefined && data.callAttempts !== null && (data.callAttempts < 0 || data.callAttempts > 3)) {
      return res.status(400).json({ error: 'Anrufversuche müssen zwischen 0 und 3 liegen' });
    }
    if (data.status !== undefined && data.status !== null && !SPRINT_STATUS_SET.has(data.status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    if (data.selfTestScore !== undefined && data.selfTestScore !== null
        && (Number.isNaN(data.selfTestScore) || data.selfTestScore < 0 || data.selfTestScore > 100)) {
      return res.status(400).json({ error: 'Selbsttest-Score muss zwischen 0 und 100 liegen' });
    }

    // Sperrliste: "kein Interesse" sperrt automatisch, jeder andere Status entsperrt wieder
    let previousStatus = null;
    if (data.status !== undefined) {
      const existing = await prisma.sprintTarget.findUnique({
        where: { id: req.params.id },
        select: { status: true, lossReason: true },
      });
      if (!existing) return res.status(404).json({ error: 'SprintTarget nicht gefunden' });
      previousStatus = existing.status;

      if (LOST_STATUS_SET.has(data.status)) {
        if (!data.result) data.result = 'verloren';
        const lossReason = data.lossReason ?? existing.lossReason;
        if (!lossReason) {
          return res.status(400).json({ error: `Verlustgrund ist beim Status "${data.status}" Pflicht` });
        }
      }
      if (WON_STATUS_SET.has(data.status) && !data.result) data.result = 'gewonnen';
    }

    const target = await prisma.sprintTarget.update({
      where: { id: req.params.id },
      data,
      include: { account: { select: { id: true, companyName: true } } },
    });

    let blocklisted = false;
    let unblocked = false;
    const normalizedName = normalizeCompany(target.companyName);

    if (data.status === 'kein Interesse') {
      const alreadyBlocked = await prisma.sprintBlocklist.findFirst({
        where: { normalizedName },
        select: { id: true },
      });
      if (!alreadyBlocked) {
        await prisma.sprintBlocklist.create({
          data: {
            companyName: target.companyName,
            normalizedName,
            reason: target.lossReason || 'kein Interesse',
            contactName: target.contactName || null,
            notes: 'Automatisch gesperrt bei Statuswechsel zu "kein Interesse"',
          },
        });
        blocklisted = true;
      }
    } else if (previousStatus === 'kein Interesse') {
      const { count } = await prisma.sprintBlocklist.deleteMany({
        where: { normalizedName },
      });
      unblocked = count > 0;
    }

    res.json({ ...target, blocklisted, unblocked });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'SprintTarget nicht gefunden' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Ungültige Benutzerzuordnung' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-targets/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.sprintTarget.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'SprintTarget nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-targets/:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { sprintTargetId: req.params.id },
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-targets/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, date, duration, summary, nextSteps, channel, outreachTemplateId } = req.body;
    const activityType = type || 'Note';
    const isCall = String(activityType).toLowerCase() === 'call';

    const target = await prisma.sprintTarget.findUnique({
      where: { id: req.params.id },
      select: { id: true, callAttempts: true, companyName: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'SprintTarget nicht gefunden' });

    // DSGVO Art. 21: Widerspruch ("kein Interesse"/Sperrliste) sperrt jede Kontaktaufnahme.
    // Interne Notizen/Aufgaben bleiben erlaubt, kundenbezogene Kanäle nicht.
    const isOutreach = ['call', 'email', 'linkedin', 'meeting'].includes(String(activityType).toLowerCase());
    if (isOutreach) {
      const blockReason = await contactBlockReason(prisma, target);
      if (blockReason) {
        return res.status(409).json({
          error: `Kontaktsperre (DSGVO Art. 21): ${blockReason}. Anrufe, E-Mails, LinkedIn und Termine sind gesperrt – nur interne Notizen sind möglich.`,
          blocked: true,
        });
      }
    }

    // UWG-Regel: höchstens drei Anrufversuche pro Zielkunde
    if (isCall && target.callAttempts >= 3) {
      return res.status(409).json({
        error: 'Maximal drei Anrufversuche pro Zielkunde erreicht. Bitte Ergebnis erfassen oder den Zähler zurücksetzen.',
        callAttempts: target.callAttempts,
      });
    }

    const [activity] = await prisma.$transaction([
      prisma.activity.create({
        data: {
          type: activityType,
          date: date ? new Date(date) : new Date(),
          duration: duration ? Number(duration) : null,
          summary: summary || null,
          nextSteps: nextSteps || null,
          channel: channel || null,
          outreachTemplateId: outreachTemplateId || null,
          sprintTargetId: req.params.id,
          createdById: req.user?.id || null,
        },
        include: { createdBy: { select: { name: true } } },
      }),
      ...(isCall
        ? [prisma.sprintTarget.update({
            where: { id: req.params.id },
            data: { callAttempts: { increment: 1 } },
          })]
        : []),
    ]);

    res.status(201).json({
      ...activity,
      callAttempts: isCall ? target.callAttempts + 1 : target.callAttempts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

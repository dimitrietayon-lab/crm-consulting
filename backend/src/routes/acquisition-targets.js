const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { validate, sendInvalid } = require('../lib/validate');
const { sendPdf, date: pdfDate } = require('../lib/pdf');
const { buildBafaPdf } = require('../lib/pdf/bafa-report');
const { buildReportPdf } = require('../lib/pdf/acquisition-report');
const { normalizeCompany, contactBlockReason } = require('../lib/acquisitionCompliance');
const { linkAccountOnWin } = require('../lib/acquisitionAccount');
const { getPipelineForTarget, isStatusTransitionAllowed: pipelineAllowsTransition } = require('../lib/acquisitionPipeline');
const { aggregateFlagSets, isBlockStatus, primaryBlockStatus } = require('../lib/acquisitionStatuses');

const prisma = new PrismaClient();

// Kampagnenübergreifende Rollups (Stats/Dashboard/Reporting) nutzen die
// Vereinigung aller gecachten Pipeline-Flags. Mutatoren lösen exakt die
// Pipeline des jeweiligen Zielkunden auf.
const agg = () => aggregateFlagSets();

// Standard-Kampagne für neu angelegte/importierte Zielkunden
async function resolveDefaultCampaignId() {
  const campaign = await prisma.acquisitionCampaign.findFirst({
    where: { active: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return campaign?.id || null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const ALLOWED_FIELDS = [
  'companyName', 'location', 'street', 'postalCode', 'bundesland', 'segment', 'priority',
  'numberOfEmployees', 'sizeCheckedAt', 'status', 'contactSource', 'ponturoRelationship',
  'contactName', 'contactTitle', 'contactLinkedIn', 'callAttempts', 'callTrigger',
  'emailAllowed', 'handoverDate', 'firstMeetingDate', 'offerValue',
  'offerDate', 'bafaDate', 'bafaStatus', 'result', 'lossReason', 'notes', 'stepChecks',
  'contactEmail', 'revenue', 'website', 'wzCode', 'emailConsentAt', 'emailConsentSource',
  'emailConsentRevokedAt', 'callConsentAt', 'callConsentSource', 'privacyNoticeAt',
  'privacyNoticeSource', 'selfTestScore', 'selfTestDate', 'selfTestLink',
  'decisionDate', 'nextStep', 'nextStepDue',
  'fundingAmount', 'offerValidUntil', 'bafaApprovedAmount', 'bafaSubmittedAt', 'bafaNotes',
  'fundingProgram', 'campaignId', 'pipelineId',
];

// Status-/Phasenmodell kommt aus der definierbaren Akquise-Pipeline
// (lib/acquisitionPipeline.js, DB-gestützt mit Seed-Fallback).
const countInTalk = (counts) => agg().inTalkStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
const countWon = (counts) => agg().wonStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
const countStatuses = (counts, statuses) => statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

// Zuordnung der Sprint-Rollen auf die Einträge der Rollenverwaltung (PortalRole)
const SPRINT_ROLE_IDS = {
  lead: 'sprint-role-lead',
  ki: 'sprint-role-ki',
  sales: 'sprint-role-sales',
};

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
      by: ['acquisitionTargetId'],
      where: { acquisitionTargetId: { in: ids } },
      _max: { date: true },
      _count: { _all: true },
    }),
    prisma.acquisitionAssignment.groupBy({
      by: ['acquisitionTargetId'],
      where: { acquisitionTargetId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const lastActivity = new Map(activityAgg.map((r) => [r.acquisitionTargetId, r._max.date]));
  const activityCount = new Map(activityAgg.map((r) => [r.acquisitionTargetId, r._count._all]));
  const assignmentCount = new Map(assignmentAgg.map((r) => [r.acquisitionTargetId, r._count._all]));

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

// GET /api/acquisition/stats/summary — must be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const campaignId = req.query.campaignId || null;
    const [targets, blocklistCount, assessedRows, upcomingCount] = await Promise.all([
      prisma.acquisitionTarget.findMany({
        where: campaignId ? { campaignId } : {},
        select: { status: true, offerValue: true },
      }),
      prisma.acquisitionBlocklist.count(),
      prisma.acquisitionAssessment.groupBy({ by: ['acquisitionTargetId'] }),
      prisma.activity.count({
        where: { acquisitionTargetId: { not: null }, date: { gte: now, lte: in7 } },
      }),
    ]);

    const counts = {};
    let pipelineValue = 0;
    let wonValue = 0;

    for (const t of targets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
      if (agg().activeStatuses.includes(t.status) || agg().wonStatuses.includes(t.status)) {
        pipelineValue += t.offerValue || 0;
      }
      if (agg().wonStatuses.includes(t.status)) {
        wonValue += t.offerValue || 0;
      }
    }

    const total = targets.length;
    const imGespraech = countInTalk(counts);
    const angebote = countStatuses(counts, agg().offerStatuses);
    const gewonnen = countWon(counts);
    const verloren = agg().lostStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
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

// GET /api/acquisition
router.get('/', async (req, res) => {
  try {
    const { q, sort, page, pageSize, paginate } = req.query;
    const statuses = toArray(req.query.status);
    const priorities = toArray(req.query.priority);
    const bundeslaender = toArray(req.query.bundesland);
    const segments = toArray(req.query.segment);
    const { campaignId, pipelineId } = req.query;

    const where = {};
    if (statuses.length) where.status = { in: statuses };
    if (priorities.length) where.priority = { in: priorities };
    if (bundeslaender.length) where.bundesland = { in: bundeslaender };
    if (campaignId) where.campaignId = campaignId;
    if (pipelineId) where.pipelineId = pipelineId;

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
      prisma.acquisitionTarget.count({ where }),
      prisma.acquisitionTarget.findMany({
        where,
        orderBy,
        ...(shouldPaginate ? { skip: (pageNum - 1) * size, take: size } : {}),
        include: {
          account: { select: { id: true, companyName: true } },
          campaign: { select: { id: true, name: true } },
          pipeline: { select: { id: true, key: true, name: true } },
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

// GET /api/acquisition/dashboard/summary — Kennzahlen, Agenda, Team, Top-Zielkunden
router.get('/dashboard/summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7 = new Date(startOfDay.getTime() + 7 * 86400000);
    const campaignId = req.query.campaignId || null;
    const targetWhere = campaignId ? { campaignId } : {};

    const [targets, upcomingActivities, upcomingMeetings, members, assignments, topTargets, blocklistCount] =
      await Promise.all([
        prisma.acquisitionTarget.findMany({ where: targetWhere, select: { status: true, offerValue: true, callAttempts: true } }),
        prisma.activity.findMany({
          where: { acquisitionTargetId: { not: null }, date: { gte: startOfDay, lte: in7 } },
          orderBy: { date: 'asc' },
          take: 20,
          select: {
            id: true, type: true, date: true, summary: true, nextSteps: true,
            acquisitionTarget: { select: { id: true, companyName: true, status: true, priority: true } },
          },
        }),
        prisma.acquisitionTarget.findMany({
          where: { ...targetWhere, firstMeetingDate: { gte: startOfDay, lte: in7 } },
          orderBy: { firstMeetingDate: 'asc' },
          select: { id: true, companyName: true, firstMeetingDate: true, status: true },
        }),
        prisma.user.findMany({
          select: { id: true, name: true, portalRole: { select: { name: true } } },
          orderBy: { name: 'asc' },
        }),
        prisma.acquisitionAssignment.findMany({ select: { userId: true, role: true, acquisitionTargetId: true } }),
        prisma.acquisitionTarget.findMany({
          where: { ...targetWhere, status: { notIn: agg().lostStatuses } },
          orderBy: [{ priority: 'asc' }, { offerValue: 'desc' }],
          take: 5,
          select: {
            id: true, companyName: true, status: true, priority: true, segment: true,
            offerValue: true, callAttempts: true, contactName: true,
          },
        }),
        prisma.acquisitionBlocklist.count(),
      ]);

    const counts = {};
    let pipelineValue = 0;
    let wonValue = 0;
    for (const t of targets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
      if (agg().activeStatuses.includes(t.status) || agg().wonStatuses.includes(t.status)) pipelineValue += t.offerValue || 0;
      if (agg().wonStatuses.includes(t.status)) wonValue += t.offerValue || 0;
    }
    const won = countWon(counts);
    const lost = agg().lostStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

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
        targetId: a.acquisitionTarget?.id || null,
        companyName: a.acquisitionTarget?.companyName || null,
        status: a.acquisitionTarget?.status || null,
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
        active: agg().activeStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0),
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
          (t) => (t.callAttempts || 0) >= 3 && !agg().wonStatuses.includes(t.status) && !agg().lostStatuses.includes(t.status)
        ).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition
router.post('/', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.companyName) return res.status(400).json({ error: 'companyName ist erforderlich' });
    if (!data.segment) return res.status(400).json({ error: 'segment ist erforderlich' });
    if (!data.campaignId) {
      const defaultCampaignId = await resolveDefaultCampaignId();
      if (defaultCampaignId) data.campaignId = defaultCampaignId;
    }

    const target = await prisma.acquisitionTarget.create({
      data,
      include: { account: { select: { id: true, companyName: true } } },
    });

    // Direkt als gewonnen angelegt → CRM-Account anlegen/verknüpfen
    let account = target.account;
    if (getPipelineForTarget(target).wonStatuses.includes(target.status)) {
      const linkedId = await linkAccountOnWin(prisma, target, { pipeline: getPipelineForTarget(target) });
      if (linkedId) {
        account = await prisma.account.findUnique({
          where: { id: linkedId },
          select: { id: true, companyName: true },
        });
      }
    }

    res.status(201).json({ ...target, accountId: account?.id || target.accountId, account });
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
    prisma.acquisitionTarget.findMany({ select: { id: true, companyName: true, status: true } }),
    prisma.account.findMany({ select: { id: true, companyName: true } }),
    prisma.acquisitionBlocklist.findMany({ select: { id: true, companyName: true, reason: true } }),
    prisma.acquisitionWzMapping.findMany({
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

// POST /api/acquisition/import/preview
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

// POST /api/acquisition/import/commit
router.post('/import/commit', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV-Datei fehlt' });

    let decisions = {};
    if (req.body.decisions) {
      try { decisions = JSON.parse(req.body.decisions); } catch { decisions = {}; }
    }

    const source = (req.body.source || '').trim();
    const sourceDate = req.body.sourceDate ? new Date(req.body.sourceDate) : null;
    let importCampaignId = (req.body.campaignId || '').trim();
    if (!importCampaignId) importCampaignId = await resolveDefaultCampaignId();

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
          await prisma.acquisitionTarget.update({ where: { id: row.match.id }, data });
          merged++;
        } else if (decision === 'merge' && row.match?.kind === 'account') {
          // Bestehender CRM-Account: nur als Interessent anlegen –
          // die Verknüpfung entsteht erst beim Abschluss (Status „gewonnen“).
          const data = buildTargetData(row, { source, sourceDate, defaults: true });
          if (importCampaignId) data.campaignId = importCampaignId;
          await prisma.acquisitionTarget.create({ data });
          created++;
        } else {
          const data = buildTargetData(row, { source, sourceDate, defaults: true });
          if (importCampaignId) data.campaignId = importCampaignId;
          await prisma.acquisitionTarget.create({ data });
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

// GET /api/acquisition/blocklist
router.get('/blocklist', async (req, res) => {
  try {
    const { q } = req.query;
    const where = q ? { companyName: { contains: q, mode: 'insensitive' } } : {};
    const entries = await prisma.acquisitionBlocklist.findMany({
      where,
      orderBy: { blockedAt: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition/blocklist
router.post('/blocklist', async (req, res) => {
  try {
    const { companyName, reason, contactName, notes, blockedAt } = req.body;
    if (!companyName || !String(companyName).trim()) {
      return res.status(400).json({ error: 'Unternehmen ist erforderlich' });
    }
    const entry = await prisma.acquisitionBlocklist.create({
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

// PUT /api/acquisition/blocklist/:id
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
    const entry = await prisma.acquisitionBlocklist.update({ where: { id: req.params.id }, data });
    res.json(entry);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition/blocklist/:id
router.delete('/blocklist/:id', async (req, res) => {
  try {
    await prisma.acquisitionBlocklist.delete({ where: { id: req.params.id } });
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
    // Akquise-Info (Name/Laufzeit) als Default für Kampagnenname und Zeitraum
    const campaignSettings = await prisma.acquisitionSetting.findUnique({
      where: { id: 'singleton' },
      select: { name: true, startDate: true, endDate: true },
    });
    const campaignId = query.campaignId || null;
    const campaign = campaignId
      ? await prisma.acquisitionCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
      : null;

    // Explizit übergebenes (auch leeres) Datum gewinnt; fehlt der Parameter
    // komplett, greift der in der Akquise-Info hinterlegte Kampagnen-Zeitraum.
    const fromProvided = Object.prototype.hasOwnProperty.call(query, 'from');
    const toProvided = Object.prototype.hasOwnProperty.call(query, 'to');
    const from = fromProvided ? parseDate(query.from) : parseDate(campaign?.startDate || campaignSettings?.startDate);
    const to = toProvided ? parseDate(query.to, true) : parseDate(campaign?.endDate || campaignSettings?.endDate, true);
    const dateRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : null;

    const targetWhere = {
      ...(dateRange ? { createdAt: dateRange } : {}),
      ...(campaignId ? { campaignId } : {}),
    };
    const activityWhere = { acquisitionTargetId: { not: null }, ...(dateRange ? { date: dateRange } : {}) };
    const assessmentWhere = dateRange ? { createdAt: dateRange } : {};

    const [targets, activities, blocklistCount, assessmentRows, members, assignments] = await Promise.all([
      prisma.acquisitionTarget.findMany({
        where: targetWhere,
        select: {
          id: true, status: true, priority: true, segment: true, bundesland: true,
          offerValue: true, offerDate: true, result: true, callAttempts: true, createdAt: true,
          lossReason: true, contactSource: true,
        },
      }),
      prisma.activity.findMany({
        where: activityWhere,
        select: { type: true, date: true, createdById: true, acquisitionTargetId: true },
      }),
      prisma.acquisitionBlocklist.count(),
      prisma.acquisitionAssessment.findMany({ where: assessmentWhere, select: { acquisitionTargetId: true } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      prisma.acquisitionAssignment.findMany({ select: { userId: true, acquisitionTargetId: true } }),
    ]);

    // Bei Kampagnen-Filter nur Aktivitäten der Zielkunden dieser Kampagne
    const targetIdSet = new Set(targets.map((t) => t.id));
    const scopedActivities = campaignId
      ? activities.filter((a) => a.acquisitionTargetId && targetIdSet.has(a.acquisitionTargetId))
      : activities;

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
      if (agg().activeStatuses.includes(t.status) || agg().wonStatuses.includes(t.status)) {
        pipelineValue += t.offerValue || 0;
      }
      if (agg().wonStatuses.includes(t.status)) wonValue += t.offerValue || 0;
      if (agg().offerSentStatuses.includes(t.status) && t.offerDate) {
        pendingDaysSum += Math.max(0, Math.round((Date.now() - new Date(t.offerDate).getTime()) / 86400000));
        pendingCount++;
      }
    }

    const won = countWon(byStatus);
    const lost = agg().lostStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    const nowTs = Date.now();
    const byType = {};
    let last7 = 0;
    let last30 = 0;
    for (const a of scopedActivities) {
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
      const target = targetById.get(a.acquisitionTargetId);
      if (!target) continue;
      const entry = ensureMember(a.userId);
      entry.assigned += 1;
      if (agg().wonStatuses.includes(target.status)) {
        entry.won += 1;
        entry.wonValue += target.offerValue || 0;
      }
    }
    for (const a of scopedActivities) {
      if (a.createdById) ensureMember(a.createdById).activities += 1;
    }
    const teamPerformance = [...teamMap.values()].sort((a, b) => b.wonValue - a.wonValue || b.assigned - a.assigned);

    const revenueTarget = Math.max(0, Number(query.revenueTarget) || 500000);
    const assessedTargets = new Set(assessmentRows.map((r) => r.acquisitionTargetId)).size;

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
      campaign: {
        id: campaign?.id || null,
        name: campaign?.name || campaignSettings?.name || null,
        start: campaign?.startDate || campaignSettings?.startDate || null,
        end: campaign?.endDate || campaignSettings?.endDate || null,
      },
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
        pending: countStatuses(byStatus, agg().offerSentStatuses),
        accepted: won,
        rejected: lost,
        avgPendingDays: pendingCount ? Math.round(pendingDaysSum / pendingCount) : 0,
      },
      winRate,
      activities: { total: scopedActivities.length, last7, last30, byType },
      blocklist: blocklistCount,
    };
}

// GET /api/acquisition/reporting/summary
router.get('/reporting/summary', async (req, res) => {
  try {
    res.json(await computeReportingSummary(req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition/reporting/pdf
router.get('/reporting/pdf', async (req, res) => {
  try {
    const summary = await computeReportingSummary(req.query);
    const period = summary.period || {};
    const subtitle = period.from || period.to
      ? `Zeitraum ${period.from ? pdfDate(period.from) : '…'} – ${period.to ? pdfDate(period.to) : '…'}`
      : 'Zielkunden, Pipeline und Aktivitäten';
    const pipeline = getPipelineForTarget({ campaignId: req.query.campaignId || null });
    const doc = buildReportPdf(summary, { subtitle, pipeline });
    const campaignSlug = String(summary.campaign?.name || '')
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const fileBase = campaignSlug || 'Akquise-Reporting';
    sendPdf(res, doc, `${fileBase}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Team & Zuweisung ─────────────────────────────────────────────────────────

// GET /api/acquisition/team/overview — Mitglieder + Zuweisungen je Zielkunde
router.get('/team/overview', async (req, res) => {
  try {
    const [members, targets, portalRoles, packages] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, role: true,
          portalRole: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.acquisitionTarget.findMany({
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
      prisma.acquisitionPackageInfo.findMany({
        select: { key: true, label: true },
        orderBy: { price: 'asc' },
      }),
    ]);
    const roleName = Object.fromEntries(portalRoles.map((r) => [r.id, r.name]));
    // Basis-Rollen (mit Labels aus der Rollenverwaltung)
    const baseRoles = TEAM_SLOTS.map((slot) => ({
      ...slot,
      label: roleName[SPRINT_ROLE_IDS[slot.key]] || slot.label,
    }));
    const roles = baseRoles;
    res.json({ members, targets, roles, packages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BAFA ────────────────────────────────────────────────────────────────────

const BAFA_FIELDS = [
  'bafaStatus', 'bafaDate', 'bafaSubmittedAt', 'bafaApprovedAmount', 'bafaNotes', 'fundingAmount',
  'fundingProgram',
];

const BAFA_DOC_STATUS = new Set(['offen', 'angefordert', 'erhalten', 'geprüft']);

// Förderprogramme kommen aus den Einstellungen (bafaParams.programs). Fehlt die
// Liste, wird aus den alten Einzelwerten (rate/cap) ein BAFA-Programm abgeleitet.
function normalizeFundingPrograms(bafaParams) {
  const params = bafaParams && typeof bafaParams === 'object' ? bafaParams : null;
  if (Array.isArray(params?.programs) && params.programs.length) return params.programs;
  if (params && (params.rate != null || params.cap != null)) {
    return [{
      id: 'bafa',
      name: 'BAFA',
      rate: params.rate != null ? Number(params.rate) : 0.5,
      cap: params.cap != null ? Number(params.cap) : null,
      note: '',
      active: true,
    }];
  }
  return [];
}

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

// GET /api/acquisition/:id/bafa
router.get('/:id/bafa', async (req, res) => {
  try {
    const target = await prisma.acquisitionTarget.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        companyName: true,
        location: true,
        contactName: true,
        segment: true,
        status: true,
        offerValue: true,
        offerValidUntil: true,
        bafaStatus: true,
        bafaDate: true,
        bafaSubmittedAt: true,
        bafaApprovedAmount: true,
        bafaNotes: true,
        fundingAmount: true,
        fundingProgram: true,
      },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const [documents, settings] = await Promise.all([
      prisma.acquisitionBafaDocument.findMany({
        where: { acquisitionTargetId: req.params.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.acquisitionSetting.findUnique({ where: { id: 'singleton' }, select: { bafaParams: true } }),
    ]);

    const bafaParams = settings?.bafaParams || null;
    res.json({
      target,
      documents,
      bafaParams,
      fundingPrograms: normalizeFundingPrograms(bafaParams),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition/:id/bafa
router.put('/:id/bafa', async (req, res) => {
  try {
    const data = pickBafa(req.body || {});
    const target = await prisma.acquisitionTarget.update({
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
        fundingProgram: true,
      },
    });
    res.json(target);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition/:id/bafa/documents
router.post('/:id/bafa/documents', async (req, res) => {
  try {
    const { name, status, fileUrl, notes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Dokumentname ist erforderlich' });
    }
    const target = await prisma.acquisitionTarget.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const doc = await prisma.acquisitionBafaDocument.create({
      data: {
        acquisitionTargetId: req.params.id,
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

// PUT /api/acquisition/bafa/documents/:docId
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

    const doc = await prisma.acquisitionBafaDocument.update({
      where: { id: req.params.docId },
      data,
    });
    res.json(doc);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition/bafa/documents/:docId
router.delete('/bafa/documents/:docId', async (req, res) => {
  try {
    await prisma.acquisitionBafaDocument.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition/:id/bafa/pdf
router.get('/:id/bafa/pdf', async (req, res) => {
  try {
    const target = await prisma.acquisitionTarget.findUnique({
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
        fundingProgram: true,
      },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const documents = await prisma.acquisitionBafaDocument.findMany({
      where: { acquisitionTargetId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    const doc = buildBafaPdf(target, documents);
    sendPdf(res, doc, `Foerderung-${target.companyName || 'Zielkunde'}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition/me/summary — persönliches Sprint-Cockpit
router.get('/me/summary', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Nicht authentifiziert' });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const in7 = new Date(startOfDay.getTime() + 7 * 86400000);
    const weekAgo = new Date(startOfDay.getTime() - 7 * 86400000);
    const campaignId = req.query.campaignId || null;

    const assignments = await prisma.acquisitionAssignment.findMany({
      where: { userId },
      select: { acquisitionTargetId: true, role: true },
    });
    const targetIds = [...new Set(assignments.map((a) => a.acquisitionTargetId))];

    const [myTargets, openOffers, followUps, weekActivities] = await Promise.all([
      prisma.acquisitionTarget.findMany({
        where: { id: { in: targetIds }, ...(campaignId ? { campaignId } : {}) },
        orderBy: [{ priority: 'asc' }, { nextStepDue: 'asc' }],
        select: {
          id: true, companyName: true, status: true, priority: true, segment: true,
          callAttempts: true, nextStep: true, nextStepDue: true, offerValue: true,
          offerValidUntil: true, firstMeetingDate: true,
        },
      }),
      prisma.acquisitionOffer.findMany({
        where: { acquisitionTargetId: { in: targetIds }, status: { in: ['draft', 'sent'] } },
        orderBy: { validUntil: 'asc' },
        select: {
          id: true, offerNumber: true, status: true, value: true, validUntil: true,
          acquisitionTarget: { select: { id: true, companyName: true } },
        },
      }),
      prisma.acquisitionTarget.findMany({
        where: { id: { in: targetIds }, ...(campaignId ? { campaignId } : {}), nextStepDue: { not: null, lte: in7 }, status: { notIn: agg().lostStatuses } },
        orderBy: { nextStepDue: 'asc' },
        select: { id: true, companyName: true, nextStep: true, nextStepDue: true, status: true, priority: true },
      }),
      prisma.activity.findMany({
        where: { acquisitionTargetId: { in: targetIds }, date: { gte: weekAgo } },
        select: { type: true },
      }),
    ]);

    const roleByTarget = new Map();
    for (const a of assignments) {
      if (!roleByTarget.has(a.acquisitionTargetId)) roleByTarget.set(a.acquisitionTargetId, []);
      roleByTarget.get(a.acquisitionTargetId).push(a.role);
    }

    const overdue = followUps.filter((t) => new Date(t.nextStepDue) < startOfDay);
    const dueToday = followUps.filter((t) => {
      const d = new Date(t.nextStepDue);
      return d >= startOfDay && d < endOfDay;
    });

    const activityByType = {};
    for (const a of weekActivities) activityByType[a.type] = (activityByType[a.type] || 0) + 1;

    const activeTargets = myTargets.filter((t) => !agg().lostStatuses.includes(t.status));
    const pipelineValue = activeTargets.reduce((sum, t) => sum + (t.offerValue || 0), 0);
    const won = myTargets.filter((t) => agg().wonStatuses.includes(t.status)).length;
    const expiringOffers = openOffers.filter((o) => o.validUntil && new Date(o.validUntil) <= in7);

    res.json({
      targets: myTargets.map((t) => ({ ...t, roles: roleByTarget.get(t.id) || [] })),
      stats: {
        assigned: targetIds.length,
        active: activeTargets.length,
        won,
        pipelineValue,
        openOffers: openOffers.length,
        weekActivities: weekActivities.length,
      },
      followUps: {
        overdue,
        dueToday,
        upcoming: followUps.filter((t) => new Date(t.nextStepDue) >= endOfDay),
      },
      offers: openOffers,
      expiringOffers: expiringOffers.length,
      activityByType,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition/:id
router.get('/:id', async (req, res) => {
  try {
    const target = await prisma.acquisitionTarget.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        campaign: { select: { id: true, name: true, pipelineId: true } },
        pipeline: { select: { id: true, key: true, name: true } },
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { useCases: true } } },
        },
      },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    // Kontaktsperre auch auf der Blockliste erkennen, damit das UI die
    // Kanäle (Call/E-Mail/LinkedIn/Meeting) proaktiv sperren kann.
    const blockReason = await contactBlockReason(prisma, target);
    res.json({ ...target, blocklisted: Boolean(blockReason) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition/:id
router.put('/:id', async (req, res) => {
  try {
    const data = sanitize(req.body);

    const existing = await prisma.acquisitionTarget.findUnique({
      where: { id: req.params.id },
      select: {
        status: true,
        lossReason: true,
        campaignId: true,
        pipelineId: true,
        campaign: { select: { pipelineId: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    const targetPipeline = getPipelineForTarget(existing);

    if (data.callAttempts !== undefined && data.callAttempts !== null && (data.callAttempts < 0 || data.callAttempts > 3)) {
      return res.status(400).json({ error: 'Anrufversuche müssen zwischen 0 und 3 liegen' });
    }
    if (data.status !== undefined && data.status !== null && !targetPipeline.statusSet.has(data.status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    if (data.selfTestScore !== undefined && data.selfTestScore !== null
        && (Number.isNaN(data.selfTestScore) || data.selfTestScore < 0 || data.selfTestScore > 100)) {
      return res.status(400).json({ error: 'Selbsttest-Score muss zwischen 0 und 100 liegen' });
    }
    if (data.stepChecks !== undefined && data.stepChecks !== null
        && (typeof data.stepChecks !== 'object' || Array.isArray(data.stepChecks))) {
      return res.status(400).json({ error: 'stepChecks muss ein Objekt sein' });
    }

    // Sperrliste: Block-Status sperrt automatisch, jeder andere Status entsperrt wieder
    let previousStatus = null;
    if (data.status !== undefined) {
      previousStatus = existing.status;

      // Prozess-Freischaltung: nur der nächste Schritt der Reihenfolge
      if (!pipelineAllowsTransition(previousStatus, data.status, targetPipeline)) {
        return res.status(409).json({
          error: 'Statuswechsel nicht erlaubt – bitte den nächsten Schritt der Reihenfolge wählen',
          locked: true,
        });
      }

      if (targetPipeline.lostStatuses.includes(data.status)) {
        if (!data.result) data.result = 'verloren';
        const lossReason = data.lossReason ?? existing.lossReason;
        if (!lossReason) {
          return res.status(400).json({ error: `Verlustgrund ist beim Status "${data.status}" Pflicht` });
        }
      }
      if (targetPipeline.wonStatuses.includes(data.status) && !data.result) data.result = 'gewonnen';
    }

    // Jeder Statuswechsel wird als Aktivität protokolliert. Die Detailseite
    // protokolliert die Aktivität bereits im Modal und setzt `activityLogged: true`.
    const statusChanged = data.status !== undefined && data.status !== null && data.status !== previousStatus;
    const include = { account: { select: { id: true, companyName: true } } };
    let target;
    if (statusChanged) {
      const providedSummary = typeof req.body.activitySummary === 'string' ? req.body.activitySummary.trim() : '';
      const ops = [
        prisma.acquisitionTarget.update({ where: { id: req.params.id }, data, include }),
      ];
      if (req.body.activityLogged !== true) {
        ops.push(
          prisma.activity.create({
            data: {
              type: targetPipeline.byStatus.get(data.status)?.activityType || 'Note',
              date: new Date(),
              summary: providedSummary || `Statuswechsel: ${previousStatus || '—'} → ${data.status}`,
              phaseChange: `${previousStatus || '—'} → ${data.status}`,
              acquisitionTargetId: req.params.id,
              createdById: req.user?.id || null,
            },
            include: { createdBy: { select: { name: true } } },
          }),
        );
      }
      [target] = await prisma.$transaction(ops);
    } else {
      target = await prisma.acquisitionTarget.update({
        where: { id: req.params.id },
        data,
        include,
      });
    }

    // Abschluss: Zielkunde wird zum CRM-Account (verknüpfen oder neu anlegen)
    let account = target.account;
    if (targetPipeline.wonStatuses.includes(target.status)) {
      const linkedId = await linkAccountOnWin(prisma, target, { pipeline: targetPipeline });
      if (linkedId) {
        account = await prisma.account.findUnique({
          where: { id: linkedId },
          select: { id: true, companyName: true },
        });
      }
    }

    let blocklisted = false;
    let unblocked = false;
    const normalizedName = normalizeCompany(target.companyName);

    if (data.status !== undefined && isBlockStatus(data.status, targetPipeline)) {
      const alreadyBlocked = await prisma.acquisitionBlocklist.findFirst({
        where: { normalizedName },
        select: { id: true },
      });
      if (!alreadyBlocked) {
        await prisma.acquisitionBlocklist.create({
          data: {
            companyName: target.companyName,
            normalizedName,
            reason: target.lossReason || primaryBlockStatus(targetPipeline),
            contactName: target.contactName || null,
            notes: 'Automatisch gesperrt bei Statuswechsel in einen Sperr-Status',
          },
        });
        blocklisted = true;
      }
    } else if (previousStatus && isBlockStatus(previousStatus, targetPipeline)) {
      const { count } = await prisma.acquisitionBlocklist.deleteMany({
        where: { normalizedName },
      });
      unblocked = count > 0;
    }

    res.json({ ...target, accountId: account?.id || target.accountId, account, blocklisted, unblocked });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Ungültige Benutzerzuordnung' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.acquisitionTarget.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Zielkunde nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition/:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { acquisitionTargetId: req.params.id },
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, date, duration, summary, nextSteps, channel, outreachTemplateId } = req.body;
    const activityType = type || 'Note';
    const isCall = String(activityType).toLowerCase() === 'call';

    const target = await prisma.acquisitionTarget.findUnique({
      where: { id: req.params.id },
      select: { id: true, callAttempts: true, companyName: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

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
          acquisitionTargetId: req.params.id,
          createdById: req.user?.id || null,
        },
        include: { createdBy: { select: { name: true } } },
      }),
      ...(isCall
        ? [prisma.acquisitionTarget.update({
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

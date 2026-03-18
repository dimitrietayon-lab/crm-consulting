/**
 * Workflow Executor Service
 * Shared between routes/workflows.js and scheduler.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Per-record deduplication ─────────────────────────────────────────────────
// Collect all record IDs that this workflow has already processed in previous runs.
// Stored in WorkflowRun.details.firedRecordIds (no schema migration needed).
async function getFiredRecordIds(workflowId) {
  if (!workflowId) return new Set();
  const runs = await prisma.workflowRun.findMany({
    where: { workflowId, status: { in: ['success'] } },
    select: { details: true },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });
  const fired = new Set();
  for (const run of runs) {
    const ids = run.details?.firedRecordIds;
    if (Array.isArray(ids)) ids.forEach((id) => fired.add(id));
  }
  return fired;
}

// ─── Single-Action Executor ────────────────────────────────────────────────────
// firedIds: Set of record IDs already processed by previous runs of this workflow.
// Actions that check individual records filter them out and return newFiredIds.
async function executeAction(actionType, config = {}, userId, firedIds = new Set()) {
  switch (actionType) {

    case 'mark_invoices_overdue': {
      const result = await prisma.invoice.updateMany({
        where: { status: { in: ['sent', 'partially_paid'] }, dueDate: { lt: new Date() } },
        data: { status: 'overdue' },
      });
      return { summary: `${result.count} Rechnung(en) als überfällig markiert`, count: result.count };
    }

    case 'check_expiring_ndas': {
      const days = parseInt(config.days) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      const allNdas = await prisma.nDA.findMany({
        where: { expiryDate: { gt: new Date(), lt: cutoff } },
        include: { account: { select: { companyName: true } } },
      });
      const ndas = allNdas.filter((n) => !firedIds.has(n.id));
      return {
        summary: `${ndas.length} NDA(s) laufen in ${days} Tagen ab`,
        count: ndas.length,
        items: ndas.map((n) => ({ account: n.account?.companyName, expiryDate: n.expiryDate })),
        newFiredIds: ndas.map((n) => n.id),
      };
    }

    case 'check_pending_timesheets': {
      const now = new Date();
      const dow = now.getDay() || 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dow + 1);
      weekStart.setHours(0, 0, 0, 0);
      const [allUsers, submitted] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        prisma.timesheet.findMany({
          where: { weekStart: { gte: weekStart }, status: { in: ['submitted', 'approved'] } },
          select: { userId: true },
        }),
      ]);
      const submittedIds = new Set(submitted.map((t) => t.userId));
      const missing = allUsers.filter((u) => !submittedIds.has(u.id));
      return {
        summary: `${missing.length} Mitarbeiter ohne eingereichte Zeiterfassung diese Woche`,
        count: missing.length,
        items: missing.map((u) => ({ name: u.name, email: u.email })),
      };
    }

    case 'check_pending_leave': {
      const days = parseInt(config.days) || 3;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const allRequests = await prisma.leaveRequest.findMany({
        where: { status: 'pending', createdAt: { lt: cutoff } },
        include: { user: { select: { name: true } } },
      });
      const requests = allRequests.filter((r) => !firedIds.has(r.id));
      return {
        summary: `${requests.length} Urlaubsanfrage(n) seit mehr als ${days} Tagen offen`,
        count: requests.length,
        items: requests.map((r) => ({ user: r.user.name, type: r.type, since: r.createdAt })),
        newFiredIds: requests.map((r) => r.id),
      };
    }

    case 'check_old_draft_invoices': {
      const days = parseInt(config.days) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const allInvoices = await prisma.invoice.findMany({
        where: { status: 'draft', createdAt: { lt: cutoff } },
        include: { account: { select: { companyName: true } } },
      });
      const invoices = allInvoices.filter((i) => !firedIds.has(i.id));
      return {
        summary: `${invoices.length} Rechnungsentwurf/Entwürfe älter als ${days} Tage`,
        count: invoices.length,
        items: invoices.map((i) => ({ number: i.invoiceNumber, account: i.account?.companyName, total: i.total })),
        newFiredIds: invoices.map((i) => i.id),
      };
    }

    case 'check_overdue_milestones': {
      const allMilestones = await prisma.milestone.findMany({
        where: { dueDate: { lt: new Date() }, completed: false },
        include: { phase: { include: { project: { select: { name: true } } } } },
      });
      const milestones = allMilestones.filter((m) => !firedIds.has(m.id));
      return {
        summary: `${milestones.length} überfällige Meilensteine`,
        count: milestones.length,
        items: milestones.map((m) => ({ title: m.title, project: m.phase?.project?.name, dueDate: m.dueDate })),
        newFiredIds: milestones.map((m) => m.id),
      };
    }

    case 'generate_monthly_report': {
      const [userCount, activeProjects, pendingLeave, overdueInvoices, invoiceTotals] = await Promise.all([
        prisma.user.count(),
        prisma.project.count({ where: { status: 'Active' } }),
        prisma.leaveRequest.count({ where: { status: 'pending' } }),
        prisma.invoice.count({ where: { status: 'overdue' } }),
        prisma.invoice.aggregate({ _sum: { total: true, paidAmount: true }, where: { status: { not: 'cancelled' } } }),
      ]);
      return {
        summary: 'Monatsbericht erfolgreich erstellt',
        data: {
          totalUsers: userCount, activeProjects, pendingLeave, overdueInvoices,
          totalInvoiced: invoiceTotals._sum.total || 0, totalPaid: invoiceTotals._sum.paidAmount || 0,
        },
      };
    }

    case 'create_task': {
      const { title, priority = 'Medium', dueDays = 7 } = config;
      if (!title) throw new Error('Aufgaben-Titel fehlt');
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(dueDays) || 7));
      const task = await prisma.task.create({
        data: { title, priority, status: 'Open', dueDate, createdById: userId || null },
      });
      return { summary: `Aufgabe "${title}" erstellt`, count: 1, items: [{ id: task.id, title: task.title }] };
    }

    case 'check_expense_threshold': {
      // Creates one task per new expense report that exceeds the threshold.
      // Each expense report is processed only once (per-record deduplication via firedIds).
      const threshold = parseFloat(config.threshold) || 1000;
      const taskTitle = config.taskTitle || 'Reisekosten-Prüfung erforderlich';
      const priority = config.priority || 'High';
      const allExpenses = await prisma.expenseReport.findMany({
        where: { totalAmount: { gt: threshold } },
        include: { user: { select: { name: true } } },
      });
      const newExpenses = allExpenses.filter((e) => !firedIds.has(e.id));
      const tasks = [];
      for (const expense of newExpenses) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        const task = await prisma.task.create({
          data: {
            title: `${taskTitle}: ${expense.user?.name || 'Unbekannt'} (${expense.totalAmount}€)`,
            priority,
            status: 'Open',
            dueDate,
            createdById: userId || null,
          },
        });
        tasks.push({ expenseId: expense.id, taskId: task.id, amount: expense.totalAmount, user: expense.user?.name });
      }
      return {
        summary: `${tasks.length} Aufgabe(n) für Reisekosten über ${threshold}€ erstellt`,
        count: tasks.length,
        items: tasks,
        newFiredIds: newExpenses.map((e) => e.id),
      };
    }

    case 'check_stuck_deals': {
      const days = parseInt(config.days) || 14;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const allDeals = await prisma.deal.findMany({
        where: { stage: { notIn: ['Closed Won', 'Closed Lost'] }, updatedAt: { lt: cutoff } },
        include: { account: { select: { companyName: true } } },
      });
      const deals = allDeals.filter((d) => !firedIds.has(d.id));
      return {
        summary: `${deals.length} Deal(s) seit ${days}+ Tagen nicht aktualisiert`,
        count: deals.length,
        items: deals.map((d) => ({ name: d.name, account: d.account?.companyName, stage: d.stage, updatedAt: d.updatedAt })),
        newFiredIds: deals.map((d) => d.id),
      };
    }

    case 'check_project_deadline': {
      const days = parseInt(config.days) || 7;
      const soon = new Date();
      soon.setDate(soon.getDate() + days);
      const allProjects = await prisma.project.findMany({
        where: { status: 'Active', endDate: { lt: soon, gt: new Date() } },
        include: { account: { select: { companyName: true } } },
      });
      const projects = allProjects.filter((p) => !firedIds.has(p.id));
      return {
        summary: `${projects.length} Projekt(e) mit Deadline in ${days} Tagen`,
        count: projects.length,
        items: projects.map((p) => ({ name: p.name, account: p.account?.companyName, endDate: p.endDate })),
        newFiredIds: projects.map((p) => p.id),
      };
    }

    case 'check_proposal_expiring': {
      const days = parseInt(config.days) || 14;
      const soon = new Date();
      soon.setDate(soon.getDate() + days);
      const allProposals = await prisma.proposal.findMany({
        where: { status: 'sent', validUntil: { lt: soon, gt: new Date() } },
        include: { account: { select: { companyName: true } } },
      });
      const proposals = allProposals.filter((p) => !firedIds.has(p.id));
      return {
        summary: `${proposals.length} Angebot(e) läuft in ${days} Tagen ab`,
        count: proposals.length,
        items: proposals.map((p) => ({ name: p.title, account: p.account?.companyName, validUntil: p.validUntil })),
        newFiredIds: proposals.map((p) => p.id),
      };
    }

    case 'check_invoice_due_soon': {
      const days = parseInt(config.days) || 7;
      const soon = new Date();
      soon.setDate(soon.getDate() + days);
      const allInvoices = await prisma.invoice.findMany({
        where: { status: { in: ['sent', 'draft'] }, dueDate: { lt: soon, gt: new Date() } },
        include: { account: { select: { companyName: true } } },
      });
      const invoices = allInvoices.filter((i) => !firedIds.has(i.id));
      return {
        summary: `${invoices.length} Rechnung(en) fällig in ${days} Tagen`,
        count: invoices.length,
        items: invoices.map((i) => ({ number: i.invoiceNumber, account: i.account?.companyName, dueDate: i.dueDate, total: i.total })),
        newFiredIds: invoices.map((i) => i.id),
      };
    }

    default:
      throw new Error(`Unbekannte Aktion: ${actionType}`);
  }
}

// ─── Condition Evaluator ───────────────────────────────────────────────────────
async function evaluateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) return { passed: true, reason: null };

  for (const cond of conditions) {
    const { field, operator, value } = cond;
    if (!field || value === undefined || value === '') continue;

    const numVal = parseFloat(value);
    let count = 0;

    try {
      switch (field) {
        case 'invoice.total': {
          const prismaOp = { gt: 'gt', lt: 'lt', gte: 'gte', lte: 'lte', eq: 'equals' }[operator] || 'gt';
          count = await prisma.invoice.count({ where: { total: { [prismaOp]: numVal } } });
          if (count === 0) return { passed: false, reason: `Keine Rechnungen mit ${field} ${operator} ${value}` };
          break;
        }
        case 'invoice.days_overdue': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - numVal);
          count = await prisma.invoice.count({
            where: { status: { in: ['sent', 'partially_paid'] }, dueDate: { lt: cutoff } },
          });
          if (count === 0) return { passed: false, reason: `Keine überfälligen Rechnungen > ${numVal} Tage` };
          break;
        }
        case 'leave.days_pending': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - numVal);
          count = await prisma.leaveRequest.count({ where: { status: 'pending', createdAt: { lt: cutoff } } });
          if (count === 0) return { passed: false, reason: `Keine offenen Urlaubsanfragen > ${numVal} Tage` };
          break;
        }
        case 'expense.totalAmount': {
          const prismaOp = { gt: 'gt', lt: 'lt', gte: 'gte', lte: 'lte', eq: 'equals' }[operator] || 'gt';
          count = await prisma.expenseReport.count({ where: { totalAmount: { [prismaOp]: numVal } } });
          if (count === 0) return { passed: false, reason: `Keine Reisekosten mit Betrag ${operator} ${numVal}` };
          break;
        }
        case 'days_since_activity': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - numVal);
          count = await prisma.account.count({
            where: { activities: { none: { createdAt: { gte: cutoff } } } },
          });
          if (count === 0) return { passed: false, reason: `Keine Accounts ohne Aktivität > ${numVal} Tage` };
          break;
        }
        case 'deal.amount': {
          const prismaOp = { gt: 'gt', lt: 'lt', gte: 'gte', lte: 'lte', eq: 'equals' }[operator] || 'gt';
          count = await prisma.deal.count({ where: { amount: { [prismaOp]: numVal } } });
          if (count === 0) return { passed: false, reason: `Keine Deals mit Betrag ${operator} ${numVal}` };
          break;
        }
        case 'deal.stage': {
          count = await prisma.deal.count({ where: { stage: value } });
          if (count === 0) return { passed: false, reason: `Keine Deals in Phase "${value}"` };
          break;
        }
        case 'proposal.status': {
          count = await prisma.proposal.count({ where: { status: value } });
          if (count === 0) return { passed: false, reason: `Keine Angebote mit Status "${value}"` };
          break;
        }
        case 'project.status': {
          count = await prisma.project.count({ where: { status: value } });
          if (count === 0) return { passed: false, reason: `Keine Projekte mit Status "${value}"` };
          break;
        }
        case 'milestone.days_overdue': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - numVal);
          count = await prisma.milestone.count({ where: { completed: false, dueDate: { lt: cutoff } } });
          if (count === 0) return { passed: false, reason: `Keine Meilensteine überfällig > ${numVal} Tage` };
          break;
        }
        case 'nda.days_until_expiry': {
          const soon = new Date();
          soon.setDate(soon.getDate() + numVal);
          count = await prisma.nDA.count({ where: { expiryDate: { gt: new Date(), lt: soon } } });
          if (count === 0) return { passed: false, reason: `Keine NDAs ablaufend in ${numVal} Tagen` };
          break;
        }
        case 'leave.type': {
          count = await prisma.leaveRequest.count({ where: { status: 'pending', type: value } });
          if (count === 0) return { passed: false, reason: `Keine offenen Urlaubsanfragen vom Typ "${value}"` };
          break;
        }
        case 'account.industry': {
          count = await prisma.account.count({ where: { institutionType: { contains: value } } });
          if (count === 0) return { passed: false, reason: `Keine Accounts in Branche "${value}"` };
          break;
        }
        default:
          // Unknown field — don't block execution
          break;
      }
    } catch {
      // On error, don't block execution
    }
  }

  return { passed: true, reason: null };
}

// ─── Workflow Executor ─────────────────────────────────────────────────────────
async function executeWorkflow(workflow, userId) {
  // Evaluate conditions first
  const { passed, reason } = await evaluateConditions(workflow.conditions);
  if (!passed) {
    return {
      summary: `Bedingungen nicht erfüllt: ${reason}`,
      count: 0,
      skipped: true,
      results: [],
    };
  }

  // Load previously fired record IDs to prevent duplicate processing
  const firedIds = await getFiredRecordIds(workflow.id);

  const actionsArray = Array.isArray(workflow.actions) && workflow.actions.length > 0
    ? workflow.actions
    : workflow.actionType
      ? [{ type: workflow.actionType, config: workflow.actionConfig || {} }]
      : [];

  if (actionsArray.length === 0) throw new Error('Keine Aktionen konfiguriert');

  const results = [];
  const allNewFiredIds = [];
  for (const action of actionsArray) {
    const result = await executeAction(action.type, action.config || {}, userId, firedIds);
    results.push({ type: action.type, ...result });
    // Collect new IDs and add to firedIds to prevent double-firing within same run
    if (Array.isArray(result.newFiredIds)) {
      result.newFiredIds.forEach((id) => {
        allNewFiredIds.push(id);
        firedIds.add(id);
      });
    }
  }

  const totalCount = results.reduce((s, r) => s + (r.count || 0), 0);
  const summary = results.length === 1
    ? results[0].summary
    : `${results.length} Aktionen: ${results.map((r) => r.summary).join(' | ')}`;

  // firedRecordIds is stored in WorkflowRun.details for future deduplication
  return { summary, count: totalCount, results, firedRecordIds: allNewFiredIds };
}

module.exports = { executeAction, executeWorkflow, evaluateConditions };

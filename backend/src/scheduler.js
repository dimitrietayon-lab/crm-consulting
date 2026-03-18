/**
 * Workflow Scheduler
 * Automatically runs workflows based on their trigger type using node-cron.
 */
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { executeWorkflow } = require('./services/workflowExecutor');
const { createNotification } = require('./services/notifications');

const prisma = new PrismaClient();

async function runScheduledWorkflows(triggerType) {
  let workflows = [];
  try {
    workflows = await prisma.workflow.findMany({
      where: { isActive: true, trigger: triggerType },
    });
  } catch (err) {
    console.error(`[Scheduler] Failed to load workflows for trigger "${triggerType}":`, err.message);
    return;
  }

  if (workflows.length === 0) return;
  console.log(`[Scheduler] Trigger "${triggerType}": running ${workflows.length} workflow(s)`);

  for (const wf of workflows) {
    let runId;
    try {
      const run = await prisma.workflowRun.create({
        data: { workflowId: wf.id, triggeredBy: 'scheduler', status: 'running' },
      });
      runId = run.id;

      const result = await executeWorkflow(wf, null);

      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: result.skipped ? 'skipped' : 'success',
          summary: result.summary,
          details: result,
          finishedAt: new Date(),
        },
      });
      await prisma.workflow.update({ where: { id: wf.id }, data: { lastRunAt: new Date() } });
      console.log(`[Scheduler] "${wf.name}": ${result.summary}`);

      if (!result.skipped && result.count > 0) {
        await createNotification(wf.createdById, 'workflow_success', `Workflow: ${wf.name}`, result.summary, '/workflows');
      }
    } catch (err) {
      console.error(`[Scheduler] "${wf.name}" failed:`, err.message);
      if (runId) {
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { status: 'failed', summary: err.message, finishedAt: new Date() },
        }).catch(() => {});
      }
      await createNotification(wf.createdById, 'workflow_failed', `Workflow fehlgeschlagen: ${wf.name}`, err.message, '/workflows');
    }
  }
}

function startScheduler() {
  // Stündlich — every hour at :00
  cron.schedule('0 * * * *', () => runScheduledWorkflows('schedule_hourly'));

  // Täglich — every day at 06:00
  cron.schedule('0 6 * * *', () => runScheduledWorkflows('schedule_daily'));

  // Wöchentlich — every Monday at 08:00
  cron.schedule('0 8 * * 1', () => runScheduledWorkflows('schedule_weekly'));

  // Monatlich — 1st of each month at 09:00
  cron.schedule('0 9 1 * *', () => runScheduledWorkflows('schedule_monthly'));

  // Event-based triggers — daily checks at staggered times
  cron.schedule('30 6 * * *', () => runScheduledWorkflows('account_no_activity'));
  cron.schedule('15 6 * * *', () => runScheduledWorkflows('nda_expiring'));
  cron.schedule('45 6 * * *', () => runScheduledWorkflows('project_deadline'));
  cron.schedule('0 7 * * *',  () => runScheduledWorkflows('deal_stuck'));
  cron.schedule('30 7 * * *', () => runScheduledWorkflows('proposal_expiring'));
  cron.schedule('0 8 * * *',  () => runScheduledWorkflows('invoice_due_soon'));
  cron.schedule('0 7 * * 1',  () => runScheduledWorkflows('timesheet_missing'));   // Mon 07:00
  cron.schedule('0 9 * * 1',  () => runScheduledWorkflows('leave_pending_long'));  // Mon 09:00

  console.log('[Scheduler] Workflow scheduler started (hourly / daily 06:00 / weekly Mon 08:00 / monthly 1st 09:00 + event triggers)');
}

module.exports = { startScheduler };

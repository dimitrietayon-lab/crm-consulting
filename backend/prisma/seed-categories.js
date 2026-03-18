/**
 * seed-categories.js
 * Seeds all SystemCategory groups with their default values.
 * Safe to run multiple times (upsert).
 *
 * Run: node prisma/seed-categories.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const INITIAL_CATEGORIES = {
  institutionTypes: [
    'Private Bank', 'Savings Bank', 'Cooperative Bank', 'Investment Bank', 'Digital Bank',
    'Insurance (Life)', 'Insurance (Non-Life)', 'Reinsurance', 'Health Insurance',
    'Fintech', 'Asset Manager', 'Other',
  ],
  regulatoryFrameworks: [
    'BaFin', 'Solvency II', 'Basel IV', 'DORA', 'IFRS 17', 'MiFID II', 'AML/KYC', 'GDPR', 'ECB',
  ],
  projectTypes: ['Strategy', 'Regulation', 'IT', 'Risk', 'Audit', 'Other'],
  projectStatuses: ['Offer', 'Active', 'On Hold', 'Completed', 'Lost'],
  dealServiceTypes: [
    'Strategy Consulting', 'Risk Management', 'IT Consulting', 'Regulatory Compliance',
    'Audit Support', 'Change Management', 'Process Optimization', 'Data Analytics', 'Other',
  ],
  crossSellingTypes: [
    'Strategy', 'Regulation', 'IT', 'Risk', 'Audit',
    'Finance', 'Operations', 'HR', 'Legal', 'Digital',
  ],
  dealStages: ['First Contact', 'Needs Analysis', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'],
  dealSources: ['Referral', 'Event', 'Inbound', 'Outbound', 'Other'],
  lossReasons: [
    'Preis zu hoch', 'Kompetitor gewonnen', 'Kein Budget',
    'Kein Bedarf', 'Timing', 'Kein Feedback', 'Anderer Grund',
  ],
  activityTypes: [
    'Meeting', 'Phone Call', 'Email', 'Presentation',
    'Workshop', 'Conference', 'Demo', 'Note', 'Other',
  ],
  taskPriorities: ['Critical', 'High', 'Medium', 'Low'],
  taskStatuses: ['Open', 'In Progress', 'Done', 'Cancelled'],
  proposalStatuses: ['Draft', 'Sent', 'Under Review', 'Accepted', 'Rejected'],
  leaveTypes: ['Urlaub', 'Krank', 'Weiterbildung', 'Feiertag', 'Sonstiges'],
  serviceCategories: ['Strategy', 'Regulation', 'IT', 'Risk', 'Other'],
}

async function main() {
  console.log('Seeding SystemCategory records...')
  let total = 0

  for (const [group, values] of Object.entries(INITIAL_CATEGORIES)) {
    for (let i = 0; i < values.length; i++) {
      await prisma.systemCategory.upsert({
        where: { group_value: { group, value: values[i] } },
        update: { order: i },
        create: { group, value: values[i], order: i },
      })
      total++
    }
    console.log(`  ✓ ${group} (${values.length})`)
  }

  console.log(`\nDone — ${total} categories seeded.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

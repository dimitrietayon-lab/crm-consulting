const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- USERS ---
  const adminPassword = await bcrypt.hash('admin123', 10);
  const consultantPassword = await bcrypt.hash('consultant123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.de' },
    update: {},
    create: {
      email: 'admin@crm.de',
      name: 'Admin User',
      password: adminPassword,
      role: 'admin',
    },
  });

  const consultant = await prisma.user.upsert({
    where: { email: 'anna.mueller@crm.de' },
    update: {},
    create: {
      email: 'anna.mueller@crm.de',
      name: 'Anna Mueller',
      password: consultantPassword,
      role: 'consultant',
    },
  });

  console.log('Users created:', admin.email, consultant.email);

  // --- ACCOUNTS ---
  const account1 = await prisma.account.create({
    data: {
      companyName: 'Deutsche Privatbank AG',
      institutionType: 'Private Bank',
      country: 'Germany',
      regulatoryFrameworks: ['BaFin', 'MiFID II'],
      numberOfEmployees: 850,
      aum: 12500000000,
      annualRevenue: 320000000,
      assignedConsultantId: consultant.id,
      tags: ['Key Account', 'Wealth Management'],
      bankingLicense: 'Full Banking License',
      regulatoryStatus: 'Compliant',
      coreBankingSystem: 'Temenos T24',
      baselIVStatus: 'In Progress',
      isKeyAccount: true,
      website: 'https://www.deutsche-privatbank.de',
      notes: 'Long-standing client since 2018. Focus on digital transformation and Basel IV compliance.',
    },
  });

  const account2 = await prisma.account.create({
    data: {
      companyName: 'Allianz Versicherung AG',
      institutionType: 'Insurance',
      country: 'Germany',
      regulatoryFrameworks: ['Solvency II', 'IFRS 17', 'BaFin'],
      numberOfEmployees: 15000,
      annualRevenue: 2800000000,
      assignedConsultantId: admin.id,
      tags: ['Top Tier', 'Life Insurance', 'P&C'],
      insuranceType: 'Composite',
      solvencyIIStatus: 'Fully Compliant',
      policySystem: 'SAP Insurance',
      isKeyAccount: true,
      website: 'https://www.allianz.de',
      notes: 'Major insurance client. Ongoing IFRS 17 implementation project.',
    },
  });

  const account3 = await prisma.account.create({
    data: {
      companyName: 'Commerzbank Filiale',
      institutionType: 'Savings Bank',
      country: 'Germany',
      regulatoryFrameworks: ['BaFin', 'Basel IV', 'ECB'],
      numberOfEmployees: 40000,
      annualRevenue: 5600000000,
      assignedConsultantId: consultant.id,
      tags: ['Retail Banking', 'Corporate Banking'],
      bankingLicense: 'Full Banking License',
      regulatoryStatus: 'Under Review',
      coreBankingSystem: 'Finacle',
      baselIVStatus: 'Planning Phase',
      isKeyAccount: false,
      website: 'https://www.commerzbank.de',
      notes: 'Mid-tier engagement focused on Basel IV readiness assessment.',
    },
  });

  const account4 = await prisma.account.create({
    data: {
      companyName: 'SwissLife Gruppe',
      institutionType: 'Insurance',
      country: 'Switzerland',
      regulatoryFrameworks: ['FINMA', 'Solvency II', 'IFRS 17'],
      numberOfEmployees: 9200,
      annualRevenue: 1900000000,
      assignedConsultantId: admin.id,
      tags: ['Life Insurance', 'Pension'],
      insuranceType: 'Life',
      solvencyIIStatus: 'In Progress',
      policySystem: 'Guidewire PolicyCenter',
      isKeyAccount: true,
      website: 'https://www.swisslife.ch',
      notes: 'Swiss client requiring cross-border regulatory expertise.',
    },
  });

  const account5 = await prisma.account.create({
    data: {
      companyName: 'N26 Bank GmbH',
      institutionType: 'Fintech',
      country: 'Germany',
      regulatoryFrameworks: ['DORA', 'PSD2', 'BaFin'],
      numberOfEmployees: 1500,
      aum: 0,
      annualRevenue: 180000000,
      assignedConsultantId: consultant.id,
      tags: ['Digital Bank', 'Neobank', 'DORA'],
      bankingLicense: 'E-Money License',
      regulatoryStatus: 'Active Monitoring',
      coreBankingSystem: 'Custom Microservices',
      baselIVStatus: 'N/A',
      isKeyAccount: false,
      website: 'https://www.n26.com',
      notes: 'Fast-growing neobank. DORA compliance is the primary engagement focus.',
    },
  });

  const account6 = await prisma.account.create({
    data: {
      companyName: 'DZ Bank AG',
      institutionType: 'Cooperative Bank',
      country: 'Germany',
      regulatoryFrameworks: ['BaFin', 'Basel IV', 'ECB'],
      numberOfEmployees: 5200,
      aum: 95000000000,
      annualRevenue: 1200000000,
      assignedConsultantId: admin.id,
      tags: ['Cooperative Banking', 'Central Bank'],
      bankingLicense: 'Full Banking License',
      regulatoryStatus: 'Compliant',
      coreBankingSystem: 'SAP Banking',
      baselIVStatus: 'Advanced Implementation',
      isKeyAccount: true,
      website: 'https://www.dzbank.de',
      notes: 'Central institution for German cooperative banking sector.',
    },
  });

  const account7 = await prisma.account.create({
    data: {
      companyName: 'Munich Re AG',
      institutionType: 'Insurance',
      country: 'Germany',
      regulatoryFrameworks: ['Solvency II', 'IFRS 17', 'BaFin'],
      numberOfEmployees: 43000,
      annualRevenue: 67000000000,
      assignedConsultantId: consultant.id,
      tags: ['Reinsurance', 'Global', 'Top Tier'],
      insuranceType: 'Reinsurance',
      solvencyIIStatus: 'Fully Compliant',
      policySystem: 'Sapiens',
      isKeyAccount: true,
      website: 'https://www.munichre.com',
      notes: 'Global reinsurer. Complex multi-jurisdiction regulatory requirements.',
    },
  });

  const account8 = await prisma.account.create({
    data: {
      companyName: 'Flatexdegiro Bank AG',
      institutionType: 'Digital Bank',
      country: 'Germany',
      regulatoryFrameworks: ['MiFID II', 'BaFin', 'DORA'],
      numberOfEmployees: 600,
      annualRevenue: 390000000,
      assignedConsultantId: admin.id,
      tags: ['Broker', 'Digital', 'Retail Investor'],
      bankingLicense: 'Full Banking License',
      regulatoryStatus: 'Compliant',
      coreBankingSystem: 'Proprietary',
      baselIVStatus: 'N/A',
      isKeyAccount: false,
      website: 'https://www.flatexdegiro.com',
      notes: 'Online brokerage bank. MiFID II compliance and digital resilience focus.',
    },
  });

  console.log('Accounts created:', 8);

  // --- CONTACTS ---
  const contact1 = await prisma.contact.create({
    data: {
      name: 'Dr. Klaus Hoffmann',
      title: 'Chief Executive Officer',
      hierarchyLevel: 'C-Level',
      department: 'Executive',
      email: 'k.hoffmann@deutsche-privatbank.de',
      phone: '+49 69 1234 5678',
      linkedIn: 'https://linkedin.com/in/klaushoffmann',
      notes: 'Key decision maker. Golf enthusiast. Prefers meetings on Tuesday mornings.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact1.id, accountId: account1.id, isPrimary: true },
  });

  const contact2 = await prisma.contact.create({
    data: {
      name: 'Sabine Weber',
      title: 'Chief Risk Officer',
      hierarchyLevel: 'C-Level',
      department: 'Risk Management',
      email: 's.weber@deutsche-privatbank.de',
      phone: '+49 69 1234 5690',
      notes: 'Technical lead for Basel IV initiative. Very detail-oriented.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact2.id, accountId: account1.id, isPrimary: false },
  });

  const contact3 = await prisma.contact.create({
    data: {
      name: 'Thomas Braun',
      title: 'Head of Digital Transformation',
      hierarchyLevel: 'Director',
      department: 'IT',
      email: 't.braun@allianz.de',
      phone: '+49 89 3800 0001',
      linkedIn: 'https://linkedin.com/in/thomasbraun',
      notes: 'Champion for IFRS 17 project. Has strong technical background.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact3.id, accountId: account2.id, isPrimary: true },
  });

  const contact4 = await prisma.contact.create({
    data: {
      name: 'Maria Schmidt',
      title: 'Chief Financial Officer',
      hierarchyLevel: 'C-Level',
      department: 'Finance',
      email: 'm.schmidt@allianz.de',
      phone: '+49 89 3800 0002',
      notes: 'Budget approver for all consulting engagements at Allianz.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact4.id, accountId: account2.id, isPrimary: false },
  });

  const contact5 = await prisma.contact.create({
    data: {
      name: 'Felix Meier',
      title: 'Head of Compliance',
      hierarchyLevel: 'Senior Manager',
      department: 'Compliance',
      email: 'f.meier@n26.com',
      phone: '+49 30 9876 5432',
      notes: 'Primary contact for DORA compliance project at N26.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact5.id, accountId: account5.id, isPrimary: true },
  });

  const contact6 = await prisma.contact.create({
    data: {
      name: 'Petra Lange',
      title: 'Chief Technology Officer',
      hierarchyLevel: 'C-Level',
      department: 'Technology',
      email: 'p.lange@n26.com',
      phone: '+49 30 9876 5400',
      notes: 'Technical sponsor for DORA initiative. Background in cloud architecture.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact6.id, accountId: account5.id, isPrimary: false },
  });

  const contact7 = await prisma.contact.create({
    data: {
      name: 'Hans-Peter Richter',
      title: 'Chief Risk Officer',
      hierarchyLevel: 'C-Level',
      department: 'Risk',
      email: 'hp.richter@dzbank.de',
      phone: '+49 69 7447 0001',
      notes: 'Driving Basel IV implementation. 20 years experience in banking regulation.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact7.id, accountId: account6.id, isPrimary: true },
  });

  const contact8 = await prisma.contact.create({
    data: {
      name: 'Dr. Ingrid Bauer',
      title: 'Head of Actuarial',
      hierarchyLevel: 'Director',
      department: 'Actuarial',
      email: 'i.bauer@munichre.com',
      phone: '+49 89 3891 0001',
      notes: 'Lead for IFRS 17 actuarial workstream at Munich Re.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact8.id, accountId: account7.id, isPrimary: true },
  });

  const contact9 = await prisma.contact.create({
    data: {
      name: 'Stefan Koch',
      title: 'Head of Basel IV Programme',
      hierarchyLevel: 'Senior Manager',
      department: 'Finance',
      email: 's.koch@commerzbank.de',
      phone: '+49 69 136 0001',
      notes: 'Programme manager for Basel IV at Commerzbank. Very organised.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact9.id, accountId: account3.id, isPrimary: true },
  });

  const contact10 = await prisma.contact.create({
    data: {
      name: 'Caroline Vogel',
      title: 'Head of Regulation & Strategy',
      hierarchyLevel: 'Director',
      department: 'Strategy',
      email: 'c.vogel@swisslife.ch',
      phone: '+41 43 284 0001',
      notes: 'Primary engagement contact at SwissLife. Fluent in German and French.',
    },
  });

  await prisma.contactAccount.create({
    data: { contactId: contact10.id, accountId: account4.id, isPrimary: true },
  });

  console.log('Contacts created:', 10);

  // --- SERVICE CATALOG ---
  const service1 = await prisma.serviceCatalog.create({
    data: {
      name: 'Strategy Workshop',
      category: 'Strategy',
      description: 'Facilitated strategy and roadmap workshops for financial institutions.',
      dayRate: 3500,
      unit: 'day',
    },
  });

  const service2 = await prisma.serviceCatalog.create({
    data: {
      name: 'DORA Compliance Assessment',
      category: 'Regulatory Compliance',
      description: 'End-to-end Digital Operational Resilience Act gap assessment and remediation planning.',
      dayRate: 4000,
      unit: 'day',
    },
  });

  const service3 = await prisma.serviceCatalog.create({
    data: {
      name: 'Basel IV Assessment',
      category: 'Regulatory Compliance',
      description: 'Comprehensive Basel IV impact assessment and implementation support for banks.',
      dayRate: 3800,
      unit: 'day',
    },
  });

  const service4 = await prisma.serviceCatalog.create({
    data: {
      name: 'IT Architecture Review',
      category: 'Technology',
      description: 'In-depth review of core banking or insurance system architecture and modernisation roadmap.',
      dayRate: 3200,
      unit: 'day',
    },
  });

  const service5 = await prisma.serviceCatalog.create({
    data: {
      name: 'Risk Management Framework',
      category: 'Risk',
      description: 'Design and implementation of enterprise risk management frameworks for financial institutions.',
      dayRate: 3600,
      unit: 'day',
    },
  });

  console.log('Service catalog created:', 5);

  // --- PROJECTS ---
  const project1 = await prisma.project.create({
    data: {
      name: 'Basel IV Readiness Assessment',
      accountId: account1.id,
      projectType: 'Regulatory Compliance',
      status: 'Active',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-03-31'),
      budgetPlanned: 380000,
      budgetActual: 190000,
      billingModel: 'Time & Material',
      leadConsultantId: consultant.id,
      description: 'Full scope Basel IV readiness assessment covering credit risk, market risk, and operational risk. Deliverables include gap analysis, remediation roadmap, and board presentation.',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'IFRS 17 Implementation Support',
      accountId: account2.id,
      projectType: 'Accounting & Finance',
      status: 'Active',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2025-06-30'),
      budgetPlanned: 650000,
      budgetActual: 420000,
      billingModel: 'Fixed Fee',
      leadConsultantId: admin.id,
      description: 'End-to-end support for IFRS 17 implementation at Allianz. Includes system configuration, process design, and parallel run management.',
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'DORA Gap Analysis',
      accountId: account5.id,
      projectType: 'Regulatory Compliance',
      status: 'Active',
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-05-31'),
      budgetPlanned: 180000,
      budgetActual: 60000,
      billingModel: 'Time & Material',
      leadConsultantId: consultant.id,
      description: 'DORA compliance gap analysis and ICT risk framework remediation for N26. Includes third-party risk assessment.',
    },
  });

  const project4 = await prisma.project.create({
    data: {
      name: 'Digital Strategy Roadmap',
      accountId: account6.id,
      projectType: 'Strategy',
      status: 'Offer',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-09-30'),
      budgetPlanned: 290000,
      budgetActual: 0,
      billingModel: 'Fixed Fee',
      leadConsultantId: admin.id,
      description: 'Development of a 5-year digital transformation strategy for DZ Bank including core banking modernisation and open banking capabilities.',
    },
  });

  const project5 = await prisma.project.create({
    data: {
      name: 'Risk Management Framework Design',
      accountId: account7.id,
      projectType: 'Risk Management',
      status: 'Completed',
      startDate: new Date('2023-06-01'),
      endDate: new Date('2024-01-31'),
      budgetPlanned: 420000,
      budgetActual: 415000,
      billingModel: 'Fixed Fee',
      leadConsultantId: consultant.id,
      description: 'Designed and implemented an enterprise-wide risk management framework for Munich Re covering underwriting, market, credit, and operational risk.',
    },
  });

  console.log('Projects created:', 5);

  // --- DEALS ---
  const deal1 = await prisma.deal.create({
    data: {
      title: 'Basel IV Phase 2 – Model Validation',
      accountId: account1.id,
      stage: 'Proposal Sent',
      value: 420000,
      probability: 70,
      expectedClose: new Date('2026-03-31'),
      assignedToId: consultant.id,
      source: 'Existing Client',
      serviceType: 'Regulatory Compliance',
      notes: 'Follow-on engagement from current Basel IV assessment. Client very satisfied with Phase 1.',
    },
  });

  const deal2 = await prisma.deal.create({
    data: {
      title: 'Solvency II Internal Model Review',
      accountId: account2.id,
      stage: 'Negotiation',
      value: 580000,
      probability: 85,
      expectedClose: new Date('2026-03-15'),
      assignedToId: admin.id,
      source: 'Existing Client',
      serviceType: 'Regulatory Compliance',
      notes: 'Client requires internal model review ahead of BaFin inspection in Q3 2025.',
    },
  });

  const deal3 = await prisma.deal.create({
    data: {
      title: 'Core Banking Modernisation Advisory',
      accountId: account3.id,
      stage: 'First Contact',
      value: 1200000,
      probability: 20,
      expectedClose: new Date('2026-06-01'),
      assignedToId: consultant.id,
      source: 'Conference',
      serviceType: 'Technology',
      notes: 'Initial meeting at Handelsblatt Banking Summit. Very early stage.',
    },
  });

  const deal4 = await prisma.deal.create({
    data: {
      title: 'FINMA Regulatory Reporting Optimisation',
      accountId: account4.id,
      stage: 'Qualification',
      value: 310000,
      probability: 40,
      expectedClose: new Date('2026-05-30'),
      assignedToId: admin.id,
      source: 'Referral',
      serviceType: 'Regulatory Compliance',
      notes: 'Referred by Swiss banking association contact. Client needs FINMA reporting automation.',
    },
  });

  const deal5 = await prisma.deal.create({
    data: {
      title: 'ICT Third-Party Risk Framework',
      accountId: account5.id,
      stage: 'Offer Preparation',
      value: 220000,
      probability: 60,
      expectedClose: new Date('2026-04-15'),
      assignedToId: consultant.id,
      source: 'Existing Client',
      serviceType: 'Regulatory Compliance',
      notes: 'Extension of current DORA engagement. Client wants full third-party risk framework.',
    },
  });

  const deal6 = await prisma.deal.create({
    data: {
      title: 'Digital Strategy & Open Banking',
      accountId: account6.id,
      stage: 'Proposal Sent',
      value: 290000,
      probability: 75,
      expectedClose: new Date('2026-03-20'),
      assignedToId: admin.id,
      source: 'Existing Client',
      serviceType: 'Strategy',
      notes: 'Proposal submitted last week. Awaiting board decision.',
    },
  });

  const deal7 = await prisma.deal.create({
    data: {
      title: 'Climate Risk Integration',
      accountId: account7.id,
      stage: 'Won',
      value: 340000,
      probability: 100,
      expectedClose: new Date('2025-11-30'),
      assignedToId: consultant.id,
      source: 'Existing Client',
      serviceType: 'Risk Management',
      notes: 'Won deal. Project kickoff scheduled for February 2025.',
    },
  });

  const deal8 = await prisma.deal.create({
    data: {
      title: 'MiFID II Transaction Reporting Audit',
      accountId: account8.id,
      stage: 'Lost',
      value: 95000,
      probability: 0,
      expectedClose: new Date('2026-01-31'),
      assignedToId: admin.id,
      source: 'Inbound',
      serviceType: 'Regulatory Compliance',
      lossReason: 'Price - competitor offered lower rate',
      notes: 'Lost to Big4 firm on price. Maintain relationship for future opportunities.',
    },
  });

  console.log('Deals created:', 8);

  // --- ACTIVITIES ---
  const activity1 = await prisma.activity.create({
    data: {
      type: 'Meeting',
      date: new Date('2025-01-15T10:00:00Z'),
      duration: 90,
      summary: 'Quarterly business review with Deutsche Privatbank leadership. Discussed Phase 2 scope and timeline. Client confirmed budget for model validation workstream.',
      nextSteps: 'Send formal proposal by end of January. Schedule technical kick-off for February.',
      accountId: account1.id,
      dealId: deal1.id,
      createdById: consultant.id,
    },
  });

  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity1.id, contactId: contact1.id },
      { activityId: activity1.id, contactId: contact2.id },
    ],
  });

  const activity2 = await prisma.activity.create({
    data: {
      type: 'Call',
      date: new Date('2025-01-20T14:00:00Z'),
      duration: 45,
      summary: 'Discovery call with N26 compliance team on DORA third-party requirements. Confirmed scope of potential extension.',
      nextSteps: 'Prepare ICT third-party risk framework proposal. Share DORA technical standards summary.',
      accountId: account5.id,
      dealId: deal5.id,
      projectId: project3.id,
      createdById: consultant.id,
    },
  });

  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity2.id, contactId: contact5.id },
      { activityId: activity2.id, contactId: contact6.id },
    ],
  });

  const activity3 = await prisma.activity.create({
    data: {
      type: 'Workshop',
      date: new Date('2025-01-22T09:00:00Z'),
      duration: 480,
      summary: 'Full-day IFRS 17 transition mapping workshop with Allianz finance and actuarial teams. Completed CSM roll-forward model design.',
      nextSteps: 'Document workshop outcomes. Circulate CSM model design for review by Feb 1st.',
      accountId: account2.id,
      projectId: project2.id,
      createdById: admin.id,
    },
  });

  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity3.id, contactId: contact3.id },
      { activityId: activity3.id, contactId: contact4.id },
    ],
  });

  const activity4 = await prisma.activity.create({
    data: {
      type: 'Email',
      date: new Date('2025-01-28T11:00:00Z'),
      duration: null,
      summary: 'Sent digital strategy proposal to DZ Bank. Covered 5-year roadmap, core banking modernisation options, and open banking API strategy.',
      nextSteps: 'Follow up by phone on February 5th if no response.',
      accountId: account6.id,
      dealId: deal6.id,
      createdById: admin.id,
    },
  });

  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity4.id, contactId: contact7.id },
    ],
  });

  const activity5 = await prisma.activity.create({
    data: {
      type: 'Meeting',
      date: new Date('2025-02-03T13:00:00Z'),
      duration: 120,
      summary: 'Project status review for Basel IV assessment. Presented preliminary gap analysis findings. Three high-risk areas identified in SA-CCR calculations.',
      nextSteps: 'Prepare detailed findings report. Schedule remediation workshop for mid-February.',
      accountId: account1.id,
      projectId: project1.id,
      createdById: consultant.id,
    },
  });

  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity5.id, contactId: contact2.id },
    ],
  });

  console.log('Activities created:', 5);

  // --- TASKS ---
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date(today); nextMonth.setDate(nextMonth.getDate() + 30);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  await prisma.task.create({
    data: {
      title: 'Prepare Basel IV Phase 2 proposal',
      description: 'Draft comprehensive proposal for Basel IV Phase 2 model validation workstream. Include scope, timeline, team composition, and fixed-fee pricing.',
      dueDate: nextWeek,
      priority: 'High',
      status: 'In Progress',
      assignedToId: consultant.id,
      createdById: consultant.id,
      accountId: account1.id,
      dealId: deal1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Follow up on DZ Bank proposal',
      description: 'Call Hans-Peter Richter to follow up on digital strategy proposal sent last week. Check if additional information is required.',
      dueDate: tomorrow,
      priority: 'High',
      status: 'Open',
      assignedToId: admin.id,
      createdById: admin.id,
      accountId: account6.id,
      dealId: deal6.id,
      contactId: contact7.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Complete DORA gap analysis report',
      description: 'Finalise the DORA gap analysis report for N26. Ensure all 5 DORA pillars are covered and remediation priorities are clearly documented.',
      dueDate: nextWeek,
      priority: 'High',
      status: 'In Progress',
      assignedToId: consultant.id,
      createdById: consultant.id,
      accountId: account5.id,
      projectId: project3.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Schedule Q1 review with Allianz',
      description: 'Coordinate with Maria Schmidt\'s PA to schedule Q1 project review meeting for IFRS 17 project.',
      dueDate: nextMonth,
      priority: 'Medium',
      status: 'Open',
      assignedToId: admin.id,
      createdById: admin.id,
      accountId: account2.id,
      projectId: project2.id,
      contactId: contact4.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Update NDA register for Q1',
      description: 'Review and update the NDA register. Check expiry dates and flag any NDAs due to renew in the next 90 days.',
      dueDate: nextWeek,
      priority: 'Low',
      status: 'Open',
      assignedToId: admin.id,
      createdById: admin.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Send FINMA reporting overview to SwissLife',
      description: 'Prepare and send a briefing document on FINMA reporting optimisation options to Caroline Vogel.',
      dueDate: nextWeek,
      priority: 'Medium',
      status: 'Open',
      assignedToId: admin.id,
      createdById: admin.id,
      accountId: account4.id,
      dealId: deal4.id,
      contactId: contact10.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Review SA-CCR remediation findings',
      description: 'Internal review of SA-CCR calculation findings from Basel IV project before presenting to client. Peer review by second senior consultant.',
      dueDate: yesterday,
      priority: 'High',
      status: 'Overdue',
      assignedToId: consultant.id,
      createdById: consultant.id,
      accountId: account1.id,
      projectId: project1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Onboard Commerzbank contact',
      description: 'Enter Stefan Koch\'s details into CRM and link to account. Schedule introductory call.',
      dueDate: tomorrow,
      priority: 'Low',
      status: 'Open',
      assignedToId: admin.id,
      createdById: admin.id,
      accountId: account3.id,
      contactId: contact9.id,
    },
  });

  console.log('Tasks created:', 8);
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

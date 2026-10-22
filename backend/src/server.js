require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const requireAuth = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const accountsRoutes = require('./routes/accounts');
const contactsRoutes = require('./routes/contacts');
const projectsRoutes = require('./routes/projects');
const dealsRoutes = require('./routes/deals');
const proposalsRoutes = require('./routes/proposals');
const activitiesRoutes = require('./routes/activities');
const tasksRoutes = require('./routes/tasks');
const documentsRoutes = require('./routes/documents');
const contractsRoutes = require('./routes/contracts');
const oauthRoutes = require('./routes/oauth');
const emailRoutes = require('./routes/email');
const calendarRoutes = require('./routes/calendar');
const segmentsRoutes = require('./routes/segments');
const keyAccountsRoutes = require('./routes/key-accounts');
const crossSellingRoutes = require('./routes/cross-selling');
const complianceRoutes = require('./routes/compliance');
const aiOpportunitiesRoutes = require('./routes/ai-opportunities');
const newsMonitoringRoutes = require('./routes/news-monitoring');
const skillsRoutes = require('./routes/skills');
const timesheetsRoutes = require('./routes/timesheets');
const leaveRoutes = require('./routes/leave');
const expensesRoutes = require('./routes/expenses');
const materialCostsRoutes = require('./routes/material-costs');
const invoicesRoutes = require('./routes/invoices');
const incomingInvoicesRoutes = require('./routes/incoming-invoices');
const buchhaltungRoutes    = require('./routes/buchhaltung');
const finanzplanungRoutes  = require('./routes/finanzplanung');
const lohnverwaltungRoutes = require('./routes/lohnverwaltung');
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');
const teamsRoutes = require('./routes/teams');
const workflowsRoutes = require('./routes/workflows');
const notificationsRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const { startScheduler } = require('./scheduler');
const { PrismaClient } = require('@prisma/client');
const _prisma = new PrismaClient();

// Removed portal features — cleaned up automatically on every server start
const REMOVED_PORTAL_FEATURES = ['satisfaction', 'netzwerk', 'network'];

async function cleanupPortalFeatures() {
  try {
    const { count } = await _prisma.portalFeature.deleteMany({
      where: { key: { in: REMOVED_PORTAL_FEATURES } },
    });
    if (count > 0) console.log(`[Portal] Removed ${count} stale feature(s) from permissions matrix`);
  } catch {}
}

const app = express();
const PORT = process.env.PORT || 3002
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
const uploadPath = path.resolve(UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log(`Created upload directory: ${uploadPath}`);
}

const corsOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads folder statically
app.use('/uploads', express.static(uploadPath));

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
// OAuth callbacks are public – Google/Microsoft redirect without our JWT
app.use('/api/oauth', oauthRoutes);
// Auth middleware for all routes below
app.use('/api', requireAuth);

// Protected routes
app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/segments', segmentsRoutes);
app.use('/api/key-accounts', keyAccountsRoutes);
app.use('/api/cross-selling', crossSellingRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/ai-opportunities', aiOpportunitiesRoutes);
app.use('/api/news', newsMonitoringRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/timesheets', timesheetsRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/material-costs', materialCostsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/incoming-invoices', incomingInvoicesRoutes);
app.use('/api/buchhaltung', buchhaltungRoutes);
app.use('/api/finanzplanung', finanzplanungRoutes);
app.use('/api/lohnverwaltung', lohnverwaltungRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, async () => {
  console.log(`CRM Backend running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${uploadPath}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  await cleanupPortalFeatures();
  startScheduler();
});

module.exports = app;

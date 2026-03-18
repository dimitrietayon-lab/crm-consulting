const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getGoogleToken(userId) {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });
  if (!token) throw new Error('Google not connected');
  return token;
}

async function getMicrosoftToken(userId) {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'microsoft' } },
  });
  if (!token) throw new Error('Microsoft not connected');
  return token;
}

// GET /api/calendar/google/events
router.get('/google/events', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tokenRecord = await getGoogleToken(userId);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: in30Days.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/google/push
router.post('/google/push', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { taskId } = req.body;
    const tokenRecord = await getGoogleToken(userId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { account: { select: { companyName: true } } },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const dueDate = task.dueDate || new Date();
    const start = new Date(dueDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: task.title,
        description: [task.description, task.account?.companyName].filter(Boolean).join('\n'),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });

    res.json({ eventId: event.data.id, htmlLink: event.data.htmlLink });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/microsoft/events
router.get('/microsoft/events', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tokenRecord = await getMicrosoftToken(userId);

    const { Client } = require('@microsoft/microsoft-graph-client');
    const client = Client.init({
      authProvider: (done) => done(null, tokenRecord.accessToken),
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const response = await client
      .api('/me/calendarView')
      .query({
        startDateTime: now.toISOString(),
        endDateTime: in30Days.toISOString(),
      })
      .select('subject,start,end,bodyPreview')
      .top(50)
      .get();

    res.json(response.value || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/microsoft/push
router.post('/microsoft/push', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { taskId } = req.body;
    const tokenRecord = await getMicrosoftToken(userId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { account: { select: { companyName: true } } },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { Client } = require('@microsoft/microsoft-graph-client');
    const client = Client.init({
      authProvider: (done) => done(null, tokenRecord.accessToken),
    });

    const dueDate = task.dueDate || new Date();
    const start = new Date(dueDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const event = await client.api('/me/events').post({
      subject: task.title,
      body: { contentType: 'text', content: task.description || '' },
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    });

    res.json({ eventId: event.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

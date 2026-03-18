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

// POST /api/email/sync/google
router.post('/sync/google', async (req, res) => {
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

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${sevenDaysAgo}`,
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    let synced = 0;

    // Load accounts for domain matching
    const accounts = await prisma.account.findMany({
      select: { id: true, companyName: true, website: true },
    });

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const dateStr = headers.find((h) => h.name === 'Date')?.value;
      const date = dateStr ? new Date(dateStr) : new Date();

      // Match account by email domain
      const fromDomain = from.match(/@([\w.-]+)/)?.[1];
      let accountId = null;
      if (fromDomain) {
        const match = accounts.find(
          (a) => a.website && a.website.replace(/^https?:\/\//, '').replace(/^www\./, '').startsWith(fromDomain)
        );
        if (match) accountId = match.id;
      }

      await prisma.activity.create({
        data: {
          type: 'Email',
          date,
          summary: subject,
          accountId,
          createdById: userId,
        },
      });
      synced++;
    }

    res.json({ synced, total: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/sync/microsoft
router.post('/sync/microsoft', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tokenRecord = await getMicrosoftToken(userId);

    const { Client } = require('@microsoft/microsoft-graph-client');
    const client = Client.init({
      authProvider: (done) => done(null, tokenRecord.accessToken),
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await client
      .api('/me/mailFolders/inbox/messages')
      .filter(`receivedDateTime ge ${sevenDaysAgo}`)
      .select('subject,from,receivedDateTime')
      .top(50)
      .get();

    const messages = response.value || [];
    const accounts = await prisma.account.findMany({
      select: { id: true, companyName: true, website: true },
    });

    let synced = 0;
    for (const msg of messages) {
      const from = msg.from?.emailAddress?.address || '';
      const fromDomain = from.split('@')[1];
      let accountId = null;
      if (fromDomain) {
        const match = accounts.find(
          (a) => a.website && a.website.replace(/^https?:\/\//, '').replace(/^www\./, '').startsWith(fromDomain)
        );
        if (match) accountId = match.id;
      }

      await prisma.activity.create({
        data: {
          type: 'Email',
          date: new Date(msg.receivedDateTime),
          summary: msg.subject || '(no subject)',
          accountId,
          createdById: userId,
        },
      });
      synced++;
    }

    res.json({ synced, total: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/email
router.get('/', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { type: 'Email' },
      include: {
        account: { select: { id: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/oauth/google/callback'
  );
}

function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
    },
  });
}

// GET /api/oauth/status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({ google: false, microsoft: false });

    const tokens = await prisma.oAuthToken.findMany({
      where: { userId },
      select: { provider: true },
    });

    const connected = tokens.map((t) => t.provider);
    res.json({
      google: connected.includes('google'),
      microsoft: connected.includes('microsoft'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oauth/google/connect
router.get('/google/connect', (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || '';
    const oauth2Client = getGoogleOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
      ],
      state: userId,
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ error: 'Google OAuth not configured: ' + err.message });
  }
});

// GET /api/oauth/google/callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    const oauth2Client = getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider: 'google' } },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
      },
      create: {
        userId,
        provider: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
      },
    });

    res.redirect('http://localhost:3000/settings?connected=google');
  } catch (err) {
    res.redirect(`http://localhost:3000/settings?error=google_failed`);
  }
});

// GET /api/oauth/microsoft/connect
router.get('/microsoft/connect', async (req, res) => {
  try {
    const msalClient = getMsalClient();
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ['Mail.Read', 'Calendars.ReadWrite'],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/oauth/microsoft/callback',
      state: req.user?.id || '',
    });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: 'Microsoft OAuth not configured: ' + err.message });
  }
});

// GET /api/oauth/microsoft/callback
router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: ['Mail.Read', 'Calendars.ReadWrite'],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/oauth/microsoft/callback',
    });

    const expiresAt = result.expiresOn ? new Date(result.expiresOn) : null;

    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId, provider: 'microsoft' } },
      update: {
        accessToken: result.accessToken,
        expiresAt,
        scope: result.scopes?.join(' '),
      },
      create: {
        userId,
        provider: 'microsoft',
        accessToken: result.accessToken,
        expiresAt,
        scope: result.scopes?.join(' '),
      },
    });

    res.redirect('http://localhost:3000/settings?connected=microsoft');
  } catch (err) {
    res.redirect(`http://localhost:3000/settings?error=microsoft_failed`);
  }
});

// DELETE /api/oauth/:provider/disconnect
router.delete('/:provider/disconnect', async (req, res) => {
  try {
    const userId = req.user?.id;
    await prisma.oAuthToken.deleteMany({
      where: { userId, provider: req.params.provider },
    });
    res.json({ message: `${req.params.provider} disconnected` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

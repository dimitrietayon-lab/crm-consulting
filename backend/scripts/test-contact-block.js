// Offline-Test der DSGVO-Kontaktsperre (keine DB nötig).
// Ausführen: cd backend && node scripts/test-contact-block.js
const assert = require('assert');
const { normalizeCompany, contactBlockReason } = require('../src/lib/acquisitionCompliance');

// Workflow-unabhängiger Fake: der Sperr-Status ist per Flag (isLost) markiert,
// der Literal-Fallback ("kein Interesse") bleibt erhalten.
const fakePipeline = {
  statuses: ['offen', 'kontaktiert', 'kein Interesse'],
  statusSet: new Set(['offen', 'kontaktiert', 'kein Interesse']),
  lostStatuses: ['kein Interesse'],
  byStatus: new Map([['kein Interesse', { status: 'kein Interesse', isWildcard: false }]]),
};

function fakePrisma(rows = []) {
  return {
    acquisitionBlocklist: {
      findFirst: async ({ where }) => rows.find((r) => r.normalizedName === where.normalizedName) || null,
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('normalizeCompany entfernt Rechtsform, Satzzeichen und Akzente', () => {
  assert.strictEqual(normalizeCompany('Müller & Söhne GmbH'), 'muller sohne');
  assert.strictEqual(normalizeCompany('ACME AG'), 'acme');
  assert.strictEqual(normalizeCompany('acme'), 'acme');
  assert.strictEqual(normalizeCompany(''), '');
});

test('Status "kein Interesse" sperrt auch ohne Sperrlisten-Eintrag', async () => {
  const prisma = fakePrisma([]);
  const reason = await contactBlockReason(prisma, { companyName: 'Beispiel GmbH', status: 'kein Interesse' }, fakePipeline);
  assert.ok(reason && reason.includes('kein Interesse'), `Sperrgrund erwartet, erhalten: ${reason}`);
});

test('Sperrlisten-Eintrag sperrt trotz aktivem Status', async () => {
  const prisma = fakePrisma([{ normalizedName: 'acme', reason: 'Widerspruch per E-Mail' }]);
  const reason = await contactBlockReason(prisma, { companyName: 'ACME AG', status: 'Angebot versendet' }, fakePipeline);
  assert.strictEqual(reason, 'Widerspruch per E-Mail');
});

test('Ohne Eintrag und ohne Widerspruch bleibt Kontakt erlaubt', async () => {
  const prisma = fakePrisma([{ normalizedName: 'acme', reason: 'x' }]);
  const reason = await contactBlockReason(prisma, { companyName: 'Anderes Unternehmen GmbH', status: 'kontaktiert' }, fakePipeline);
  assert.strictEqual(reason, null);
});

test('Leerer Firmenname ohne Widerspruch sperrt nicht', async () => {
  const prisma = fakePrisma([]);
  const reason = await contactBlockReason(prisma, { companyName: '', status: 'offen' }, fakePipeline);
  assert.strictEqual(reason, null);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${name}\n  ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} Tests bestanden`);
  process.exit(failed ? 1 : 0);
})();

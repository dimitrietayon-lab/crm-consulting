// Offline-Test der DSGVO-Kontaktsperre (keine DB nötig).
// Ausführen: cd backend && node scripts/test-contact-block.js
const assert = require('assert');
const { normalizeCompany, contactBlockReason } = require('../src/lib/sprintCompliance');

function fakePrisma(rows = []) {
  return {
    sprintBlocklist: {
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
  const reason = await contactBlockReason(prisma, { companyName: 'Beispiel GmbH', status: 'kein Interesse' });
  assert.ok(reason && reason.includes('kein Interesse'), `Sperrgrund erwartet, erhalten: ${reason}`);
});

test('Sperrlisten-Eintrag sperrt trotz aktivem Status', async () => {
  const prisma = fakePrisma([{ normalizedName: 'acme', reason: 'Widerspruch per E-Mail' }]);
  const reason = await contactBlockReason(prisma, { companyName: 'ACME AG', status: 'Angebot versendet' });
  assert.strictEqual(reason, 'Widerspruch per E-Mail');
});

test('Ohne Eintrag und ohne Widerspruch bleibt Kontakt erlaubt', async () => {
  const prisma = fakePrisma([{ normalizedName: 'acme', reason: 'x' }]);
  const reason = await contactBlockReason(prisma, { companyName: 'Anderes Unternehmen GmbH', status: 'kontaktiert' });
  assert.strictEqual(reason, null);
});

test('Leerer Firmenname ohne Widerspruch sperrt nicht', async () => {
  const prisma = fakePrisma([]);
  const reason = await contactBlockReason(prisma, { companyName: '', status: 'offen' });
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

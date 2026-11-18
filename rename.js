// Einmalig: benennt Sprint-* Dateien/Ordner in Acquisition-* / akquise um.
// Ausführen:  node C:\innolab\crm-consulting\rename.js
// Schreibt jede Aktion nach rename-log.txt.
const fs = require('fs');
const path = require('path');

const root = 'C:\\innolab\\crm-consulting';
const log = [];

const moves = [
  // Backend routes
  ['backend/src/routes/sprint-targets.js',     'backend/src/routes/acquisition-targets.js'],
  ['backend/src/routes/sprint-assessments.js', 'backend/src/routes/acquisition-assessments.js'],
  ['backend/src/routes/sprint-offers.js',      'backend/src/routes/acquisition-offers.js'],
  ['backend/src/routes/sprint-handover.js',    'backend/src/routes/acquisition-handover.js'],
  ['backend/src/routes/sprint-settings.js',    'backend/src/routes/acquisition-settings.js'],
  ['backend/src/routes/sprint-outreach.js',    'backend/src/routes/acquisition-outreach.js'],
  ['backend/src/routes/sprint-contacts.js',    'backend/src/routes/acquisition-contacts.js'],
  ['backend/src/routes/sprint-market.js',      'backend/src/routes/acquisition-market.js'],
  // Backend libs
  ['backend/src/lib/sprintCompliance.js',      'backend/src/lib/acquisitionCompliance.js'],
  ['backend/src/lib/sprintAccount.js',         'backend/src/lib/acquisitionAccount.js'],
  // Backend PDFs
  ['backend/src/lib/pdf/sprint-assessment.js', 'backend/src/lib/pdf/acquisition-assessment.js'],
  ['backend/src/lib/pdf/sprint-offer.js',      'backend/src/lib/pdf/acquisition-offer.js'],
  ['backend/src/lib/pdf/sprint-report.js',     'backend/src/lib/pdf/acquisition-report.js'],
  // Frontend app folder
  ['frontend/app/(protected)/sprint-targets',  'frontend/app/(protected)/akquise'],
  // Frontend components
  ['frontend/components/sprint',               'frontend/components/acquisition'],
  // Frontend libs
  ['frontend/lib/sprintOptions.js',            'frontend/lib/acquisitionOptions.js'],
  ['frontend/lib/sprintSettings.js',           'frontend/lib/acquisitionSettings.js'],
  ['frontend/lib/sprintTeam.js',               'frontend/lib/acquisitionTeam.js'],
];

for (const [from, to] of moves) {
  const src = path.join(root, from);
  const dst = path.join(root, to);
  try {
    if (!fs.existsSync(src)) {
      log.push(fs.existsSync(dst)
        ? `SKIP   ${from}  (bereits verschoben)`
        : `SKIP   ${from}  (nicht gefunden)`);
      continue;
    }
    if (fs.existsSync(dst)) {
      log.push(`SKIP   ${from}  (Ziel existiert bereits: ${to})`);
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    log.push(`MOVED  ${from}  ->  ${to}`);
  } catch (err) {
    log.push(`ERROR  ${from}  ->  ${to}  ::  ${err.message}`);
  }
}

for (const d of [
  'frontend/components/acquisition/SprintNav.jsx',
  'frontend/components/acquisition/StatusPicker.jsx',
]) {
  const p = path.join(root, d);
  try {
    if (fs.existsSync(p)) { fs.unlinkSync(p); log.push(`DELETED ${d}`); }
  } catch (err) {
    log.push(`ERROR  löschen ${d}  ::  ${err.message}`);
  }
}

const failed = log.filter((l) => l.startsWith('ERROR')).length;
log.push('');
log.push(`SUMMARY failed=${failed}`);
log.push(failed === 0
  ? 'OK — Dateien liegen jetzt unter acquisition-* / akquise / components/acquisition.'
  : 'MIT FEHLERN beendet — siehe ERROR-Zeilen oben.');

const out = log.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'rename-log.txt'), out, 'utf8');
console.log(out);
process.exit(failed === 0 ? 0 : 1);

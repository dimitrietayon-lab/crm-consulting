#!/usr/bin/env node
/*
 * Bündelt alle Sprint-Mockups in EINE selbstständige HTML-Datei.
 *
 *   node bundle-mockups.cjs
 *
 * Ergebnis: mockups-uebersicht.html — beginnt auf dem Dashboard; die
 * Navigation läuft über die Sidebar der Mockups selbst. CSS + Nav-Skript
 * sind eingebettet, kein Internet nötig.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'mockups-uebersicht.html');

const SHARED_CSS = fs.readFileSync(path.join(ROOT, 'mockup-sprint.css'), 'utf8');
const SHARED_JS = fs.readFileSync(path.join(ROOT, 'mockup-sprint-nav.js'), 'utf8');
const PLATFORM_CSS = fs.readFileSync(path.join(ROOT, 'mockup-platform.css'), 'utf8');

const PAGES = [
  { group: 'Sprint', label: 'Dashboard', file: 'mockup-sprint-dashboard.html' },
  { group: 'Sprint', label: 'Planung', file: 'mockup-sprint-planung.html' },
  { group: 'Zielkunden', label: 'Liste', file: 'mockup-sprint-zielkunden-liste.html' },
  { group: 'Zielkunden', label: 'Listen-Import', file: 'mockup-sprint-import.html' },
  { group: 'Zielkunden', label: 'Kanban', file: 'mockup-sprint-kanban.html' },
  { group: 'Zielkunden', label: 'Neuer Zielkunde', file: 'mockup-sprint-zielkunde-neu.html' },
  { group: 'Zielkunden', label: 'Detail', file: 'mockup-sprint-detail.html' },
  { group: 'Zielkunden', label: 'Kontakte', file: 'mockup-sprint-kontakte.html' },
  { group: 'Vertrieb', label: 'Outreach', file: 'mockup-sprint-outreach.html' },
  { group: 'Vertrieb', label: 'Aktivitäten', file: 'mockup-sprint-aktivitaeten.html' },
  { group: 'Vertrieb', label: 'Aktivität loggen', file: 'mockup-sprint-aktivitaet-loggen.html' },
  { group: 'Vertrieb', label: 'Übergabe', file: 'mockup-sprint-uebergabe.html' },
  { group: 'Vertrieb', label: 'Assessment', file: 'mockup-sprint-assessment.html' },
  { group: 'Angebote', label: 'Liste', file: 'mockup-sprint-angebote-liste.html' },
  { group: 'Angebote', label: 'Angebot', file: 'mockup-sprint-angebot.html' },
  { group: 'Angebote', label: 'Neues Angebot', file: 'mockup-sprint-angebot-neu.html' },
  { group: 'Angebote', label: 'Proposals', file: 'mockup-sprint-proposals.html' },
  { group: 'Angebote', label: 'BAFA', file: 'mockup-sprint-bafa.html' },
  { group: 'Organisation', label: 'Team', file: 'mockup-sprint-team.html' },
  { group: 'Organisation', label: 'Einstellungen', file: 'mockup-sprint-einstellungen.html' },
  { group: 'Organisation', label: 'Sperrliste', file: 'mockup-sprint-sperrliste.html' },
  { group: 'Organisation', label: 'Reporting', file: 'mockup-sprint-reporting.html' },
  { group: 'CRM', label: 'CRM-Profil', file: 'mockup-crm-profil.html' },
  { group: 'CRM', label: 'Feature-Übernahme', file: 'mockup-sprint-feature-uebernahme.html' },
  { group: 'CRM', label: 'Sidebar-Varianten', file: 'mockup-sidebar-varianten.html' },
  { group: 'Plattform', label: 'Mandanten', file: 'mockup-platform-uebersicht.html' },
  { group: 'Plattform', label: 'Neuer Mandant', file: 'mockup-platform-mandant-neu.html' },
  { group: 'Plattform', label: 'Mandant-Detail', file: 'mockup-platform-mandant.html' },
  { group: 'Plattform', label: 'Mandantenwechsel', file: 'mockup-platform-wechsel.html' },
];

// Button-Ziele je Seite (Label -> Mockup-Datei)
const PAGE_GO = {
  'mockup-sprint-dashboard.html': {
    'Sprint-Einstellungen': 'mockup-sprint-einstellungen.html',
    'Bericht exportieren': 'mockup-sprint-reporting.html'
  },
  'mockup-sprint-kanban.html': {
    'Zielkunde': 'mockup-sprint-zielkunde-neu.html'
  },
  'mockup-sprint-aktivitaeten.html': {
    'Aktivität loggen': 'mockup-sprint-aktivitaet-loggen.html'
  },
  'mockup-sprint-aktivitaet-loggen.html': {
    'Aktivität speichern': 'mockup-sprint-aktivitaeten.html'
  },
  'mockup-sprint-detail.html': {
    'Aktivität': 'mockup-sprint-aktivitaet-loggen.html',
    'Neue Aktivität loggen': 'mockup-sprint-aktivitaet-loggen.html',
    'loggen': 'mockup-sprint-aktivitaet-loggen.html'
  },
  'mockup-sprint-zielkunden-liste.html': {
    'Details': 'mockup-sprint-detail.html',
    'Loggen': 'mockup-sprint-aktivitaet-loggen.html',
    'Angebot': 'mockup-sprint-angebot.html',
    'Sperrliste': 'mockup-sprint-sperrliste.html'
  },
  'mockup-sprint-angebote-liste.html': {
    'Anzeigen': 'mockup-sprint-angebot.html',
    'Bearbeiten': 'mockup-sprint-angebot.html',
    'Verlängern': 'mockup-sprint-angebot.html'
  },
  'mockup-sprint-angebot.html': {
    'Angebot versenden': 'mockup-sprint-angebote-liste.html',
    'Als angenommen markieren': 'mockup-sprint-angebote-liste.html'
  },
  'mockup-sprint-angebot-neu.html': {
    'Erstellen & Versenden': 'mockup-sprint-angebote-liste.html',
    'Entwurf speichern': 'mockup-sprint-angebote-liste.html',
    'Als Entwurf speichern': 'mockup-sprint-angebote-liste.html'
  },
  'mockup-sprint-bafa.html': {
    'Bericht exportieren': 'mockup-sprint-reporting.html',
    'Details': 'mockup-sprint-detail.html'
  },
  'mockup-sprint-proposals.html': {
    'Details': 'mockup-sprint-assessment.html',
    'Deal': 'mockup-sprint-angebot-neu.html',
    'Deal anlegen →': 'mockup-sprint-angebot-neu.html'
  },
  'mockup-sprint-zielkunde-neu.html': {
    'Zielkunde anlegen →': 'mockup-sprint-kanban.html'
  },
  'mockup-sprint-import.html': {
    '43 Zielkunden importieren': 'mockup-sprint-kanban.html'
  },
  'mockup-sprint-uebergabe.html': {
    'Übergabe bestätigen': 'mockup-sprint-detail.html'
  },
  'mockup-sprint-kontakte.html': {},
  'mockup-crm-profil.html': {
    'Modul-Freigaben': 'mockup-platform-mandant.html',
    'Wo die Module liegen': 'mockup-platform-mandant.html',
    'Modul-Freigaben im Plattform-Admin': 'mockup-platform-mandant.html'
  },
  'mockup-platform-uebersicht.html': {
    'Öffnen': 'mockup-platform-mandant.html',
    'Neuer Mandant': 'mockup-platform-mandant-neu.html',
    'Mandantenwechsel ansehen': 'mockup-platform-wechsel.html'
  },
  'mockup-platform-mandant-neu.html': {
    'Weiter': 'mockup-platform-mandant.html',
    'Zurück': 'mockup-platform-uebersicht.html',
    'Abbrechen': 'mockup-platform-uebersicht.html',
    'Mandant anlegen': 'mockup-platform-mandant.html'
  },
  'mockup-platform-mandant.html': {
    'Zum Mandanten wechseln': 'mockup-platform-wechsel.html',
    'Mandant bearbeiten': 'mockup-platform-mandant-neu.html'
  },
  'mockup-platform-wechsel.html': {
    'Wechseln': 'mockup-platform-mandant.html',
    'Mandant wechseln': 'mockup-platform-mandant.html'
  }
};

// Klicks auf Verweise/Buttons bleiben in der einen Datei:
// interne Links + Button-Ziele -> Hülle, Tabs/Filter schalten um.
function makeBridge(file) {
  const map = PAGE_GO[file] || {};
  return String.raw`<script>
(function () {
  var GO = ${JSON.stringify(map)};
  var TITLE_GO = { 'Zielkunde öffnen': 'mockup-sprint-detail.html', 'Anruf loggen': 'mockup-sprint-aktivitaet-loggen.html' };
  var TOGGLE = ['filter-btn', 'cat-btn', 'seg-tab', 'tab', 'pg-btn', 'sent-btn'];
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().replace(/^[+＋]\s*/, '').trim(); }
  function go(page) { try { parent.postMessage({ mockupPage: page }, '*'); } catch (err) {} }
  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:8px;font:13px Inter,sans-serif;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;pointer-events:none';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 1600);
  }
  function toggleActive(el) {
    for (var i = 0; i < TOGGLE.length; i++) {
      var c = TOGGLE[i];
      if (el.classList && el.classList.contains(c)) {
        var p = el.parentElement;
        if (p) {
          for (var j = 0; j < p.children.length; j++) {
            var n = p.children[j];
            if (n.classList && n.classList.contains(c)) n.classList.remove('active');
          }
        }
        el.classList.add('active');
        return true;
      }
    }
    return false;
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href], button') : null;
    if (!el) return;
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (/^mockup-[^\/]*\.html$/.test(href)) { e.preventDefault(); go(href); }
      return;
    }
    if (toggleActive(el)) { e.preventDefault(); return; }
    var label = norm(el.textContent);
    var dest = GO[label] || TITLE_GO[norm(el.getAttribute('title'))];
    if (dest) { e.preventDefault(); go(dest); return; }
    if (/export|speicher|lösch|generier|importier|erstell|vorlage|bestätig|bearbeit/i.test(label)) {
      e.preventDefault();
      toast('Demo: „' + label + '“ ausgeführt');
    }
  });
})();
</script>
`;
}

function inlinePage(file) {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // Webfonts raus – Datei soll offline vollständig sein
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/gi, '');
  // Plattform-CSS inline (nur auf den Plattform-Seiten vorhanden)
  html = html.replace(
    /<link[^>]*href=["']mockup-platform\.css["'][^>]*>/i,
    '<style>\n' + PLATFORM_CSS + '\n</style>'
  );
  // Shared-CSS inline voranstellen; nav.js findet <style id="sprint-ds">
  // und injiziert dann nicht mehr den externen Link
  html = html.replace(
    /<script[^>]*src=["']mockup-sprint-nav\.js["'][^>]*>\s*<\/script>/i,
    '<style id="sprint-ds">\n' + SHARED_CSS + '\n</style>\n<script>\n' + SHARED_JS + '\n</script>'
  );
  // Link-/Button-Bridge ans Ende des Body
  html = html.replace(/<\/body>/i, makeBridge(file) + '</body>');
  return html;
}

const pages = PAGES.map(function (p) {
  return { file: p.file, html: inlinePage(p.file) };
});

const pagesJson = JSON.stringify(pages)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const out = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KI-Readiness Sprint – Mockup</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body { background: #f9fafb; overflow: hidden; }
iframe { width: 100%; height: 100%; border: none; display: block; background: #f9fafb; }
</style>
</head>
<body>
<iframe id="frame" title="KI-Readiness Sprint"></iframe>
<script>
var PAGES = ${pagesJson};
var frame = document.getElementById('frame');
var byFile = {};
PAGES.forEach(function (p) { byFile[p.file] = p; });
window.addEventListener('message', function (e) {
  if (e.data && typeof e.data.mockupPage === 'string' && byFile[e.data.mockupPage]) {
    frame.srcdoc = byFile[e.data.mockupPage].html;
  }
});
frame.srcdoc = PAGES[0].html;
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, out, 'utf8');
process.stdout.write('Geschrieben: ' + OUT + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)\n');

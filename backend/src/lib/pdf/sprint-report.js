const {
  createDoc, header, sectionTitle, kvRow, table, money, date, footer,
} = require('./index');

function buildReportPdf(summary, meta = {}) {
  const doc = createDoc({ title: 'Sprint-Reporting' });
  const period = summary.period || {};

  header(doc, 'Sprint-Reporting', meta.subtitle || 'Zielkunden, Pipeline und Aktivitäten');

  sectionTitle(doc, 'Zeitraum');
  kvRow(doc, 'Von', period.from ? date(period.from) : 'Gesamter Zeitraum');
  kvRow(doc, 'Bis', period.to ? date(period.to) : 'Gesamter Zeitraum');
  kvRow(doc, 'Erzeugt am', date(new Date()));

  sectionTitle(doc, 'Kennzahlen');
  kvRow(doc, 'Zielkunden', summary.total);
  kvRow(doc, 'Im Gespräch', [
    'Qualifizierungsgespräch', 'Übergabe an Engagement Manager',
    'Erstgespräch terminiert', 'Erstgespräch durchgeführt', 'Fragebogen geschickt',
  ].reduce((sum, s) => sum + ((summary.byStatus || {})[s] || 0), 0));
  kvRow(doc, 'Offene Angebote', summary.offers?.pending || 0);
  kvRow(doc, 'Gewonnen', ((summary.byStatus || {})['gewonnen'] || 0) + ((summary.byStatus || {})['Folgeprojekt'] || 0));
  kvRow(doc, 'Win-Rate', `${summary.winRate || 0}%`);
  kvRow(doc, 'Pipeline-Wert', money(summary.pipelineValue));
  kvRow(doc, 'Gewonnener Umsatz', money(summary.wonValue));
  kvRow(doc, 'Umsatzziel', `${money(summary.revenue?.target)} (${summary.revenue?.percent || 0}% erreicht)`);
  kvRow(doc, 'Assessment-Coverage', `${summary.assessments?.coverage || 0}%`);

  if (summary.segmentList?.length) {
    sectionTitle(doc, 'Segmente');
    table(
      doc,
      [
        { label: 'Segment', width: 5 },
        { label: 'Zielkunden', width: 2, align: 'right' },
      ],
      summary.segmentList.map((s) => [s.segment, s.count])
    );
  }

  if (summary.bundeslandList?.length) {
    sectionTitle(doc, 'Bundesländer');
    table(
      doc,
      [
        { label: 'Bundesland', width: 5 },
        { label: 'Zielkunden', width: 2, align: 'right' },
      ],
      summary.bundeslandList.map((b) => [b.bundesland, b.count])
    );
  }

  if (summary.lossReasonList?.length) {
    sectionTitle(doc, 'Verlustgründe');
    table(
      doc,
      [
        { label: 'Grund', width: 5 },
        { label: 'Anzahl', width: 2, align: 'right' },
      ],
      summary.lossReasonList.map((r) => [r.reason, r.count])
    );
  }

  if (summary.activities?.byType) {
    sectionTitle(doc, 'Aktivitäten nach Typ');
    table(
      doc,
      [
        { label: 'Typ', width: 5 },
        { label: 'Anzahl', width: 2, align: 'right' },
      ],
      Object.entries(summary.activities.byType).map(([type, count]) => [type, count])
    );
  }

  footer(doc, `Sprint-Reporting · ${date(new Date())}`);
  return doc;
}

module.exports = { buildReportPdf };

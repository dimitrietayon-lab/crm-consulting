const {
  createDoc, header, sectionTitle, kvRow, paragraph, table, date, footer, COLORS, fontBold,
} = require('./index');

const DIMENSIONS = [
  ['dataAvailability', 'Datenverfügbarkeit'],
  ['techStack', 'Technologie-Stack'],
  ['processMaturity', 'Prozessreife'],
  ['aiCompetency', 'KI-Kompetenz'],
  ['governance', 'Governance & Compliance'],
  ['strategy', 'Strategie & Leadership'],
];

function scoreLabel(score) {
  if (score == null) return '—';
  if (score >= 4) return 'Bereit';
  if (score >= 2.5) return 'Entwicklung';
  return 'Früh';
}

function buildAssessmentPdf(assessment) {
  const target = assessment.sprintTarget || {};
  const doc = createDoc({ title: 'KI-Readiness Assessment' });

  header(doc, 'KI-Readiness Assessment', [target.companyName, `Version ${assessment.version}`].filter(Boolean).join(' · '));

  sectionTitle(doc, 'Gesamtbild');
  kvRow(doc, 'Unternehmen', target.companyName);
  kvRow(doc, 'Segment', target.segment);
  kvRow(doc, 'Gesamtscore', assessment.totalScore != null ? `${assessment.totalScore.toFixed(1)} / 5` : '—');
  kvRow(doc, 'Einschätzung', scoreLabel(assessment.totalScore));
  kvRow(doc, 'Erstellt am', date(assessment.updatedAt || assessment.createdAt));
  kvRow(doc, 'Quelle', assessment.generatedByAi ? 'KI-gestützt' : 'Manuell');

  sectionTitle(doc, '6-Dimensionen-Analyse');
  table(
    doc,
    [
      { label: 'Dimension', width: 4 },
      { label: 'Score', width: 1.2, align: 'right' },
      { label: 'Bewertung', width: 2 },
    ],
    DIMENSIONS.map(([key, label]) => [
      label,
      assessment[key] != null ? `${assessment[key].toFixed(1)} / 5` : '—',
      scoreLabel(assessment[key]),
    ])
  );

  if (assessment.findings) {
    sectionTitle(doc, 'Erkenntnisse');
    paragraph(doc, assessment.findings);
  }
  if (assessment.recommendations) {
    sectionTitle(doc, 'Empfehlungen');
    paragraph(doc, assessment.recommendations);
  }

  const useCases = assessment.useCases || [];
  if (useCases.length > 0) {
    sectionTitle(doc, 'Use-Case-Kandidaten');
    table(
      doc,
      [
        { label: 'Titel', width: 5 },
        { label: 'Typ', width: 2 },
        { label: 'Priorität', width: 1.5 },
        { label: 'Potenzial', width: 1.6, align: 'right' },
      ],
      useCases.map((uc) => [
        uc.title,
        uc.type,
        uc.priority,
        uc.estimatedValue ? `${Number(uc.estimatedValue).toLocaleString('de-DE')} €` : '—',
      ])
    );
  }

  footer(doc, `Assessment · ${target.companyName || ''} · ${date(new Date())}`);
  return doc;
}

module.exports = { buildAssessmentPdf };

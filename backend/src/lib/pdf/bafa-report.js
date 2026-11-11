const {
  createDoc, header, sectionTitle, kvRow, paragraph, table, money, date, footer,
} = require('./index');

function buildBafaPdf(target, documents = []) {
  const doc = createDoc({ title: 'Förderung' });

  header(doc, 'Förderung', [target.companyName, target.location].filter(Boolean).join(' · '));

  sectionTitle(doc, 'Antrag');
  kvRow(doc, 'Unternehmen', target.companyName);
  kvRow(doc, 'Ansprechpartner', target.contactName);
  kvRow(doc, 'Segment', target.segment);
  kvRow(doc, 'Förderprogramm', target.fundingProgram);
  kvRow(doc, 'Förderstatus', target.bafaStatus || 'nicht beantragt');
  kvRow(doc, 'Antragsdatum', date(target.bafaDate));
  kvRow(doc, 'Eingereicht am', date(target.bafaSubmittedAt));
  kvRow(doc, 'Angebotswert', money(target.offerValue));
  kvRow(doc, 'Fördersumme (berechnet)', money(target.fundingAmount));
  kvRow(doc, 'Bewilligter Betrag', money(target.bafaApprovedAmount));

  sectionTitle(doc, 'Nachweise');
  if (!documents.length) {
    paragraph(doc, 'Keine Nachweise hinterlegt.');
  } else {
    table(
      doc,
      [
        { label: 'Dokument', width: 5 },
        { label: 'Status', width: 2 },
        { label: 'Notiz', width: 3 },
      ],
      documents.map((d) => [d.name, d.status, d.notes || '—'])
    );
  }

  if (target.bafaNotes) {
    sectionTitle(doc, 'Hinweise');
    paragraph(doc, target.bafaNotes);
  }

  footer(doc, `Förderung · ${target.companyName || ''} · ${date(new Date())}`);
  return doc;
}

module.exports = { buildBafaPdf };

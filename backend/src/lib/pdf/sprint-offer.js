const {
  createDoc, header, sectionTitle, kvRow, paragraph, table, money, date, footer, COLORS, fontBold,
} = require('./index');

const PACKAGE_LABELS = { compact: 'Compact', standard: 'Standard', premium: 'Premium' };
const STATUS_LABELS = {
  draft: 'Entwurf', sent: 'Versendet', accepted: 'Angenommen', rejected: 'Abgelehnt', expired: 'Abgelaufen',
};

function buildOfferPdf(offer) {
  const target = offer.sprintTarget || {};
  const doc = createDoc({ title: `Angebot ${offer.offerNumber}` });

  header(
    doc,
    `Angebot ${offer.offerNumber}`,
    [target.companyName, target.location].filter(Boolean).join(' · ')
  );

  sectionTitle(doc, 'Kunde');
  kvRow(doc, 'Unternehmen', target.companyName);
  kvRow(doc, 'Ansprechpartner', target.contactName);
  kvRow(doc, 'E-Mail', target.contactEmail);
  kvRow(doc, 'Segment', target.segment);
  kvRow(doc, 'Status', STATUS_LABELS[offer.status] || offer.status);

  sectionTitle(doc, 'Angebotsdaten');
  kvRow(doc, 'Paket', offer.packageLabel || PACKAGE_LABELS[offer.package] || offer.package);
  kvRow(doc, 'Angebotsdatum', date(offer.createdAt));
  kvRow(doc, 'Gültig bis', date(offer.validUntil));

  sectionTitle(doc, 'Positionen');
  const items = offer.items || [];
  if (items.length === 0) {
    paragraph(doc, 'Keine Positionen hinterlegt.');
  } else {
    table(
      doc,
      [
        { label: 'Pos.', width: 0.6, align: 'right' },
        { label: 'Leistung', width: 6 },
        { label: 'Menge', width: 1.1, align: 'right' },
        { label: 'Einzelpreis', width: 2.1, align: 'right' },
        { label: 'Summe', width: 2.1, align: 'right' },
      ],
      items.map((item) => [
        item.position,
        item.description,
        item.quantity,
        money(item.unitPrice),
        money(item.total),
      ])
    );
  }

  const totalRowWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxLeft = doc.page.margins.left + totalRowWidth * 0.55;
  const boxTop = doc.y + 4;
  doc.save();
  doc.roundedRect(boxLeft, boxTop, totalRowWidth * 0.45, 44, 6).fill('#f5f3ff');
  doc.restore();
  fontBold(doc);
  doc.fontSize(10).fillColor(COLORS.muted).text('Gesamtsumme (netto)', boxLeft + 12, boxTop + 8, { width: 160 });
  doc.fontSize(15).fillColor(COLORS.primary).text(money(offer.value), boxLeft + 12, boxTop + 20, {
    width: totalRowWidth * 0.45 - 24,
    align: 'right',
  });
  doc.y = boxTop + 58;
  doc.fillColor(COLORS.dark);

  if (target.bafaStatus) {
    sectionTitle(doc, 'Förderung (BAFA)');
    kvRow(doc, 'BAFA-Status', target.bafaStatus);
    kvRow(doc, 'Beantragt am', date(target.bafaDate));
    if (target.bafaApprovedAmount) kvRow(doc, 'Bewilligter Betrag', money(target.bafaApprovedAmount));
  }

  if (offer.notes) {
    sectionTitle(doc, 'Hinweise');
    paragraph(doc, offer.notes);
  }

  footer(doc, `Angebot ${offer.offerNumber} · erzeugt am ${date(new Date())}`);
  return doc;
}

module.exports = { buildOfferPdf, PACKAGE_LABELS, STATUS_LABELS };

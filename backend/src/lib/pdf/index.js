const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const boldCandidateNames = ['DejaVuSans-Bold.ttf', 'arialbd.ttf', 'segoeuib.ttf', 'calibrib.ttf'];
const regularCandidateNames = ['DejaVuSans.ttf', 'arial.ttf', 'segoeui.ttf', 'calibri.ttf'];

const FONT_DIRS = [
  process.env.PDF_FONT_DIR,
  path.resolve(__dirname, '../../../assets/fonts'),
  'C:/Windows/Fonts',
  '/usr/share/fonts/truetype/dejavu',
  '/usr/share/fonts/truetype/msttcorefonts',
  '/Library/Fonts',
].filter(Boolean);

let resolved = null;

function findFont(names) {
  for (const dir of FONT_DIRS) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        // ignore inaccessible directories
      }
    }
  }
  return null;
}

function resolveFonts() {
  if (resolved !== null) return resolved;
  if (process.env.PDF_FONT_PATH && fs.existsSync(process.env.PDF_FONT_PATH)) {
    const bold = process.env.PDF_FONT_BOLD && fs.existsSync(process.env.PDF_FONT_BOLD)
      ? process.env.PDF_FONT_BOLD
      : process.env.PDF_FONT_PATH;
    resolved = { regular: process.env.PDF_FONT_PATH, bold };
    return resolved;
  }
  const regular = findFont(regularCandidateNames);
  const bold = findFont(boldCandidateNames) || regular;
  resolved = regular ? { regular, bold } : null;
  return resolved;
}

const COLORS = {
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  dark: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  success: '#059669',
  danger: '#dc2626',
};

function createDoc(options = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 55 },
    info: { Title: options.title || 'Dokument', Author: 'CRM' },
  });

  const fonts = resolveFonts();
  if (fonts) {
    try {
      doc.registerFont('Body', fonts.regular);
      doc.registerFont('Bold', fonts.bold);
      doc.font('Body');
    } catch {
      doc.font('Helvetica');
    }
  } else {
    doc.font('Helvetica');
  }
  doc.fillColor(COLORS.dark);
  return doc;
}

function fontRegular(doc) {
  try {
    doc.font('Body');
  } catch {
    doc.font('Helvetica');
  }
}

function fontBold(doc) {
  try {
    doc.font('Bold');
  } catch {
    doc.font('Helvetica-Bold');
  }
}

function header(doc, title, subtitle) {
  const { width } = doc.page;
  const left = doc.page.margins.left;
  const top = doc.y;
  const boxWidth = width - left - doc.page.margins.right;

  doc.save();
  doc.roundedRect(left, top, boxWidth, 74, 8).fill(COLORS.primary);
  doc.restore();

  doc.fillColor('#ffffff');
  fontBold(doc);
  doc.fontSize(19).text(title, left + 18, top + 16, { width: boxWidth - 36, ellipsis: true });
  if (subtitle) {
    fontRegular(doc);
    doc.fontSize(10).fillColor('#e0e7ff').text(subtitle, left + 18, top + 44, { width: boxWidth - 36, ellipsis: true });
  }
  doc.fillColor(COLORS.dark);
  doc.y = top + 92;
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 34);
  fontBold(doc);
  doc.fontSize(12).fillColor(COLORS.dark).text(text);
  doc.moveDown(0.3);
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.6);
  fontRegular(doc);
}

function kvRow(doc, label, value, opts = {}) {
  const left = doc.page.margins.left;
  const labelWidth = opts.labelWidth || 150;
  const valueWidth = doc.page.width - left - doc.page.margins.right - labelWidth;
  const startY = doc.y;
  ensureSpace(doc, 18);
  fontRegular(doc);
  doc.fontSize(9.5).fillColor(COLORS.muted).text(label, left, startY, { width: labelWidth });
  fontBold(doc);
  doc.fontSize(10).fillColor(COLORS.dark).text(value == null || value === '' ? '—' : String(value), left + labelWidth, startY, { width: valueWidth });
  doc.y = Math.max(doc.y, startY + 16);
  doc.moveDown(0.25);
}

function paragraph(doc, text) {
  if (!text) return;
  ensureSpace(doc, 24);
  fontRegular(doc);
  doc.fontSize(10).fillColor(COLORS.dark).text(String(text), {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: 'left',
    lineGap: 2,
  });
  doc.moveDown(0.5);
}

function table(doc, columns, rows) {
  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - left - doc.page.margins.right;
  const totalFlex = columns.reduce((s, c) => s + (c.width || 1), 0);

  const drawHeader = () => {
    const y = doc.y;
    doc.save();
    doc.rect(left, y, tableWidth, 20).fill(COLORS.primarySoft);
    doc.restore();
    let x = left;
    fontBold(doc);
    doc.fontSize(9).fillColor(COLORS.dark);
    for (const col of columns) {
      const w = (tableWidth * (col.width || 1)) / totalFlex;
      doc.text(col.label, x + 5, y + 6, { width: w - 10, align: col.align || 'left' });
      x += w;
    }
    doc.y = y + 24;
  };

  ensureSpace(doc, 40);
  drawHeader();

  rows.forEach((row, rowIndex) => {
    const startY = doc.y;
    const textHeight = Math.max(
      16,
      ...columns.map((col, i) => {
        const w = (tableWidth * (col.width || 1)) / totalFlex;
        doc.fontSize(9.5);
        const h = doc.heightOfString(String(row[i] ?? ''), { width: w - 10 });
        return h + 8;
      })
    );

    if (startY + textHeight > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(left, y, tableWidth, textHeight).fill('#fafafa');
      doc.restore();
    }
    let x = left;
    columns.forEach((col, i) => {
      const w = (tableWidth * (col.width || 1)) / totalFlex;
      fontRegular(doc);
      doc.fontSize(9.5).fillColor(COLORS.dark).text(String(row[i] ?? ''), x + 5, y + 4, {
        width: w - 10,
        align: col.align || 'left',
      });
      x += w;
    });
    doc.y = y + textHeight;
    doc.moveTo(left, doc.y)
      .lineTo(left + tableWidth, doc.y)
      .strokeColor(COLORS.line)
      .lineWidth(0.6)
      .stroke();
  });
  doc.moveDown(0.8);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function money(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function date(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function contentDisposition(filename) {
  const fallback = filename
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function sendPdf(res, doc, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDisposition(filename));
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  doc.end();
}

function footer(doc, text) {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom + 18;
  fontRegular(doc);
  doc.fontSize(8).fillColor(COLORS.muted).text(
    text || 'Erzeugt am ' + date(new Date()) + ' · CRM',
    left,
    bottom,
    { width: doc.page.width - left - doc.page.margins.right, align: 'center' }
  );
}

module.exports = {
  COLORS,
  createDoc,
  fontRegular,
  fontBold,
  header,
  sectionTitle,
  kvRow,
  paragraph,
  table,
  ensureSpace,
  money,
  date,
  contentDisposition,
  sendPdf,
  footer,
};

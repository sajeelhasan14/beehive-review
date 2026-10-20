import 'server-only';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// The print kit for one funnel: a QR code PNG, a fold-in-half table tent and a sticker sheet.
// All three point at the funnel URL (/c/{slug}). Built on request, nothing stored.

export interface KitInput {
  url: string;          // full funnel URL the QR opens
  name: string;         // business name
  question: string;     // rating question, the headline
  color: string;        // brand color, #RRGGBB
}

const INK = rgb(0.1, 0.1, 0.1);
const SOFT = rgb(0.42, 0.42, 0.42);

export function qrPng(url: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: 'png', width, margin: 2, errorCorrectionLevel: 'M' });
}

function hexToRgb(hex: string) {
  const n = Number.parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'E8B54D', 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// The built-in PDF fonts only cover basic Latin: swap curly quotes, drop anything else they can't draw.
function plain(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '');
}

// Biggest font size (up to max) at which the text fits the width.
function fit(font: PDFFont, text: string, maxWidth: number, max: number): number {
  let size = max;
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

function centered(page: PDFPage, font: PDFFont, text: string, cx: number, y: number, maxWidth: number, max: number, color = INK) {
  const size = fit(font, text, maxWidth, max);
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

// Letter landscape, folded along the middle into a tent. The top half is drawn upside down,
// so both sides read the right way up once it stands on the table.
export async function tableTentPdf(kit: KitInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${plain(kit.name)} table tent`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const brand = hexToRgb(kit.color);

  // One panel (792 x 306), drawn on its own page, then placed twice.
  const W = 792;
  const H = 306;
  const panelDoc = await PDFDocument.create();
  const pBold = await panelDoc.embedFont(StandardFonts.HelveticaBold);
  const pRegular = await panelDoc.embedFont(StandardFonts.Helvetica);
  const pQr = await panelDoc.embedPng(await qrPng(kit.url, 900));
  const panel = panelDoc.addPage([W, H]);
  panel.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: brand });
  const qrSize = 210;
  panel.drawImage(pQr, { x: W - qrSize - 56, y: (H - qrSize) / 2 - 6, width: qrSize, height: qrSize });

  const textX = 64;
  const textW = W - qrSize - 56 - textX - 40;
  const name = plain(kit.name);
  const question = plain(kit.question);
  panel.drawText(name.toUpperCase(), { x: textX, y: 214, size: fit(pBold, name.toUpperCase(), textW, 15), font: pBold, color: brand });
  panel.drawText(question, { x: textX, y: 166, size: fit(pBold, question, textW, 34), font: pBold, color: INK });
  panel.drawText('Point your phone camera at the code.', { x: textX, y: 124, size: 15, font: pRegular, color: SOFT });
  panel.drawText('Tap a face. It takes 20 seconds.', { x: textX, y: 102, size: 15, font: pRegular, color: SOFT });
  panel.drawText('We read every one.', { x: textX, y: 62, size: 13, font: pBold, color: INK });

  const [embedded] = await doc.embedPdf(await panelDoc.save());
  const page = doc.addPage([W, 612]);
  page.drawPage(embedded, { x: 0, y: 0 });                                // bottom half, upright
  page.drawPage(embedded, { x: W, y: 612, rotate: degrees(180) });        // top half, upside down
  page.drawLine({ start: { x: 18, y: 306 }, end: { x: W - 18, y: 306 }, thickness: 0.5, color: SOFT, dashArray: [4, 4] });
  page.drawText('fold', { x: W / 2 - 8, y: 309, size: 7, font: regular, color: SOFT });

  return doc.save();
}

// Letter portrait, 12 square stickers of 2.5 inches (3 across, 4 down), with light cut guides.
export async function stickerSheetPdf(kit: KitInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${plain(kit.name)} stickers`);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const qr = await doc.embedPng(await qrPng(kit.url, 700));
  const brand = hexToRgb(kit.color);
  const page = doc.addPage([612, 792]);

  const S = 180;
  const left = (612 - 3 * S) / 2;
  const bottom = (792 - 4 * S) / 2;
  const name = plain(kit.name);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x = left + col * S;
      const y = bottom + row * S;
      page.drawRectangle({ x: x + 4, y: y + 4, width: S - 8, height: S - 8, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });
      page.drawRectangle({ x: x + 4, y: y + S - 12, width: S - 8, height: 8, color: brand });
      centered(page, bold, name, x + S / 2, y + S - 30, S - 30, 12);
      const q = 104;
      page.drawImage(qr, { x: x + (S - q) / 2, y: y + 34, width: q, height: q });
      centered(page, bold, 'Scan to rate us', x + S / 2, y + 20, S - 30, 11);
      centered(page, regular, 'Takes 20 seconds', x + S / 2, y + 9, S - 30, 7, SOFT);
    }
  }
  return doc.save();
}

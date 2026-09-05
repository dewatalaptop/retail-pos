import type { ReceiptData } from "../components/Receipt";

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Makan di tempat",
  takeaway: "Bawa pulang",
  delivery: "Diantar",
};

// Standard ESC/POS control bytes — the same command set virtually every
// thermal receipt printer (58mm and 80mm alike) understands out of the box.
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init: [ESC, 0x40],
  alignLeft: [ESC, 0x61, 0],
  alignCenter: [ESC, 0x61, 1],
  alignRight: [ESC, 0x61, 2],
  boldOn: [ESC, 0x45, 1],
  boldOff: [ESC, 0x45, 0],
  doubleHeightWidthOn: [GS, 0x21, 0x11],
  doubleHeightWidthOff: [GS, 0x21, 0x00],
  feed: (lines: number) => [ESC, 0x64, lines],
  // GS V 66 3 = feed 3 dots then partial cut — the combination most 58/80mm
  // printers respond to; a handful of full-cut-only models ignore the "66"
  // sub-mode and still just cut, so this is the safer single command to send
  // rather than branching on printer model, which we have no way to detect.
  cut: [GS, 0x56, 66, 3],
};

// The two widths that cover the overwhelming majority of thermal receipt
// printers sold for POS use. Character counts are the standard column count
// at the printer's default font (Font A, 12x24) for each physical width —
// the same numbers every ESC/POS printer's own datasheet quotes.
export const PAPER_WIDTHS = {
  "58": { label: "58mm (kertas kecil)", chars: 32 },
  "80": { label: "80mm (kertas besar)", chars: 48 },
} as const;

export type PaperWidthKey = keyof typeof PAPER_WIDTHS;

function rp(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

// Printers default to a single-byte code page (CP437 on power-on for
// virtually every ESC/POS model) — Indonesian text uses plain Latin letters
// with no diacritics, so a direct char-code map covers everything actually
// printed here without needing to select or reason about code pages.
function textBytes(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes.push(code < 256 ? code : 0x3f); // '?' for anything outside Latin-1
  }
  bytes.push(0x0a); // line feed after every text line
  return bytes;
}

function wrapText(s: string, width: number): string[] {
  if (s.length <= width) return [s];
  const words = s.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      if (current) lines.push(current);
      // A single word longer than the whole line (rare, but a barcode-like
      // SKU pasted as a product name shouldn't silently vanish) — hard-break it.
      current = word.length > width ? word.slice(0, width) : word;
      if (word.length > width) {
        lines.push(current);
        current = "";
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Left-aligned label + right-aligned value on one line, padded/truncated to
// exactly `width` columns — the standard receipt-line layout.
function twoColumn(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space >= 1) return left + " ".repeat(space) + right;
  // Line's too narrow for both at full length — the value (a price) matters
  // more than the label here, so trim the label and keep the number intact.
  const trimmedLeft = left.slice(0, Math.max(0, width - right.length - 1));
  return trimmedLeft + " ".repeat(Math.max(1, width - trimmedLeft.length - right.length)) + right;
}

function separator(width: number): number[] {
  return textBytes("-".repeat(width));
}

export interface ReceiptPrintOptions {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  footerNote?: string;
  paperWidth: PaperWidthKey;
}

/**
 * Builds the raw ESC/POS byte sequence for a full receipt, laid out to fit
 * the given paper width. Mirrors the on-screen Receipt component's content
 * (see components/Receipt.tsx) so what prints matches what the cashier
 * already saw on screen before tapping print.
 */
export function buildReceiptBytes(data: ReceiptData, opts: ReceiptPrintOptions): Uint8Array {
  const width = PAPER_WIDTHS[opts.paperWidth].chars;
  const out: number[] = [...CMD.init];

  out.push(...CMD.alignCenter, ...CMD.boldOn, ...CMD.doubleHeightWidthOn);
  out.push(...textBytes(opts.storeName));
  out.push(...CMD.doubleHeightWidthOff, ...CMD.boldOff);
  if (opts.storeAddress) out.push(...textBytes(opts.storeAddress));
  if (opts.storePhone) out.push(...textBytes(opts.storePhone));
  out.push(...textBytes(`Struk Transaksi #${data.transactionId}`));
  out.push(...textBytes(new Date(data.createdAt).toLocaleString("id-ID")));
  if (data.tableNumber || data.orderType) {
    const orderTypeLabel = data.orderType ? ORDER_TYPE_LABEL[data.orderType] : "";
    out.push(
      ...textBytes(
        [data.tableNumber ? `Meja ${data.tableNumber}` : "", orderTypeLabel].filter(Boolean).join(" - ")
      )
    );
  }
  out.push(...CMD.alignLeft);
  out.push(...separator(width));

  for (const item of data.items) {
    for (const line of wrapText(item.name, width)) out.push(...textBytes(line));
    const qtyPrice = `${item.qty} x ${rp(item.price)}${item.discountPercent > 0 ? ` (-${item.discountPercent}%)` : ""}`;
    const lineTotal = rp(Math.round(item.qty * item.price * (1 - item.discountPercent / 100)));
    out.push(...textBytes(twoColumn(qtyPrice, lineTotal, width)));
    if (item.note) out.push(...textBytes(`  > ${item.note}`));
  }

  out.push(...separator(width));
  out.push(...textBytes(twoColumn("Subtotal", rp(data.subtotal), width)));
  out.push(...textBytes(twoColumn("Diskon", `-${rp(data.discountTotal)}`, width)));
  out.push(...textBytes(twoColumn("Pajak", rp(data.taxTotal), width)));
  if (data.serviceChargeTotal) {
    out.push(...textBytes(twoColumn("Biaya layanan", rp(data.serviceChargeTotal), width)));
  }
  out.push(...CMD.boldOn);
  out.push(...textBytes(twoColumn("Total", rp(data.total), width)));
  out.push(...CMD.boldOff);
  out.push(...separator(width));

  out.push(
    ...textBytes(
      twoColumn(`Bayar (${data.paymentMethod})`, data.cashReceived !== undefined ? rp(data.cashReceived) : "-", width)
    )
  );
  if (data.customerName) {
    out.push(...textBytes(twoColumn("Atas nama", data.customerName, width)));
  }
  if (data.changeDue !== undefined) {
    out.push(...textBytes(twoColumn("Kembalian", rp(data.changeDue), width)));
  }

  if (opts.footerNote) {
    out.push(...CMD.alignCenter);
    for (const line of wrapText(opts.footerNote, width)) out.push(...textBytes(line));
  }

  out.push(...CMD.feed(3), ...CMD.cut);
  return new Uint8Array(out);
}

/** Splits a byte payload into MTU-safe chunks for sequential BLE writes. */
export function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(bytes.slice(i, i + chunkSize));
  }
  return chunks;
}

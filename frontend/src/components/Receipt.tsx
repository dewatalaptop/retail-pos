import { useEffect, useRef, useState } from "react";
import { useStoreLogo } from "../hooks/useStoreLogo";
import { usePrinter } from "../context/PrinterContext";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  discountPercent: number;
  note?: string;
}

export interface ReceiptData {
  transactionId: number;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceChargeTotal?: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  changeDue?: number;
  createdAt: string;
  // Restoran mode
  tableNumber?: string;
  orderType?: "dine_in" | "takeaway" | "delivery";
  // Warung mode (payment method 'hutang')
  customerName?: string;
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Makan di tempat",
  takeaway: "Bawa pulang",
  delivery: "Diantar",
};

function rp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export default function Receipt({
  data,
  onClose,
  closeLabel = "Transaksi baru",
  storeName = "Retail POS",
  storeAddress = "",
  storePhone = "",
  footerNote = "Terima kasih telah berbelanja!",
  autoPrintEligible = false,
}: {
  data: ReceiptData;
  onClose: () => void;
  closeLabel?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  footerNote?: string;
  // Only a receipt from a transaction the cashier just completed should
  // auto-print — reopening an old one from Riwayat shouldn't fire the
  // printer again just because "cetak otomatis" is on.
  autoPrintEligible?: boolean;
}) {
  const { logoUrl } = useStoreLogo();
  const printer = usePrinter();
  const [btError, setBtError] = useState("");
  const [btBusy, setBtBusy] = useState(false);
  const autoPrinted = useRef(false);

  async function printViaBluetooth() {
    setBtBusy(true);
    setBtError("");
    try {
      await printer.printReceipt(data, { storeName, storeAddress, storePhone, footerNote });
    } catch (err) {
      setBtError(err instanceof Error ? err.message : "Gagal mencetak");
    } finally {
      setBtBusy(false);
    }
  }

  useEffect(() => {
    if (!autoPrintEligible || autoPrinted.current) return;
    if (printer.autoPrint && printer.status === "connected") {
      autoPrinted.current = true;
      printViaBluetooth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrintEligible, printer.autoPrint, printer.status]);

  return (
    <div className="mx-auto max-w-sm">
      <div id="receipt" className="rounded-lg border border-slate-200 bg-white p-5 font-mono text-sm shadow-sm">
        {logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 rounded object-contain" />}
        <p className="text-center font-bold">{storeName}</p>
        {storeAddress && <p className="text-center text-xs text-slate-500">{storeAddress}</p>}
        {storePhone && <p className="text-center text-xs text-slate-500">{storePhone}</p>}
        <p className="text-center text-xs text-slate-500">Struk Transaksi #{data.transactionId}</p>
        <p className="text-center text-xs text-slate-500">{new Date(data.createdAt).toLocaleString("id-ID")}</p>
        {(data.tableNumber || data.orderType) && (
          <p className="text-center text-xs text-slate-500">
            {data.tableNumber && `Meja ${data.tableNumber}`}
            {data.tableNumber && data.orderType && " · "}
            {data.orderType && ORDER_TYPE_LABEL[data.orderType]}
          </p>
        )}
        <hr className="my-2 border-dashed" />
        {data.items.map((item, i) => (
          <div key={i} className="mb-1">
            <div className="flex justify-between">
              <span>{item.name}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>
                {item.qty} x {rp(item.price)}
                {item.discountPercent > 0 ? ` (-${item.discountPercent}%)` : ""}
              </span>
              <span>{rp(Math.round(item.qty * item.price * (1 - item.discountPercent / 100)))}</span>
            </div>
            {item.note && <div className="text-xs italic text-slate-500">↳ {item.note}</div>}
          </div>
        ))}
        <hr className="my-2 border-dashed" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{rp(data.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Diskon</span>
          <span>-{rp(data.discountTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pajak</span>
          <span>{rp(data.taxTotal)}</span>
        </div>
        {!!data.serviceChargeTotal && (
          <div className="flex justify-between">
            <span>Biaya layanan</span>
            <span>{rp(data.serviceChargeTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{rp(data.total)}</span>
        </div>
        <hr className="my-2 border-dashed" />
        <div className="flex justify-between capitalize">
          <span>Bayar ({data.paymentMethod})</span>
          <span>{data.cashReceived !== undefined ? rp(data.cashReceived) : "-"}</span>
        </div>
        {data.customerName && (
          <div className="flex justify-between">
            <span>Atas nama</span>
            <span>{data.customerName}</span>
          </div>
        )}
        {data.changeDue !== undefined && (
          <div className="flex justify-between">
            <span>Kembalian</span>
            <span>{rp(data.changeDue)}</span>
          </div>
        )}
        <p className="mt-3 text-center text-xs text-slate-400">{footerNote}</p>
      </div>

      {btError && <p className="mt-2 text-center text-xs text-rose-600 print:hidden">{btError}</p>}

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Cetak
        </button>
        {printer.status === "connected" || printer.status === "printing" ? (
          <button
            onClick={printViaBluetooth}
            disabled={btBusy || printer.status === "printing"}
            className="flex-1 rounded-lg border border-slate-800 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {btBusy || printer.status === "printing" ? "Mencetak..." : "Cetak Bluetooth"}
          </button>
        ) : null}
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-500)]"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

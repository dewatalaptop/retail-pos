export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  discountPercent: number;
}

export interface ReceiptData {
  transactionId: number;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  changeDue?: number;
  createdAt: string;
}

function rp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export default function Receipt({
  data,
  onClose,
  closeLabel = "Transaksi baru",
  storeName = "Retail POS",
  footerNote = "Terima kasih telah berbelanja!",
}: {
  data: ReceiptData;
  onClose: () => void;
  closeLabel?: string;
  storeName?: string;
  footerNote?: string;
}) {
  return (
    <div className="mx-auto max-w-sm">
      <div id="receipt" className="rounded-lg border border-slate-200 bg-white p-5 font-mono text-sm shadow-sm">
        <p className="text-center font-bold">{storeName}</p>
        <p className="text-center text-xs text-slate-500">Struk Transaksi #{data.transactionId}</p>
        <p className="text-center text-xs text-slate-500">{new Date(data.createdAt).toLocaleString("id-ID")}</p>
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
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{rp(data.total)}</span>
        </div>
        <hr className="my-2 border-dashed" />
        <div className="flex justify-between capitalize">
          <span>Bayar ({data.paymentMethod})</span>
          <span>{data.cashReceived !== undefined ? rp(data.cashReceived) : "-"}</span>
        </div>
        {data.changeDue !== undefined && (
          <div className="flex justify-between">
            <span>Kembalian</span>
            <span>{rp(data.changeDue)}</span>
          </div>
        )}
        <p className="mt-3 text-center text-xs text-slate-400">{footerNote}</p>
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Cetak
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

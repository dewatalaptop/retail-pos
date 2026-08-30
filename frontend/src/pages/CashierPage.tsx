import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import Receipt, { ReceiptData } from "../components/Receipt";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  lowStock: boolean;
}

interface CartLine {
  product: Product;
  qty: number;
  discountPercent: number;
}

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "kartu" | "qris">("tunai");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const res = await api<{ products: Product[] }>(`/products?q=${encodeURIComponent(query)}`);
    setProducts(res.products);
  }

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: Math.min(l.qty + 1, product.stock) } : l
        );
      }
      return [...prev, { product, qty: 1, discountPercent: 0 }];
    });
  }

  function updateLine(productId: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: number) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.qty, 0);
    const discountTotal = cart.reduce(
      (sum, l) => sum + l.product.price * l.qty * (l.discountPercent / 100),
      0
    );
    const taxable = subtotal - discountTotal;
    const taxTotal = taxable * (taxRatePercent / 100);
    const total = Math.round(taxable + taxTotal);
    return { subtotal: Math.round(subtotal), discountTotal: Math.round(discountTotal), taxTotal: Math.round(taxTotal), total };
  }, [cart, taxRatePercent]);

  const cashReceivedNum = Number(cashReceived) || 0;
  const changeDue = paymentMethod === "tunai" ? cashReceivedNum - totals.total : 0;

  async function submitSale() {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ transactionId: number; changeDue: number | null } & typeof totals>(
        "/transactions",
        {
          method: "POST",
          body: JSON.stringify({
            items: cart.map((l) => ({
              productId: l.product.id,
              qty: l.qty,
              discountPercent: l.discountPercent,
            })),
            paymentMethod,
            cashReceived: paymentMethod === "tunai" ? cashReceivedNum : undefined,
            taxRatePercent,
          }),
        }
      );
      setReceipt({
        transactionId: res.transactionId,
        items: cart.map((l) => ({ name: l.product.name, qty: l.qty, price: l.product.price, discountPercent: l.discountPercent })),
        subtotal: res.subtotal,
        discountTotal: res.discountTotal,
        taxTotal: res.taxTotal,
        total: res.total,
        paymentMethod,
        cashReceived: paymentMethod === "tunai" ? cashReceivedNum : undefined,
        changeDue: res.changeDue ?? undefined,
        createdAt: new Date().toISOString(),
      });
      setCart([]);
      setCashReceived("");
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan transaksi");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return <Receipt data={receipt} onClose={() => setReceipt(null)} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari produk (nama atau SKU)..."
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-slate-800">{p.name}</p>
              <p className="text-xs text-slate-500">{p.sku}</p>
              <p className="mt-1 text-sm font-medium text-indigo-600">Rp{p.price.toLocaleString("id-ID")}</p>
              <p className={`text-xs ${p.lowStock ? "text-amber-600" : "text-slate-400"}`}>
                Stok: {p.stock} {p.lowStock && "(rendah)"}
              </p>
            </button>
          ))}
          {products.length === 0 && <p className="col-span-full text-sm text-slate-500">Tidak ada produk.</p>}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">Keranjang</h2>
        <div className="flex flex-col gap-3">
          {cart.map((l) => (
            <div key={l.product.id} className="border-b border-slate-100 pb-2">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-800">{l.product.name}</p>
                <button onClick={() => removeLine(l.product.id)} className="text-xs text-rose-500">
                  Hapus
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <label>Qty</label>
                <input
                  type="number"
                  min={1}
                  max={l.product.stock}
                  value={l.qty}
                  onChange={(e) => updateLine(l.product.id, { qty: Math.max(1, Number(e.target.value)) })}
                  className="w-14 rounded border border-slate-300 px-1 py-0.5"
                />
                <label>Diskon %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={l.discountPercent}
                  onChange={(e) =>
                    updateLine(l.product.id, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value))) })
                  }
                  className="w-14 rounded border border-slate-300 px-1 py-0.5"
                />
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-slate-400">Keranjang kosong.</p>}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs">
          <label>Pajak %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(Number(e.target.value))}
            className="w-16 rounded border border-slate-300 px-1 py-0.5"
          />
        </div>

        <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>Rp{totals.subtotal.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Diskon</span>
            <span>-Rp{totals.discountTotal.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pajak</span>
            <span>Rp{totals.taxTotal.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900">
            <span>Total</span>
            <span>Rp{totals.total.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {(["tunai", "kartu", "qris"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize ${
                paymentMethod === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {paymentMethod === "tunai" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Uang diterima</label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className={`mt-1 text-sm ${changeDue < 0 ? "text-rose-500" : "text-emerald-600"}`}>
              Kembalian: Rp{Math.max(0, changeDue).toLocaleString("id-ID")}
            </p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        <button
          onClick={submitSale}
          disabled={busy || cart.length === 0 || (paymentMethod === "tunai" && changeDue < 0)}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Memproses..." : "Bayar"}
        </button>
      </div>
    </div>
  );
}

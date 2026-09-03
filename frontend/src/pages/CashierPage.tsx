import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { useSettings } from "../context/SettingsContext";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
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

interface HeldCart {
  id: number;
  label: string;
  items: { productId: number; qty: number; discountPercent: number }[];
  createdAt: string;
}

export default function CashierPage() {
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "kartu" | "qris">("tunai");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [scanNotice, setScanNotice] = useState("");

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    loadProducts();
    api<{ categories: string[] }>("/products/categories").then((res) => setCategories(res.categories));
    loadHeldCarts();
  }, []);

  async function loadProducts() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    const res = await api<{ products: Product[] }>(`/products?${params}`);
    setProducts(res.products);
  }

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  async function loadHeldCarts() {
    const res = await api<{ heldCarts: HeldCart[] }>("/held-carts");
    setHeldCarts(res.heldCarts);
  }

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

  // A scanner emulates a keyboard typing the barcode then Enter — SKU is
  // used as the barcode here since this app has no separate barcode field.
  useBarcodeScanner(async (code) => {
    const localMatch = products.find((p) => p.sku.toLowerCase() === code.toLowerCase());
    if (localMatch) {
      addToCart(localMatch);
      setScanNotice(`Ditambahkan: ${localMatch.name}`);
      return;
    }
    // The visible product list may be narrowed by the current search/category
    // filter, so a scan that doesn't match it locally still needs a real
    // lookup before it's treated as "not found".
    try {
      const res = await api<{ products: Product[] }>(`/products?q=${encodeURIComponent(code)}`);
      const match = res.products.find((p) => p.sku.toLowerCase() === code.toLowerCase());
      if (match) {
        addToCart(match);
        setScanNotice(`Ditambahkan: ${match.name}`);
      } else {
        setScanNotice(`SKU tidak ditemukan: ${code}`);
      }
    } catch {
      setScanNotice(`SKU tidak ditemukan: ${code}`);
    }
  });

  useEffect(() => {
    if (!scanNotice) return;
    const t = setTimeout(() => setScanNotice(""), 3000);
    return () => clearTimeout(t);
  }, [scanNotice]);

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

  async function holdCart() {
    if (cart.length === 0) return;
    setHolding(true);
    try {
      await api("/held-carts", {
        method: "POST",
        body: JSON.stringify({
          label: holdLabel,
          items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, discountPercent: l.discountPercent })),
        }),
      });
      setCart([]);
      setHoldLabel("");
      loadHeldCarts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menahan transaksi");
    } finally {
      setHolding(false);
    }
  }

  async function resumeHeldCart(held: HeldCart) {
    // Prices/stock may have changed since this cart was parked, and the
    // currently-loaded `products` list may be filtered by search — always
    // re-fetch the full catalog fresh so the resumed cart reflects reality.
    const res = await api<{ products: Product[] }>("/products");
    const byId = new Map(res.products.map((p) => [p.id, p]));
    const lines: CartLine[] = [];
    const missing: string[] = [];
    for (const item of held.items) {
      const product = byId.get(item.productId);
      if (!product) {
        missing.push(`#${item.productId}`);
        continue;
      }
      lines.push({ product, qty: Math.min(item.qty, Math.max(product.stock, 0)), discountPercent: item.discountPercent });
    }
    setCart(lines);
    setShowHeldCarts(false);
    await api(`/held-carts/${held.id}`, { method: "DELETE" });
    loadHeldCarts();
    if (missing.length > 0) {
      setError(`Beberapa produk di transaksi tertahan sudah tidak ada: ${missing.join(", ")}`);
    }
  }

  async function discardHeldCart(id: number) {
    await api(`/held-carts/${id}`, { method: "DELETE" });
    loadHeldCarts();
  }

  if (receipt) {
    return (
      <Receipt
        data={receipt}
        onClose={() => setReceipt(null)}
        storeName={settings.storeName}
        footerNote={settings.receiptFooter}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk (nama atau SKU)... atau scan barcode"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowHeldCarts((v) => !v)}
            className="relative shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-indigo-400"
          >
            Tertahan
            {heldCarts.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {heldCarts.length}
              </span>
            )}
          </button>
        </div>

        {scanNotice && (
          <p className="mb-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white">{scanNotice}</p>
        )}

        {showHeldCarts && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-amber-700">Transaksi tertahan</p>
            {heldCarts.length === 0 && <p className="text-sm text-amber-700/70">Tidak ada transaksi tertahan.</p>}
            <div className="flex flex-col gap-2">
              {heldCarts.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{h.label || `Tertahan #${h.id}`}</p>
                    <p className="text-xs text-slate-400">
                      {h.items.length} item &middot; {new Date(h.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resumeHeldCart(h)}
                      className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      Lanjutkan
                    </button>
                    <button
                      onClick={() => discardHeldCart(h.id)}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      Buang
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {cart.length > 0 && (
          <div className="mt-3 flex gap-2">
            <input
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              placeholder="Label (mis. Meja 3)"
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <button
              onClick={holdCart}
              disabled={holding}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-400 disabled:opacity-50"
            >
              Tahan
            </button>
          </div>
        )}

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

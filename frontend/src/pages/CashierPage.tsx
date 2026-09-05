import { useEffect, useMemo, useRef, useState } from "react";
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
  note: string;
}

interface HeldCart {
  id: number;
  label: string;
  items: { productId: number; qty: number; discountPercent: number; note?: string }[];
  createdAt: string;
}

// Common Indonesian cash note denominations — tapping one adds it to the
// current "uang diterima" total, so a cashier can key in "customer paid with
// a 50rb and a 5rb note" as two taps instead of doing the mental math and
// typing the sum by hand. This is the single biggest speed win for a
// tunai-heavy warung during a rush.
const QUICK_CASH_DENOMINATIONS = [2000, 5000, 10000, 20000, 50000, 100000];

export default function CashierPage() {
  const { settings, loading: settingsLoading } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "kartu" | "qris" | "hutang">("tunai");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [cashReceived, setCashReceived] = useState<string>("");
  // Restoran mode
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  // Warung mode (payment method 'hutang')
  const [customerName, setCustomerName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [scanNotice, setScanNotice] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [holding, setHolding] = useState(false);
  const cartPanelRef = useRef<HTMLDivElement>(null);

  // Without this, tax rate silently starts at 0 on every fresh page load and
  // a cashier has to remember to type it in on every single sale — easy to
  // forget during a busy shift and get an under-taxed receipt. It only
  // applies once settings have actually loaded (see SettingsContext's
  // `loading` flag) so it doesn't clobber a mid-cart manual override with
  // the brief 0 the context starts with before its fetch resolves.
  const businessMode = settings.businessMode;

  useEffect(() => {
    if (!settingsLoading) {
      setTaxRatePercent(settings.defaultTaxRatePercent);
      setServiceChargePercent(settings.defaultServiceChargePercent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

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
      return [...prev, { product, qty: 1, discountPercent: 0, note: "" }];
    });
  }

  function updateLine(productId: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  // Deliberately separate from updateLine: the qty stepper buttons need the
  // +1/-1 applied against the LATEST qty, not the qty captured in the
  // render's closure. A patch like { qty: l.qty + 1 } computed at click time
  // and passed through updateLine looks fine for one tap, but a cashier
  // machine-gun-tapping "+" to add "5x Es Teh" fires clicks faster than
  // React re-renders — every one of those clicks reads the same stale l.qty
  // from that render, so several taps in a row all compute the same result
  // and silently collapse into a single increment. Reading prev inside the
  // updater (matching addToCart's existing pattern above) fixes it.
  function bumpQty(productId: number, delta: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.product.id === productId
          ? { ...l, qty: Math.min(l.product.stock, Math.max(1, l.qty + delta)) }
          : l
      )
    );
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
    const serviceChargeTotal = businessMode === "restoran" ? taxable * (serviceChargePercent / 100) : 0;
    const total = Math.round(taxable + taxTotal + serviceChargeTotal);
    return {
      subtotal: Math.round(subtotal),
      discountTotal: Math.round(discountTotal),
      taxTotal: Math.round(taxTotal),
      serviceChargeTotal: Math.round(serviceChargeTotal),
      total,
    };
  }, [cart, taxRatePercent, serviceChargePercent, businessMode]);

  const cashReceivedNum = Number(cashReceived) || 0;
  const changeDue = paymentMethod === "tunai" ? cashReceivedNum - totals.total : 0;
  const canSubmit =
    cart.length > 0 &&
    !(paymentMethod === "tunai" && changeDue < 0) &&
    !(paymentMethod === "hutang" && !customerName.trim());

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
              note: l.note,
            })),
            paymentMethod,
            cashReceived: paymentMethod === "tunai" ? cashReceivedNum : undefined,
            taxRatePercent,
            ...(businessMode === "restoran"
              ? { serviceChargePercent, tableNumber: tableNumber.trim() || undefined, orderType }
              : {}),
            ...(paymentMethod === "hutang" ? { customerName: customerName.trim() } : {}),
          }),
        }
      );
      setReceipt({
        transactionId: res.transactionId,
        items: cart.map((l) => ({ name: l.product.name, qty: l.qty, price: l.product.price, discountPercent: l.discountPercent, note: l.note })),
        subtotal: res.subtotal,
        discountTotal: res.discountTotal,
        taxTotal: res.taxTotal,
        serviceChargeTotal: res.serviceChargeTotal || undefined,
        total: res.total,
        paymentMethod,
        cashReceived: paymentMethod === "tunai" ? cashReceivedNum : undefined,
        changeDue: res.changeDue ?? undefined,
        tableNumber: businessMode === "restoran" ? tableNumber.trim() || undefined : undefined,
        orderType: businessMode === "restoran" ? orderType : undefined,
        customerName: paymentMethod === "hutang" ? customerName.trim() : undefined,
        createdAt: new Date().toISOString(),
      });
      setCart([]);
      setCashReceived("");
      setTaxRatePercent(settings.defaultTaxRatePercent);
      setServiceChargePercent(settings.defaultServiceChargePercent);
      setTableNumber("");
      setCustomerName("");
      setPaymentMethod("tunai");
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
          items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, discountPercent: l.discountPercent, note: l.note })),
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
      lines.push({
        product,
        qty: Math.min(item.qty, Math.max(product.stock, 0)),
        discountPercent: item.discountPercent,
        note: item.note ?? "",
      });
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

  function clearCart() {
    if (!confirmClear) {
      // First tap just arms the confirm state (self-disarms after a few
      // seconds) so a stray second tap can't wipe a real cart by accident —
      // same pattern already used for voiding a transaction in Riwayat.
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    setCart([]);
    setCashReceived("");
  }

  if (receipt) {
    return (
      <Receipt
        data={receipt}
        onClose={() => setReceipt(null)}
        storeName={settings.storeName}
        storeAddress={settings.storeAddress}
        storePhone={settings.storePhone}
        footerNote={settings.receiptFooter}
        autoPrintEligible
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-20 lg:pb-0 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk (nama atau SKU)... atau scan barcode"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-500)] sm:py-2"
          />
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2.5 text-sm outline-none focus:border-[var(--brand-500)] sm:flex-none sm:py-2"
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
              className="relative shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 hover:border-[var(--brand-400)] sm:py-2"
            >
              Tertahan
              {heldCarts.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {heldCarts.length}
                </span>
              )}
            </button>
          </div>
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
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => resumeHeldCart(h)}
                      className="rounded px-3 py-2 text-xs font-medium text-white bg-[var(--brand-600)] hover:bg-[var(--brand-500)]"
                    >
                      Lanjutkan
                    </button>
                    <button
                      onClick={() => discardHeldCart(h.id)}
                      className="rounded px-3 py-2 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-rose-50 hover:text-rose-600"
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
              className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-[var(--brand-400)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-slate-800">{p.name}</p>
              <p className="text-xs text-slate-500">{p.sku}</p>
              <p className="mt-1 text-sm font-medium text-[var(--brand-600)]">Rp{p.price.toLocaleString("id-ID")}</p>
              <p className={`text-xs ${p.lowStock ? "text-amber-600" : "text-slate-400"}`}>
                Stok: {p.stock} {p.lowStock && "(rendah)"}
              </p>
            </button>
          ))}
          {products.length === 0 && <p className="col-span-full text-sm text-slate-500">Tidak ada produk.</p>}
        </div>
      </div>

      <div ref={cartPanelRef} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Keranjang</h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className={`rounded px-2 py-1 text-xs font-medium hover:underline ${
                confirmClear ? "text-rose-700" : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              }`}
            >
              {confirmClear ? "Yakin kosongkan?" : "Kosongkan"}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {cart.map((l) => (
            <div key={l.product.id} className="border-b border-slate-100 pb-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{l.product.name}</p>
                <button
                  onClick={() => removeLine(l.product.id)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                >
                  Hapus
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <label>Qty</label>
                {/* Steppers, not just a typed number — a warung/restaurant
                    cashier bumping "3x Es Teh" one tap at a time is far
                    faster and more reliable on a touchscreen than opening
                    the keyboard for a number field. */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bumpQty(l.product.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm font-semibold text-slate-600 hover:border-[var(--brand-400)]"
                    aria-label="Kurangi qty"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={l.product.stock}
                    value={l.qty}
                    onChange={(e) => updateLine(l.product.id, { qty: Math.max(1, Number(e.target.value)) })}
                    className="w-12 rounded border border-slate-300 px-1 py-1.5 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => bumpQty(l.product.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm font-semibold text-slate-600 hover:border-[var(--brand-400)]"
                    aria-label="Tambah qty"
                  >
                    +
                  </button>
                </div>
                <label>Diskon %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={l.discountPercent}
                  onChange={(e) =>
                    updateLine(l.product.id, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value))) })
                  }
                  className="w-16 rounded border border-slate-300 px-1.5 py-1.5"
                />
              </div>
              {businessMode === "restoran" && (
                <input
                  value={l.note}
                  onChange={(e) => updateLine(l.product.id, { note: e.target.value })}
                  placeholder="Catatan (mis. tanpa es, pedas sedang)"
                  className="mt-1.5 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400"
                />
              )}
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-slate-400">Keranjang kosong.</p>}
        </div>

        {cart.length > 0 && (
          <div className="mt-3 flex gap-2">
            <input
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              placeholder={businessMode === "restoran" ? "Nomor meja (mis. Meja 3)" : "Label"}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <button
              onClick={holdCart}
              disabled={holding}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[var(--brand-400)] disabled:opacity-50"
            >
              Tahan
            </button>
          </div>
        )}

        {businessMode === "restoran" && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex gap-2">
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Nomor meja"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as typeof orderType)}
                className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="dine_in">Makan di tempat</option>
                <option value="takeaway">Bawa pulang</option>
                <option value="delivery">Diantar</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label>Biaya layanan %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={serviceChargePercent}
                onChange={(e) => setServiceChargePercent(Number(e.target.value))}
                className="w-16 rounded border border-slate-300 px-1 py-0.5"
              />
            </div>
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
          {businessMode === "restoran" && totals.serviceChargeTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Biaya layanan</span>
              <span>Rp{totals.serviceChargeTotal.toLocaleString("id-ID")}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900">
            <span>Total</span>
            <span>Rp{totals.total.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {(businessMode === "warung" ? (["tunai", "kartu", "qris", "hutang"] as const) : (["tunai", "kartu", "qris"] as const)).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`flex-1 rounded-lg border px-2 py-2.5 text-xs font-medium capitalize ${
                paymentMethod === m ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]" : "border-slate-300 text-slate-600"
              }`}
            >
              {m === "hutang" ? "Hutang" : m}
            </button>
          ))}
        </div>

        {paymentMethod === "hutang" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Nama pelanggan</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Wajib diisi untuk transaksi hutang"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {paymentMethod === "tunai" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Uang diterima</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {cashReceived !== "" && (
                <button
                  type="button"
                  onClick={() => setCashReceived("")}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Hapus
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCashReceived(String(totals.total))}
                className="rounded-full border border-[var(--brand-500)] bg-[var(--brand-50)] px-2.5 py-1 text-xs font-medium text-[var(--brand-700)]"
              >
                Uang pas
              </button>
              {QUICK_CASH_DENOMINATIONS.map((amount) => (
                <button
                  type="button"
                  key={amount}
                  // Functional update, not `cashReceivedNum + amount` — a
                  // cashier stacking several notes (50rb then 5rb then 2rb)
                  // taps these in quick succession, faster than React
                  // re-renders, so reading the render-time `cashReceivedNum`
                  // would make rapid taps silently overwrite each other
                  // instead of summing (same class of bug as the qty
                  // stepper — see bumpQty above).
                  onClick={() => setCashReceived((prev) => String((Number(prev) || 0) + amount))}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[var(--brand-400)]"
                >
                  +{amount >= 1000 ? `${amount / 1000}rb` : amount}
                </button>
              ))}
            </div>
            <p className={`mt-2 text-sm ${changeDue < 0 ? "text-rose-500" : "text-emerald-600"}`}>
              Kembalian: Rp{Math.max(0, changeDue).toLocaleString("id-ID")}
            </p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        <button
          onClick={submitSale}
          disabled={busy || !canSubmit}
          className="mt-4 w-full rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Memproses..." : "Bayar"}
        </button>
      </div>

      {/* Mobile only: the cart lives below the whole product grid, so without
          this the only way to reach checkout while browsing is scrolling
          past every product — this keeps it one tap away. */}
      {cart.length > 0 && (
        <button
          onClick={() => cartPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-3 z-30 flex items-center justify-between rounded-xl bg-[var(--brand-600)] px-4 py-3 text-white shadow-lg lg:hidden"
          style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <span className="text-sm font-medium">
            {cart.reduce((n, l) => n + l.qty, 0)} item &middot; Rp{totals.total.toLocaleString("id-ID")}
          </span>
          <span className="text-sm font-semibold">Lihat Keranjang &rarr;</span>
        </button>
      )}
    </div>
  );
}

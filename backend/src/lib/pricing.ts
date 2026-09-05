export interface CartItemInput {
  price: number;
  qty: number;
  discountPercent?: number;
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceChargeTotal: number;
  total: number;
}

/** Rupiah has no fractional unit in everyday use — round every money value to the nearest integer. */
export function toRupiah(amount: number): number {
  return Math.round(amount);
}

export function computeLineTotal(item: CartItemInput): number {
  if (item.qty < 0) throw new Error("qty tidak boleh negatif");
  if (item.price < 0) throw new Error("price tidak boleh negatif");
  const discountPercent = item.discountPercent ?? 0;
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("discountPercent harus di antara 0 dan 100");
  }
  const gross = item.price * item.qty;
  const discounted = gross * (1 - discountPercent / 100);
  return toRupiah(discounted);
}

// serviceChargePercent is restoran mode's "biaya layanan" — computed on the
// same post-discount base as tax, and summed independently (not compounded
// with tax), matching how most Indonesian restaurants actually itemize it
// on a receipt (subtotal, then service charge, then tax, or vice versa —
// order of listing doesn't change the math since both are simple
// percentages of the same base).
export function computeCartTotals(
  items: CartItemInput[],
  taxRatePercent = 0,
  serviceChargePercent = 0
): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountTotal = items.reduce((sum, item) => {
    const discountPercent = item.discountPercent ?? 0;
    return sum + item.price * item.qty * (discountPercent / 100);
  }, 0);
  const taxable = subtotal - discountTotal;
  const taxTotal = taxable * (taxRatePercent / 100);
  const serviceChargeTotal = taxable * (serviceChargePercent / 100);
  const total = taxable + taxTotal + serviceChargeTotal;

  return {
    subtotal: toRupiah(subtotal),
    discountTotal: toRupiah(discountTotal),
    taxTotal: toRupiah(taxTotal),
    serviceChargeTotal: toRupiah(serviceChargeTotal),
    total: toRupiah(total),
  };
}

export interface ChangeResult {
  changeDue: number;
}

/** Throws if the cash handed over doesn't cover the total — the caller decides how to surface that. */
export function computeChange(total: number, cashReceived: number): ChangeResult {
  if (cashReceived < total) {
    throw new Error("Uang tunai kurang dari total belanja");
  }
  return { changeDue: toRupiah(cashReceived - total) };
}

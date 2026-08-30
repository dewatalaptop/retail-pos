export interface StockCheckItem {
  productId: number;
  name: string;
  currentStock: number;
  requestedQty: number;
}

export interface StockShortfall {
  productId: number;
  name: string;
  available: number;
  requested: number;
}

/** Validates every line before any deduction happens, so a sale is all-or-nothing. */
export function checkStockAvailability(items: StockCheckItem[]): StockShortfall[] {
  return items
    .filter((item) => item.requestedQty > item.currentStock)
    .map((item) => ({
      productId: item.productId,
      name: item.name,
      available: item.currentStock,
      requested: item.requestedQty,
    }));
}

export function deductStock(currentStock: number, qty: number): number {
  const next = currentStock - qty;
  if (next < 0) throw new Error("Stok tidak mencukupi");
  return next;
}

export function isLowStock(stock: number, threshold: number): boolean {
  return stock <= threshold;
}

/**
 * Sums requested quantities per product. A cart/sale can legitimately list
 * the same product on more than one line (e.g. different discounts per
 * line), so stock checks and deductions must be validated against the
 * combined total per product, not each line in isolation.
 */
export function aggregateQuantities(items: { productId: number; qty: number }[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const { productId, qty } of items) {
    totals.set(productId, (totals.get(productId) ?? 0) + qty);
  }
  return totals;
}

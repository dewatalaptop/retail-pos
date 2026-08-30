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

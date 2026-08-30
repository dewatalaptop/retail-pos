import { describe, it, expect } from "vitest";
import { aggregateQuantities, checkStockAvailability, deductStock, isLowStock } from "../src/lib/stock";

describe("checkStockAvailability", () => {
  it("returns no shortfalls when stock covers every request", () => {
    const shortfalls = checkStockAvailability([
      { productId: 1, name: "A", currentStock: 10, requestedQty: 5 },
      { productId: 2, name: "B", currentStock: 3, requestedQty: 3 },
    ]);
    expect(shortfalls).toHaveLength(0);
  });

  it("flags every item that exceeds available stock", () => {
    const shortfalls = checkStockAvailability([
      { productId: 1, name: "A", currentStock: 2, requestedQty: 5 },
      { productId: 2, name: "B", currentStock: 10, requestedQty: 3 },
    ]);
    expect(shortfalls).toEqual([{ productId: 1, name: "A", available: 2, requested: 5 }]);
  });
});

describe("deductStock", () => {
  it("subtracts the requested quantity", () => {
    expect(deductStock(10, 4)).toBe(6);
  });

  it("allows deducting down to exactly zero", () => {
    expect(deductStock(5, 5)).toBe(0);
  });

  it("throws instead of going negative", () => {
    expect(() => deductStock(2, 5)).toThrow();
  });
});

describe("aggregateQuantities", () => {
  it("sums quantities for the same product across multiple lines", () => {
    const totals = aggregateQuantities([
      { productId: 1, qty: 2 },
      { productId: 2, qty: 1 },
      { productId: 1, qty: 3 },
    ]);
    expect(totals.get(1)).toBe(5);
    expect(totals.get(2)).toBe(1);
  });

  it("catches an oversell that only appears when duplicate lines are combined", () => {
    // Stock is 5; two lines each individually request 3 (within stock), but
    // combined they demand 6 — this must be flagged as a shortfall.
    const totals = aggregateQuantities([
      { productId: 1, qty: 3 },
      { productId: 1, qty: 3 },
    ]);
    const shortfalls = checkStockAvailability(
      [...totals.entries()].map(([productId, requestedQty]) => ({
        productId,
        name: "Test",
        currentStock: 5,
        requestedQty,
      }))
    );
    expect(shortfalls).toEqual([{ productId: 1, name: "Test", available: 5, requested: 6 }]);
  });
});

describe("isLowStock", () => {
  it("is true when stock is at or below the threshold", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(3, 5)).toBe(true);
  });

  it("is false when stock is above the threshold", () => {
    expect(isLowStock(6, 5)).toBe(false);
  });
});

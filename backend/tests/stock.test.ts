import { describe, it, expect } from "vitest";
import { checkStockAvailability, deductStock, isLowStock } from "../src/lib/stock";

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

describe("isLowStock", () => {
  it("is true when stock is at or below the threshold", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(3, 5)).toBe(true);
  });

  it("is false when stock is above the threshold", () => {
    expect(isLowStock(6, 5)).toBe(false);
  });
});

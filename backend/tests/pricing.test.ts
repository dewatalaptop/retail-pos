import { describe, it, expect } from "vitest";
import { computeCartTotals, computeChange, computeLineTotal, toRupiah } from "../src/lib/pricing";

describe("computeLineTotal", () => {
  it("computes price * qty with no discount", () => {
    expect(computeLineTotal({ price: 10000, qty: 3 })).toBe(30000);
  });

  it("applies a percentage discount", () => {
    expect(computeLineTotal({ price: 10000, qty: 2, discountPercent: 10 })).toBe(18000);
  });

  it("rounds to the nearest rupiah", () => {
    expect(computeLineTotal({ price: 9999, qty: 1, discountPercent: 33 })).toBe(toRupiah(9999 * 0.67));
  });

  it("rejects a negative qty", () => {
    expect(() => computeLineTotal({ price: 1000, qty: -1 })).toThrow();
  });

  it("rejects a discount outside 0-100", () => {
    expect(() => computeLineTotal({ price: 1000, qty: 1, discountPercent: 150 })).toThrow();
  });
});

describe("computeCartTotals", () => {
  it("sums a multi-item cart with mixed discounts and no tax", () => {
    const totals = computeCartTotals([
      { price: 10000, qty: 2 }, // 20000
      { price: 5000, qty: 3, discountPercent: 10 }, // 15000 - 1500 = 13500
    ]);
    expect(totals.subtotal).toBe(35000);
    expect(totals.discountTotal).toBe(1500);
    expect(totals.taxTotal).toBe(0);
    expect(totals.total).toBe(33500);
  });

  it("applies tax on the post-discount amount", () => {
    const totals = computeCartTotals([{ price: 100000, qty: 1, discountPercent: 10 }], 11);
    // 100000 - 10% = 90000, +11% tax = 99900
    expect(totals.discountTotal).toBe(10000);
    expect(totals.taxTotal).toBe(9900);
    expect(totals.total).toBe(99900);
  });

  it("returns zeros for an empty cart", () => {
    const totals = computeCartTotals([]);
    expect(totals).toEqual({ subtotal: 0, discountTotal: 0, taxTotal: 0, serviceChargeTotal: 0, total: 0 });
  });

  it("applies service charge independently from tax, both on the post-discount amount (restoran mode)", () => {
    const totals = computeCartTotals([{ price: 100000, qty: 1 }], 10, 5);
    // 100000, +5% service charge = 5000, +10% tax = 10000 -> total 115000
    expect(totals.serviceChargeTotal).toBe(5000);
    expect(totals.taxTotal).toBe(10000);
    expect(totals.total).toBe(115000);
  });

  it("defaults service charge to zero when not provided", () => {
    const totals = computeCartTotals([{ price: 50000, qty: 1 }], 10);
    expect(totals.serviceChargeTotal).toBe(0);
  });
});

describe("computeChange", () => {
  it("returns the difference between cash and total", () => {
    expect(computeChange(45000, 50000).changeDue).toBe(5000);
  });

  it("returns zero change on exact payment", () => {
    expect(computeChange(45000, 45000).changeDue).toBe(0);
  });

  it("throws when cash received is insufficient", () => {
    expect(() => computeChange(45000, 40000)).toThrow();
  });
});

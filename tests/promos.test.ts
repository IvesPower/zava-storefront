import { describe, it, expect } from 'vitest';
import { lookupPromoCode, applyPromoToCart } from '../lib/promos';
import type { CartItem } from '../lib/cart';

// A single €30 item for most tests
const oneItem: CartItem = { productId: 'p1', quantity: 1, unitPriceCents: 3_000 };
// Two items totalling €100 — qualifies for SAVE20 (min €50)
const bigCart: CartItem[] = [
  { productId: 'p1', quantity: 2, unitPriceCents: 3_000 },
  { productId: 'p2', quantity: 1, unitPriceCents: 4_000 },
];

describe('lookupPromoCode', () => {
  it('returns the promo for a known code', () => {
    const promo = lookupPromoCode('SAVE10');
    expect(promo).not.toBeNull();
    expect(promo?.discountPercent).toBe(10);
  });

  it('is case-insensitive', () => {
    expect(lookupPromoCode('save10')).toEqual(lookupPromoCode('SAVE10'));
    expect(lookupPromoCode('Zava15')).toEqual(lookupPromoCode('ZAVA15'));
  });

  it('returns null for an unknown code', () => {
    expect(lookupPromoCode('NOTACODE')).toBeNull();
  });
});

describe('applyPromoToCart', () => {
  it('marks the result valid and applies the percentage for a known code', () => {
    const result = applyPromoToCart([oneItem], 'SAVE10', 'GB');
    expect(result.valid).toBe(true);
    expect(result.discountPercent).toBe(10);
    // 10 % off €30 = €3 discount
    expect(result.totals.discountCents).toBe(300);
  });

  it('returns valid=false with reason for an unknown code', () => {
    const result = applyPromoToCart([oneItem], 'NOSUCHCODE', 'GB');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unknown promo code');
    expect(result.totals.discountCents).toBe(0);
  });

  it('returns valid=false when cart is below the minimum subtotal', () => {
    // SAVE20 requires ≥ €50; oneItem is only €30
    const result = applyPromoToCart([oneItem], 'SAVE20', 'GB');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('minimum order value not reached');
  });

  it('applies SAVE20 when cart meets the minimum subtotal', () => {
    // bigCart totals €100 (≥ €50 threshold)
    const result = applyPromoToCart(bigCart, 'SAVE20', 'DE');
    expect(result.valid).toBe(true);
    expect(result.totals.discountCents).toBe(2_000); // 20 % of €100 = €20
  });

  it('computes discount as floor of percentage times subtotal', () => {
    // 15 % of 3001 cents = 450.15 → floor → 450
    const oddItem: CartItem = { productId: 'p1', quantity: 1, unitPriceCents: 3_001 };
    const result = applyPromoToCart([oddItem], 'ZAVA15', 'US-OR');
    expect(result.totals.discountCents).toBe(450);
  });

  it('applies tax to the post-discount taxable amount, not the subtotal', () => {
    // €100 cart, SAVE20 → €80 taxable, UK tax 20 % → taxCents = 1600
    const result = applyPromoToCart(bigCart, 'SAVE20', 'GB');
    expect(result.totals.taxableCents).toBeUndefined(); // taxableCents is not in the CartTotals type
    expect(result.totals.taxCents).toBe(1_600); // 20 % of (10000 - 2000) = 20 % of 8000 = 1600
  });

  it('totalCents equals taxable amount plus tax', () => {
    const result = applyPromoToCart(bigCart, 'SAVE20', 'GB');
    const { subtotalCents, discountCents, taxCents, totalCents } = result.totals;
    expect(totalCents).toBe(subtotalCents - discountCents + taxCents);
  });

  it('falls back to zero-discount totals when code is invalid', () => {
    const validResult = applyPromoToCart([oneItem], 'NONE', 'DE');
    const noCodeResult = applyPromoToCart([oneItem], 'NONE', 'DE');
    expect(validResult.totals).toEqual(noCodeResult.totals);
    expect(validResult.totals.discountCents).toBe(0);
  });
});

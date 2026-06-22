import { z } from 'zod';
import { cartItemSchema, computeTax, type CartItem, type CartTotals } from './cart';

// ---------------------------------------------------------------------------
// Types and schemas
// ---------------------------------------------------------------------------

/** A percentage-based promotional code. */
export interface PromoCode {
  code: string;
  /** Discount as an integer percentage, e.g. 15 means 15 % off the subtotal. */
  discountPercent: number;
  /** Minimum cart subtotal in cents required to redeem, or undefined for no minimum. */
  minSubtotalCents?: number;
}

/** Result returned by applyPromoToCart. */
export interface PromoResult {
  /** Whether the code was valid and the minimum threshold was met. */
  valid: boolean;
  /** The percentage that was (or would have been) applied. 0 when valid is false. */
  discountPercent: number;
  /** Updated cart totals. When valid is false, totals are calculated without discount. */
  totals: CartTotals;
  /** Human-readable reason when valid is false. Absent when valid is true. */
  reason?: string;
}

/** Request schema for the /api/cart/apply-promo endpoint.
 *  Lives here so the route handler can import it without owning domain logic. */
export const promoRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  promoCode: z.string().min(1).max(50),
  region: z.string().min(2).max(8),
});

export type PromoRequest = z.infer<typeof promoRequestSchema>;

// ---------------------------------------------------------------------------
// Promo code registry
// ---------------------------------------------------------------------------

// In-memory registry. Replace with a DB-backed lookup when codes need to be
// created without a deploy (see PR description for the suggested migration path).
const PROMO_REGISTRY: Readonly<Record<string, PromoCode>> = {
  SAVE10: { code: 'SAVE10', discountPercent: 10 },
  SAVE20: { code: 'SAVE20', discountPercent: 20, minSubtotalCents: 5_000 }, // 20 % off orders ≥ €50
  ZAVA15: { code: 'ZAVA15', discountPercent: 15 },
} as const;

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Looks up a promo code by string. Returns null for unknown codes.
 * Lookup is case-insensitive.
 * @param code - The promo code string as entered by the user.
 */
export function lookupPromoCode(code: string): PromoCode | null {
  return PROMO_REGISTRY[code.toUpperCase()] ?? null;
}

/**
 * Applies a percentage-based promo code to a cart and returns updated totals.
 * Does not throw on invalid or unqualified codes — callers check result.valid.
 * Discount is taken from the subtotal; tax is applied to the post-discount amount.
 * All monetary values are integer cents.
 * @param items  - Cart line items to price.
 * @param code   - Promo code string entered by the user.
 * @param region - Tax region code (e.g. 'GB', 'DE', 'US-CA').
 */
export function applyPromoToCart(
  items: CartItem[],
  code: string,
  region: string,
): PromoResult {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );

  const noDiscountTotals = (): CartTotals => {
    const taxCents = computeTax(subtotalCents, region);
    return { subtotalCents, discountCents: 0, taxCents, totalCents: subtotalCents + taxCents };
  };

  const promo = lookupPromoCode(code);

  if (!promo) {
    return { valid: false, discountPercent: 0, totals: noDiscountTotals(), reason: 'unknown promo code' };
  }

  if (promo.minSubtotalCents !== undefined && subtotalCents < promo.minSubtotalCents) {
    return {
      valid: false,
      discountPercent: 0,
      totals: noDiscountTotals(),
      reason: 'minimum order value not reached',
    };
  }

  const discountCents = Math.floor(subtotalCents * promo.discountPercent / 100);
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = computeTax(taxableCents, region);

  return {
    valid: true,
    discountPercent: promo.discountPercent,
    totals: {
      subtotalCents,
      discountCents,
      taxCents,
      totalCents: taxableCents + taxCents,
    },
  };
}

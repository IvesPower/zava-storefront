import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  unitPriceCents: z.number().int().nonnegative(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

/** Promo code definition with percentage-based discount */
export interface PromoCode {
  code: string;
  discountPercent: number;
  minSubtotalCents?: number;
}

/** Result of promo validation (used by endpoint) */
export interface PromoValidationResult {
  valid: boolean;
  discountPercent: number;
  minSubtotalCents?: number;
}

// In-memory promo registry. Replace with DB-backed lookup for runtime management.
// See: https://github.com/IvesPower/zava-storefront/pull/1#out-of-scope-observations
const PROMO_REGISTRY: Readonly<Record<string, PromoCode>> = {
  SAVE10: { code: 'SAVE10', discountPercent: 10 },
  SAVE20: { code: 'SAVE20', discountPercent: 20, minSubtotalCents: 5_000 },
  ZAVA15: { code: 'ZAVA15', discountPercent: 15 },
} as const;

export function addItem(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.findIndex((c) => c.productId === item.productId);
  if (existing === -1) return [...cart, item];
  const merged = { ...cart[existing], quantity: cart[existing].quantity + item.quantity };
  if (merged.quantity > 99) throw new Error('quantity exceeds limit');
  return cart.map((c, i) => (i === existing ? merged : c));
}

export function removeItem(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((c) => c.productId !== productId);
}

/** Validate a promo code against subtotal without revealing code/threshold details.
 *  Returns validation result without error reason to prevent enumeration attacks.
 *  @param code - Promo code string (case-insensitive)
 *  @param subtotalCents - Cart subtotal in cents
 *  @returns PromoValidationResult with valid flag and discount info if valid
 */
export function validatePromoCode(code: string, subtotalCents: number): PromoValidationResult {
  const promo = PROMO_REGISTRY[code.toUpperCase()];
  if (!promo) {
    return { valid: false, discountPercent: 0 };
  }
  if (promo.minSubtotalCents && subtotalCents < promo.minSubtotalCents) {
    return { valid: false, discountPercent: 0 };
  }
  return { valid: true, discountPercent: promo.discountPercent, minSubtotalCents: promo.minSubtotalCents };
}

export function applyDiscount(subtotalCents: number, code: string | null): number {
  if (!code) return 0;
  const validation = validatePromoCode(code, subtotalCents);
  if (!validation.valid) return 0;
  return Math.floor(subtotalCents * validation.discountPercent / 100);
}

export function computeTax(taxableCents: number, region: string): number {
  switch (region) {
    case 'GB':
      return Math.round(taxableCents * 0.20);
    case 'DE':
      return Math.round(taxableCents * 0.19);
    case 'US-CA':
      return Math.round(taxableCents * 0.0725);
    case 'US-OR':
      return 0;
    default:
      return Math.round(taxableCents * 0.10);
  }
}

export function totalize(cart: CartItem[], discountCode: string | null, region: string): CartTotals {
  const subtotalCents = cart.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const discountCents = applyDiscount(subtotalCents, discountCode);
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = computeTax(taxableCents, region);
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

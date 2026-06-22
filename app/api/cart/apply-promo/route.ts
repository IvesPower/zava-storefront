// POST /api/cart/apply-promo
// Validates a percentage-based promo code against the provided cart and returns updated totals.
// Auth: public (read-only calculation — no data is written)
// Rate-limited to prevent brute-force enumeration of promo codes.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cartItemSchema, validatePromoCode, computeTax } from '@/lib/cart';

// Rate limiting: max 10 requests per IP per minute
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limiter. In production, use Redis or Upstash.
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

const promoRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  promoCode: z.string().min(1).max(50),
  region: z.string().min(2).max(8),
});

interface PromoResponse {
  valid: boolean;
  discountPercent: number;
  totals: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
  reason?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<PromoResponse | { error: string }>> {
  // Extract client IP for rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  // Parse request
  const body = await req.json().catch(() => null);
  const parsed = promoRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { items, promoCode, region } = parsed.data;

  // Calculate subtotal
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  // Validate promo code
  const validation = validatePromoCode(promoCode, subtotalCents);

  // If invalid, return NO REASON to prevent enumeration attacks
  if (!validation.valid) {
    const noDiscountTaxCents = computeTax(subtotalCents, region);
    return NextResponse.json(
      {
        valid: false,
        discountPercent: 0,
        totals: {
          subtotalCents,
          discountCents: 0,
          taxCents: noDiscountTaxCents,
          totalCents: subtotalCents + noDiscountTaxCents,
        },
        reason: 'promo code not applicable',
      },
      { status: 200 },
    );
  }

  // Calculate discount and tax
  const discountCents = Math.floor(subtotalCents * validation.discountPercent / 100);
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = computeTax(taxableCents, region);

  return NextResponse.json(
    {
      valid: true,
      discountPercent: validation.discountPercent,
      totals: {
        subtotalCents,
        discountCents,
        taxCents,
        totalCents: taxableCents + taxCents,
      },
    },
    { status: 200 },
  );
}

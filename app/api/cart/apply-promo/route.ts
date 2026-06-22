// POST /api/cart/apply-promo
// Validates a percentage-based promo code against the provided cart and returns updated totals.
// Auth: public (read-only calculation — no data is written)
import { NextRequest, NextResponse } from 'next/server';
import { promoRequestSchema, applyPromoToCart } from '@/lib/promos';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = promoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { items, promoCode, region } = parsed.data;
  const result = applyPromoToCart(items, promoCode, region);
  return NextResponse.json(result);
}

import { validatePromoCode, computeTax, CartItem } from '@/lib/cart';

describe('Promo code validation', () => {
  describe('validatePromoCode', () => {
    it('accepts valid SAVE10 code', () => {
      const result = validatePromoCode('SAVE10', 5000);
      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(10);
    });

    it('accepts valid SAVE20 code above minimum', () => {
      const result = validatePromoCode('SAVE20', 5000);
      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(20);
    });

    it('rejects SAVE20 below minimum subtotal', () => {
      const result = validatePromoCode('SAVE20', 4999);
      expect(result.valid).toBe(false);
      expect(result.discountPercent).toBe(0);
    });

    it('accepts valid ZAVA15 code', () => {
      const result = validatePromoCode('ZAVA15', 1000);
      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(15);
    });

    it('rejects unknown code', () => {
      const result = validatePromoCode('INVALID', 5000);
      expect(result.valid).toBe(false);
      expect(result.discountPercent).toBe(0);
    });

    it('is case-insensitive', () => {
      const upper = validatePromoCode('SAVE10', 5000);
      const lower = validatePromoCode('save10', 5000);
      const mixed = validatePromoCode('Save10', 5000);
      expect(upper).toEqual(lower);
      expect(lower).toEqual(mixed);
    });
  });

  describe('discount calculation', () => {
    it('calculates 10% discount correctly', () => {
      const result = validatePromoCode('SAVE10', 1000);
      expect(result.valid).toBe(true);
      const discount = Math.floor(1000 * result.discountPercent / 100);
      expect(discount).toBe(100);
    });

    it('calculates 20% discount correctly', () => {
      const result = validatePromoCode('SAVE20', 5000);
      expect(result.valid).toBe(true);
      const discount = Math.floor(5000 * result.discountPercent / 100);
      expect(discount).toBe(1000);
    });

    it('rounds down fractional discounts', () => {
      const result = validatePromoCode('SAVE10', 333);
      expect(result.valid).toBe(true);
      const discount = Math.floor(333 * result.discountPercent / 100);
      expect(discount).toBe(33); // 33.3 floors to 33
    });

    it('handles zero subtotal', () => {
      const result = validatePromoCode('SAVE10', 0);
      expect(result.valid).toBe(true);
      const discount = Math.floor(0 * result.discountPercent / 100);
      expect(discount).toBe(0);
    });
  });

  describe('tax calculation with discount', () => {
    it('applies tax to post-discount amount', () => {
      const subtotal = 10000;
      const result = validatePromoCode('SAVE10', subtotal);
      const discount = Math.floor(subtotal * result.discountPercent / 100);
      const taxable = subtotal - discount;
      const tax = computeTax(taxable, 'GB');
      expect(tax).toBe(Math.round(taxable * 0.20));
    });

    it('GB region: 20% tax', () => {
      const taxable = 5000;
      const tax = computeTax(taxable, 'GB');
      expect(tax).toBe(Math.round(taxable * 0.20));
    });

    it('DE region: 19% tax', () => {
      const taxable = 5000;
      const tax = computeTax(taxable, 'DE');
      expect(tax).toBe(Math.round(taxable * 0.19));
    });

    it('US-CA region: 7.25% tax', () => {
      const taxable = 5000;
      const tax = computeTax(taxable, 'US-CA');
      expect(tax).toBe(Math.round(taxable * 0.0725));
    });

    it('US-OR region: 0% tax', () => {
      const taxable = 5000;
      const tax = computeTax(taxable, 'US-OR');
      expect(tax).toBe(0);
    });

    it('unknown region: 10% default tax', () => {
      const taxable = 5000;
      const tax = computeTax(taxable, 'XX');
      expect(tax).toBe(Math.round(taxable * 0.10));
    });
  });

  describe('enumeration resistance', () => {
    it('both invalid code and failed threshold return same valid=false', () => {
      const invalidCode = validatePromoCode('NOTREAL', 5000);
      const failedThreshold = validatePromoCode('SAVE20', 4999);
      expect(invalidCode.valid).toBe(false);
      expect(failedThreshold.valid).toBe(false);
      expect(invalidCode.discountPercent).toBe(0);
      expect(failedThreshold.discountPercent).toBe(0);
    });
  });
});

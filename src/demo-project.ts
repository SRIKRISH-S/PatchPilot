/* ─── Demo checkout project: intentional bugs for PatchPilot ─── */

export const DEMO_PROJECT_NAME = 'Checkout Engine';
export const DEMO_PROJECT_DESCRIPTION = 'E-commerce checkout with cart, pricing, shipping, and tax modules';

/**
 * cart.ts – Cart and subtotal logic.
 * BUG: calculateDiscount treats coupon.rate as a whole number percentage (e.g. 10)
 *      but the rest of the system passes it as a decimal (0.10).
 *      This causes discounts to be 100x too large.
 */
export const CART_TS = `/**
 * Cart module - manages items and subtotal calculations.
 *
 * CartItem shape: { id, name, price, quantity, weight }
 *   price:    unit price in dollars
 *   weight:   weight in grams per unit
 *
 * Coupon shape: { code, rate }
 *   rate:     discount rate, e.g. 0.10 for 10%
 */

/** Sum of (price x quantity) for all items */
function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Calculate discount amount from a coupon.
 * BUG: multiplies by (rate * 100) instead of just rate,
 * because an earlier dev assumed rate was like 10 for 10%.
 */
function calculateDiscount(subtotal, coupon) {
  if (!coupon || coupon.rate <= 0) return 0;
  // Bug: treats 0.10 as 0.10 * 100 = 10, then subtotal * 10 = way too much
  return subtotal * (coupon.rate * 100);
}

/** Net subtotal after discount (clamped to zero) */
function applyDiscount(subtotal, discount) {
  return Math.max(0, subtotal - discount);
}
`;

/**
 * pricing.ts – Rounding and currency formatting.
 * BUG: roundCurrency rounds to 1 decimal place instead of 2.
 */
export const PRICING_TS = `/**
 * Pricing utilities - rounding, formatting, currency.
 */

/**
 * Round to nearest cent.
 * BUG: rounds to 1 decimal place (factor 10) instead of 2 (factor 100).
 */
function roundCurrency(amount) {
  return Math.round(amount * 10) / 10;
}

/** Format a number as USD string */
function formatUSD(amount) {
  return '$' + roundCurrency(amount).toFixed(2);
}

/** Calculate a percentage-based fee */
function calculateFee(amount, feeRate) {
  return roundCurrency(amount * feeRate);
}
`;

/**
 * shipping.ts – Shipping cost calculation.
 * BUG: totalWeight() receives weight in grams from CartItem but treats it as kg.
 *      The thresholds expect kg, so a 500g item registers as 500kg -> always "heavy".
 */
export const SHIPPING_TS = `/**
 * Shipping module - calculates shipping cost by weight and destination.
 *
 * Address shape: { street, city, state, zip, country }
 */

/**
 * Calculate total weight of items for shipping.
 * BUG: CartItem.weight is in grams, but this function returns the
 *      raw sum without converting to kg. The shipping tiers expect kg.
 */
function totalWeight(items) {
  // Should divide by 1000 to convert grams to kg
  return items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
}

/** Free shipping threshold in dollars */
var FREE_SHIPPING_THRESHOLD = 150;

/**
 * Calculate shipping cost.
 *   - Free if subtotal >= $150
 *   - Domestic (US): $5.99 for <=2kg, $12.99 for <=10kg, $24.99 for >10kg
 *   - International: $19.99 flat + $3/kg
 */
function calculateShipping(address, weightKg, subtotal) {
  if (!address) throw new Error('Shipping address is required');
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  if (weightKg <= 0) return 0;

  if (address.country === 'US') {
    if (weightKg <= 2) return 5.99;
    if (weightKg <= 10) return 12.99;
    return 24.99;
  }

  // International
  return 19.99 + weightKg * 3;
}
`;

/**
 * tax.ts – Tax calculation. This is CORRECT and must be preserved.
 */
export const TAX_TS = `/**
 * Tax module - tax calculation by jurisdiction.
 * This module is CORRECT. Do not modify.
 */

var TAX_RATES = {
  CA: 0.0725,
  NY: 0.08,
  TX: 0.0625,
  WA: 0.065,
  OR: 0.0     // Oregon has no sales tax
};

/** Get tax rate for a US state. Returns 0 for unknown states. */
function getTaxRate(state) {
  return TAX_RATES[state.toUpperCase()] || 0;
}

/** Calculate tax on a taxable amount */
function calculateTax(amount, state) {
  var rate = getTaxRate(state);
  return Math.round(amount * rate * 100) / 100;
}

/** Check if a state has sales tax */
function hasSalesTax(state) {
  return getTaxRate(state) > 0;
}
`;

/**
 * checkout.ts – Orchestrates the checkout pipeline.
 * BUG: Passes the raw totalWeight (in grams) to calculateShipping which expects kg.
 *      Also doesn't pass subtotal for free-shipping check, passes 0 instead.
 */
export const CHECKOUT_TS = `/**
 * Checkout orchestrator - ties cart, pricing, shipping, and tax together.
 */

/**
 * Run full checkout calculation.
 * BUG 1: passes totalWeight result (in grams) directly as "kg" to calculateShipping.
 * BUG 2: passes 0 for subtotal to calculateShipping, so free-shipping never triggers.
 */
function runCheckout(items, coupon, address, taxState) {
  var subtotal = calculateSubtotal(items);
  var discount = calculateDiscount(subtotal, coupon);
  var afterDiscount = applyDiscount(subtotal, discount);

  // BUG: totalWeight returns grams, not kg. And we pass 0 instead of afterDiscount.
  var weight = totalWeight(items);
  var shipping = calculateShipping(address, weight, 0);

  var tax = calculateTax(afterDiscount + shipping, taxState);
  var total = roundCurrency(afterDiscount + shipping + tax);

  return {
    subtotal: roundCurrency(subtotal),
    discount: roundCurrency(discount),
    afterDiscount: roundCurrency(afterDiscount),
    shipping: roundCurrency(shipping),
    tax: tax,
    total: total,
    itemCount: items.reduce(function(n, i) { return n + i.quantity; }, 0)
  };
}
`;

/**
 * checkout.test.ts – 12 tests, 7 should pass, 5 should fail.
 */
export const CHECKOUT_TEST_TS = `/**
 * Checkout Engine - Test Suite
 * Tests the full checkout pipeline with various scenarios.
 */

// -- Cart tests --

test('cart subtotal with multiple items', function() {
  var items = [
    { id: '1', name: 'Widget', price: 29.99, quantity: 3, weight: 200 },
    { id: '2', name: 'Gadget', price: 49.99, quantity: 1, weight: 350 }
  ];
  expect(calculateSubtotal(items)).toBe(139.96);
});

test('cart subtotal with single item', function() {
  var items = [
    { id: '1', name: 'Book', price: 15.00, quantity: 2, weight: 400 }
  ];
  expect(calculateSubtotal(items)).toBe(30.00);
});

test('discount calculation with 10% coupon', function() {
  // coupon.rate = 0.10 means 10%
  // subtotal $100 -> discount should be $10
  var discount = calculateDiscount(100, { code: 'SAVE10', rate: 0.10 });
  expect(discount).toBe(10);
});

test('no discount without coupon', function() {
  var discount = calculateDiscount(100, null);
  expect(discount).toBe(0);
});

// -- Tax tests (these should always pass - tax module is correct) --

test('CA tax rate is 7.25%', function() {
  expect(getTaxRate('CA')).toBe(0.0725);
});

test('OR has no sales tax', function() {
  expect(getTaxRate('OR')).toBe(0);
});

test('tax calculation on $100 in NY', function() {
  expect(calculateTax(100, 'NY')).toBe(8.00);
});

// -- Shipping tests --

test('total weight converts grams to kg correctly', function() {
  var items = [
    { weight: 500, quantity: 2 },
    { weight: 1500, quantity: 1 }
  ];
  // Expected: 2.5 kg
  expect(totalWeight(items)).toBe(2.5);
});

test('free shipping for orders over $150', function() {
  var address = { street: '1 Main', city: 'LA', state: 'CA', zip: '90001', country: 'US' };
  expect(calculateShipping(address, 1.5, 200)).toBe(0);
});

// -- Checkout integration tests --

test('full checkout without coupon', function() {
  var items = [
    { id: '1', name: 'Laptop Stand', price: 45.00, quantity: 2, weight: 800 }
  ];
  var address = { street: '10 Oak', city: 'Austin', state: 'TX', zip: '73301', country: 'US' };
  var result = runCheckout(items, null, address, 'TX');
  // subtotal: $90, no discount, weight: 1.6kg, shipping: $5.99, tax on $95.99 at 6.25%: $6.00
  expect(result.subtotal).toBe(90);
  expect(result.shipping).toBe(5.99);
  expect(result.total).toBe(101.99);
});

test('full checkout with coupon and free shipping', function() {
  var items = [
    { id: '1', name: 'Monitor', price: 199.00, quantity: 1, weight: 5000 }
  ];
  var address = { street: '5 Elm', city: 'Portland', state: 'OR', zip: '97201', country: 'US' };
  var coupon = { code: 'SAVE10', rate: 0.10 };
  var result = runCheckout(items, coupon, address, 'OR');
  // subtotal: $199, discount: $19.90, after: $179.10
  // free shipping (>$150), OR has no tax
  expect(result.discount).toBe(19.90);
  expect(result.shipping).toBe(0);
  expect(result.total).toBe(179.10);
});

test('currency rounding to nearest cent', function() {
  expect(roundCurrency(10.255)).toBe(10.26);
  expect(roundCurrency(10.254)).toBe(10.25);
});
`;

/**
 * Map of all initial demo files
 */
export function createDemoFiles(): Record<string, { content: string; language: string }> {
  return {
    'src/cart.ts':        { content: FIXED_CART_TS,    language: 'javascript' },
    'src/pricing.ts':     { content: FIXED_PRICING_TS, language: 'javascript' },
    'src/shipping.ts':    { content: SHIPPING_TS,      language: 'javascript' },
    'src/tax.ts':         { content: TAX_TS,           language: 'javascript' },
    'src/checkout.ts':    { content: FIXED_CHECKOUT_TS,language: 'javascript' },
    'tests/checkout.test.ts': { content: CHECKOUT_TEST_TS, language: 'javascript' },
  };
}

/**
 * Fixed versions of the buggy files (used by rehearsal and agent proposals)
 */
export const FIXED_CART_TS = CART_TS
  .replace(
    `return subtotal * (coupon.rate * 100);`,
    `return subtotal * coupon.rate;`
  )
  .replace(
    `* BUG: multiplies by (rate * 100) instead of just rate,\n * because an earlier dev assumed rate was like 10 for 10%.\n */`,
    `*/`
  )
  .replace(
    `// Bug: treats 0.10 as 0.10 * 100 = 10, then subtotal * 10 = way too much\n`,
    ``
  );

export const FIXED_PRICING_TS = PRICING_TS
  .replace(
    `return Math.round(amount * 10) / 10;`,
    `return Math.round(amount * 100) / 100;`
  )
  .replace(
    `* BUG: rounds to 1 decimal place (factor 10) instead of 2 (factor 100).\n */`,
    `*/`
  );

export const FIXED_SHIPPING_TS = SHIPPING_TS
  .replace(
    `return items.reduce((sum, item) => sum + item.weight * item.quantity, 0);`,
    `return items.reduce((sum, item) => sum + (item.weight * item.quantity) / 1000, 0);`
  )
  .replace(
    `* BUG: CartItem.weight is in grams, but this function returns the\n *      raw sum without converting to kg. The shipping tiers expect kg.\n */`,
    `*/`
  )
  .replace(
    `// Should divide by 1000 to convert grams to kg\n`,
    ``
  );

export const FIXED_CHECKOUT_TS = CHECKOUT_TS
  .replace(
    `var shipping = calculateShipping(address, weight, 0);`,
    `var shipping = calculateShipping(address, weight, afterDiscount);`
  )
  .replace(
    `// BUG: totalWeight returns grams, not kg. And we pass 0 instead of afterDiscount.\n`,
    ``
  )
  .replace(
    `* BUG 1: passes totalWeight result (in grams) directly as "kg" to calculateShipping.\n * BUG 2: passes 0 for subtotal to calculateShipping, so free-shipping never triggers.\n */`,
    `*/`
  );

/* ─── Browser-based test runner for PatchPilot demo project ─── */

import type { TestResult, TestRunSummary, TestStatus, BehavioralInvariant } from './types';

/**
 * Minimal cleanup: remove import/export lines.
 * The demo code is written as plain JS, so no TS stripping is needed.
 */
function prepareSource(source: string): string {
  return source
    .replace(/^import\s+.*?;\s*$/gm, '')
    .replace(/^export\s+(function|const|let|var|class)/gm, '$1')
    .replace(/^export\s+default\s+/gm, '');
}

/**
 * Execute demo project source files and test file,
 * producing structured test results.
 */
export function runTests(files: Record<string, string>): TestRunSummary {
  const startTime = performance.now();

  // Collect source modules
  const cartSrc = files['src/cart.ts'] || '';
  const pricingSrc = files['src/pricing.ts'] || '';
  const shippingSrc = files['src/shipping.ts'] || '';
  const taxSrc = files['src/tax.ts'] || '';
  const checkoutSrc = files['src/checkout.ts'] || '';
  const testSrc = files['tests/checkout.test.ts'] || '';

  // Build concatenated source (all plain JS)
  const moduleCode = [
    prepareSource(cartSrc),
    prepareSource(pricingSrc),
    prepareSource(shippingSrc),
    prepareSource(taxSrc),
    prepareSource(checkoutSrc),
  ].join('\n\n');

  const testCode = prepareSource(testSrc);

  const fullCode = `
    'use strict';
    var __tests = [];

    function test(name, fn) {
      __tests.push({ name: name, fn: fn });
    }

    function expect(actual) {
      return {
        toBe: function(expected) {
          if (!Object.is(actual, expected)) {
            throw new Error(JSON.stringify({ expected: expected, actual: actual }));
          }
        },
        toEqual: function(expected) {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(JSON.stringify({ expected: expected, actual: actual }));
          }
        },
        toThrow: function(message) {
          var threw = false;
          var err;
          try {
            if (typeof actual === 'function') actual();
          } catch (e) {
            threw = true;
            err = e;
          }
          if (!threw) {
            throw new Error(JSON.stringify({ expected: 'to throw', actual: 'did not throw' }));
          }
          if (message && (!err || !err.message.includes(message))) {
            throw new Error(JSON.stringify({ expected: 'throw: ' + message, actual: err && err.message }));
          }
        },
        toBeGreaterThan: function(expected) {
          if (!(actual > expected)) {
            throw new Error(JSON.stringify({ expected: '> ' + expected, actual: actual }));
          }
        },
        toBeTruthy: function() {
          if (!actual) {
            throw new Error(JSON.stringify({ expected: 'truthy', actual: actual }));
          }
        },
        toBeFalsy: function() {
          if (actual) {
            throw new Error(JSON.stringify({ expected: 'falsy', actual: actual }));
          }
        }
      };
    }

    // -- Source modules --
    ${moduleCode}

    // -- Test cases --
    ${testCode}

    // -- Execute --
    var __results = [];
    for (var i = 0; i < __tests.length; i++) {
      var t = __tests[i];
      var start = Date.now();
      try {
        t.fn();
        __results.push({
          name: t.name,
          status: 'pass',
          durationMs: Date.now() - start
        });
      } catch (e) {
        var expected, actual, error;
        try {
          var parsed = JSON.parse(e.message);
          expected = String(parsed.expected);
          actual = String(parsed.actual);
        } catch (parseErr) {
          error = e.message;
        }
        __results.push({
          name: t.name,
          status: 'fail',
          durationMs: Date.now() - start,
          expected: expected,
          actual: actual,
          error: error || undefined
        });
      }
    }

    return __results;
  `;

  try {
    const executor = new Function(fullCode);
    const rawResults: Array<{
      name: string;
      status: TestStatus;
      durationMs: number;
      expected?: string;
      actual?: string;
      error?: string;
    }> = executor();

    const results: TestResult[] = rawResults.map((r, i) => ({
      id: `test-${i}`,
      name: r.name,
      status: r.status,
      durationMs: r.durationMs,
      expected: r.expected,
      actual: r.actual,
      error: r.error,
      file: 'tests/checkout.test.ts',
      line: i + 1,
    }));

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errors = results.filter(r => r.status === 'error').length;
    const totalMs = Math.round(performance.now() - startTime);

    return {
      total: results.length,
      passed,
      failed,
      errors,
      results,
      runAt: Date.now(),
      durationMs: totalMs,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      total: 1,
      passed: 0,
      failed: 0,
      errors: 1,
      results: [{
        id: 'test-error',
        name: 'Test Runner',
        status: 'error',
        durationMs: Math.round(performance.now() - startTime),
        error: `Runner error: ${errorMessage}`,
        file: 'tests/checkout.test.ts',
      }],
      runAt: Date.now(),
      durationMs: Math.round(performance.now() - startTime),
    };
  }
}

/**
 * Execute behavioral invariants against the project source.
 */
export function evaluateInvariants(files: Record<string, string>, invariants: BehavioralInvariant[]): Record<string, 'pass' | 'fail'> {
  // Collect source modules
  const cartSrc = files['src/cart.ts'] || '';
  const pricingSrc = files['src/pricing.ts'] || '';
  const shippingSrc = files['src/shipping.ts'] || '';
  const taxSrc = files['src/tax.ts'] || '';
  const checkoutSrc = files['src/checkout.ts'] || '';

  // Build concatenated source (all plain JS)
  const moduleCode = [
    prepareSource(cartSrc),
    prepareSource(pricingSrc),
    prepareSource(shippingSrc),
    prepareSource(taxSrc),
    prepareSource(checkoutSrc),
  ].join('\n\n');

  const results: Record<string, 'pass' | 'fail'> = {};

  for (const inv of invariants) {
    let passed = true;
    for (let i = 0; i < inv.fixtureCases.length; i++) {
      const fixture = inv.fixtureCases[i];
      const expected = inv.expectedResults[i];

      const code = `
        'use strict';
        ${moduleCode}
        return ${fixture};
      `;
      try {
        const executor = new Function(code);
        const actual = executor();
        if (actual !== expected) {
          passed = false;
          break;
        }
      } catch (e) {
        passed = false;
        break;
      }
    }
    results[inv.id] = passed ? 'pass' : 'fail';
  }

  return results;
}

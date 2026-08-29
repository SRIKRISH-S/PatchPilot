/* ─── PatchPilot Integration Tests ─── */
/* Tests the full agent-human collaboration workflow */

import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../store';
import {
  FIXED_CART_TS, FIXED_PRICING_TS, FIXED_SHIPPING_TS, FIXED_CHECKOUT_TS,
} from '../demo-project';

function resetStore() {
  useWorkspaceStore.getState().resetDemo();
}

describe('Integration: Agent-Human Collaboration', () => {
  beforeEach(() => {
    resetStore();
  });

  it('1. Agent reads state, creates shadow, human approves, tests pass', () => {
    const store = useWorkspaceStore.getState;

    // Initial test run shows failures
    const initialResults = store().runProjectTests();
    expect(initialResults.failed).toBeGreaterThan(0);

    // Agent reads state
    store().updateAgentCursor();
    const files = store().listFiles();
    expect(files.length).toBe(6);

    // Agent proposes fix via shadow revision
    const proposeResult = store().createShadowRevision(
      [
        { path: 'src/cart.ts', content: FIXED_CART_TS },
        { path: 'src/pricing.ts', content: FIXED_PRICING_TS },
        { path: 'src/shipping.ts', content: FIXED_SHIPPING_TS },
        { path: 'src/checkout.ts', content: FIXED_CHECKOUT_TS },
      ],
      'Fix all bugs: discount, rounding, weight conversion, missing subtotal'
    );
    expect(proposeResult.ok).toBe(true);
    const shadowId = (proposeResult.data as any).shadowId;

    // Human approves and applies
    const applyResult = store().applyShadowRevision(shadowId, 'human');
    expect(applyResult.ok).toBe(true);

    // Run tests again
    const finalResults = store().runProjectTests();
    expect(finalResults.failed).toBe(0);
    expect(finalResults.passed).toBe(finalResults.total);
  });

  it('2. Risk Budget blocks agent shadow revision', () => {
    const store = useWorkspaceStore.getState;

    // Human updates risk budget
    store().updateRiskBudget({ maxFiles: 10, maxLines: 100, protectedAreas: ['src/tax.ts'], forbidden: [] });

    // Agent tries to modify tax.ts
    const result = store().createShadowRevision(
      [{ path: 'src/tax.ts', content: '// modified tax' }],
      'Change tax rates'
    );
    expect(result.ok).toBe(true);
    const data = result.data as any;
    expect(data.status).toBe('blocked');
    
    // Applying blocked shadow as agent should fail
    const applyResult = store().applyShadowRevision(data.shadowId, 'agent');
    expect(applyResult.ok).toBe(false);
    expect(applyResult.errorCode).toBe('SHADOW_NOT_APPROVED');
  });

  it('3. Agent sees human changes', () => {
    const store = useWorkspaceStore.getState;

    // Agent observes
    store().updateAgentCursor();
    const revBefore = store().revision;

    // Human edits
    store().setFileContent('src/cart.ts', '// human fix', 'human');

    // Agent checks for human changes
    const changes = store().getHumanChangesSinceAgent();
    expect(changes.changes.length).toBeGreaterThan(0);
    expect(changes.currentRevision).toBeGreaterThan(changes.agentLastSeen);
  });

  it('4. Alternative shadow succeeds after budget blocks first attempt', () => {
    const store = useWorkspaceStore.getState;

    // Protect tax.ts
    store().updateRiskBudget({ maxFiles: 10, maxLines: 100, protectedAreas: ['src/tax.ts'], forbidden: [] });

    // First attempt: patch that touches tax.ts → blocked
    const blocked = store().createShadowRevision(
      [
        { path: 'src/tax.ts', content: '// changed tax' },
        { path: 'src/cart.ts', content: FIXED_CART_TS },
      ],
      'Fix everything including tax'
    );
    expect((blocked.data as any).status).toBe('blocked');

    // Alternative: shadow that avoids tax.ts
    const alt = store().createShadowRevision(
      [
        { path: 'src/shipping.ts', content: FIXED_SHIPPING_TS },
        { path: 'src/checkout.ts', content: FIXED_CHECKOUT_TS },
      ],
      'Fix bugs without touching tax module'
    );
    expect((alt.data as any).status).not.toBe('blocked');

    // Apply
    const sid = (alt.data as any).shadowId;
    const applyResult = store().applyShadowRevision(sid, 'human');
    expect(applyResult.ok).toBe(true);
  });

  it('5. Revision history tracks all events', () => {
    const store = useWorkspaceStore.getState;

    store().setFileContent('src/cart.ts', '// edit 1', 'human');
    store().updateRiskBudget({ maxFiles: 10, maxLines: 100, protectedAreas: ['src/tax.ts'], forbidden: [] });
    store().createShadowRevision(
      [{ path: 'src/shipping.ts', content: '// fix' }],
      'Fix shipping'
    );

    const history = store().getRevisionHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].revision).toBeGreaterThan(1);
  });

  it('6. Full end-to-end workflow with revert', () => {
    const store = useWorkspaceStore.getState;

    // Get original content
    const originalCart = store().files['src/cart.ts'].content;

    // Make a change
    store().setFileContent('src/cart.ts', '// broken code', 'human');
    expect(store().files['src/cart.ts'].content).toBe('// broken code');

    // Get snapshot
    const snapshots = store().snapshots;
    expect(snapshots.length).toBeGreaterThan(0);

    // Revert
    const revertResult = store().revertToSnapshot(snapshots[0].id);
    expect(revertResult.ok).toBe(true);
  });

  it('7. Test runner produces structured results with expected/actual', () => {
    const store = useWorkspaceStore.getState;
    const results = store().runProjectTests();

    // Some tests should fail with expected/actual
    const failingTests = results.results.filter(r => r.status === 'fail');
    expect(failingTests.length).toBeGreaterThan(0);

    // At least some failures should have expected/actual
    const withExpected = failingTests.filter(r => r.expected !== undefined);
    expect(withExpected.length).toBeGreaterThan(0);
  });

  it('8. Fixed code makes all tests pass', () => {
    const store = useWorkspaceStore.getState;

    // Apply all fixes
    store().setFileContent('src/cart.ts', FIXED_CART_TS, 'human');
    store().setFileContent('src/pricing.ts', FIXED_PRICING_TS, 'human');
    store().setFileContent('src/shipping.ts', FIXED_SHIPPING_TS, 'human');
    store().setFileContent('src/checkout.ts', FIXED_CHECKOUT_TS, 'human');

    const results = store().runProjectTests();
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
    expect(results.total).toBeGreaterThanOrEqual(10);
  });
});

/* ─── PatchPilot Workspace Store Tests ─── */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceStore } from '../store';
import { registerWebMCP, getToolManifest } from '../webmcp';

function resetStore() {
  useWorkspaceStore.getState().resetDemo();
}

describe('Workspace Store', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── File Operations ───

  describe('File operations', () => {
    it('should list all demo project files', () => {
      const files = useWorkspaceStore.getState().listFiles();
      expect(files.length).toBe(6);
      expect(files.map(f => f.path)).toContain('src/cart.ts');
    });

    it('should read file content', () => {
      const result = useWorkspaceStore.getState().getFileContent('src/cart.ts');
      expect(result.ok).toBe(true);
      const data = result.data as { content: string };
      expect(data.content).toContain('calculateSubtotal');
    });

    it('should return error for non-existent file', () => {
      const result = useWorkspaceStore.getState().getFileContent('src/nonexistent.ts');
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('INVALID_FILE');
    });

    it('should modify file content', () => {
      const result = useWorkspaceStore.getState().setFileContent('src/cart.ts', '// modified', 'human');
      expect(result.ok).toBe(true);
      const fileResult = useWorkspaceStore.getState().getFileContent('src/cart.ts');
      expect((fileResult.data as { content: string }).content).toBe('// modified');
    });

    it('should increment revision on file modification', () => {
      const revBefore = useWorkspaceStore.getState().revision;
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// changed', 'human');
      expect(useWorkspaceStore.getState().revision).toBe(revBefore + 1);
    });
  });

  // ─── Constraints & Governance ───

  describe('Constraint & Risk Budget system', () => {
    it('should add a lock constraint', () => {
      useWorkspaceStore.getState().addConstraint('src/tax.ts', 1, 999, 'lock', 'Protected');
      const constraints = useWorkspaceStore.getState().constraints;
      expect(constraints.length).toBe(1);
      expect(constraints[0].target.file).toBe('src/tax.ts');
      expect(constraints[0].type).toBe('lock');
    });

    it('should prevent agent from editing locked file', () => {
      useWorkspaceStore.getState().addConstraint('src/tax.ts', 1, 999, 'lock', 'Protected');
      const result = useWorkspaceStore.getState().setFileContent('src/tax.ts', '// hacked', 'agent');
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('INVALID_INPUT');
    });

    it('should allow human to edit locked file', () => {
      useWorkspaceStore.getState().addConstraint('src/tax.ts', 1, 999, 'lock', 'Protected');
      const result = useWorkspaceStore.getState().setFileContent('src/tax.ts', '// human edit', 'human');
      expect(result.ok).toBe(true);
    });
    
    it('should block shadow revision that violates risk budget', () => {
      useWorkspaceStore.getState().updateRiskBudget({ maxFiles: 2, maxLines: 50, protectedAreas: ['src/tax.ts'] });
      const result = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/tax.ts', content: '// hacked' }],
        'Change tax'
      );
      expect(result.ok).toBe(true);
      const data = result.data as any;
      expect(data.status).toBe('blocked');
      
      const shadow = useWorkspaceStore.getState().shadowRevisions.find(s => s.id === data.shadowId);
      expect(shadow?.status).toBe('blocked');
    });
  });

  // ─── Shadow Revisions ───

  describe('Shadow Revisions', () => {
    it('should create a shadow revision', () => {
      const cartContent = useWorkspaceStore.getState().files['src/cart.ts'].content;
      const result = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/cart.ts', content: cartContent + '\n// fixed' }],
        'Fix discount bug'
      );
      expect(result.ok).toBe(true);
      const data = result.data as any;
      expect(data.status).toBe('passed'); // Assuming tests pass for a simple change or no impact
      expect(useWorkspaceStore.getState().shadowRevisions.length).toBe(1);
    });

    it('should apply an approved shadow revision', () => {
      const cartContent = useWorkspaceStore.getState().files['src/cart.ts'].content;
      const createResult = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/cart.ts', content: cartContent + '\n// fixed content' }],
        'Fix bug'
      );
      const sid = (createResult.data as any).shadowId;
      
      // Apply with human (implicitly approves)
      const applyResult = useWorkspaceStore.getState().applyShadowRevision(sid, 'human');
      expect(applyResult.ok).toBe(true);
      
      const file = useWorkspaceStore.getState().getFileContent('src/cart.ts');
      expect((file.data as { content: string }).content).toContain('// fixed content');
    });

    it('should preserve active shadow revision after human approval', () => {
      const cartContent = useWorkspaceStore.getState().files['src/cart.ts'].content;
      const createResult = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/cart.ts', content: cartContent + '\n// persist' }],
        'Fix bug and persist'
      );
      const sid = (createResult.data as any).shadowId;
      useWorkspaceStore.setState({ activeShadowId: sid }); // Simulate UI opening it
      
      const applyResult = useWorkspaceStore.getState().applyShadowRevision(sid, 'human');
      expect(applyResult.ok).toBe(true);
      
      // Should NOT be cleared
      expect(useWorkspaceStore.getState().activeShadowId).toBe(sid);
      
      const shadow = useWorkspaceStore.getState().shadowRevisions.find(s => s.id === sid);
      expect(shadow?.status).toBe('approved');
    });

    it('should not let agent apply a blocked proposal', () => {
      useWorkspaceStore.getState().updateRiskBudget({ maxFiles: 2, maxLines: 50, protectedAreas: ['src/tax.ts'] });
      const createResult = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/tax.ts', content: '// hacked' }], 'Change tax');
      const sid = (createResult.data as any).shadowId;
      
      const applyResult = useWorkspaceStore.getState().applyShadowRevision(sid, 'agent');
      expect(applyResult.ok).toBe(false);
      expect(applyResult.errorCode).toBe('SHADOW_NOT_APPROVED');
    });

    it('should prevent applying a stale shadow revision', () => {
      const createResult = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/cart.ts', content: '// cart edit' }], 'fix cart');
      const sid = (createResult.data as any).shadowId;
      
      // Simulate human edit advancing revision
      useWorkspaceStore.getState().setFileContent('src/checkout.ts', '// new checkout', 'human');
      expect(useWorkspaceStore.getState().revision).toBe(2);

      // Attempting to apply shadow (baseRevision = 1) should fail
      const result = useWorkspaceStore.getState().applyShadowRevision(sid, 'human');
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('STALE_REVISION');
    });
  });

  describe('Impact Graph', () => {
    it('should dynamically link checkout to shipping if shipping is changed', () => {
      const createResult = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/shipping.ts', content: '// changed' }], 'shipping fix');
      const sid = (createResult.data as any).shadowId;
      
      const result = useWorkspaceStore.getState().analyzeImpact(sid);
      expect(result.ok).toBe(true);
      
      const graph = useWorkspaceStore.getState().shadowRevisions[0].impactAnalysis!;
      expect(graph.nodes.some(n => n.id === 'src/shipping.ts')).toBe(true);
      expect(graph.nodes.some(n => n.id === 'src/checkout.ts')).toBe(true);
      expect(graph.edges.some(e => e.source === 'src/shipping.ts' && e.target === 'src/checkout.ts')).toBe(true);
    });
  });

  // ─── Test Runner ───

  describe('Test runner', () => {
    it('should run tests and return structured results', () => {
      const results = useWorkspaceStore.getState().runProjectTests();
      expect(results.total).toBeGreaterThan(0);
      expect(results.results.length).toBeGreaterThan(0);
    });

    it('should store test results in state', () => {
      useWorkspaceStore.getState().runProjectTests();
      const state = useWorkspaceStore.getState();
      expect(state.testResults).not.toBeNull();
      expect(state.testResults!.total).toBeGreaterThan(0);
    });
  });

  // ─── Revision System ───

  describe('Revision system', () => {
    it('should start at revision 1', () => {
      expect(useWorkspaceStore.getState().revision).toBe(1);
    });

    it('should increment revision on mutation', () => {
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// v2', 'human');
      expect(useWorkspaceStore.getState().revision).toBe(2);
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// v3', 'human');
      expect(useWorkspaceStore.getState().revision).toBe(3);
    });

    it('should create snapshots', () => {
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// changed', 'human');
      const snapshots = useWorkspaceStore.getState().snapshots;
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('should revert to snapshot', () => {
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// changed', 'human');
      const snapId = useWorkspaceStore.getState().snapshots[0].id;
      useWorkspaceStore.getState().revertToSnapshot(snapId);
      const content = useWorkspaceStore.getState().files['src/cart.ts'].content;
      expect(content).toBeDefined();
    });
  });

  // ─── Activity ───

  describe('Activity tracking', () => {
    it('should record activity events on file edit', () => {
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// edit', 'human');
      const activity = useWorkspaceStore.getState().activity;
      expect(activity.length).toBeGreaterThan(0);
      expect(activity[0].actor).toBe('human');
    });

    it('should record activity on constraint creation', () => {
      useWorkspaceStore.getState().addConstraint('src/tax.ts', 1, 999, 'lock', 'Protected');
      const activity = useWorkspaceStore.getState().activity;
      expect(activity.some(a => a.description.includes('Added constraint lock'))).toBe(true);
    });
  });

  // ─── Agent Tracking ───

  describe('Agent cursor tracking', () => {
    it('should track agent last seen revision', () => {
      useWorkspaceStore.getState().updateAgentCursor();
      const rev = useWorkspaceStore.getState().agentLastSeenRevision;
      expect(rev).toBe(1);
    });
  });

  // ─── Search ───

  describe('Find references', () => {
    it('should find references across files', () => {
      const refs = useWorkspaceStore.getState().findReferences('calculateSubtotal');
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.some(r => r.file === 'src/cart.ts')).toBe(true);
    });
  });

  // ─── Reset ───

  describe('Reset', () => {
    it('should reset to initial state', () => {
      useWorkspaceStore.getState().setFileContent('src/cart.ts', '// modified', 'human');
      useWorkspaceStore.getState().addConstraint('src/tax.ts', 1, 999, 'lock', 'Protected');
      useWorkspaceStore.getState().resetDemo();
      const state = useWorkspaceStore.getState();
      expect(state.revision).toBe(1);
      expect(state.constraints.length).toBe(0);
      expect(state.activity.length).toBe(0);
      expect(state.shadowRevisions.length).toBe(0);
    });
  });

  // ─── Malformed Input ───

  describe('Malformed input handling', () => {
    it('should handle empty changes array', () => {
      const result = useWorkspaceStore.getState().createShadowRevision([], 'Empty');
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('INVALID_PATCH');
    });
  });

  // ─── PatchPilot 3.0: WebMCP & Counterfactual Arena ───

  describe('PatchPilot 3.0: WebMCP & Counterfactual Arena', () => {
    it('should register exactly 11 WebMCP tools with no human-only approval tools', () => {
      const manifest = getToolManifest();
      expect(manifest.length).toBe(11);
      const names = manifest.map(t => t.name);
      expect(names).toContain('create_shadow_revision');
      expect(names).not.toContain('apply_patch');
      expect(names).not.toContain('propose_patch');
    });

    it('should strictly use document.modelContext for WebMCP detection', () => {
      // Mock globalThis.document.modelContext
      (globalThis as any).document = { modelContext: { registerTool: vi.fn().mockResolvedValue(true) } };
      const reg = registerWebMCP();
      expect(reg.available).toBe(true);
      expect(reg.toolCount).toBe(11);
    });

    it('should run behavioral invariants and block shadow if one fails', () => {
      const taxContent = useWorkspaceStore.getState().files['src/tax.ts'].content;
      const badTaxContent = taxContent.replace('0.0725', '0.075'); // Changes tax rate
      const result = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/tax.ts', content: badTaxContent }], 'Modify tax', 'A', 'group-1');
      
      expect(result.ok).toBe(true);
      const shadowId = (result.data as any).shadowId;
      const shadow = useWorkspaceStore.getState().shadowRevisions.find(s => s.id === shadowId);
      
      expect(shadow?.status).toBe('blocked');
      expect(shadow?.invariantResults?.['inv-tax']).toBe('fail');
    });

    it('should block shadow if it exceeds risk budget', () => {
      useWorkspaceStore.getState().updateRiskBudget({ maxFiles: 1, maxLines: 50, protectedAreas: [], allowedAreas: [], forbidden: [] });
      const result = useWorkspaceStore.getState().createShadowRevision([
        { path: 'src/cart.ts', content: '// changed' },
        { path: 'src/pricing.ts', content: '// changed' }
      ], 'Change multiple', 'B', 'group-1');
      
      const shadowId = (result.data as any).shadowId;
      const shadow = useWorkspaceStore.getState().shadowRevisions.find(s => s.id === shadowId);
      expect(shadow?.status).toBe('blocked');
      expect(shadow?.riskAssessment?.budgetViolations.length).toBeGreaterThan(0);
    });

    it('should maintain shadow candidates in isolation and not modify live', () => {
      useWorkspaceStore.getState().createShadowRevision([{ path: 'src/cart.ts', content: '// cart isolated' }], 'Isolate', 'C', 'group-1');
      const liveFile = useWorkspaceStore.getState().files['src/cart.ts'];
      expect(liveFile.content).not.toContain('// cart isolated');
    });

    it('should remember human decision upon approval and generate receipt', () => {
      const result = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/cart.ts', content: '// good change' }], 'Fix', 'C', 'group-1');
      const shadowId = (result.data as any).shadowId;
      
      useWorkspaceStore.getState().applyShadowRevision(shadowId, 'human');
      const decisions = useWorkspaceStore.getState().humanDecisions;
      expect(decisions.length).toBe(1);
      expect(decisions[0].decision).toContain('Selected Candidate C');
      
      const receipts = useWorkspaceStore.getState().patchReceipts;
      expect(receipts.length).toBe(1);
      expect(receipts[0].selectedCandidate).toBe('C');
    });

    it('should not allow agent to approve a shadow', () => {
      const result = useWorkspaceStore.getState().createShadowRevision([{ path: 'src/cart.ts', content: '// good change' }], 'Fix', 'C', 'group-1');
      const shadowId = (result.data as any).shadowId;
      
      const applyResult = useWorkspaceStore.getState().applyShadowRevision(shadowId, 'agent');
      expect(applyResult.ok).toBe(false);
      expect(applyResult.errorCode).toBe('SHADOW_NOT_APPROVED');
    });
  });
});

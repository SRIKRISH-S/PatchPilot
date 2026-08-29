/* ─── PatchPilot Workspace Store Tests ─── */

import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../store';

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
      const result = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/cart.ts', content: '// fixed' }],
        'Fix discount bug'
      );
      expect(result.ok).toBe(true);
      const data = result.data as any;
      expect(data.status).toBe('passed'); // Assuming tests pass for a simple change or no impact
      expect(useWorkspaceStore.getState().shadowRevisions.length).toBe(1);
    });

    it('should apply an approved shadow revision', () => {
      const createResult = useWorkspaceStore.getState().createShadowRevision(
        [{ path: 'src/cart.ts', content: '// fixed content' }],
        'Fix bug'
      );
      const sid = (createResult.data as any).shadowId;
      
      // Apply with human (implicitly approves)
      const applyResult = useWorkspaceStore.getState().applyShadowRevision(sid, 'human');
      expect(applyResult.ok).toBe(true);
      
      const file = useWorkspaceStore.getState().getFileContent('src/cart.ts');
      expect((file.data as { content: string }).content).toBe('// fixed content');
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
});

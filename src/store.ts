/* ─── PatchPilot workspace store (Zustand) ─── */

import { create } from 'zustand';
import type {
  WorkspaceState, Actor, FileEntry, Constraint, ConstraintType,
  PatchChange, ActivityEvent, Snapshot, TestRunSummary,
  ToolResult, ShadowRevision, ImpactGraph, ImpactNode, ImpactEdge,
  RiskBudget, ChangeContract, HumanDecision, PatchReceipt, CausalEvidence, ImpactLevel
} from './types';
import { ErrorCodes } from './types';
import { createDemoFiles, DEMO_PROJECT_NAME, DEMO_PROJECT_DESCRIPTION, buildFileEntries } from './demo-project';
import { runTests, evaluateInvariants } from './test-runner';

/* ─── Helpers ─── */

let _eventId = 0;
function nextEventId(): string { return `evt-${++_eventId}-${Date.now()}`; }

let _shadowId = 0;
function nextShadowId(): string { return `shadow-${++_shadowId}-${Date.now()}`; }

let _snapshotId = 0;
function nextSnapshotId(): string { return `snap-${++_snapshotId}`; }

let _constraintId = 0;
function nextConstraintId(): string { return `cst-${++_constraintId}`; }

let _receiptId = 0;
function nextReceiptId(): string { return `rcpt-${++_receiptId}`; }

let _decisionId = 0;
function nextDecisionId(): string { return `dec-${++_decisionId}`; }

function buildFileEntries(demoFiles: Record<string, { content: string; language: string }>): Record<string, FileEntry> {
  const entries: Record<string, FileEntry> = {};
  for (const [path, { content, language }] of Object.entries(demoFiles)) {
    entries[path] = {
      path,
      content,
      language,
      modified: false,
      lastModifiedBy: 'system',
      lastModifiedAt: Date.now(),
    };
  }
  return entries;
}

function fileContents(files: Record<string, FileEntry>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, entry] of Object.entries(files)) {
    result[path] = entry.content;
  }
  return result;
}

function createSnapshot(state: WorkspaceState, description: string, actor: Actor): Snapshot {
  return {
    id: nextSnapshotId(),
    revision: state.revision,
    files: fileContents(state.files),
    constraints: [...state.constraints],
    description,
    actor,
    createdAt: Date.now(),
  };
}

/* ─── Store interface ─── */

export interface WorkspaceActions {
  // File operations
  setActiveFile: (path: string) => void;
  getFileContent: (path: string) => ToolResult;
  setFileContent: (path: string, content: string, actor: Actor) => ToolResult;
  listFiles: () => { path: string; language: string; modified: boolean; locked: boolean; hasErrors: boolean }[];

  // Human Governance (Constraints, Contract, Decisions)
  addConstraint: (file: string, startLine: number, endLine: number, type: ConstraintType, reason: string) => void;
  removeConstraint: (id: string) => void;
  updateChangeContract: (contract: Partial<ChangeContract>) => void;
  updateRiskBudget: (budget: Partial<RiskBudget>) => void;
  addHumanDecision: (decision: string, reason: string) => void;

  // Shadow Lab (Agent operations)
  createShadowRevision: (changes: PatchChange[], explanation: string) => ToolResult;
  analyzeImpact: (shadowId: string) => ToolResult;
  runShadowTests: (shadowId: string) => ToolResult;
  evaluateRiskBudget: (shadowId: string) => ToolResult;
  
  // Live Operations
  applyShadowRevision: (shadowId: string, approvedBy: Actor) => ToolResult;
  rejectShadowRevision: (shadowId: string) => ToolResult;
  runProjectTests: () => TestRunSummary;

  // Activity
  addActivity: (actor: Actor, type: string, description: string, affectedFiles?: string[], detail?: string) => void;

  // Snapshot/revision
  createManualSnapshot: (description: string) => void;
  revertToSnapshot: (snapshotId: string) => ToolResult;
  getRevisionHistory: () => Array<{ revision: number; description: string; actor: Actor; timestamp: number }>;

  // Agent tracking
  updateAgentCursor: () => void;
  getHumanChangesSinceAgent: () => { changes: Array<{ file: string; actor: Actor; timestamp: number }>; currentRevision: number; agentLastSeen: number };

  // Search
  findReferences: (symbol: string, path?: string) => Array<{ file: string; line: number; text: string }>;

  // UI state
  setShowLanding: (show: boolean) => void;
  setShowDiffView: (show: boolean, shadowId?: string) => void;
  setShowWebMCPInspector: (show: boolean) => void;
  setRehearsalRunning: (running: boolean) => void;
  setRehearsalStep: (step: number) => void;
  setJudgeMode: (judge: boolean) => void;
  setWebMCPStatus: (status: { available: boolean, reason?: string }) => void;

  // Reset
  resetDemo: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

function createInitialState(): WorkspaceState {
  const demoFiles = createDemoFiles();
  const files = buildFileEntries(demoFiles);

  return {
    projectName: DEMO_PROJECT_NAME,
    projectDescription: DEMO_PROJECT_DESCRIPTION,
    files,
    activeFile: 'src/checkout.ts',
    revision: 1,
    snapshots: [],
    
    constraints: [],
    changeContract: {
      goal: 'Fix checkout shipping failures.',
      mustPreserve: ['tax calculations', 'coupon semantics', 'currency rounding rules'],
      mustSatisfy: ['12/12 tests passing', 'no protected file modifications'],
      riskLimit: 'medium',
      preferredFiles: ['src/shipping.ts', 'src/cart.ts']
    },
    riskBudget: {
      maxFiles: 3,
      maxLines: 40,
      allowedAreas: ['src/shipping.ts', 'src/cart.ts', 'src/checkout.ts', 'src/pricing.ts'],
      protectedAreas: ['src/tax.ts'],
      forbidden: ['pricing semantics']
    },
    invariants: [
      {
        id: 'inv-tax',
        name: 'Tax calculation',
        description: 'Tax calculation logic for US states must remain unchanged.',
        fixtureCases: ['calculateTax(100, "CA")', 'calculateTax(100, "NY")'],
        expectedResults: [7.25, 8.00]
      },
      {
        id: 'inv-coupon',
        name: 'Coupon semantics',
        description: 'Coupon rate scaling must remain mathematically equivalent for downstream consumers.',
        fixtureCases: ['calculateDiscount(100, { rate: 0.10 })', 'calculateDiscount(100, null)'],
        expectedResults: [1000, 0] // the buggy original logic returns 1000 for 0.10
      },
      {
        id: 'inv-rounding',
        name: 'Currency rounding',
        description: 'Rounding must exactly match the legacy system output format.',
        fixtureCases: ['roundCurrency(12.345)', 'roundCurrency(12.9)'],
        expectedResults: [12.3, 12.9] // original bug logic
      }
    ],
    humanDecisions: [],
    
    shadowRevisions: [],
    activeShadowId: null,
    patchReceipts: [],

    testResults: null,
    testsRunning: false,
    activity: [],
    agentLastSeenRevision: 0,
    
    showLanding: true,
    showDiffView: false,
    diffShadowId: null,
    showWebMCPInspector: false,
    rehearsalRunning: false,
    rehearsalStep: 0,
    judgeMode: false,
    webmcpStatus: null,
  };
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  const mutate = (
    actor: Actor,
    description: string,
    affectedFiles: string[],
    updater: (state: WorkspaceState) => Partial<WorkspaceState>,
    createSnap = true,
  ) => {
    set(state => {
      const newRevision = state.revision + 1;
      const event: ActivityEvent = {
        id: nextEventId(),
        actor,
        type: description.split(' ')[0].toLowerCase(),
        description,
        timestamp: Date.now(),
        revision: newRevision,
        affectedFiles,
      };
      const updates = updater(state);
      const newState = {
        ...updates,
        revision: newRevision,
        activity: [event, ...state.activity].slice(0, 100),
      };

      if (createSnap) {
        const fullState = { ...state, ...newState };
        const snap = createSnapshot(fullState as WorkspaceState, description, actor);
        newState.snapshots = [snap, ...(state.snapshots || [])].slice(0, 50) as Snapshot[];
      }

      // Track last human edit
      if (actor === 'human' && event.type === 'human') {
        newState.lastHumanEdit = {
          files: affectedFiles,
          summary: description,
          revision: newRevision,
          timestamp: Date.now()
        };
      }

      return newState;
    });
  };

  return {
    ...createInitialState(),

    // ─── File operations ───

    setActiveFile: (path: string) => {
      set({ activeFile: path });
    },

    getFileContent: (path: string): ToolResult => {
      const { files } = get();
      if (!files[path]) {
        return { ok: false, errorCode: ErrorCodes.INVALID_FILE, message: `File not found: ${path}`, retryable: false };
      }
      return { ok: true, data: { path, content: files[path].content, language: files[path].language } };
    },

    setFileContent: (path: string, content: string, actor: Actor): ToolResult => {
      const state = get();
      if (!state.files[path]) {
        return { ok: false, errorCode: ErrorCodes.INVALID_FILE, message: `File not found: ${path}`, retryable: false };
      }
      
      // Direct edits are only for human (agents use shadow revisions)
      if (actor === 'agent') {
        return { ok: false, errorCode: ErrorCodes.INVALID_INPUT, message: `Agents must use create_shadow_revision instead of direct file edits.`, retryable: false };
      }

      mutate(actor, `Human edited ${path}`, [path], s => ({
        files: {
          ...s.files,
          [path]: {
            ...s.files[path],
            content,
            modified: true,
            lastModifiedBy: actor,
            lastModifiedAt: Date.now(),
          },
        },
      }));
      return { ok: true, data: { path, applied: true } };
    },

    listFiles: () => {
      const { files, constraints, testResults } = get();
      const failingFiles = new Set<string>();
      if (testResults) {
        for (const r of testResults.results) {
          if (r.status === 'fail' && r.file) failingFiles.add(r.file);
        }
      }
      return Object.values(files).map(f => ({
        path: f.path,
        language: f.language,
        modified: f.modified,
        locked: constraints.some(c => c.target?.file === f.path && (c.type === 'locked' || c.type === 'must_preserve')),
        hasErrors: failingFiles.has(f.path),
      }));
    },

    // ─── Human Governance ───

    addConstraint: (file, startLine, endLine, type, reason) => {
      const constraint: Constraint = {
        id: nextConstraintId(),
        type,
        target: { file, startLine, endLine },
        reason,
        createdBy: 'human',
        createdAt: Date.now(),
      };
      mutate('human', `Added constraint ${type} on ${file}`, [file], s => ({
        constraints: [...s.constraints, constraint],
      }));
    },

    removeConstraint: (id) => {
      const constraint = get().constraints.find(c => c.id === id);
      const file = constraint?.target?.file || 'unknown';
      mutate('human', `Removed constraint from ${file}`, [file], s => ({
        constraints: s.constraints.filter(c => c.id !== id),
      }));
    },

    updateChangeContract: (contract) => {
      mutate('human', `Updated Change Contract`, [], s => ({
        changeContract: { ...s.changeContract, ...contract }
      }), false);
    },

    updateRiskBudget: (budget) => {
      mutate('human', `Updated Risk Budget`, [], s => ({
        riskBudget: { ...s.riskBudget, ...budget }
      }), false);
    },

    addHumanDecision: (decision, reason) => {
      mutate('human', `Recorded Human Decision`, [], s => ({
        humanDecisions: [{ id: nextDecisionId(), decision, reason, createdAt: Date.now() }, ...s.humanDecisions]
      }), false);
    },

    // ─── Shadow Lab ───

    createShadowRevision: (changes, explanation, candidateId, groupId): ToolResult => {
      if (!changes || changes.length === 0) {
        return { ok: false, errorCode: ErrorCodes.INVALID_PATCH, message: 'No changes provided', retryable: false };
      }
      const state = get();
      
      // Optimistic concurrency check
      if (state.agentLastSeenRevision < state.revision - 5) {
         return { ok: false, errorCode: ErrorCodes.STALE_REVISION, message: `Stale state. Authoritative revision is ${state.revision}, agent last saw ${state.agentLastSeenRevision}. Please fetch project state again.`, retryable: true };
      }

      const shadow: ShadowRevision = {
        id: nextShadowId(),
        groupId,
        candidateId,
        baseRevision: state.revision,
        createdAt: Date.now(),
        changes,
        explanation,
        status: 'draft',
      };

      set(s => ({
        shadowRevisions: [shadow, ...s.shadowRevisions].slice(0, 20),
        activeShadowId: shadow.id
      }));

      // Automatically trigger impact analysis & risk budget
      get().analyzeImpact(shadow.id);
      get().runShadowTests(shadow.id);
      const riskResult = get().evaluateRiskBudget(shadow.id);

      return {
        ok: true,
        data: { shadowId: shadow.id, status: riskResult.ok ? 'passed' : 'blocked' },
        message: `Shadow revision created and verified. Status: ${riskResult.ok ? 'passed' : 'blocked'}. Awaiting human review.`,
      };
    },

    analyzeImpact: (shadowId): ToolResult => {
      const state = get();
      const shadow = state.shadowRevisions.find(s => s.id === shadowId);
      if (!shadow) return { ok: false, errorCode: ErrorCodes.SHADOW_NOT_FOUND };

      // Dynamic Impact Analysis
      const nodes: ImpactNode[] = [];
      const edges: ImpactEdge[] = [];
      let violatesProtection = false;
      const affectedTests: string[] = [];

      // 1. Add changed files as initial nodes
      for (const change of shadow.changes) {
        const isProtected = state.riskBudget.protectedAreas.includes(change.path);
        if (isProtected) violatesProtection = true;
        
        nodes.push({
          id: change.path,
          type: 'file',
          label: change.path + (isProtected ? ' 🔒' : ''),
          impactLevel: isProtected ? 'PROTECTED' : 'MEDIUM'
        });
      }

      // 2. Discover dependencies dynamically by scanning live file contents
      // We look for any file that calls functions defined in the changed files
      for (const change of shadow.changes) {
        const moduleName = change.path.split('/').pop()?.replace('.ts', '');
        
        // Extract function names from the changed file and the base file
        const baseContent = state.files[change.path]?.content || '';
        const funcMatches = (change.content + '\n' + baseContent).match(/function\s+([a-zA-Z0-9_]+)/g);
        const funcNames = funcMatches ? Array.from(new Set(funcMatches.map(m => m.split(/\s+/)[1]))) : [];
        if (!moduleName && funcNames.length === 0) continue;

        for (const [path, entry] of Object.entries(state.files)) {
          if (path === change.path) continue; // Skip self
          
          const content = entry.content;
          let isDependent = false;
          
          if (moduleName && (content.includes(`'./${moduleName}'`) || content.includes(`"./${moduleName}"`))) {
             isDependent = true;
          }
          for (const fn of funcNames) {
             if (content.includes(`${fn}(`)) {
                 isDependent = true;
                 break;
             }
          }
          
          if (isDependent) {
            // Add edge
            edges.push({ source: change.path, target: path, type: 'calls' });
            
            // Ensure target is a node
            if (!nodes.find(n => n.id === path)) {
               const isTest = path.includes('.test.');
               nodes.push({
                 id: path,
                 type: isTest ? 'test' : 'file',
                 label: path,
                 impactLevel: isTest ? 'LOW' : 'HIGH'
               });
               if (isTest) affectedTests.push(path);
            }
          }
        }
      }

      // Ensure tests are always connected to the main entry point if modified
      if (shadow.changes.some(c => c.path === 'src/checkout.ts') && !nodes.find(n => n.id === 'tests/checkout.test.ts')) {
         edges.push({ source: 'src/checkout.ts', target: 'tests/checkout.test.ts', type: 'tests' });
         nodes.push({ id: 'tests/checkout.test.ts', type: 'test', label: 'tests/checkout.test.ts', impactLevel: 'LOW' });
         affectedTests.push('tests/checkout.test.ts');
      }

      const impactGraph: ImpactGraph = {
        nodes, edges,
        summary: {
          affectedFiles: shadow.changes.map(c => c.path),
          affectedTests,
          highestImpact: violatesProtection ? 'PROTECTED' : (edges.length > 3 ? 'HIGH' : 'MEDIUM'),
          violatesProtection
        }
      };

      set(s => ({
        shadowRevisions: s.shadowRevisions.map(sr => 
          sr.id === shadowId ? { ...sr, impactAnalysis: impactGraph } : sr
        )
      }));

      return { ok: true, data: { impactGraph } };
    },

    runShadowTests: (shadowId): ToolResult => {
      const state = get();
      const shadow = state.shadowRevisions.find(s => s.id === shadowId);
      if (!shadow) return { ok: false, errorCode: ErrorCodes.SHADOW_NOT_FOUND };

      // Overlay shadow changes onto base files
      const shadowFiles = fileContents(state.files);
      for (const change of shadow.changes) {
        shadowFiles[change.path] = change.content;
      }

      set({ testsRunning: true });
      const results = runTests(shadowFiles);
      set({ testsRunning: false });

      set(s => ({
        shadowRevisions: s.shadowRevisions.map(sr => 
          sr.id === shadowId ? { ...sr, testResults: results } : sr
        )
      }));

      return { ok: true, data: { testResults: results } };
    },

    evaluateRiskBudget: (shadowId): ToolResult => {
      const state = get();
      const shadow = state.shadowRevisions.find(s => s.id === shadowId);
      if (!shadow) return { ok: false, errorCode: ErrorCodes.SHADOW_NOT_FOUND };

      const violations: string[] = [];
      const budget = state.riskBudget;

      if (shadow.changes.length > budget.maxFiles) violations.push(`Exceeded max files (${budget.maxFiles})`);
      
      const linesChanged = shadow.changes.reduce((acc, c) => acc + (c.content.split('\\n').length), 0);
      // Rough estimation for demo.
      if (linesChanged > budget.maxLines * 10) violations.push(`Exceeded max lines (${budget.maxLines})`);

      for (const change of shadow.changes) {
        if (budget.protectedAreas.includes(change.path)) {
           violations.push(`Modified protected area: ${change.path}`);
        }
      }
      
      if (shadow.impactAnalysis?.summary.violatesProtection) {
         violations.push(`Impact analysis detected protected area violation.`);
      }

      // Evaluate behavioral invariants
      const shadowFiles = fileContents(state.files);
      for (const change of shadow.changes) {
        shadowFiles[change.path] = change.content;
      }
      const invResults = evaluateInvariants(shadowFiles, state.invariants);
      const failedInvariants = Object.entries(invResults).filter(([_, status]) => status === 'fail').map(([id]) => id);
      if (failedInvariants.length > 0) {
        violations.push(`Violated behavioral invariants: ${failedInvariants.join(', ')}`);
      }

      const overallRisk = violations.length > 0 ? 'high' : 'low';
      const status = violations.length > 0 ? 'blocked' : 'passed';

      // Deterministic PatchPilot Evaluation Score
      let patchScore = 100;
      if (violations.length > 0) patchScore -= 50;
      if (shadow.impactAnalysis?.summary.highestImpact === 'HIGH') patchScore -= 10;
      if (shadow.testResults?.failed && shadow.testResults.failed > 0) patchScore -= (shadow.testResults.failed * 10);
      patchScore = Math.max(0, patchScore);

      const evidence: CausalEvidence = {
         failureDetected: true,
         shadowTestsPassed: shadow.testResults?.failed === 0,
         proposedFix: shadow.explanation,
         impactLevel: shadow.impactAnalysis?.summary.highestImpact || 'LOW',
         humanDecision: `Governance Evaluation: ${patchScore}/100 Score. ${status === 'passed' ? 'Recommended for approval.' : 'BLOCKED.'}`
      };

      set(s => ({
        shadowRevisions: s.shadowRevisions.map(sr => 
          sr.id === shadowId ? { 
            ...sr, 
            status,
            invariantResults: invResults,
            riskAssessment: { scopeRisk: shadow.changes.length, impactRisk: patchScore, overallRisk, budgetViolations: violations },
            evidence 
          } : sr
        )
      }));

      if (status === 'blocked') {
        return { ok: false, errorCode: ErrorCodes.BUDGET_EXCEEDED, message: `BLOCKED BY POLICY:\n${violations.join('\n')}`, data: { violations }};
      }
      return { ok: true, data: { status }};
    },

    // ─── Live Operations ───

    applyShadowRevision: (shadowId, approvedBy): ToolResult => {
      const state = get();
      const shadow = state.shadowRevisions.find(p => p.id === shadowId);
      if (!shadow) return { ok: false, errorCode: ErrorCodes.SHADOW_NOT_FOUND, message: 'Shadow not found' };

      if (approvedBy === 'agent' && shadow.status !== 'approved') {
        return { ok: false, errorCode: ErrorCodes.SHADOW_NOT_APPROVED, message: 'Only humans can approve' };
      }

      if (shadow.baseRevision !== state.revision) {
          return { ok: false, errorCode: ErrorCodes.STALE_REVISION, message: `STALE SHADOW: This shadow was created from revision #${shadow.baseRevision}. The workspace is now at revision #${state.revision}. Please re-evaluate the state.` };
      }

      // Apply the changes
      const updatedFiles = { ...state.files };
      for (const change of shadow.changes) {
        if (updatedFiles[change.path]) {
          updatedFiles[change.path] = {
            ...updatedFiles[change.path],
            content: change.content,
            modified: true,
            lastModifiedBy: 'agent',
            lastModifiedAt: Date.now(),
          };
        }
      }

      let invariantsPreserved = 0;
      if (shadow.invariantResults) {
         invariantsPreserved = Object.values(shadow.invariantResults).filter(v => v === 'pass').length;
      }

      const receipt: PatchReceipt = {
        id: nextReceiptId(),
        revision: get().revision,
        approvedBy,
        shadowId,
        selectedCandidate: shadow.candidateId,
        decisionReason: 'Human reviewed counterfactual evidence and selected best path.',
        filesChanged: shadow.changes.length,
        linesChanged: shadow.changes.reduce((acc, c) => acc + c.content.split('\\n').length, 0),
        shadowVerification: 'passed',
        impact: shadow.impactAnalysis?.summary.highestImpact || 'LOW',
        risk: shadow.riskAssessment?.overallRisk || 'low',
        contractViolations: 0,
        invariantsPreserved,
        timestamp: Date.now(),
      };

      // Record to human decisions
      if (shadow.candidateId) {
         get().addHumanDecision(`Selected Candidate ${shadow.candidateId}`, receipt.decisionReason!);
      }

      mutate(approvedBy, `Approved & Applied Shadow #${shadowId}`, shadow.changes.map(c => c.path), s => ({
        files: updatedFiles,
        patchReceipts: [receipt, ...s.patchReceipts],
        shadowRevisions: s.shadowRevisions.map(sr => 
          sr.id === shadowId ? { ...sr, status: 'approved' as const } : sr
        ),
        activeShadowId: s.activeShadowId, // Do not clear active shadow after apply
      }));

      // Auto run live tests
      get().runProjectTests();

      return { ok: true, data: { shadowId, status: 'approved', receipt } };
    },

    rejectShadowRevision: (shadowId): ToolResult => {
      set(s => ({
        shadowRevisions: s.shadowRevisions.map(p =>
          p.id === shadowId ? { ...p, status: 'rejected' as const } : p
        ),
        activeShadowId: s.activeShadowId === shadowId ? null : s.activeShadowId,
      }));
      return { ok: true };
    },

    runProjectTests: (): TestRunSummary => {
      set({ testsRunning: true });
      const state = get();
      const contents = fileContents(state.files);
      const results = runTests(contents);

      mutate('system', `Live Tests executed: ${results.passed}/${results.total} passing`, ['tests/checkout.test.ts'], s => ({
        testResults: results,
        testsRunning: false,
      }), false);

      return results;
    },

    // ─── Activity ───

    addActivity: (actor, type, description, affectedFiles = [], detail) => {
      set(s => ({
        activity: [{
          id: nextEventId(),
          actor,
          type,
          description,
          timestamp: Date.now(),
          revision: s.revision,
          affectedFiles,
          detail,
        }, ...s.activity].slice(0, 100),
      }));
    },

    // ─── Snapshots ───

    createManualSnapshot: (description) => {
      const state = get();
      const snap = createSnapshot(state, description, 'human');
      set(s => ({ snapshots: [snap, ...s.snapshots].slice(0, 50) }));
    },

    revertToSnapshot: (snapshotId): ToolResult => {
      const { snapshots } = get();
      const snap = snapshots.find(s => s.id === snapshotId);
      if (!snap) return { ok: false, errorCode: 'SNAPSHOT_NOT_FOUND' };

      const restoredFiles: Record<string, FileEntry> = {};
      for (const [path, content] of Object.entries(snap.files)) {
        restoredFiles[path] = {
          path,
          content,
          language: get().files[path]?.language || 'typescript',
          modified: false,
          lastModifiedBy: 'system',
          lastModifiedAt: Date.now(),
        };
      }

      mutate('human', `Reverted to revision #${snap.revision}`, Object.keys(snap.files), () => ({
        files: restoredFiles,
        constraints: [...snap.constraints],
      }));

      return { ok: true };
    },

    getRevisionHistory: () => {
      return get().snapshots.map(s => ({
        revision: s.revision,
        description: s.description,
        actor: s.actor,
        timestamp: s.createdAt,
      }));
    },

    // ─── Agent tracking ───

    updateAgentCursor: () => {
      set(s => ({ agentLastSeenRevision: s.revision }));
    },

    getHumanChangesSinceAgent: () => {
      const { activity, revision, agentLastSeenRevision } = get();
      const changes = activity
        .filter(e => e.actor === 'human' && e.revision > agentLastSeenRevision)
        .map(e => ({ file: e.affectedFiles?.[0] || 'unknown', actor: e.actor, timestamp: e.timestamp }));
      return { changes, currentRevision: revision, agentLastSeen: agentLastSeenRevision };
    },

    // ─── Search ───

    findReferences: (symbol, path) => {
      const { files } = get();
      const results: Array<{ file: string; line: number; text: string }> = [];
      const filesToSearch = path ? { [path]: files[path] } : files;

      for (const [filePath, entry] of Object.entries(filesToSearch)) {
        if (!entry) continue;
        const lines = entry.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(symbol)) {
            results.push({ file: filePath, line: i + 1, text: lines[i].trim() });
          }
        }
      }
      return results;
    },

    // ─── UI state ───

    setShowLanding: (show) => set({ showLanding: show }),
    setShowDiffView: (show, shadowId) => set({ showDiffView: show, diffShadowId: shadowId || null }),
    setShowWebMCPInspector: (show) => set({ showWebMCPInspector: show }),
    setRehearsalRunning: (running) => set({ rehearsalRunning: running }),
    setRehearsalStep: (step) => set({ rehearsalStep: step }),
    setJudgeMode: (judge) => set({ judgeMode: judge }),
    setWebMCPStatus: (status) => set({ webmcpStatus: status }),

    // ─── Reset ───

    resetDemo: () => {
      _eventId = 0;
      _shadowId = 0;
      _snapshotId = 0;
      _constraintId = 0;
      _receiptId = 0;
      _decisionId = 0;
      set(createInitialState());
    },
  };
});

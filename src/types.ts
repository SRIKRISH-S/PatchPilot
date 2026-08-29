/* ─── Core types for PatchPilot workspace ─── */

export type Actor = 'human' | 'agent' | 'system';
export type ConstraintType = 'locked' | 'must_preserve' | 'review_only' | 'max_scope' | 'required_test' | 'forbidden_symbol' | 'required_symbol';
export type ShadowStatus = 'draft' | 'simulating' | 'passed' | 'warning' | 'blocked' | 'approved' | 'rejected' | 'expired';
export type TestStatus = 'pass' | 'fail' | 'error' | 'skip';
export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'PROTECTED';

export interface FileEntry {
  path: string;
  content: string;
  language: string;
  modified: boolean;
  lastModifiedBy: Actor;
  lastModifiedAt: number;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  target: {
    file?: string;
    startLine?: number;
    endLine?: number;
    symbol?: string;
  };
  reason: string;
  createdBy: Actor;
  createdAt: number;
}

export interface PatchChange {
  path: string;
  content: string;
}

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  durationMs: number;
  expected?: string;
  actual?: string;
  error?: string;
  file?: string;
  line?: number;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  results: TestResult[];
  runAt: number;
  durationMs: number;
}

export interface ImpactNode {
  id: string;
  type: 'file' | 'function' | 'test';
  label: string;
  impactLevel: ImpactLevel;
}

export interface ImpactEdge {
  source: string; // node id
  target: string; // node id
  type: 'calls' | 'imports' | 'tests';
}

export interface ImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  summary: {
    affectedFiles: string[];
    affectedTests: string[];
    highestImpact: ImpactLevel;
    violatesProtection: boolean;
  };
}

export interface CausalEvidence {
  failureDetected: boolean;
  rootCauseAnalyzed?: string;
  affectedSymbols?: string[];
  proposedFix?: string;
  shadowTestsPassed?: boolean;
  impactLevel?: ImpactLevel;
  humanDecision?: string;
}

export interface RiskBudget {
  maxFiles: number;
  maxLines: number;
  allowedAreas: string[];
  protectedAreas: string[];
  forbidden: string[];
}

export interface ChangeContract {
  goal: string;
  mustPreserve: string[];
  mustSatisfy: string[];
  riskLimit: 'low' | 'medium' | 'high';
  preferredFiles: string[];
}

export interface HumanDecision {
  id: string;
  decision: string;
  reason: string;
  createdAt: number;
}

export interface ShadowRevision {
  id: string;
  baseRevision: number;
  createdAt: number;
  changes: PatchChange[];
  testResults?: TestRunSummary;
  impactAnalysis?: ImpactGraph;
  riskAssessment?: {
    scopeRisk: number;
    impactRisk: number;
    overallRisk: 'low' | 'medium' | 'high';
    budgetViolations: string[];
  };
  explanation?: string;
  evidence?: CausalEvidence;
  status: ShadowStatus;
  options?: Array<{
    id: string;
    description: string;
    changes: PatchChange[];
    risk: 'low' | 'medium' | 'high';
  }>;
}

export interface PatchReceipt {
  id: string;
  revision: number;
  approvedBy: Actor;
  shadowId: string;
  filesChanged: number;
  linesChanged: number;
  shadowVerification: string;
  impact: ImpactLevel;
  risk: string;
  contractViolations: number;
  timestamp: number;
}

export interface ActivityEvent {
  id: string;
  actor: Actor;
  type: string;
  description: string;
  timestamp: number;
  revision: number;
  affectedFiles?: string[];
  detail?: string;
}

export interface Snapshot {
  id: string;
  revision: number;
  files: Record<string, string>;
  constraints: Constraint[];
  description: string;
  actor: Actor;
  createdAt: number;
}

export interface WorkspaceState {
  // Project metadata
  projectName: string;
  projectDescription: string;

  // Files
  files: Record<string, FileEntry>;
  activeFile: string;

  // Versioning
  revision: number;
  snapshots: Snapshot[];

  // Constraints & Contracts
  constraints: Constraint[];
  changeContract: ChangeContract;
  riskBudget: RiskBudget;
  humanDecisions: HumanDecision[];

  // Shadows & Proofs
  shadowRevisions: ShadowRevision[];
  activeShadowId: string | null;
  patchReceipts: PatchReceipt[];

  // Legacy proposals (mapped to shadows now)
  // Removing PatchProposal in favor of ShadowRevision

  // Tests
  testResults: TestRunSummary | null;
  testsRunning: boolean;

  // Activity
  activity: ActivityEvent[];

  // Agent tracking
  agentLastSeenRevision: number;
  lastHumanEdit?: {
    files: string[];
    summary: string;
    revision: number;
    timestamp: number;
  };

  // UI state
  showLanding: boolean;
  showDiffView: boolean;
  diffShadowId: string | null;
  showWebMCPInspector: boolean;
  rehearsalRunning: boolean;
  rehearsalStep: number;
  judgeMode: boolean;
  webmcpStatus: { available: boolean; reason?: string } | null;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  errorCode?: string;
  message?: string;
  retryable?: boolean;
}

// WebMCP tool response format
export interface WebMCPResponse {
  content: Array<{ type: string; text: string }>;
  structuredContent?: unknown;
}

// Error codes
export const ErrorCodes = {
  INVALID_FILE: 'INVALID_FILE',
  FILE_LOCKED: 'FILE_LOCKED',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  STALE_REVISION: 'STALE_REVISION',
  SHADOW_NOT_FOUND: 'SHADOW_NOT_FOUND',
  SHADOW_NOT_APPROVED: 'SHADOW_NOT_APPROVED',
  TEST_RUN_FAILED: 'TEST_RUN_FAILED',
  INVALID_PATCH: 'INVALID_PATCH',
  INVALID_INPUT: 'INVALID_INPUT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
} as const;

/* ─── WebMCP tool registration for PatchPilot 2.0 ─── */

import { useWorkspaceStore } from './store';
import type { WebMCPResponse } from './types';

/* ─── Types for WebMCP ─── */

interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
  execute: (args: Record<string, unknown>) => Promise<WebMCPResponse>;
}

interface WebMCPRegistration {
  available: boolean;
  reason?: string;
  toolCount: number;
  toolNames: string[];
}

/* ─── Tool response helpers ─── */

function mcpResult(text: string, data?: unknown): WebMCPResponse {
  return {
    content: [{ type: 'text', text }],
    structuredContent: data,
  };
}

function mcpError(code: string, message: string): WebMCPResponse {
  return {
    content: [{ type: 'text', text: `ERROR [${code}]: ${message}` }],
    structuredContent: { ok: false, errorCode: code, message, retryable: true },
  };
}

/* ─── Tool definitions ─── */

function createTools(): WebMCPToolDefinition[] {
  const state = () => useWorkspaceStore.getState();

  return [
    // ─── READ TOOLS ───

    {
      name: 'get_project_state',
      description: 'Returns current PatchPilot project state including authoritative revision, active file, change contract, risk budget, failing tests, and recent human changes since your last observation.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const s = state();
        s.updateAgentCursor();
        const humanChanges = s.getHumanChangesSinceAgent();
        const files = s.listFiles();
        const testSummary = s.testResults
          ? `${s.testResults.passed}/${s.testResults.total} passing, ${s.testResults.failed} failing`
          : 'No live test results yet';

        const text = [
          `Project: ${s.projectName}`,
          `Live Revision: #${s.revision}`,
          `Active file: ${s.activeFile}`,
          `Files: ${files.map(f => f.path + (f.locked ? ' 🔒' : '') + (f.modified ? ' ●' : '')).join(', ')}`,
          `Live Tests: ${testSummary}`,
          `Risk Budget: Max files: ${s.riskBudget.maxFiles}, Protected: ${s.riskBudget.protectedAreas.join(', ')}`,
          `Change Contract Goal: ${s.changeContract.goal}`,
          humanChanges.changes.length > 0
            ? `HUMAN CHANGES SINCE LAST OBSERVATION: ${humanChanges.changes.map(c => c.file).join(', ')}`
            : 'No human changes since your last observation.',
        ].join('\n');

        return mcpResult(text, {
          projectName: s.projectName,
          revision: s.revision,
          activeFile: s.activeFile,
          files: files,
          testSummary: s.testResults ? { passed: s.testResults.passed, failed: s.testResults.failed, total: s.testResults.total } : null,
          riskBudget: s.riskBudget,
          changeContract: s.changeContract,
          humanChanges: humanChanges.changes,
        });
      },
    },

    {
      name: 'list_files',
      description: 'Returns the project file tree with metadata.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const files = state().listFiles();
        return mcpResult(files.map(f => `${f.path} [${f.language}]${f.locked ? ' (PROTECTED)' : ''}`).join('\n'), { files });
      },
    },

    {
      name: 'get_file',
      description: 'Read the contents of a specific file from the live authoritative project.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      execute: async ({ path }) => {
        if (typeof path !== 'string') return mcpError('INVALID_INPUT', 'path must be a string');
        const result = state().getFileContent(path);
        if (!result.ok) return mcpError(result.errorCode!, result.message!);
        state().addActivity('agent', 'inspect', `Inspected ${path}`, [path]);
        return mcpResult((result.data as any).content, result.data);
      },
    },

    {
      name: 'get_test_results',
      description: 'Returns the latest live authoritative test results.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const s = state();
        if (!s.testResults) return mcpResult('No tests run yet.', { noResults: true });
        const text = s.testResults.results.map(r => r.status === 'pass' ? `✓ ${r.name}` : `✗ ${r.name} — ${r.error || ''}`).join('\n');
        return mcpResult(`${s.testResults.passed}/${s.testResults.total} passing\n\n${text}`, s.testResults);
      },
    },

    {
      name: 'find_references',
      description: 'Search project files for references to a symbol.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['symbol'],
        additionalProperties: false,
      },
      execute: async ({ symbol, path }) => {
        const refs = state().findReferences(symbol as string, path as string | undefined);
        const text = refs.map(r => `${r.file}:${r.line} — ${r.text}`).join('\n');
        return mcpResult(text || 'No references found.', { references: refs });
      },
    },

    {
      name: 'get_human_decisions',
      description: 'Returns persistent decisions and reasoning provided by the human.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const decisions = state().humanDecisions;
        const text = decisions.map(d => `Decision: ${d.decision}\nReason: ${d.reason}`).join('\n\n');
        return mcpResult(text || 'No recorded decisions.', { decisions });
      },
    },

    {
      name: 'get_change_contract',
      description: 'Returns the current human-defined Change Contract (intent and constraints).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        const contract = state().changeContract;
        const text = [
          `Goal: ${contract.goal}`,
          `Must Preserve: ${contract.mustPreserve.join(', ')}`,
          `Must Satisfy: ${contract.mustSatisfy.join(', ')}`,
          `Risk Limit: ${contract.riskLimit}`,
          `Preferred Files: ${contract.preferredFiles.join(', ')}`
        ].join('\n');
        return mcpResult(text, contract);
      },
    },

    {
      name: 'get_shadow_revision',
      description: 'Returns details about a specific shadow revision.',
      inputSchema: {
        type: 'object',
        properties: { shadowId: { type: 'string' } },
        required: ['shadowId'],
        additionalProperties: false,
      },
      execute: async ({ shadowId }) => {
        const shadow = state().shadowRevisions.find(s => s.id === shadowId);
        if (!shadow) return mcpError('SHADOW_NOT_FOUND', 'Shadow revision not found.');
        return mcpResult(`Shadow ID: ${shadow.id}\nStatus: ${shadow.status}\nChanges: ${shadow.changes.length} files.`, shadow);
      },
    },

    // ─── AGENT ANALYSIS ───

    {
      name: 'create_shadow_revision',
      description: 'Creates a new Shadow Revision to isolate proposed changes. This does NOT modify the live workspace. Generates impact analysis and runs tests automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            }
          },
          explanation: { type: 'string', description: 'Why this change works' },
        },
        required: ['changes', 'explanation'],
        additionalProperties: false,
      },
      execute: async ({ changes, explanation }) => {
        const result = state().createShadowRevision(
          changes as Array<{ path: string; content: string }>,
          explanation as string
        );
        if (!result.ok) return mcpError(result.errorCode!, result.message!);
        const data = result.data as { shadowId: string, status: string };
        state().addActivity('agent', 'shadow', `Created Shadow #${data.shadowId} (${data.status})`);
        return mcpResult(`Shadow revision created: ${data.shadowId}. Status: ${data.status}. Fetch shadow details for evidence.`, data);
      },
    },

    {
      name: 'analyze_impact',
      description: 'Triggers impact analysis for a shadow revision.',
      inputSchema: {
        type: 'object',
        properties: { shadowId: { type: 'string' } },
        required: ['shadowId'],
        additionalProperties: false,
      },
      execute: async ({ shadowId }) => {
        const result = state().analyzeImpact(shadowId as string);
        if (!result.ok) return mcpError(result.errorCode!, 'Failed to analyze impact');
        return mcpResult('Impact analysis complete.', result.data);
      },
    },

    {
      name: 'run_shadow_tests',
      description: 'Executes the test suite against a specific shadow revision.',
      inputSchema: {
        type: 'object',
        properties: { shadowId: { type: 'string' } },
        required: ['shadowId'],
        additionalProperties: false,
      },
      execute: async ({ shadowId }) => {
        const result = state().runShadowTests(shadowId as string);
        if (!result.ok) return mcpError(result.errorCode!, 'Failed to run shadow tests');
        return mcpResult('Shadow tests complete.', result.data);
      },
    },

    {
      name: 'get_patch_evidence',
      description: 'Returns the causal evidence and risk assessment for a shadow revision.',
      inputSchema: {
        type: 'object',
        properties: { shadowId: { type: 'string' } },
        required: ['shadowId'],
        additionalProperties: false,
      },
      execute: async ({ shadowId }) => {
        const shadow = state().shadowRevisions.find(s => s.id === shadowId);
        if (!shadow) return mcpError('SHADOW_NOT_FOUND', 'Shadow revision not found.');
        const text = [
          `Overall Risk: ${shadow.riskAssessment?.overallRisk}`,
          `Budget Violations: ${shadow.riskAssessment?.budgetViolations.join(', ') || 'None'}`,
          `Impact Level: ${shadow.evidence?.impactLevel}`,
          `Tests Passed: ${shadow.evidence?.shadowTestsPassed}`,
        ].join('\n');
        return mcpResult(text, { risk: shadow.riskAssessment, evidence: shadow.evidence });
      },
    },

    // ─── AGENT ACTION ───

    {
      name: 'propose_patch',
      description: 'Alias for create_shadow_revision.',
      inputSchema: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
          },
          reason: { type: 'string' },
          testPlan: { type: 'string' },
        },
        required: ['changes', 'reason', 'testPlan'],
        additionalProperties: false,
      },
      execute: async ({ changes, reason }) => {
        const result = state().createShadowRevision(
          changes as Array<{ path: string; content: string }>,
          reason as string
        );
        if (!result.ok) return mcpError(result.errorCode!, result.message!);
        const data = result.data as { shadowId: string, status: string };
        state().addActivity('agent', 'shadow', `Proposed Patch via Shadow #${data.shadowId} (${data.status})`);
        return mcpResult(`Proposal created as Shadow ${data.shadowId}. Status: ${data.status}.`, data);
      },
    },

    {
      name: 'apply_patch',
      description: 'Apply an APPROVED shadow revision to the live workspace. Fails if unapproved or stale.',
      inputSchema: {
        type: 'object',
        properties: { shadowId: { type: 'string' } },
        required: ['shadowId'],
        additionalProperties: false,
      },
      execute: async ({ shadowId }) => {
        const shadow = state().shadowRevisions.find(s => s.id === shadowId);
        if (!shadow) return mcpError('SHADOW_NOT_FOUND', 'Shadow not found');
        if (shadow.status !== 'approved') return mcpError('SHADOW_NOT_APPROVED', `Shadow status is ${shadow.status}. Human approval is required.`);
        
        const result = state().applyShadowRevision(shadowId as string, 'agent');
        if (!result.ok) return mcpError(result.errorCode!, result.message!);
        return mcpResult('Shadow revision applied successfully to the live workspace.', result.data);
      },
    },

  ];
}

/* ─── Registration ─── */

let _registered = false;

export function registerWebMCP(): WebMCPRegistration {
  const host = (globalThis as any).document?.modelContext;
  
  if (!host?.registerTool) {
    return { available: false, reason: 'WebMCP not detected.', toolCount: 0, toolNames: [] };
  }

  if (_registered) {
    const tools = createTools();
    return { available: true, toolCount: tools.length, toolNames: tools.map(t => t.name) };
  }

  const tools = createTools();
  
  Promise.all(tools.map(t => host.registerTool!(t)))
    .then(() => {
      console.log(`[PatchPilot 2.0] WebMCP: ${tools.length} tools registered`);
      _registered = true;
    })
    .catch(err => {
      console.error('[PatchPilot 2.0] WebMCP registration failed:', err);
    });

  return { available: true, toolCount: tools.length, toolNames: tools.map(t => t.name) };
}

export function getToolManifest() {
  return createTools().map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

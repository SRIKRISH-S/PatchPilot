# PatchPilot 3.0 Security & Governance Model

The primary security thesis of PatchPilot 3.0 is that AI agents cannot be fully trusted to modify authoritative software state autonomously, regardless of the underlying LLM's capability. 

To bridge this gap, PatchPilot 3.0 enforces a strict separation between **Agent Simulation** and **Human Authority**.

## 1. Single Source of Truth
The `WorkspaceStore` (powered by Zustand) holds the live, authoritative project state. 
- WebMCP tools like `get_file` and `get_project_state` read from this state.
- WebMCP tools exposed to the agent **cannot** directly mutate this state. There is no `write_file` tool.

## 2. The Shadow Change Lab
When the agent proposes a patch via `create_shadow_revision`, it operates on a deep clone of the workspace state.
- The `files` record in the shadow revision is mutated.
- The authoritative `files` record remains untouched.

## 3. Human-Governed Risk Budgets
Before a shadow revision is even presented to the human for approval, it must pass the **Constraint Engine**.
The constraint engine analyzes the shadow revision and checks it against the Human Risk Budget.

**Risk Budget Violations that trigger an automatic block:**
- **Protected Areas:** If the patch touches a file or directory explicitly marked as protected by the human (e.g., `src/tax.ts`).
- **Blast Radius Exceeded:** If the impact analysis graph detects that the patch will affect more modules than the human permitted.
- **Size Limits:** If the patch exceeds the maximum allowed changed files or lines of code.

## 4. Causal Verification (Zero-Trust Tests)
The agent cannot simply claim a patch works. It must prove it.
When a shadow revision is created, `runShadowTests` is executed. This runs the real browser-side test runner against the simulated shadow state.
- The human sees the raw results of these isolated tests in the Evidence Chain UI.
- The agent cannot fake the test results because it does not control the test runner.

## 5. Concurrent Stale Detection
If the human modifies a file while the agent is simulating a shadow revision, applying that shadow could overwrite human work.
- Every shadow revision tracks `baseRevision`.
- When `applyShadowRevision` is called, the system verifies that `baseRevision` matches the current `revision`.
- If they do not match, the shadow is marked as stale and application fails.

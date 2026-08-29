# PatchPilot Architecture

PatchPilot is built as a client-side only, browser-native application. It requires no backend server, operating entirely within the user's browser, utilizing modern Web capabilities and the WebMCP standard to bridge human and AI collaboration.

## Core Pillars

1. **Single Source of Truth (Zustand Store)**
2. **WebMCP Bridge**
3. **In-Browser Execution & Test Runner**
4. **Constraint & Patch System**

---

## 1. Single Source of Truth (Zustand)

All application state—files, constraints, patch proposals, test results, and activity history—lives in a single Zustand store (`src/store.ts`).

### Mutation Tracking
To ensure complete transparency between the human and the agent, direct mutations of the state are forbidden. All changes must go through the internal `mutate` function.
- The `mutate` function automatically increments the global `revision` counter.
- It records the action in the `activity` timeline (logging the actor: 'human', 'agent', or 'system').
- It generates a snapshot of the workspace, allowing for reverts.

### Agent Cursor Tracking
Because the human and agent operate concurrently, the store tracks `agentLastSeenRevision`. When the agent queries the state via WebMCP, this cursor updates. If the human modifies a file, the agent can use `check_human_changes` to detect modifications that occurred since its last read, preventing conflict overwrites.

---

## 2. WebMCP Bridge

WebMCP is the mechanism that allows the AI agent to interact with the live application.
In PatchPilot, WebMCP is not a generic API; it is a direct proxy to the Zustand store.

Located in `src/webmcp.ts`, the application imperatively registers tools onto the `document.modelContext`.
- **Read Tools:** `get_project_state`, `check_human_changes`, `find_references`
- **Write/Action Tools:** `propose_patch`, `apply_patch`, `run_tests`

**Security Boundary:** The WebMCP layer enforces that the agent *cannot* bypass business logic. For example, the `apply_patch` tool calls the store's `applyProposal` method, which inherently checks if the human has approved the patch. If unapproved, the store rejects the action, and WebMCP relays the failure back to the agent.

---

## 3. In-Browser Execution & Test Runner

PatchPilot executes the demo project's code directly in the browser to provide immediate, real test results—not simulated outputs.

Located in `src/test-runner.ts`:
1. **TypeScript Stripping:** A custom parser strips TypeScript types, interfaces, and export/import syntax, transforming the code into valid JavaScript.
2. **Concatenation:** The project files and test suite are concatenated into a single executable string.
3. **Execution Harness:** A custom `test()` and `expect()` harness is injected into the string.
4. **Function Constructor:** The combined code is executed securely within the browser using the `Function` constructor.
5. **Structured Results:** Expected, actual, and error outputs are parsed and returned to the UI (and to the agent via WebMCP).

---

## 4. Constraint & Patch System

### Constraints (Locks)
Humans can lock files (e.g., locking `tax.ts` to prevent the agent from touching business-critical logic).
- Constraints are checked in `proposePatch`: The agent receives an immediate error if it attempts to propose a change to a locked file.
- Constraints are checked again in `applyProposal`: In case a file was locked *after* a proposal was made, the application prevents the patch from applying.

### Patch Proposals
The agent does not edit files directly. It submits a patch proposal consisting of one or more file modifications.
1. Agent calls `propose_patch`.
2. Proposal enters `pending` state.
3. Human reviews the diffs in the UI.
4. Human clicks "Approve".
5. Agent calls `apply_patch` (or the human can apply it).
6. Files are updated, revision increments, and the test suite can be re-run.

---

## Project Structure

\`\`\`
src/
├── __tests__/         # Vitest unit & integration tests
├── components/        # (If extracted) React UI components
├── demo-project.ts    # The source code for the Checkout Engine demo
├── main.tsx           # Entry point and Main UI layout
├── rehearsal.ts       # Scripted deterministic demo of the workflow
├── store.ts           # Core Zustand state and business logic
├── styles.css         # Custom Design System
├── test-runner.ts     # In-browser JS execution harness
├── types.ts           # TypeScript interfaces for State and WebMCP
└── webmcp.ts          # Registration of agent tools
\`\`\`

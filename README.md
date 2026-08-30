# PatchPilot 3.0: The Shadow Change Lab

**Understand. Simulate. Govern. Apply.**

PatchPilot 3.0 is a browser-native WebMCP application that introduces a novel paradigm for human-AI collaboration: **The Shadow Change Lab**.

Most AI coding assistants operate on a fundamental flaw: they edit the live, authoritative state of the project, forcing the human to clean up their messes. 

In PatchPilot 3.0, the agent is strictly prohibited from mutating the authoritative workspace. Instead, when the agent wants to propose a change, it creates a **Shadow Revision**.

## Core Innovation

- **Shadow Revisions**: Agent patches are fully isolated in a simulated workspace before they touch authoritative state.
- **Impact Graphs**: The system calculates visual dependency mapping to determine the "blast radius" of the agent's patch.
- **Risk Budgets**: Strict human limits govern the agent. If the agent touches a protected file or exceeds the allowed patch size, the Shadow Revision is instantly blocked by the system.
- **Causal Evidence**: The agent must prove the tests pass in the Shadow Revision. The human reviews evidence, not just diffs.
- **Change Contracts**: Human intent acts as a persistent programmatic constraint.

## How it works (The Hero Workflow)

1. The Human sets a Change Contract: *"Fix the shipping logic, don't touch tax, keep the patch small."*
2. The Agent creates a Shadow Revision attempting to fix the bug, but mistakenly touches `tax.ts`.
3. The System runs Impact Analysis and Shadow Tests.
4. The System blocks the Shadow Revision because `tax.ts` is in the Risk Budget's protected areas.
5. The Agent observes the block reason, and proposes a narrower Shadow Revision.
6. The System proves the new Shadow Revision works and respects the budget.
7. The Human approves the proven Shadow Revision, which is then applied to the live workspace.

## Documentation

- [`PRODUCT_CONCEPT.md`](./PRODUCT_CONCEPT.md): The philosophy of the Shadow Lab.
- [`SECURITY_MODEL.md`](./SECURITY_MODEL.md): How risk budgets and contracts govern agent behavior.
- [`WEBMCP_TOOLS.md`](./WEBMCP_TOOLS.md): The native tool spec for an agent to use this.
- [`JUDGE_GUIDE.md`](./JUDGE_GUIDE.md): How to judge this hackathon entry.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd patchpilot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`.

### Judge Demo
Click **"Run Hero Demo"** on the landing page to watch a programmatic replay of the Shadow Lab workflow.

## Technology Stack

- **React 19**
- **TypeScript**
- **Vite**
- **Zustand** (State Management)
- **diff** (Patch generation and parsing)
- **Lucide React** (Icons)
- **Vanilla CSS** (Custom Design System)

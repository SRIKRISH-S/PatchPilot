# Judge Guide: PatchPilot 3.0

Thank you for reviewing PatchPilot 3.0 for the OpenAI WebMCP Challenge!

This project is a browser-native React application that implements a novel paradigm for human-AI collaboration: **The Shadow Change Lab**. 

We highly recommend viewing the application in a WebMCP-enabled browser (like the ChatGPT desktop app or a compatible Chromium build) to experience the full interaction, but **the demo works perfectly in standard browsers via the Rehearsal Mode.**

## Quick Start
1. Run `npm run dev` to start the Vite server.
2. Open the application in your browser.
3. On the landing page, click **Run Hero Demo** (Rehearsal Mode) or **Enter Human-Governed Workspace** for manual exploration.

## How to Evaluate This Entry

### 1. Run the "Hero Story" (Rehearsal Mode)
Clicking "Run Hero Demo" triggers a fully scripted, programmatic sequence that drives the actual WebMCP state machine (no fake state). It demonstrates:
- The human setting a strict Change Contract and Risk Budget ("Don't touch tax.ts").
- The agent attempting a fix that violates the budget.
- The system automatically **blocking** the agent's Shadow Revision.
- The agent dynamically proposing a narrower, safer fix.
- The system proving the fix passes shadow tests before human approval.

### 2. Enter "Judge Mode"
In the top right corner of the workspace, click the **JUDGE MODE** button. 
This brings up an overlay that clearly articulates our core innovation, the exact mechanics of the Shadow Lab, and provides a prompt you can copy-paste into your actual WebMCP agent to try the integration live.

### 3. Inspect the Architecture
Check `src/store.ts` and `src/webmcp.ts` to see how we guarantee security:
- `createShadowRevision`: The heart of the simulation engine.
- `evaluateRiskBudget`: The policy engine that blocks unsafe AI behavior.
- `webmcp.ts`: Notice that we deliberately **do not** expose `write_file` to the agent. The agent is forced to use the Shadow Lab.

### The Innovation
Most WebMCP demos are variations of "I gave the AI a file writer tool and it built a website." 
PatchPilot 3.0 asks: **"How do we safely let an AI touch a production codebase?"** 

The answer is **governance, isolation, and proof.** By forcing the AI into a Shadow Revision, enforcing Risk Budgets, and generating visual Causal Evidence (Impact Graphs and Shadow Tests), we transform the AI from a dangerous rogue agent into a verifiable, governed collaborator.

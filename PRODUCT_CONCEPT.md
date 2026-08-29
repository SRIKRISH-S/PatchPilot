# PatchPilot 2.0: The Shadow Change Lab

*Debug together. You decide what changes.*

## The Problem with AI Coding Assistants
Today's WebMCP agents and AI coding assistants operate on a fundamental flaw: **they edit the live, authoritative state of the project.**

Even when they propose a "diff", the mental burden is on the human to read the code, guess if it breaks something else, and pray the tests pass. If the agent makes a mistake, the human has to clean it up. The agent is treated as a peer, but it is not a peer. It is a highly capable, probabilistic system that requires governance.

## The Innovation: Shadow Revisions
PatchPilot 2.0 introduces the **Shadow Change Lab**. 

In PatchPilot, the agent is strictly prohibited from mutating the authoritative workspace. Instead, when the agent wants to propose a change, it creates a **Shadow Revision**. 

A Shadow Revision is an isolated, simulated fork of the workspace. Within this shadow environment:
1. The agent applies its patches.
2. The system calculates an **Impact Graph**, visually mapping the dependency blast radius of the change.
3. The system executes the entire test suite against the shadow state.
4. The system evaluates the change against the human's **Risk Budget** and **Change Contract**.

## Causal Evidence, not just Code
Because the agent operates in a Shadow Revision, it cannot just present a diff to the human. It presents **Causal Evidence**.

The human does not just see `+ calculateShipping(total)`, they see:
- "This patch changes 1 file."
- "The impact radius is localized to the Checkout module."
- "It respects the Risk Budget (max 2 files, does not touch tax.ts)."
- "It proves that 4 previously failing tests now pass, without breaking the other 8."

**"Don't let AI change your system. Let AI prove the change."**

## Human Governance
The human developer acts as the Governor. They do not write the boilerplate fix; they define the constraints.

- **Change Contracts**: Programmatic declarations of intent (e.g. "Fix shipping, preserve tax logic").
- **Risk Budgets**: Hard limits on the agent's autonomy (e.g. "Max 50 lines changed, `src/tax.ts` is strictly protected").

If a Shadow Revision violates the Risk Budget (e.g. the agent tries to "fix" shipping by altering the tax rate), the system instantly blocks the shadow. The agent is forced to observe the block reason and propose a narrower, safer patch.

## Why PatchPilot is not just another AI coding assistant
Typical AI coding assistants follow a basic loop: **Prompt → Modify → Test**.
This places the burden of proof entirely on the human reviewer.

PatchPilot uses a fundamentally differentiated interaction model:
**Intent → Inspect → Shadow → Prove → Analyze → Negotiate → Approve → Apply → Verify**

The core innovation is that **the human governs the change BEFORE it becomes authoritative.**

## Skeptical Judge FAQ

1. **Why is this WebMCP and not just an API?**
   An API requires the agent to build the interaction logic. WebMCP exposes typed capabilities directly connected to the live, stateful workspace running in the user's browser, enabling seamless collaboration without custom agent-side plumbing.
2. **Why does the agent need to operate the page itself?**
   The agent is not scraping the DOM or guessing what UI buttons do. It interacts with the live application state via structured WebMCP schemas (`create_shadow_revision`, `analyze_impact`), which guarantees deterministic execution while the human monitors visually.
3. **What does the human do that the agent cannot?**
   The human dictates policy: setting Risk Budgets (e.g. max files), defining the Change Contract, locking protected files (`tax.ts`), and ultimately approving/rejecting patches.
4. **What prevents the agent from bypassing the human?**
   The WebMCP registry strictly omits human-only tools. There is no `approve_patch` tool available to the agent.
5. **What happens if the workspace changes after the agent's proposal?**
   PatchPilot has strict Staleness Checks. If the live revision advances while the agent is building a shadow revision, the shadow is marked as **STALE** and fails closed upon application.
6. **What proves the patch actually works?**
   Causal Evidence. The shadow revision runs the live test suite in an isolated environment. The agent must present passing tests *before* the human considers the patch.
7. **What is simulated vs real?**
   The domain logic (tests, constraints, graphs) is real and deterministic. The Rehearsal Mode in the UI is a local, hardcoded simulation of an agent's actions for fast, offline demos, but it relies on the exact same underlying State API that the actual WebMCP connection uses.
8. **Why is this more than an AI code editor?**
   It's a Governance Engine. AI editors help you type. PatchPilot helps you secure, restrict, and verify what AI writes.
9. **What is the single most innovative part?**
   The **Shadow Change Lab** – forcing the agent to prove its patch in isolation against human-defined programmatic constraints (Risk Budgets) before authorization.
10. **Can I understand the concept in 30 seconds?**
    Yes: "Don't let AI edit your code. Force AI to prove its patch in a shadow environment first."
11. **Can I see the WebMCP advantage in under 2 minutes?**
    Yes. Run the Hero Demo. The agent connects via WebMCP, hits a human-defined constraint, gets blocked, adapts, and proposes a verified patch.
12. **Can I break it by issuing a malicious request?**
    Try it. If your agent attempts to edit `tax.ts` directly, it will receive an `INVALID_INPUT` error. If it proposes a shadow revision that touches `tax.ts`, the proposal will be immediately `BLOCKED BY POLICY`.

## Conclusion
PatchPilot 2.0 is not a generic AI chat window. It is a browser-native, WebMCP-powered, human-governed change lab that forces AI agents to prove their work before it ever touches production state.

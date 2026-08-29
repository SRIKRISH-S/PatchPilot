# PatchPilot 3.0: Human-Governed Agentic Change Management

*AI can generate the change. PatchPilot makes it prove the change.*

## The Problem with AI Coding Assistants
Today's WebMCP agents and AI coding assistants operate on a fundamental flaw: **they edit the live, authoritative state of the project.**

Even when they propose a "diff", the mental burden is on the human to read the code, guess if it breaks something else, and pray the tests pass. If the agent makes a mistake, the human has to clean it up. The agent is treated as a peer, but it is not a peer. It is a highly capable, probabilistic system that requires governance.

## The Innovation: Counterfactual Change Arena
PatchPilot 3.0 introduces the **Counterfactual Change Arena**. 

In PatchPilot, the agent is strictly prohibited from mutating the authoritative workspace. Instead, when investigating an issue, the agent creates multiple **Candidate Shadow Revisions** (e.g., A: Minimal, B: Balanced, C: Refactor).

Within this shadow environment, each candidate is independently evaluated:
1. **Testing**: The system executes the entire test suite against the shadow state.
2. **Impact Graph**: The system calculates the dependency blast radius of the change.
3. **Behavioral Invariants**: The system dynamically tests the human-defined business invariants (e.g. Tax behavior, Coupon semantics) to ensure they have not been violated.
4. **Risk Budget**: The system evaluates the change against the human's hard limits (e.g. Max Files, Protected Areas).

## Causal Evidence, not just Code
Because the agent operates in the Counterfactual Arena, it cannot just present a diff. It presents a **Strategy Comparison Matrix**.

The human does not just see `+ calculateShipping(total)`, they see:
- Candidate A changes 18 lines, but fails a business invariant.
- Candidate B passes all invariants, but violates the scope budget by touching 4 files.
- Candidate C passes tests, preserves invariants, and respects the budget.

**"Don't let AI change your system. Let AI prove the change."**

## Human Governance
The human developer acts as the Governor. They do not write the boilerplate fix; they define the constraints.

- **Change Contracts**: Programmatic declarations of intent (e.g. "Fix shipping, preserve tax logic").
- **Behavioral Invariants**: Formal rules asserting that legacy behaviors remain mathematically equivalent regardless of code changes.
- **Risk Budgets**: Hard limits on the agent's autonomy (e.g. "Max 50 lines changed, `src/tax.ts` is strictly protected").

If a Shadow Revision fails an invariant or violates the budget, it is instantly blocked. 

## Why PatchPilot is not just another AI coding assistant
Typical AI coding assistants follow a basic loop: **Prompt → Modify → Test**.
This places the burden of proof entirely on the human reviewer.

PatchPilot uses a fundamentally differentiated interaction model:
**Understand → Simulate (A, B, C) → Compare → Govern → Apply**

The core innovation is that **the human governs the change BEFORE it becomes authoritative.**

## Skeptical Judge FAQ

1. **Why not just use a coding agent?**
   Because PatchPilot separates generation from authorization. Agents can hallucinate or break subtle business logic; separating generation from authorization ensures human oversight of proven evidence.
2. **Why not just use a backend API?**
   Because the agent operates on page-local live workspace state, human constraints, shadow state, evidence, and revisions directly in the user's browser.
3. **Why is WebMCP important?**
   It gives the agent structured capabilities of the live application.
4. **Why not trust tests alone?**
   Passing tests does not prove business invariants remain preserved. AI can rewrite a function to pass tests but unintentionally alter a downstream coupling.
5. **What happens if the human changes the code?**
   The proposal becomes stale and the agent must re-read the current authoritative state.
6. **Can the agent approve itself?**
   No. The `apply_patch` WebMCP tool does not exist for the agent.
7. **Can it bypass protected code?**
   No. Protected files are strictly locked in the Risk Budget.
8. **Can it exceed the human's risk budget?**
   No.
9. **Can the agent change the Change Contract or Behavioral Invariants?**
   No. These are human-only governance structures.
10. **How does the agent choose the best candidate?**
    The agent *does not* choose the final candidate. The agent proposes candidates to the Counterfactual Arena, and the final choice always remains human-controlled.
11. **What is the single most innovative part?**
    The **Counterfactual Change Arena** – forcing the agent to prove competing patches in isolated parallel shadows against human-defined business invariants before authorization.
12. **Can I see the WebMCP advantage?**
    Yes. Run the Hero Demo. The agent connects via WebMCP, creates 3 candidates, and hits human-defined constraints where only one valid candidate survives the Counterfactual Eval.

## Conclusion
PatchPilot 3.0 is a browser-native, WebMCP-powered, Human-Governed Agentic Change Management platform that forces AI agents to prove competing counterfactual strategies before they ever touch production state.

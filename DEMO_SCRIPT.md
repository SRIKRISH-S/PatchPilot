# PatchPilot — 2-minute judge demo

## Setup

Open the deployed site in ChatGPT's in-app browser (or Chrome with WebMCP enabled). Start from the default project. Click **Run judge demo** once to create the intentional shipping bug and stage the agent proposal.

## 0:00–0:15 — Problem

"PatchPilot is a debugging workspace where the human and the agent work on the same live project. The project currently has a broken shipping rule."

Run tests. Show the failed `heavy India shipping` assertion.

## 0:15–0:40 — Agent inspection

Tell the agent:

> Inspect the current project, find why the shipping test fails, and propose a fix. Do not change the file without my approval.

The agent should use `get_project_state`, `get_file`, `get_test_results`, and `propose_patch`.

## 0:40–1:00 — Human approval

The proposal appears in **AGENT PROPOSAL**. Explain:

> "The agent can propose the change, but it cannot silently apply it. I decide what enters my workspace."

Click **Approve**. Run tests again. Show all checks passing.

## 1:00–1:25 — Human lock

Select `shipping.js` and click **Lock**.

Tell the agent:

> The shipping logic is now locked. Continue working on the project without modifying that file.

The agent can still inspect the workspace and work on other files, but the application rejects mutations against the locked file.

## 1:25–1:45 — Shared live state

Make a small manual edit in `cart.js` or unlock/relock the active file. Then ask the agent for `get_project_state` and show that the agent sees the current file list, locks, and test state.

## 1:45–2:00 — WebMCP point

Show the tool count / WebMCP indicator and say:

> "The important part isn't a chatbot beside an IDE. The page itself exposes structured tools for its live state. The human and the agent operate the same workspace, with human-only control over approval and locked areas. That's the WebMCP experience we're exploring."

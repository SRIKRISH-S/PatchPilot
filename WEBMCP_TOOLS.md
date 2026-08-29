# PatchPilot 2.0 WebMCP Tool Specification

PatchPilot 2.0 exposes a strictly governed set of WebMCP tools to the AI agent. The agent cannot bypass human constraints or alter authoritative state.

## 1. READ TOOLS
These tools allow the agent to inspect the authoritative state of the workspace.

- `get_project_state`: Returns the live revision, failing tests, active file, Risk Budget, and Change Contract.
- `list_files`: Returns the project file tree and protection status.
- `get_file`: Reads the contents of a specific file from the live workspace.
- `get_test_results`: Returns the latest live authoritative test outcomes.
- `find_references`: Searches the project for a specific symbol.
- `get_human_decisions`: Returns persistent decisions/reasoning provided by the human.
- `get_change_contract`: Returns the human-defined intent and constraints.
- `get_shadow_revision`: Returns details, status, and evidence for a specific shadow.

## 2. AGENT ANALYSIS & ACTION TOOLS
These tools are how the agent operates the Shadow Lab.

- `create_shadow_revision`: Creates a new isolated Shadow Revision with proposed changes. Automatically triggers impact analysis and shadow test execution. Returns the Shadow ID and status (e.g., `draft`, `blocked`, `passed`).
- `analyze_impact`: Explicitly triggers dependency blast radius analysis for a shadow.
- `run_shadow_tests`: Explicitly executes the test suite against a shadow revision.
- `get_patch_evidence`: Retrieves the causal evidence and risk assessment for a shadow.
- `apply_patch`: Applies a shadow revision to the live workspace. **WILL FAIL** if the shadow status is not `approved` by the human.
- `revert_revision`: Reverts the workspace to a previous snapshot.

## Important Notes for Agent Behavior
1. **Never edit files directly**: You do not have a `write_file` tool. You must use `create_shadow_revision`.
2. **Observe Risk Budgets**: If `create_shadow_revision` returns a status of `blocked`, read the error message. You likely touched a protected file or exceeded the max changed lines budget. Adapt your patch and try again.
3. **Approval is out of your hands**: Once you create a successful shadow revision, you must wait for the human to approve it in the UI. Do not attempt to force `apply_patch` on an unapproved shadow.

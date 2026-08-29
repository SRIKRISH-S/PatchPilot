/* ─── PatchPilot 3.0 Rehearsal mode: The Shadow Lab Hero Story ─── */

import { useWorkspaceStore } from './store';
import { FIXED_SHIPPING_TS } from './demo-project';

export interface RehearsalStep {
  label: string;
  actor: 'agent' | 'human' | 'system';
  description: string;
  delay: number;
}

export const REHEARSAL_STEPS: RehearsalStep[] = [
  { label: 'System Check', actor: 'system', description: 'Executing initial test suite...', delay: 800 },
  { label: 'Set Human Intent', actor: 'human', description: 'Configuring Change Contract: "Fix shipping failures, preserve tax, max 2 files".', delay: 1500 },
  { label: 'Agent Observes', actor: 'agent', description: 'Agent reads workspace state, contract, and invariants via WebMCP.', delay: 1000 },
  { label: 'Agent Creates Candidates', actor: 'agent', description: 'Agent investigates and proposes 3 counterfactual candidates (A, B, C) in the Shadow Arena.', delay: 1200 },
  { label: 'Counterfactual Eval', actor: 'system', description: 'Running shadow tests and invariant verifications for all candidates in isolation...', delay: 2000 },
  { label: 'Impact Analysis', actor: 'system', description: 'Calculating blast radius and risk for candidates...', delay: 1500 },
  { label: 'Arena Results', actor: 'system', description: 'Candidate A blocked by invariant. Candidate B blocked by budget. Candidate C passes.', delay: 2000 },
  { label: 'Human Review', actor: 'human', description: 'Human inspects the Counterfactual Arena strategy matrix.', delay: 2000 },
  { label: 'Apply Revision', actor: 'human', description: 'Human selects Candidate C and applies it to live authoritative state.', delay: 1000 },
];

export async function runRehearsal(
  onStep: (stepIndex: number, step: RehearsalStep) => void,
  onComplete: () => void,
): Promise<void> {
  const store = useWorkspaceStore.getState;
  const set = useWorkspaceStore.setState;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  set({ rehearsalRunning: true, rehearsalStep: 0, showLanding: false });

  // 1. System Check
  onStep(0, REHEARSAL_STEPS[0]);
  await delay(REHEARSAL_STEPS[0].delay);
  store().runProjectTests();

  // 2. Set Human Intent
  onStep(1, REHEARSAL_STEPS[1]);
  await delay(REHEARSAL_STEPS[1].delay);
  store().updateChangeContract({
    goal: 'Fix shipping bug where grams are treated as kg.',
    mustPreserve: ['tax calculation logic'],
    mustSatisfy: ['shipping tests must pass'],
  });
  store().updateRiskBudget({ maxFiles: 2, maxLines: 50, protectedAreas: ['src/tax.ts'], allowedAreas: ['src/shipping.ts'], forbidden: [] });

  // 3. Agent Observes
  onStep(2, REHEARSAL_STEPS[2]);
  await delay(REHEARSAL_STEPS[2].delay);
  store().addActivity('agent', 'inspect', 'get_project_state: Reading contract and invariants.');

  // 4. Agent Creates Candidates
  onStep(3, REHEARSAL_STEPS[3]);
  await delay(REHEARSAL_STEPS[3].delay);
  
  const taxContent = store().files['src/tax.ts']?.content || '';
  const badTaxContent = taxContent.replace('0.0725', '0.075'); // Fails tax invariant
  
  const groupId = 'group-demo-1';

  // Candidate A: Fails Invariant
  store().createShadowRevision(
    [
      { path: 'src/shipping.ts', content: FIXED_SHIPPING_TS },
      { path: 'src/tax.ts', content: badTaxContent }
    ],
    'Minimal fix but accidentally updates tax rate to 7.5%.',
    'A',
    groupId
  );

  // Candidate B: Exceeds Budget (touches 3 files)
  store().createShadowRevision(
    [
      { path: 'src/shipping.ts', content: FIXED_SHIPPING_TS },
      { path: 'src/cart.ts', content: store().files['src/cart.ts'].content + '\n// extra line' },
      { path: 'src/pricing.ts', content: store().files['src/pricing.ts'].content + '\n// extra line' }
    ],
    'Fixes shipping and touches cart/pricing to restructure dependencies.',
    'B',
    groupId
  );

  // Candidate C: Successful Refactor
  const shadowCRes = store().createShadowRevision(
    [{ path: 'src/shipping.ts', content: FIXED_SHIPPING_TS }],
    'Fixes shipping bug precisely without touching other modules.',
    'C',
    groupId
  );

  const shadowCId = (shadowCRes.data as any).shadowId;
  set({ activeShadowId: shadowCId }); // Set active to C so the arena opens focusing on C

  // 5. Counterfactual Eval
  onStep(4, REHEARSAL_STEPS[4]);
  await delay(REHEARSAL_STEPS[4].delay);
  // (Tests and invariants run automatically in createShadowRevision)

  // 6. Impact Analysis
  onStep(5, REHEARSAL_STEPS[5]);
  await delay(REHEARSAL_STEPS[5].delay);

  // 7. Arena Results
  onStep(6, REHEARSAL_STEPS[6]);
  await delay(REHEARSAL_STEPS[6].delay);
  store().addActivity('system', 'shadow', 'Arena evaluation complete. Candidates A & B blocked.');

  // 8. Human Review
  onStep(7, REHEARSAL_STEPS[7]);
  await delay(REHEARSAL_STEPS[7].delay);

  // 9. Apply Revision
  onStep(8, REHEARSAL_STEPS[8]);
  await delay(REHEARSAL_STEPS[8].delay);
  store().applyShadowRevision(shadowCId, 'human');

  set({ rehearsalRunning: false });
  onComplete();
}

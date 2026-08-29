/* ─── PatchPilot 2.0 Rehearsal mode: The Shadow Lab Hero Story ─── */

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
  { label: 'Set Human Intent', actor: 'human', description: 'Configuring Change Contract: "Fix shipping failures, do not touch tax.ts".', delay: 1500 },
  { label: 'Agent Observes', actor: 'agent', description: 'Agent reads workspace state and contract via WebMCP.', delay: 1000 },
  { label: 'Agent Creates Shadow', actor: 'agent', description: 'Agent creates Shadow Revision #1 touching shipping.ts and tax.ts.', delay: 1200 },
  { label: 'Shadow Tests Run', actor: 'system', description: 'Running shadow tests in isolation...', delay: 1500 },
  { label: 'Impact Analysis', actor: 'system', description: 'Calculating blast radius of Shadow #1...', delay: 1200 },
  { label: 'Shadow Blocked', actor: 'system', description: 'BLOCKED: Shadow #1 violates Risk Budget (Protected Area: tax.ts).', delay: 2000 },
  { label: 'Agent Adapts', actor: 'agent', description: 'Agent observes block reason, creates narrower Shadow #2.', delay: 1500 },
  { label: 'Shadow Tests Run', actor: 'system', description: 'Running shadow tests for Shadow #2...', delay: 1500 },
  { label: 'Impact Analysis', actor: 'system', description: 'Calculating blast radius of Shadow #2...', delay: 1200 },
  { label: 'Human Review', actor: 'human', description: 'Human inspects Shadow #2 evidence and approves.', delay: 2000 },
  { label: 'Apply Revision', actor: 'human', description: 'Applying Shadow #2 to live authoritative state.', delay: 1000 },
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
  store().updateContract({
    goal: 'Fix shipping bug where grams are treated as kg.',
    mustPreserve: ['tax calculation logic'],
    mustSatisfy: ['shipping tests must pass'],
  });
  store().updateRiskBudget({ maxFiles: 2, maxLines: 50, protectedAreas: ['src/tax.ts'] });

  // 3. Agent Observes
  onStep(2, REHEARSAL_STEPS[2]);
  await delay(REHEARSAL_STEPS[2].delay);
  store().addActivity('agent', 'inspect', 'get_project_state: Reading contract and constraints.');

  // 4. Agent Creates Shadow #1
  onStep(3, REHEARSAL_STEPS[3]);
  await delay(REHEARSAL_STEPS[3].delay);
  const taxContent = store().files['src/tax.ts']?.content || '';
  const badTaxContent = taxContent.replace('0.0725', '0.075'); // Bad change
  const shadow1Res = store().createShadowRevision(
    [
      { path: 'src/shipping.ts', content: FIXED_SHIPPING_TS },
      { path: 'src/tax.ts', content: badTaxContent }
    ],
    'Fixing shipping logic and updating tax rate to 7.5%.'
  );
  const shadow1Id = (shadow1Res.data as any).shadowId;
  set({ activeShadowId: shadow1Id });

  // 5. Shadow Tests Run
  onStep(4, REHEARSAL_STEPS[4]);
  await delay(REHEARSAL_STEPS[4].delay);
  // It automatically ran in createShadowRevision, but let's pause for effect.

  // 6. Impact Analysis
  onStep(5, REHEARSAL_STEPS[5]);
  await delay(REHEARSAL_STEPS[5].delay);

  // 7. Shadow Blocked
  onStep(6, REHEARSAL_STEPS[6]);
  await delay(REHEARSAL_STEPS[6].delay);
  // It's already blocked because createShadowRevision runs evaluateRiskBudget automatically.
  store().addActivity('agent', 'shadow', 'Shadow #1 BLOCKED by Risk Budget: Touched src/tax.ts');

  // 8. Agent Adapts (Narrower patch)
  onStep(7, REHEARSAL_STEPS[7]);
  await delay(REHEARSAL_STEPS[7].delay);
  const shadow2Res = store().createShadowRevision(
    [{ path: 'src/shipping.ts', content: FIXED_SHIPPING_TS }],
    'Fixing shipping logic only, preserving tax logic per contract.'
  );
  const shadow2Id = (shadow2Res.data as any).shadowId;
  set({ activeShadowId: shadow2Id });

  // 9. Shadow Tests Run
  onStep(8, REHEARSAL_STEPS[8]);
  await delay(REHEARSAL_STEPS[8].delay);

  // 10. Impact Analysis
  onStep(9, REHEARSAL_STEPS[9]);
  await delay(REHEARSAL_STEPS[9].delay);

  // 11. Human Review
  onStep(10, REHEARSAL_STEPS[10]);
  await delay(REHEARSAL_STEPS[10].delay);
  // (In UI, human clicks approve, but we'll do it programmatically in the next step)

  // 12. Apply Revision
  onStep(11, REHEARSAL_STEPS[11]);
  await delay(REHEARSAL_STEPS[11].delay);
  store().applyShadowRevision(shadow2Id, 'human');

  set({ rehearsalRunning: false });
  onComplete();
}

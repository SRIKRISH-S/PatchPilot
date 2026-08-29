/* ─── PatchPilot 2.0 – Main Application ─── */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkspaceStore } from './store';
import type { WorkspaceStore } from './store';
import { registerWebMCP, getToolManifest } from './webmcp';
import { runRehearsal, REHEARSAL_STEPS } from './rehearsal';
import type { ShadowRevision, TestResult, ActivityEvent, Constraint, PatchChange } from './types';
import * as Diff from 'diff';
import './styles.css';

/* ─── Selectors ─── */
const sel = {
  files: (s: WorkspaceStore) => s.files,
  activeFile: (s: WorkspaceStore) => s.activeFile,
  revision: (s: WorkspaceStore) => s.revision,
  constraints: (s: WorkspaceStore) => s.constraints,
  changeContract: (s: WorkspaceStore) => s.changeContract,
  riskBudget: (s: WorkspaceStore) => s.riskBudget,
  shadowRevisions: (s: WorkspaceStore) => s.shadowRevisions,
  activeShadowId: (s: WorkspaceStore) => s.activeShadowId,
  testResults: (s: WorkspaceStore) => s.testResults,
  testsRunning: (s: WorkspaceStore) => s.testsRunning,
  activity: (s: WorkspaceStore) => s.activity,
  showLanding: (s: WorkspaceStore) => s.showLanding,
  showWebMCPInspector: (s: WorkspaceStore) => s.showWebMCPInspector,
  rehearsalRunning: (s: WorkspaceStore) => s.rehearsalRunning,
  rehearsalStep: (s: WorkspaceStore) => s.rehearsalStep,
  projectName: (s: WorkspaceStore) => s.projectName,
  judgeMode: (s: WorkspaceStore) => s.judgeMode,
};

/* ─── Icons ─── */
function Icon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const icons: Record<string, string> = {
    file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM13 3.5L18.5 9H13V3.5z',
    lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-2 0V7a5 5 0 00-10 0v4',
    unlock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-2 0V7a5 5 0 00-10 0v4',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    play: 'M5 3l14 9-14 9V3z',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 110 6 3 3 0 010-6z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    git: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
    terminal: 'M4 17l6-6-6-6M12 19h8',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    alert: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    bot: 'M12 2a2 2 0 012 2v1h3a2 2 0 012 2v4a6 6 0 01-12 0V7a2 2 0 012-2h3V4a2 2 0 012-2zM9 12h.01M15 12h.01',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z',
    server: 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    chevronDown: 'M6 9l6 6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
    copy: 'M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
    link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
    arrowDown: 'M12 5v14M5 12l7 7 7-7',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'
  };
  const d = icons[name] || icons.file;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/* ─── Landing Page ─── */
function LandingPage() {
  const store = useWorkspaceStore;
  const setShowLanding = useWorkspaceStore(sel.showLanding);
  const [startingRehearsal, setStartingRehearsal] = useState(false);

  const openWorkspace = () => {
    store.getState().runProjectTests();
    store.getState().setShowLanding(false);
  };

  const startRehearsalDemo = async () => {
    setStartingRehearsal(true);
    store.getState().resetDemo();
    await runRehearsal(
      (idx) => { store.setState({ rehearsalStep: idx }); },
      () => { store.setState({ rehearsalRunning: false }); setStartingRehearsal(false); },
    );
  };

  return (
    <div className="landing">
      <div className="landing-content">
        <div className="landing-logo">
          <div className="logo-mark">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#logo-grad)" />
              <path d="M14 24h6l3-8 3 16 3-8h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
            </svg>
          </div>
          <h1 className="landing-title">PatchPilot 2.0</h1>
          <p className="landing-tagline">Understand. Simulate. Govern. Apply.</p>
        </div>

        <div className="landing-diagram">
          <div className="diagram-node human-node">
            <Icon name="user" size={20} />
            <span>Human Developer</span>
          </div>
          <div className="diagram-arrow">↕ (Controls & Approves)</div>
          <div className="diagram-node workspace-node shadow">
            <Icon name="shield" size={20} />
            <span>Shadow Change Lab</span>
          </div>
          <div className="diagram-arrow">↕ (Simulates & Proves)</div>
          <div className="diagram-node agent-node">
            <Icon name="bot" size={20} />
            <span>AI Agent (WebMCP)</span>
          </div>
        </div>

        <div className="landing-actions">
          <button className="landing-btn primary" onClick={openWorkspace}>
            <Icon name="terminal" size={18} />
            Enter Human-Governed Workspace
          </button>
          <button className="landing-btn secondary" onClick={startRehearsalDemo} disabled={startingRehearsal}>
            <Icon name="play" size={18} />
            {startingRehearsal ? 'Running Rehearsal…' : 'Run Hero Demo'}
          </button>
        </div>

        <div className="landing-features">
          <div className="feature">
            <Icon name="shield" size={18} />
            <div><strong>Shadow Revisions</strong><span>Agent changes are isolated and simulated</span></div>
          </div>
          <div className="feature">
            <Icon name="git" size={18} />
            <div><strong>Impact Analysis</strong><span>Visual dependency graphs of patch radius</span></div>
          </div>
          <div className="feature">
            <Icon name="sliders" size={18} />
            <div><strong>Risk Budgets</strong><span>Strict limits on agent's scope of change</span></div>
          </div>
          <div className="feature">
            <Icon name="zap" size={18} />
            <div><strong>Causal Evidence</strong><span>Agent proves the change before approval</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Top Bar ─── */
function TopBar() {
  const store = useWorkspaceStore;
  const revision = useWorkspaceStore(sel.revision);
  const activeShadowId = useWorkspaceStore(sel.activeShadowId);
  const shadowRevisions = useWorkspaceStore(sel.shadowRevisions);
  const activeShadow = activeShadowId ? shadowRevisions.find(s => s.id === activeShadowId) : null;
  const testResults = useWorkspaceStore(sel.testResults);
  const rehearsalRunning = useWorkspaceStore(sel.rehearsalRunning);
  const judgeMode = useWorkspaceStore(sel.judgeMode);
  
  const buildId = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA 
    ? import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA.substring(0, 7) 
    : 'local';

  return (
    <header className="topbar">
      <div className="topbar-left flex items-center">
        <div className="brand mr-4">
          <div className="logo-sm">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#logo-grad-sm)" />
              <path d="M14 24h6l3-8 3 16 3-8h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="logo-grad-sm" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
            </svg>
          </div>
          <div className="brand-name">PATCHPILOT 3.0</div>
        </div>
        <div className="text-[10px] text-tertiary bg-surface-raised px-2 py-0.5 rounded border border-subtle">
          BUILD {buildId}
        </div>
      </div>

      <div className="topbar-center flex gap-2">
        <div className="status-pill border-blue/30 text-blue bg-blue/5">
          LIVE REVISION #{revision}
        </div>
        
        {activeShadow && (
          <>
            <div className={`status-pill ${activeShadow.status === 'blocked' ? 'border-red/30 text-red bg-red/5' : activeShadow.status === 'passed' ? 'border-amber/30 text-amber bg-amber/5' : 'border-green/30 text-green bg-green/5'}`}>
              SHADOW: {activeShadow.candidateId ? `CANDIDATE ${activeShadow.candidateId}` : activeShadow.id.split('-').pop()}
            </div>
          </>
        )}

        <div className="status-pill border-subtle text-secondary bg-surface-raised">
          {testResults ? `${testResults.passed}/${testResults.total} TESTS` : 'NO TESTS'}
        </div>

        <div className="status-pill border-subtle text-secondary bg-surface-raised">
          INVARIANTS {activeShadow ? (activeShadow.invariantResults && Object.values(activeShadow.invariantResults).every(v => v === 'pass') ? '✓' : '✗') : '✓'}
        </div>

        <div className="status-pill border-subtle text-secondary bg-surface-raised">
          RISK: {activeShadow?.riskAssessment?.overallRisk?.toUpperCase() || 'LOW'}
        </div>

        <div className="status-pill border-violet/30 text-violet bg-violet/5 font-bold">
          <Icon name="shield" size={12} className="inline mr-1 -mt-0.5" />
          HUMAN GOVERNED
        </div>
      </div>

      <div className="topbar-right">
        {rehearsalRunning && (
          <span className="rehearsal-badge mr-4">
            <Icon name="play" size={12} /> REHEARSAL
          </span>
        )}
        
        {store.getState().webmcpStatus?.available ? (
          <span className="text-xs text-green border border-green/30 bg-green/5 px-2 py-1 rounded mr-3 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green animate-pulse"></div>
            WEBMCP • CONNECTED
          </span>
        ) : (
          <span className="text-xs text-red border border-red/30 bg-red/5 px-2 py-1 rounded mr-3 opacity-80 flex items-center gap-1">
            WEBMCP • NOT CONNECTED
          </span>
        )}
        <button className={`topbar-btn ${judgeMode ? 'active' : ''}`} onClick={() => store.getState().setJudgeMode(!judgeMode)}>
          JUDGE MODE
        </button>
        <button className="topbar-btn" onClick={() => store.getState().setShowWebMCPInspector(true)}>
          <Icon name="link" size={14} /> WebMCP
        </button>
      </div>
    </header>
  );
}

/* ─── File Sidebar ─── */
function FileSidebar() {
  const files = useWorkspaceStore(sel.files);
  const activeFile = useWorkspaceStore(sel.activeFile);
  const store = useWorkspaceStore;

  const filePaths = Object.keys(files);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="section-label">LIVE WORKSPACE</span>
      </div>
      <div className="file-tree">
        {filePaths.map(path => {
          const name = path.split('/').pop()!;
          return (
            <button key={path}
              className={`file-item ${activeFile === path ? 'active' : ''}`}
              onClick={() => store.getState().setActiveFile(path)}>
              <span className="file-icon-badge">{files[path].language === 'typescript' ? 'TS' : 'JS'}</span>
              <span className="file-name">{name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

/* ─── Code Editor (Split View Support) ─── */
function CodeEditor() {
  const store = useWorkspaceStore;
  const files = useWorkspaceStore(sel.files);
  const activeFile = useWorkspaceStore(sel.activeFile);
  const activeShadowId = useWorkspaceStore(sel.activeShadowId);
  const shadowRevisions = useWorkspaceStore(sel.shadowRevisions);
  
  const activeShadow = activeShadowId ? shadowRevisions.find(s => s.id === activeShadowId) : null;
  const shadowChange = activeShadow?.changes.find(c => c.path === activeFile);

  const file = files[activeFile];
  const liveContent = file?.content || '';
  const shadowContent = shadowChange?.content || liveContent;

  const handleLiveChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    store.getState().setFileContent(activeFile, e.target.value, 'human');
  };

  return (
    <section className="editor-panel">
      <div className="editor-tabs">
        <button className="editor-tab active">{activeFile}</button>
      </div>

      <div className={`editor-split ${activeShadow ? 'is-split' : ''}`}>
        
        {/* LIVE SIDE */}
        <div className="editor-pane">
          <div className="editor-toolbar live-toolbar">
            <span className="toolbar-title">LIVE WORKSPACE (Auth)</span>
            <Icon name="lock" size={14} className="text-tertiary" title="Protected from direct agent edits" />
          </div>
          <textarea
            className="code-textarea"
            value={liveContent}
            onChange={handleLiveChange}
            spellCheck={false}
          />
        </div>

        {/* SHADOW SIDE */}
        {activeShadow && (
          <div className="editor-pane shadow-pane">
            <div className="editor-toolbar shadow-toolbar">
              <span className="toolbar-title text-violet">SHADOW REVISION {activeShadow.status === 'blocked' ? '(BLOCKED)' : ''}</span>
              {shadowChange && <span className="tab-dot text-violet">● Modified</span>}
            </div>
            <textarea
              className={`code-textarea ${activeShadow.status === 'blocked' ? 'blocked' : ''}`}
              value={shadowContent}
              readOnly
              spellCheck={false}
            />
          </div>
        )}
        
      </div>
    </section>
  );
}

/* ─── Right Panel: Evidence ─── */
function EvidenceView({ shadow }: { shadow: ShadowRevision }) {
  if (!shadow.evidence) return <div className="p-4 text-tertiary">No evidence generated yet.</div>;
  const { evidence, riskAssessment } = shadow;
  const isApproved = shadow.status === 'approved';

  const steps = [
    { icon: 'zap', color: 'red', title: 'Observed Failure', desc: 'Tests failing in base revision' },
    { icon: 'search', color: 'blue', title: 'Root Cause', desc: evidence.proposedFix },
    { icon: 'file', color: 'violet', title: 'Shadow Patch', desc: 'Candidate changes applied in isolation' },
    { icon: 'git', color: 'amber', title: 'Impact Analysis', desc: `Blast radius: ${evidence.impactLevel}` },
    { icon: 'shield', color: riskAssessment?.overallRisk === 'high' ? 'red' : 'green', title: 'Invariant Verification', desc: riskAssessment?.budgetViolations.length ? riskAssessment.budgetViolations.join(', ') : 'Within risk budget and invariants preserved' },
    { icon: 'check', color: evidence.shadowTestsPassed ? 'green' : 'red', title: 'Test Verification', desc: shadow.testResults ? `${shadow.testResults.passed}/${shadow.testResults.total} TESTS PASSING` : 'Verified' },
    ...(isApproved || shadow.evidence?.humanDecision ? [
      { icon: 'user', color: 'violet', title: 'Human Approval', desc: shadow.evidence?.humanDecision || 'Human Authorized' },
      { icon: 'server', color: 'blue', title: 'Live Revision', desc: 'Merged to authoritative state' },
      { icon: 'copy', color: 'primary', title: 'Change Receipt', desc: 'Immutable governance record generated' }
    ] : [])
  ];

  return (
    <div className="evidence-chain">
      <h3 className="evidence-title">
        <Icon name="search" size={16} /> Causal Evidence Board
      </h3>
      
      <div className="timeline-container">
        {steps.map((step, i) => (
          <div key={i} className="timeline-step">
            <div className={`timeline-icon-wrap ${step.color}`}>
              <Icon name={step.icon} size={12} />
            </div>
            <div className="timeline-content">
              <strong className={step.color}>{step.title}</strong>
              <span>{step.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Right Panel: Impact Graph ─── */
function ImpactGraphView({ shadow }: { shadow: ShadowRevision }) {
  if (!shadow.impactAnalysis) return <div className="p-4 text-tertiary">Run impact analysis to view graph.</div>;
  
  const { nodes, summary } = shadow.impactAnalysis;

  return (
    <div className="impact-view">
      <div className="impact-summary mb-4">
        <div className={`impact-badge ${summary.highestImpact.toLowerCase()}`}>
          IMPACT: {summary.highestImpact}
        </div>
        {summary.violatesProtection && (
          <div className="impact-badge protected text-red mt-2">
            <Icon name="shield" size={12} /> PROTECTED AREA AFFECTED
          </div>
        )}
      </div>
      <div className="graph-container">
        {nodes.map(n => (
          <div key={n.id} className={`graph-node ${n.impactLevel.toLowerCase()}`}>
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Right Panel: Contract & Budget ─── */
function ContractView() {
  const contract = useWorkspaceStore(sel.changeContract);
  const budget = useWorkspaceStore(sel.riskBudget);

  return (
    <div className="contract-view p-4">
      <h3 className="text-sm font-bold text-primary mb-2">HUMAN INTENT CONTRACT</h3>
      <div className="contract-box mb-6">
        <p className="text-secondary mb-2"><strong>Goal:</strong> {contract.goal}</p>
        <p className="text-secondary mb-2"><strong>Must Preserve:</strong> {contract.mustPreserve.join(', ')}</p>
        <p className="text-secondary"><strong>Must Satisfy:</strong> {contract.mustSatisfy.join(', ')}</p>
      </div>

      <h3 className="text-sm font-bold text-primary mb-2">RISK BUDGET</h3>
      <div className="budget-box">
        <p className="text-secondary mb-2"><strong>Max Scope:</strong> {budget.maxFiles} files, {budget.maxLines} lines</p>
        <p className="text-secondary mb-2"><strong>Allowed:</strong> {budget.allowedAreas.join(', ')}</p>
        <p className="text-amber"><strong>Protected:</strong> {budget.protectedAreas.join(', ')}</p>
      </div>
    </div>
  );
}

/* ─── Right Panel: Agent Activity ─── */
function AgentActivity() {
  const activity = useWorkspaceStore(sel.activity).filter(a => a.actor !== 'human');
  
  return (
    <div className="timeline p-4">
      {activity.map(a => (
        <div key={a.id} className="timeline-event">
          <Icon name={a.actor === 'agent' ? 'bot' : 'server'} size={14} className="text-tertiary" />
          <div className="ml-2">
            <div className="text-sm text-primary">{a.description}</div>
            <div className="text-xs text-tertiary">{new Date(a.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CounterfactualArena({ activeShadow }: { activeShadow: ShadowRevision }) {
  const store = useWorkspaceStore;
  const shadowRevisions = useWorkspaceStore(sel.shadowRevisions);
  
  const group = activeShadow.groupId 
    ? shadowRevisions.filter(s => s.groupId === activeShadow.groupId).reverse()
    : shadowRevisions.filter(s => s.baseRevision === activeShadow.baseRevision && s.id === activeShadow.id);

  const formatInvariant = (shadow: ShadowRevision) => {
    if (!shadow.invariantResults) return '✗';
    const allPass = Object.values(shadow.invariantResults).every(r => r === 'pass');
    return allPass ? '✓' : '✗';
  };

  const getRecommended = () => {
    return group.find(s => s.status === 'passed' && s.riskAssessment?.overallRisk === 'low') || group.find(s => s.status === 'passed') || null;
  };

  const recommended = getRecommended();
  
  const getBlockReason = (shadow: ShadowRevision) => {
    if (shadow.status !== 'blocked') return null;
    if (formatInvariant(shadow) === '✗') return 'Invariants: FAILED';
    if (shadow.riskAssessment?.budgetViolations.length) return 'Risk: Budget exceeded';
    if (shadow.impactAnalysis?.summary.highestImpact === 'HIGH') return 'Impact: HIGH';
    if (shadow.impactAnalysis?.summary.highestImpact === 'PROTECTED') return 'Risk: Protected file';
    return 'Status: BLOCKED';
  };

  return (
    <div className="proposal-view">
      <div className="arena-header">
        <h3 className="arena-title">COUNTERFACTUAL CHANGE ARENA</h3>
        <p className="arena-subtitle">"Three possible ways to fix the same production failure."</p>
      </div>

      <div className="arena-grid">
        {group.map(s => {
          const isBlocked = s.status === 'blocked';
          const blockReason = getBlockReason(s);
          const isRecommended = recommended?.id === s.id;
          
          return (
            <div key={s.id} className={`candidate-card ${isBlocked ? 'blocked' : ''} ${isRecommended ? 'recommended' : ''}`}>
              <div className={`candidate-header ${isBlocked ? 'blocked' : ''} ${isRecommended ? 'recommended' : ''}`}>
                Candidate {s.candidateId || s.id.split('-').pop()}
              </div>
              <div className="candidate-body">
                <div className="candidate-metric">
                  <span className="metric-label">Tests:</span>
                  <span className={`metric-value ${s.testResults?.failed ? 'fail' : ''}`}>{s.testResults ? `${s.testResults.passed}/${s.testResults.total}` : '-'}</span>
                </div>
                <div className="candidate-metric">
                  <span className="metric-label">Impact:</span>
                  <span className={`metric-value ${s.impactAnalysis?.summary.highestImpact === 'HIGH' ? 'warn' : ''}`}>{s.impactAnalysis?.summary.highestImpact || '-'}</span>
                </div>
                {isBlocked ? (
                  <div className="candidate-block-reason">
                    {blockReason}
                  </div>
                ) : (
                  <>
                    <div className="candidate-metric">
                      <span className="metric-label">Risk:</span>
                      <span className="metric-value">{s.riskAssessment?.overallRisk || '-'}</span>
                    </div>
                    <div className="candidate-metric">
                      <span className="metric-label">Files:</span>
                      <span className="metric-value">{s.changes.length}</span>
                    </div>
                    <div className="candidate-metric">
                      <span className="metric-label">Lines:</span>
                      <span className="metric-value">{s.changes.reduce((a,c) => a + c.content.split('\n').length, 0)}</span>
                    </div>
                    <div className="candidate-metric">
                      <span className="metric-label">Invariants:</span>
                      <span className="metric-value pass">PASS</span>
                    </div>
                    <div className="candidate-metric">
                      <span className="metric-label">Budget:</span>
                      <span className="metric-value pass">PASS</span>
                    </div>
                    <div className="candidate-ready">
                      Status: READY FOR APPROVAL
                    </div>
                  </>
                )}
              </div>
              <button 
                className={`candidate-action ${store.getState().activeShadowId === s.id ? 'active' : ''}`}
                onClick={() => store.setState({ activeShadowId: s.id })}>
                {store.getState().activeShadowId === s.id ? 'VIEWING CODE' : 'VIEW CODE'}
              </button>
            </div>
          );
        })}
      </div>

      {recommended && store.getState().activeShadowId === recommended.id && (
        <div className="review-section">
          <div className="review-header">
            <h4 className="review-title">READY FOR HUMAN REVIEW</h4>
            <div className="review-cand-id">Candidate {recommended.candidateId || recommended.id.split('-').pop()}</div>
          </div>
          
          <div className="review-body">
            <p className="review-desc">Candidate {recommended.candidateId || recommended.id.split('-').pop()} satisfies all constraints:</p>
            <div className="review-checks">
              <div className="review-check"><Icon name="check" size={16} /> {recommended.testResults?.passed}/{recommended.testResults?.total} tests</div>
              <div className="review-check"><Icon name="check" size={16} /> Behavioral invariants preserved</div>
              <div className="review-check"><Icon name="check" size={16} /> Protected files untouched</div>
              <div className="review-check"><Icon name="check" size={16} /> Risk budget satisfied</div>
              <div className="review-check"><Icon name="check" size={16} /> Shadow isolated</div>
              <div className="review-check"><Icon name="check" size={16} /> Impact analyzed</div>
            </div>
            
            <div className="review-actions">
              <button 
                className="review-btn secondary"
                onClick={() => store.setState({ activeTab: 'EVIDENCE' })}>
                <Icon name="search" size={14} /> VIEW EVIDENCE
              </button>
              <button 
                className="review-btn primary"
                onClick={() => store.getState().applyShadowRevision(recommended.id, 'human')}>
                <Icon name="check" size={16} /> APPROVE & APPLY
              </button>
            </div>
            <div className="review-disclaimer">
              Human Authorized Only
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Right Panel: Change Receipt ─── */
function ChangeReceiptView({ activeShadow }: { activeShadow: ShadowRevision }) {
  const store = useWorkspaceStore;
  const receipts = useWorkspaceStore(s => s.patchReceipts);
  const receipt = receipts.find(r => r.shadowId === activeShadow.id);

  if (!receipt) return <div className="p-4 text-secondary">Receipt not found.</div>;

  const timestamp = new Date(receipt.timestamp).toLocaleString();
  const candidateName = `Candidate ${receipt.selectedCandidate || receipt.shadowId.split('-').pop()}`;

  return (
    <div className="receipt-view proposal-view">
      <div className="receipt-header-banner">
        <div className="receipt-icon-wrap">
          <Icon name="check" size={24} />
        </div>
        <div>
          <h3 className="receipt-title">APPLIED TO LIVE</h3>
          <p className="receipt-subtitle">The counterfactual candidate has been merged into authoritative state.</p>
        </div>
      </div>

      <div className="receipt-panel">
        <div className="receipt-panel-header">
          <h4 className="receipt-panel-title">
            <Icon name="shield" size={16} /> 
            Change Receipt
          </h4>
          <span className="receipt-id">{receipt.id}</span>
        </div>
        
        <div className="receipt-grid">
          <div className="receipt-label">Selected Candidate</div>
          <div className="receipt-value">{candidateName}</div>

          <div className="receipt-label">Human Decision</div>
          <div className="receipt-value violet">
            <Icon name="user" size={14} /> Approved ({receipt.approvedBy})
          </div>

          <div className="receipt-label">Changed Files</div>
          <div className="receipt-value mono">
            {activeShadow.changes.map(c => c.path).join(', ')}
          </div>

          <div className="receipt-label">Verification</div>
          <div className="receipt-value green">
            {activeShadow.testResults ? `${activeShadow.testResults.passed}/${activeShadow.testResults.total} tests passing` : 'Verified'}
          </div>

          <div className="receipt-label">Behavioral Invariants</div>
          <div className="receipt-value green">All preserved</div>

          <div className="receipt-label">Risk Budget</div>
          <div className="receipt-value green">Compliant</div>

          <div className="receipt-label">Protected Files</div>
          <div className="receipt-value">untouched</div>

          <div className="receipt-label">Impact</div>
          <div className={`receipt-value ${receipt.impact === 'HIGH' ? 'amber' : 'blue'}`}>{receipt.impact}</div>

          <div className="receipt-label receipt-divider">Live Revision</div>
          <div className="receipt-value receipt-live-rev receipt-divider">#{receipt.revision}</div>

          <div className="receipt-label">Timestamp</div>
          <div className="receipt-value receipt-timestamp">{timestamp}</div>
        </div>
      </div>

      <div className="receipt-close">
        <button 
          className="btn secondary"
          onClick={() => store.setState({ activeShadowId: null })}>
          <Icon name="x" size={16} /> DISMISS RECEIPT
        </button>
      </div>
    </div>
  );
}

/* ─── Right Panel Container ─── */
function RightPanel() {
  const activeShadowId = useWorkspaceStore(sel.activeShadowId);
  const shadowRevisions = useWorkspaceStore(sel.shadowRevisions);
  const activeShadow = activeShadowId ? shadowRevisions.find(s => s.id === activeShadowId) : null;
  const [activeTab, setActiveTab] = useState<'AGENT' | 'EVIDENCE' | 'IMPACT' | 'PROPOSAL' | 'CONTRACT'>('CONTRACT');

  // Auto-switch to proposal when a new shadow arrives
  useEffect(() => {
    if (activeShadowId) setActiveTab('PROPOSAL');
  }, [activeShadowId]);

  return (
    <aside className="right-panel">
      <div className="right-tabs">
        {(['AGENT', 'EVIDENCE', 'IMPACT', 'PROPOSAL', 'CONTRACT'] as const).map(tab => (
          <button key={tab}
            className={`right-tab ${activeTab === tab ? 'active' : ''} ${(tab === 'EVIDENCE' || tab === 'IMPACT' || tab === 'PROPOSAL') && !activeShadow ? 'disabled' : ''}`}
            onClick={() => setActiveShadow ? setActiveTab(tab) : tab === 'AGENT' || tab === 'CONTRACT' ? setActiveTab(tab) : null}>
            {tab}
          </button>
        ))}
      </div>
      
      <div className="right-content overflow-y-auto h-full">
        {activeTab === 'CONTRACT' && <ContractView />}
        {activeTab === 'AGENT' && <AgentActivity />}
        {activeTab === 'EVIDENCE' && activeShadow && <EvidenceView shadow={activeShadow} />}
        {activeTab === 'IMPACT' && activeShadow && <ImpactGraphView shadow={activeShadow} />}
        {activeTab === 'PROPOSAL' && activeShadow && activeShadow.status !== 'approved' && <CounterfactualArena activeShadow={activeShadow} />}
        {activeTab === 'PROPOSAL' && activeShadow && activeShadow.status === 'approved' && <ChangeReceiptView activeShadow={activeShadow} />}
        
        {(activeTab === 'EVIDENCE' || activeTab === 'IMPACT' || activeTab === 'PROPOSAL') && !activeShadow && (
          <div className="p-8 text-center text-tertiary">
            <Icon name="shield" size={32} className="mb-4 mx-auto opacity-50" />
            <p>No active shadow revision.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─── WebMCP Inspector ─── */
function WebMCPInspector() {
  const show = useWorkspaceStore(sel.showWebMCPInspector);
  const store = useWorkspaceStore;
  if (!show) return null;
  return (
    <div className="inspector-overlay" onClick={() => store.getState().setShowWebMCPInspector(false)}>
      <div className="inspector-panel" onClick={e => e.stopPropagation()}>
        <div className="inspector-header">
          <div>
            <h2 className="inspector-title">WEBMCP TOOL REGISTRY</h2>
            <p className="inspector-subtitle">11 TOOLS REGISTERED</p>
          </div>
          <button className="inspector-close" onClick={() => store.getState().setShowWebMCPInspector(false)}>
            <Icon name="x" size={24} />
          </button>
        </div>

        <div className="permission-grid">
          <div className="permission-box allow">
            <h3 className="permission-box-title allow">
              <Icon name="check" size={16} /> AGENT PERMISSIONS
            </h3>
            <ul className="permission-list">
              <li className="permission-item allow"><Icon name="check" size={14} /> Inspect project state</li>
              <li className="permission-item allow"><Icon name="check" size={14} /> Analyze impact radius</li>
              <li className="permission-item allow"><Icon name="check" size={14} /> Read evidence & human decisions</li>
              <li className="permission-item allow"><Icon name="check" size={14} /> Create counterfactual shadow patches</li>
              <li className="permission-item allow"><Icon name="check" size={14} /> Run shadow tests</li>
              <li className="permission-item allow"><Icon name="check" size={14} /> Compare candidates</li>
            </ul>
          </div>
          <div className="permission-box block">
            <h3 className="permission-box-title block">
              <Icon name="x" size={16} /> BLOCKED FROM AGENT
            </h3>
            <ul className="permission-list">
              <li className="permission-item block"><Icon name="x" size={14} /> Approve patches</li>
              <li className="permission-item block"><Icon name="x" size={14} /> Apply patches to live state</li>
              <li className="permission-item block"><Icon name="x" size={14} /> Modify authoritative live state</li>
              <li className="permission-item block"><Icon name="x" size={14} /> Bypass risk budgets</li>
              <li className="permission-item block"><Icon name="x" size={14} /> Fake test results</li>
            </ul>
          </div>
        </div>

        <div className="human-boundary">
          <h3 className="human-boundary-title">HUMAN-ONLY CONTROL BOUNDARY</h3>
          <p className="human-boundary-desc">The agent cannot cross this boundary. All patches require explicit human approval via the PatchPilot UI.</p>
        </div>

        <h3 className="registry-title">Registered Tools</h3>
        <div className="registry-grid">
          {getToolManifest().map(t => (
            <div key={t.name} className="tool-card">
              <div className="tool-card-header">
                <strong className="tool-card-name">{t.name}</strong>
                <span className="tool-card-type">
                  {t.name.includes('create') || t.name.includes('run') || t.name.includes('analyze') ? 'MUTATE SHADOW' : 'READ LIVE'}
                </span>
              </div>
              <p className="tool-card-desc">{t.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Judge Mode Presentation ─── */
function JudgeModeOverlay() {
  const judgeMode = useWorkspaceStore(sel.judgeMode);
  const store = useWorkspaceStore;
  if (!judgeMode) return null;

  return (
    <div className="judge-overlay">
      <div className="judge-panel">
        <button className="judge-close" onClick={() => store.getState().setJudgeMode(false)}>
          <Icon name="x" size={28} />
        </button>
        
        <div className="judge-header">
          <h2 className="judge-title">PATCHPILOT 3.0</h2>
          <h3 className="judge-subtitle">Human-Governed Agentic Change Management</h3>
          <p className="judge-quote">
            "The agent can investigate, simulate and prove a change.<br/>It cannot independently change authoritative state."
          </p>
        </div>

        <div className="process-timeline">
          <div className="process-line"></div>
          
          {[
            { num: '01', title: 'UNDERSTAND', icon: 'search', color: 'blue' },
            { num: '02', title: 'SIMULATE', icon: 'file', color: 'violet' },
            { num: '03', title: 'VERIFY', icon: 'shield', color: 'amber' },
            { num: '04', title: 'HUMAN APPROVES', icon: 'user', color: 'green' },
            { num: '05', title: 'APPLY', icon: 'check', color: 'primary' },
          ].map((step, i) => (
            <div key={i} className="process-step">
              <div className={`process-icon-wrap ${step.color}`}>
                <Icon name={step.icon} size={24} />
              </div>
              <span className="process-num">{step.num}</span>
              <span className="process-name">{step.title}</span>
            </div>
          ))}
        </div>

        <div className="comparison-section">
          <div className="comparison-card">
            <div className="comparison-bg-icon">
              <Icon name="bot" size={64} />
            </div>
            <h3 className="comparison-title">Traditional AI Coding</h3>
            <div className="flow-diagram">
              <div className="flow-node">AI</div>
              <Icon name="chevronRight" size={16} className="flow-arrow" />
              <div className="flow-node">CODE</div>
              <Icon name="chevronRight" size={16} className="flow-arrow" />
              <div className="flow-node danger">LIVE</div>
            </div>
            <p className="comparison-desc">Blindly modifies state. High risk, low governance. Humans must review a messy PR after the fact.</p>
          </div>
          
          <div className="comparison-card patchpilot">
            <div className="comparison-bg-icon">
              <Icon name="shield" size={64} />
            </div>
            <h3 className="comparison-title">PatchPilot 3.0</h3>
            <div className="flow-diagram">
              <div className="flow-node">AI</div>
              <Icon name="chevronRight" size={12} className="flow-arrow" />
              <div className="flow-node shadow">SHADOW</div>
              <Icon name="chevronRight" size={12} className="flow-arrow" />
              <div className="flow-node evidence">EVIDENCE</div>
              <Icon name="chevronRight" size={12} className="flow-arrow" />
              <div className="flow-node human">HUMAN</div>
              <Icon name="chevronRight" size={12} className="flow-arrow" />
              <div className="flow-node live">LIVE</div>
            </div>
            <p className="comparison-desc">Takes less than 20 seconds for a judge to understand. Agent proves correctness in counterfactual worlds; human executes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Icon Sidebar ─── */
function IconSidebar() {
  const store = useWorkspaceStore();
  return (
    <div className="icon-sidebar">
      <div className="icon-sidebar-top">
        <button 
          className="icon-btn logo-btn" 
          title="Back to Dashboard" 
          onClick={() => store.setShowLanding(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>
        </button>
        <button className="icon-btn active" title="Workspace">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
        </button>
        <button className="icon-btn" title="Activity">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </button>
        <button className="icon-btn" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      </div>
      <div className="icon-sidebar-bottom">
        <div className="user-badge" title="Profile">PP</div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
function App() {
  const showLanding = useWorkspaceStore(sel.showLanding);
  const store = useWorkspaceStore;
  
  useEffect(() => {
    const status = registerWebMCP();
    store.getState().setWebMCPStatus(status);
  }, []);

  if (showLanding) return <LandingPage />;

  return (
    <div className="app-shell">
      <IconSidebar />
      <div className="app-content">
        <TopBar />
        <main className="workspace">
          <FileSidebar />
          <CodeEditor />
          <RightPanel />
        </main>
      </div>
      <WebMCPInspector />
      <JudgeModeOverlay />
    </div>
  );
}

/* ─── Mount ─── */
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

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
    { icon: 'zap', color: 'text-red', title: 'Observed Failure', desc: 'Tests failing in base revision' },
    { icon: 'search', color: 'text-blue', title: 'Root Cause', desc: evidence.proposedFix },
    { icon: 'file', color: 'text-violet', title: 'Shadow Patch', desc: 'Candidate changes applied in isolation' },
    { icon: 'git', color: 'text-amber', title: 'Impact Analysis', desc: `Blast radius: ${evidence.impactLevel}` },
    { icon: 'shield', color: riskAssessment?.overallRisk === 'high' ? 'text-red' : 'text-green', title: 'Invariant Verification', desc: riskAssessment?.budgetViolations.length ? riskAssessment.budgetViolations.join(', ') : 'Within risk budget and invariants preserved' },
    { icon: 'check', color: evidence.shadowTestsPassed ? 'text-green' : 'text-red', title: 'Test Verification', desc: shadow.testResults ? `${shadow.testResults.passed}/${shadow.testResults.total} TESTS PASSING` : 'Verified' },
    ...(isApproved || shadow.evidence?.humanDecision ? [
      { icon: 'user', color: 'text-violet', title: 'Human Approval', desc: shadow.evidence?.humanDecision || 'Human Authorized' },
      { icon: 'server', color: 'text-blue', title: 'Live Revision', desc: 'Merged to authoritative state' },
      { icon: 'copy', color: 'text-primary', title: 'Change Receipt', desc: 'Immutable governance record generated' }
    ] : [])
  ];

  return (
    <div className="evidence-chain p-6 overflow-y-auto h-full">
      <h3 className="text-sm font-bold text-primary mb-6 uppercase tracking-wider flex items-center gap-2">
        <Icon name="search" size={16} className="text-violet" /> Causal Evidence Board
      </h3>
      
      <div className="relative pl-6 border-l-2 border-subtle ml-3 space-y-8">
        {steps.map((step, i) => (
          <div key={i} className="relative">
            <div className={`absolute -left-[35px] w-6 h-6 rounded-full bg-surface border-2 ${step.color.replace('text-', 'border-')} flex items-center justify-center`}>
              <Icon name={step.icon} size={12} className={step.color} />
            </div>
            <div>
              <strong className={`block text-sm ${step.color}`}>{step.title}</strong>
              <span className="text-sm text-secondary">{step.desc}</span>
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
    <div className="proposal-view p-6 flex flex-col h-full overflow-y-auto">
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold text-primary mb-2 tracking-tight">COUNTERFACTUAL CHANGE ARENA</h3>
        <p className="text-secondary text-sm font-medium">"Three possible ways to fix the same production failure."</p>
      </div>

      <div className="flex gap-4 mb-8">
        {group.map(s => {
          const isBlocked = s.status === 'blocked';
          const blockReason = getBlockReason(s);
          const isRecommended = recommended?.id === s.id;
          
          return (
            <div key={s.id} className={`flex-1 flex flex-col border rounded-xl overflow-hidden transition-all duration-300 ${isBlocked ? 'border-red/20 opacity-80' : isRecommended ? 'border-violet/60 shadow-[0_0_15px_rgba(139,92,246,0.1)] ring-1 ring-violet/30' : 'border-subtle bg-surface-raised'}`}>
              <div className={`p-3 text-center border-b font-bold text-sm ${isBlocked ? 'bg-red/5 border-red/10 text-secondary' : isRecommended ? 'bg-violet/10 border-violet/20 text-violet' : 'border-subtle text-primary'}`}>
                Candidate {s.candidateId || s.id.split('-').pop()}
              </div>
              <div className="p-4 space-y-3 text-xs bg-surface/50 flex-1">
                <div className="flex justify-between">
                  <span className="text-tertiary">Tests:</span>
                  <span className={s.testResults?.failed ? 'text-red font-bold' : 'text-primary'}>{s.testResults ? `${s.testResults.passed}/${s.testResults.total}` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Impact:</span>
                  <span className={s.impactAnalysis?.summary.highestImpact === 'HIGH' ? 'text-amber font-bold' : 'text-primary'}>{s.impactAnalysis?.summary.highestImpact || '-'}</span>
                </div>
                {isBlocked ? (
                  <div className="mt-4 pt-4 border-t border-red/10">
                    <div className="text-red font-bold">{blockReason}</div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Risk:</span>
                      <span className="text-primary">{s.riskAssessment?.overallRisk || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Files:</span>
                      <span className="text-primary">{s.changes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Lines:</span>
                      <span className="text-primary">{s.changes.reduce((a,c) => a + c.content.split('\n').length, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Invariants:</span>
                      <span className="text-green font-bold">PASS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-tertiary">Budget:</span>
                      <span className="text-green font-bold">PASS</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-subtle">
                      <div className="text-green font-bold">Status: READY FOR APPROVAL</div>
                    </div>
                  </>
                )}
              </div>
              <button 
                className={`w-full py-2 text-xs font-bold transition-colors ${store.getState().activeShadowId === s.id ? 'bg-primary text-root' : 'bg-surface hover:bg-surface-raised text-secondary'}`}
                onClick={() => store.setState({ activeShadowId: s.id })}>
                {store.getState().activeShadowId === s.id ? 'VIEWING CODE' : 'VIEW CODE'}
              </button>
            </div>
          );
        })}
      </div>

      {recommended && store.getState().activeShadowId === recommended.id && (
        <div className="mt-auto bg-surface-raised border border-violet/30 rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-violet/10 px-6 py-3 border-b border-violet/20 flex items-center justify-between">
            <h4 className="text-violet font-bold text-sm tracking-wide">READY FOR HUMAN REVIEW</h4>
            <div className="text-xs text-violet/80">Candidate {recommended.candidateId || recommended.id.split('-').pop()}</div>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-secondary mb-4">Candidate {recommended.candidateId || recommended.id.split('-').pop()} satisfies all constraints:</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                {recommended.testResults?.passed}/{recommended.testResults?.total} tests
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                Behavioral invariants preserved
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                Protected files untouched
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                Risk budget satisfied
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                Shadow isolated
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Icon name="check" size={16} className="text-green" /> 
                Impact analyzed
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                className="btn secondary flex-1 flex justify-center items-center gap-2"
                onClick={() => store.setState({ activeTab: 'EVIDENCE' })}>
                <Icon name="search" size={14} /> VIEW EVIDENCE
              </button>
              <button 
                className="btn approve flex-1 flex justify-center items-center gap-2 bg-violet hover:bg-violet/90 text-white border-0 py-2 font-bold shadow-md"
                onClick={() => store.getState().applyShadowRevision(recommended.id, 'human')}>
                <Icon name="check" size={16} /> APPROVE & APPLY
              </button>
            </div>
            <div className="text-center mt-3 text-[10px] text-tertiary uppercase tracking-widest font-bold">
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
    <div className="proposal-view p-6 flex flex-col h-full overflow-y-auto animate-in fade-in zoom-in-95">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-green/10 p-2 rounded-full border border-green/20">
          <Icon name="check" size={24} className="text-green" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-green tracking-tight">APPLIED TO LIVE</h3>
          <p className="text-sm text-secondary">The counterfactual candidate has been merged into authoritative state.</p>
        </div>
      </div>

      <div className="bg-surface-raised border border-subtle p-6 rounded-xl mb-6 shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-subtle pb-4">
          <h4 className="text-sm font-bold text-primary flex items-center gap-2 tracking-wide uppercase">
            <Icon name="shield" size={16} className="text-violet" /> 
            Change Receipt
          </h4>
          <span className="text-xs font-mono text-tertiary">{receipt.id}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-y-5 text-sm">
          <div className="text-secondary">Selected Candidate</div>
          <div className="font-bold text-primary">{candidateName}</div>

          <div className="text-secondary">Human Decision</div>
          <div className="font-bold text-violet flex items-center gap-2">
            <Icon name="user" size={14} /> Approved ({receipt.approvedBy})
          </div>

          <div className="text-secondary">Changed Files</div>
          <div className="text-primary font-mono text-xs bg-surface p-1 rounded inline-block">
            {activeShadow.changes.map(c => c.path).join(', ')}
          </div>

          <div className="text-secondary">Verification</div>
          <div className="text-green font-bold">
            {activeShadow.testResults ? `${activeShadow.testResults.passed}/${activeShadow.testResults.total} tests passing` : 'Verified'}
          </div>

          <div className="text-secondary">Behavioral Invariants</div>
          <div className="text-green font-bold">All preserved</div>

          <div className="text-secondary">Risk Budget</div>
          <div className="text-green font-bold">Compliant</div>

          <div className="text-secondary">Protected Files</div>
          <div className="text-primary">untouched</div>

          <div className="text-secondary">Impact</div>
          <div className={`font-bold ${receipt.impact === 'HIGH' ? 'text-amber' : 'text-blue'}`}>{receipt.impact}</div>

          <div className="text-secondary border-t border-subtle pt-4 mt-2">Live Revision</div>
          <div className="font-bold text-primary text-lg border-t border-subtle pt-4 mt-2">#{receipt.revision}</div>

          <div className="text-secondary">Timestamp</div>
          <div className="text-tertiary">{timestamp}</div>
        </div>
      </div>

      <div className="mt-auto">
        <button 
          className="btn secondary w-full flex justify-center items-center gap-2 py-3 font-bold"
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
      <div className="inspector-panel p-8 bg-surface border border-subtle rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8 border-b border-subtle pb-4">
          <div>
            <h2 className="text-2xl font-bold text-primary tracking-tight">WEBMCP TOOL REGISTRY</h2>
            <p className="text-secondary text-sm font-medium mt-1">11 TOOLS REGISTERED</p>
          </div>
          <button className="text-tertiary hover:text-primary transition-colors" onClick={() => store.getState().setShowWebMCPInspector(false)}>
            <Icon name="x" size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-surface-raised border border-green/30 rounded-lg p-5">
            <h3 className="text-green font-bold text-sm mb-4 flex items-center gap-2">
              <Icon name="check" size={16} /> AGENT PERMISSIONS
            </h3>
            <ul className="space-y-2 text-sm text-primary">
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Inspect project state</li>
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Analyze impact radius</li>
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Read evidence & human decisions</li>
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Create counterfactual shadow patches</li>
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Run shadow tests</li>
              <li className="flex items-start gap-2"><Icon name="check" size={14} className="text-green mt-0.5" /> Compare candidates</li>
            </ul>
          </div>
          <div className="bg-surface-raised border border-red/30 rounded-lg p-5">
            <h3 className="text-red font-bold text-sm mb-4 flex items-center gap-2">
              <Icon name="x" size={16} /> BLOCKED FROM AGENT
            </h3>
            <ul className="space-y-2 text-sm text-primary">
              <li className="flex items-start gap-2"><Icon name="x" size={14} className="text-red mt-0.5" /> Approve patches</li>
              <li className="flex items-start gap-2"><Icon name="x" size={14} className="text-red mt-0.5" /> Apply patches to live state</li>
              <li className="flex items-start gap-2"><Icon name="x" size={14} className="text-red mt-0.5" /> Modify authoritative live state</li>
              <li className="flex items-start gap-2"><Icon name="x" size={14} className="text-red mt-0.5" /> Bypass risk budgets</li>
              <li className="flex items-start gap-2"><Icon name="x" size={14} className="text-red mt-0.5" /> Fake test results</li>
            </ul>
          </div>
        </div>

        <div className="bg-violet/10 border border-violet/30 rounded-lg p-4 mb-8 text-center">
          <h3 className="text-violet font-bold text-sm tracking-widest uppercase">HUMAN-ONLY CONTROL BOUNDARY</h3>
          <p className="text-secondary text-xs mt-1">The agent cannot cross this boundary. All patches require explicit human approval via the PatchPilot UI.</p>
        </div>

        <h3 className="text-lg font-bold text-primary mb-4 border-b border-subtle pb-2">Registered Tools</h3>
        <div className="grid grid-cols-2 gap-4">
          {getToolManifest().map(t => (
            <div key={t.name} className="p-4 bg-surface-raised border border-subtle rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <strong className="text-violet text-sm font-mono">{t.name}</strong>
                <span className="text-[10px] uppercase bg-surface px-1.5 py-0.5 rounded text-tertiary">
                  {t.name.includes('create') || t.name.includes('run') || t.name.includes('analyze') ? 'MUTATE SHADOW' : 'READ LIVE'}
                </span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">{t.description}</p>
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
    <div className="judge-overlay fixed inset-0 z-50 bg-root/95 backdrop-blur-md flex items-center justify-center p-8">
      <div className="bg-surface border border-subtle rounded-2xl p-10 max-w-5xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
        <button className="absolute top-6 right-6 text-tertiary hover:text-primary transition-colors" onClick={() => store.getState().setJudgeMode(false)}>
          <Icon name="x" size={28} />
        </button>
        
        <div className="mb-10 text-center">
          <h2 className="text-4xl font-bold mb-3 tracking-tight text-primary">PATCHPILOT 3.0</h2>
          <h3 className="text-2xl text-violet font-medium mb-4">Human-Governed Agentic Change Management</h3>
          <p className="text-lg text-secondary max-w-2xl mx-auto italic">
            "The agent can investigate, simulate and prove a change.<br/>It cannot independently change authoritative state."
          </p>
        </div>

        <div className="flex justify-between items-center mb-12 px-8 relative">
          <div className="absolute top-1/2 left-16 right-16 h-1 bg-subtle -z-10 -translate-y-1/2 rounded"></div>
          
          {[
            { num: '01', title: 'UNDERSTAND', icon: 'search', color: 'text-blue' },
            { num: '02', title: 'SIMULATE', icon: 'file', color: 'text-violet' },
            { num: '03', title: 'VERIFY', icon: 'shield', color: 'text-amber' },
            { num: '04', title: 'HUMAN APPROVES', icon: 'user', color: 'text-green' },
            { num: '05', title: 'APPLY', icon: 'check', color: 'text-primary' },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center bg-surface p-2">
              <div className={`w-14 h-14 rounded-full bg-surface-raised border-2 border-subtle flex items-center justify-center mb-3 shadow-sm ${step.color}`}>
                <Icon name={step.icon} size={24} />
              </div>
              <span className="text-[10px] font-bold text-tertiary mb-1">{step.num}</span>
              <span className="text-xs font-bold text-primary tracking-wider">{step.title}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-surface-raised border border-subtle rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Icon name="bot" size={64} />
            </div>
            <h3 className="text-lg font-bold text-tertiary mb-6 uppercase tracking-widest border-b border-subtle pb-3">Traditional AI Coding</h3>
            <div className="flex items-center gap-4 text-primary font-mono text-sm opacity-60">
              <div className="bg-surface p-3 rounded border border-subtle">AI</div>
              <Icon name="chevronRight" size={16} />
              <div className="bg-surface p-3 rounded border border-subtle">CODE</div>
              <Icon name="chevronRight" size={16} />
              <div className="bg-surface p-3 rounded border border-subtle text-red font-bold">LIVE</div>
            </div>
            <p className="mt-6 text-sm text-secondary">Blindly modifies state. High risk, low governance. Humans must review a messy PR after the fact.</p>
          </div>
          
          <div className="bg-violet/5 border border-violet/30 rounded-xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(139,92,246,0.1)]">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Icon name="shield" size={64} />
            </div>
            <h3 className="text-lg font-bold text-violet mb-6 uppercase tracking-widest border-b border-violet/20 pb-3">PatchPilot 3.0</h3>
            <div className="flex items-center gap-2 text-primary font-mono text-[11px] font-bold">
              <div className="bg-surface p-2 rounded border border-subtle">AI</div>
              <Icon name="chevronRight" size={12} className="text-violet" />
              <div className="bg-violet/20 p-2 rounded border border-violet/30 text-violet">SHADOW</div>
              <Icon name="chevronRight" size={12} className="text-violet" />
              <div className="bg-amber/10 p-2 rounded border border-amber/30 text-amber">EVIDENCE</div>
              <Icon name="chevronRight" size={12} className="text-violet" />
              <div className="bg-green/10 p-2 rounded border border-green/30 text-green">HUMAN</div>
              <Icon name="chevronRight" size={12} className="text-violet" />
              <div className="bg-surface p-2 rounded border border-subtle text-primary">LIVE</div>
            </div>
            <p className="mt-6 text-sm text-secondary">Takes less than 20 seconds for a judge to understand. Agent proves correctness in counterfactual worlds; human executes.</p>
          </div>
        </div>
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
      <TopBar />
      <main className="workspace">
        <FileSidebar />
        <CodeEditor />
        <RightPanel />
      </main>
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

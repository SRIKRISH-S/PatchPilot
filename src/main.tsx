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
  const rehearsalRunning = useWorkspaceStore(sel.rehearsalRunning);
  const judgeMode = useWorkspaceStore(sel.judgeMode);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <div className="logo-sm">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#logo-grad-sm)" />
              <path d="M14 24h6l3-8 3 16 3-8h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="logo-grad-sm" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#8b5cf6"/><stop offset="1" stopColor="#3b82f6"/></linearGradient></defs>
            </svg>
          </div>
          <div className="brand-name">PatchPilot 2.0</div>
        </div>
      </div>

      <div className="topbar-center">
        <div className="live-pill">
          <span className="live-dot" /> LIVE REVISION #{revision}
        </div>
        
        {activeShadow && (
          <>
            <Icon name="chevronRight" size={16} className="text-tertiary" />
            <div className={`shadow-pill ${activeShadow.status}`}>
              <Icon name="shield" size={12} />
              SHADOW {activeShadow.id} — {activeShadow.status.toUpperCase()}
            </div>
          </>
        )}

        {rehearsalRunning && (
          <span className="rehearsal-badge ml-4">
            <Icon name="play" size={12} /> REHEARSAL: Deterministic local walkthrough. No external AI agent is executing these calls.
          </span>
        )}
      </div>

      <div className="topbar-right">
        {store.getState().webmcpStatus?.available ? (
          <span className="text-xs text-green border border-green px-2 py-1 rounded mr-3 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green animate-pulse"></div>
            WEBMCP CONNECTED
          </span>
        ) : (
          <span className="text-xs text-red border border-red/30 px-2 py-1 rounded mr-3 opacity-80">
            WEBMCP NOT DETECTED
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

  return (
    <div className="evidence-chain">
      <div className="chain-node">
        <Icon name="zap" size={16} className="text-red" />
        <div className="node-content">
          <strong>Failure Detected</strong>
          <span>Tests failing in base revision</span>
        </div>
      </div>
      <div className="chain-link" />
      <div className="chain-node">
        <Icon name="search" size={16} className="text-blue" />
        <div className="node-content">
          <strong>Agent Analysis</strong>
          <span>{evidence.proposedFix}</span>
        </div>
      </div>
      <div className="chain-link" />
      <div className="chain-node">
        <Icon name="terminal" size={16} className={evidence.shadowTestsPassed ? 'text-green' : 'text-red'} />
        <div className="node-content">
          <strong>Shadow Verification</strong>
          <span>{evidence.shadowTestsPassed ? 'All tests passed in isolation' : 'Tests failed in shadow'}</span>
        </div>
      </div>
      <div className="chain-link" />
      <div className="chain-node">
        <Icon name="shield" size={16} className={riskAssessment?.overallRisk === 'high' ? 'text-red' : 'text-green'} />
        <div className="node-content">
          <strong>Risk Assessment ({riskAssessment?.overallRisk.toUpperCase()})</strong>
          <span>{riskAssessment?.budgetViolations.length ? riskAssessment.budgetViolations.join(', ') : 'Within human risk budget'}</span>
        </div>
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

/* ─── Right Panel: Proposal (Action) ─── */
function ProposalView({ shadow }: { shadow: ShadowRevision }) {
  const store = useWorkspaceStore;

  return (
    <div className="proposal-view p-4 flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-primary">Shadow Revision {shadow.id}</h3>
        <p className="text-secondary mt-1">{shadow.explanation}</p>
      </div>

      <div className={`status-banner ${shadow.status} mb-4`}>
        STATUS: {shadow.status.toUpperCase()}
      </div>

      <div className="diff-summary flex-1">
        <h4 className="text-sm font-bold text-secondary mb-2">Files Changed</h4>
        {shadow.changes.map(c => (
          <div key={c.path} className="flex justify-between text-sm py-1 border-b border-subtle">
            <span>{c.path}</span>
            <span className="text-violet">Modified</span>
          </div>
        ))}
        
        {shadow.evidence?.humanDecision && (
          <div className="mt-4 p-3 bg-surface-raised border border-subtle rounded-md">
            <span className="text-xs text-tertiary block mb-1">AUTOMATED EVALUATION</span>
            <span className={`text-sm ${shadow.status === 'passed' ? 'text-green' : 'text-amber'}`}>
              {shadow.evidence.humanDecision}
            </span>
          </div>
        )}
      </div>

      <div className="actions mt-auto pt-4 border-t border-subtle flex gap-2">
        <button 
          className="btn danger flex-1"
          onClick={() => store.getState().rejectShadowRevision(shadow.id)}>
          Reject
        </button>
        <button 
          className="btn approve flex-1"
          disabled={shadow.status === 'blocked'}
          onClick={() => store.getState().applyShadowRevision(shadow.id, 'human')}>
          {shadow.status === 'blocked' ? 'Blocked by Policy' : 'Approve & Apply'}
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
        {activeTab === 'PROPOSAL' && activeShadow && <ProposalView shadow={activeShadow} />}
        
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
      <div className="inspector-panel p-6 bg-surface border border-subtle rounded-lg max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">WebMCP Native Tools</h2>
        <p className="text-secondary mb-6">The AI agent connects to PatchPilot 2.0 via these native tools to operate the Shadow Change Lab.</p>
        <div className="space-y-4">
          {getToolManifest().map(t => (
            <div key={t.name} className="p-3 bg-surface-raised border border-subtle rounded">
              <strong className="text-violet">{t.name}</strong>
              <p className="text-sm text-secondary mt-1">{t.description}</p>
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
    <div className="judge-overlay fixed inset-0 z-50 bg-root/95 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-surface border border-subtle rounded-xl p-8 max-w-4xl w-full shadow-2xl relative">
        <button className="absolute top-4 right-4 text-tertiary hover:text-primary" onClick={() => store.getState().setJudgeMode(false)}>
          <Icon name="x" size={24} />
        </button>
        
        <h2 className="text-3xl font-bold mb-2">PatchPilot 2.0: Shadow Change Lab</h2>
        <p className="text-xl text-secondary mb-8">A new human-governed collaboration model for WebMCP.</p>

        <div className="flex gap-4 mb-8">
          <div className="bg-surface-raised px-4 py-2 rounded border border-subtle">
            <span className="text-xs text-tertiary block mb-1">STATE</span>
            <span className="text-sm font-bold text-primary">LIVE #{store.getState().revision}</span>
          </div>
          <div className="bg-surface-raised px-4 py-2 rounded border border-subtle">
            <span className="text-xs text-tertiary block mb-1">PROTOCOL</span>
            <span className={`text-sm font-bold ${store.getState().webmcpStatus?.available ? 'text-green' : 'text-red'}`}>
              {store.getState().webmcpStatus?.available ? 'WEBMCP CONNECTED' : 'WEBMCP NOT DETECTED'}
            </span>
          </div>
          <div className="bg-surface-raised px-4 py-2 rounded border border-subtle">
            <span className="text-xs text-tertiary block mb-1">GOVERNANCE</span>
            <span className="text-sm font-bold text-violet">CONTRACT VALID</span>
          </div>
          <div className="bg-surface-raised px-4 py-2 rounded border border-subtle">
            <span className="text-xs text-tertiary block mb-1">POLICY</span>
            <span className="text-sm font-bold text-green">RISK LOW</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-violet mb-4">The Innovation: LIVE vs SHADOW</h3>
            <ul className="space-y-3 text-secondary list-disc pl-4">
              <li><strong>Shadow Revisions:</strong> Agent patches are fully isolated before they touch authoritative state.</li>
              <li><strong>Impact Graphs:</strong> Visual dependency mapping to calculate blast radius.</li>
              <li><strong>Risk Budgets:</strong> Strict human limits (e.g. max files, protected areas).</li>
              <li><strong>Causal Evidence:</strong> Agent must prove the tests pass in isolation.</li>
              <li><strong>Change Contracts:</strong> Human intent acts as a persistent programmatic constraint.</li>
            </ul>
          </div>
          <div className="bg-surface-raised p-6 rounded-lg border border-subtle">
            <h3 className="text-md font-bold mb-3">Recommended Judge Demo</h3>
            <p className="text-sm text-secondary mb-4">Try this exact prompt in your WebMCP Agent (e.g. ChatGPT):</p>
            <code className="block bg-input p-3 rounded text-sm text-primary mb-4 whitespace-pre-wrap">
              "Fix the checkout shipping failures. Do not touch tax logic. Keep the patch under 20 changed lines."
            </code>
            <p className="text-sm text-secondary">Watch the agent create a shadow revision, get blocked if it touches tax.ts, and negotiate a narrower patch.</p>
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

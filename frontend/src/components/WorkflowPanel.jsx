// ── Full Analysis Workflow Panel ──────────────────────────────────────────────
import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const API = 'http://localhost:3001';

const STEPS = [
  { id: 1, icon: '⚡', label: 'Stress Test' },
  { id: 2, icon: '🤖', label: 'AI Perf Analysis' },
  { id: 3, icon: '🔐', label: 'Security Scan' },
  { id: 4, icon: '📋', label: 'Issue Compilation' },
  { id: 5, icon: '🔍', label: 'GitHub Search' },
  { id: 6, icon: '🧠', label: 'Code Analysis' },
  { id: 7, icon: '📄', label: 'Final Report' },
];

const SEV_COLOR = { critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#4ade80', info: '#94a3b8' };

function StepBar({ stepStates }) {
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', overflowX: 'auto' }}>
      {STEPS.map((step, idx) => {
        const state = stepStates[step.id] || 'idle';
        const colors = {
          idle:     { bg: '#0f172a', border: '#1e293b', text: '#475569' },
          active:   { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
          complete: { bg: '#052e16', border: '#16a34a', text: '#4ade80' },
          error:    { bg: '#2d0a0a', border: '#dc2626', text: '#f87171' },
        }[state];
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 110 }}>
            <div style={{
              flex: 1, padding: '0.6rem 0.5rem', textAlign: 'center',
              background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: idx === 0 ? '8px 0 0 8px' : idx === STEPS.length - 1 ? '0 8px 8px 0' : 0,
              borderLeft: idx > 0 ? 'none' : undefined,
              transition: 'all 0.3s',
            }}>
              <div style={{ fontSize: '1.1rem' }}>{step.icon}</div>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: colors.text, marginTop: '0.2rem' }}>{step.label}</div>
              {state === 'active' && (
                <div style={{ width: '100%', height: 2, background: '#1e3a5f', marginTop: 4, borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#3b82f6', animation: 'pulse 1s ease-in-out infinite', width: '60%' }} />
                </div>
              )}
              {state === 'complete' && <div style={{ fontSize: '0.6rem', color: '#4ade80' }}>✓</div>}
              {state === 'error'    && <div style={{ fontSize: '0.6rem', color: '#f87171' }}>✗</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IssueTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ background: '#0f172a' }}>
            {['Category', 'Severity', 'Title', 'Detail'].map(h => (
              <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #1e293b' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#070f1a' : '#0a1525', borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '0.4rem 0.75rem', color: '#94a3b8' }}>{row.category}</td>
              <td style={{ padding: '0.4rem 0.75rem' }}>
                <span style={{ color: SEV_COLOR[row.severity] || '#94a3b8', fontWeight: 600, fontSize: '0.7rem' }}>
                  {row.severity?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#e2e8f0', fontWeight: 500 }}>{row.title}</td>
              <td style={{ padding: '0.4rem 0.75rem', color: '#94a3b8', maxWidth: 400 }}>{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepResult({ step, data }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div style={{ background: '#0a1525', border: '1px solid #1e293b', borderRadius: 6, marginBottom: '0.5rem', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem', textAlign: 'left' }}
      >
        <span>{step.icon}</span>
        <span style={{ fontWeight: 600 }}>Step {step.id}: {step.label}</span>
        <span style={{ color: '#475569', marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid #1e293b' }}>
          <pre style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function WorkflowPanel({ preFill }) {
  const [form, setForm] = useState({
    url: preFill?.url || '',
    method: preFill?.method || 'GET',
    payload: preFill?.payload ? (typeof preFill.payload === 'string' ? preFill.payload : JSON.stringify(preFill.payload, null, 2)) : '',
    vus: '20',
    duration: '15',
    githubRepos: '',
  });
  const [running, setRunning] = useState(false);
  const [stepStates, setStepStates] = useState({});
  const [stepLabels, setStepLabels] = useState({});
  const [stepData, setStepData] = useState({});
  const [issueTable, setIssueTable] = useState([]);
  const [report, setReport] = useState('');
  const [ticks, setTicks] = useState([]);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const setStep = (id, phase) => setStepStates(prev => ({ ...prev, [id]: phase === 'complete' ? 'complete' : phase === 'error' ? 'error' : 'active' }));

  const run = async () => {
    setRunning(true);
    setStepStates({});
    setStepLabels({});
    setStepData({});
    setIssueTable([]);
    setReport('');
    setTicks([]);
    setError('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API}/api/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.url,
          method: form.method,
          payload: form.payload ? (() => { try { return JSON.parse(form.payload); } catch { return form.payload; } })() : undefined,
          vus: parseInt(form.vus) || 20,
          duration: parseInt(form.duration) || 15,
          githubRepos: form.githubRepos || undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const chunks = buf.split('\n\n');
        buf = chunks.pop();

        for (const chunk of chunks) {
          let event = 'message';
          let dataStr = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr);

            if (event === 'workflow') {
              const { step, phase, label, data } = payload;
              setStep(step, phase);
              if (label) setStepLabels(prev => ({ ...prev, [step]: label }));
              if (data) setStepData(prev => ({ ...prev, [step]: data }));
              if (phase === 'complete' && data?.issues) setIssueTable(data.issues);
            } else if (event === 'workflow:tick') {
              setTicks(prev => [...prev, payload]);
            } else if (event === 'workflow:done') {
              if (payload.report) setReport(payload.report);
              if (payload.table) setIssueTable(payload.table);
            } else if (event === 'workflow:error') {
              setError(payload.message);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }

    setRunning(false);
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }`}</style>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', margin: '0 0 0.25rem' }}>🔬 Full Analysis Pipeline</h2>
        <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>
          Stress test → AI performance analysis → security scan → issue compilation → GitHub code search → code review → final report
        </p>
      </div>

      {/* Config form */}
      <div style={{ background: '#0a1525', border: '1px solid #1e293b', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Method</label>
            <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              style={{ width: '100%', background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.4rem', fontSize: '0.8rem' }}>
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Target URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://api.example.com/endpoint"
              style={{ width: '100%', background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.4rem', fontSize: '0.8rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Request Payload (JSON, optional)</label>
            <textarea value={form.payload} onChange={e => setForm(f => ({ ...f, payload: e.target.value }))} rows={3} placeholder='{ "key": "value" }'
              style={{ width: '100%', background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.4rem', fontSize: '0.75rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>VUs</label>
              <input type="number" value={form.vus} onChange={e => setForm(f => ({ ...f, vus: e.target.value }))} min={1} max={500}
                style={{ width: '100%', background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.4rem', fontSize: '0.8rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Duration (s)</label>
              <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} min={5} max={300}
                style={{ width: '100%', background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.4rem', fontSize: '0.8rem', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* GitHub repos (token loaded from backend .env) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', color: '#4ade80', whiteSpace: 'nowrap' }}>✓ GitHub (token from .env)</span>
          <label style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>Repos</label>
          <input value={form.githubRepos} onChange={e => setForm(f => ({ ...f, githubRepos: e.target.value }))}
            placeholder="owner/repo1,owner/repo2 — leave blank to use GITHUB_REPOS from .env"
            style={{ flex: 1, background: '#070f1a', border: '1px solid #1e293b', borderRadius: 4, color: '#e2e8f0', padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={run} disabled={running || !form.url}
            style={{ background: running ? '#1e3a5f' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.5rem', cursor: running || !form.url ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
            {running ? '⏳ Running…' : '🔬 Run Full Analysis'}
          </button>
          {running && (
            <button onClick={stop}
              style={{ background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem' }}>
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(running || Object.keys(stepStates).length > 0) && (
        <StepBar stepStates={stepStates} />
      )}

      {/* Step labels feed */}
      {Object.entries(stepLabels).length > 0 && (
        <div style={{ background: '#070f1a', border: '1px solid #1e293b', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', maxHeight: 160, overflowY: 'auto' }}>
          {Object.entries(stepLabels).sort(([a], [b]) => +a - +b).map(([id, label]) => {
            const step = STEPS.find(s => s.id === +id);
            const state = stepStates[id];
            const col = state === 'complete' ? '#4ade80' : state === 'error' ? '#f87171' : '#93c5fd';
            return (
              <div key={id} style={{ fontSize: '0.75rem', color: col, marginBottom: '0.2rem' }}>
                {step?.icon} <strong>Step {id}:</strong> {label}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ background: '#2d0a0a', border: '1px solid #dc2626', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.8rem' }}>
          ✗ {error}
        </div>
      )}

      {/* Issue table */}
      {issueTable.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            📋 All Issues ({issueTable.length})
          </h3>
          <IssueTable rows={issueTable} />
        </div>
      )}

      {/* Step result accordion */}
      {Object.entries(stepData).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Step Details</h3>
          {STEPS.filter(s => stepData[s.id]).map(step => (
            <StepResult key={step.id} step={step} data={stepData[step.id]} />
          ))}
        </div>
      )}

      {/* Final report */}
      {report && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: 0 }}>📄 Final Report</h3>
            <button onClick={() => navigator.clipboard.writeText(report)}
              style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 4, padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
              📋 Copy Markdown
            </button>
          </div>
          <div style={{ background: '#070f1a', border: '1px solid #1e293b', borderRadius: 8, padding: '1.25rem 1.5rem', maxHeight: 600, overflowY: 'auto' }}>
            <style>{`
              .md-report h1 { color:#e2e8f0; font-size:1.2rem; margin:0 0 1rem; border-bottom:1px solid #1e293b; padding-bottom:0.5rem; }
              .md-report h2 { color:#93c5fd; font-size:1rem; margin:1.25rem 0 0.5rem; }
              .md-report h3 { color:#a5b4fc; font-size:0.88rem; margin:1rem 0 0.4rem; }
              .md-report p  { color:#94a3b8; font-size:0.8rem; line-height:1.7; margin:0.4rem 0; }
              .md-report strong { color:#e2e8f0; }
              .md-report em { color:#7dd3fc; font-style:italic; }
              .md-report ul, .md-report ol { color:#94a3b8; font-size:0.8rem; padding-left:1.25rem; margin:0.4rem 0; }
              .md-report li { margin:0.25rem 0; line-height:1.6; }
              .md-report table { width:100%; border-collapse:collapse; font-size:0.78rem; margin:0.75rem 0; }
              .md-report th { background:#0f172a; color:#64748b; font-weight:600; text-align:left; padding:0.4rem 0.75rem; border-bottom:1px solid #1e293b; }
              .md-report td { color:#94a3b8; padding:0.35rem 0.75rem; border-bottom:1px solid #0f172a; }
              .md-report tr:hover td { background:#0a1525; }
              .md-report code { background:#0f172a; color:#7dd3fc; padding:0.1rem 0.35rem; border-radius:3px; font-size:0.78rem; font-family:monospace; }
              .md-report pre { background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:0.75rem; overflow-x:auto; margin:0.5rem 0; }
              .md-report pre code { background:none; padding:0; color:#94a3b8; }
              .md-report hr { border:none; border-top:1px solid #1e293b; margin:1rem 0; }
              .md-report blockquote { border-left:3px solid #3b82f6; padding-left:0.75rem; color:#64748b; margin:0.5rem 0; }
            `}</style>
            <div className="md-report">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

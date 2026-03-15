import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import TestForm from './components/TestForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import SuiteDashboard from './components/SuiteDashboard.jsx';
import WSTestPanel from './components/WSTestPanel.jsx';
import SecurityPanel from './components/SecurityPanel.jsx';
import MockPanel from './components/MockPanel.jsx';
import WorkflowPanel from './components/WorkflowPanel.jsx';

const API = 'http://localhost:3001';

// ── Live mini-chart shown during test run ─────────────────────────────────────
function LiveChart({ data }) {
  if (!data.length) return null;
  return (
    <div className="live-chart-card">
      <div className="live-chart-label">
        <span>Live Response Time</span>
        <span className="live-dot" />
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45" />
          <XAxis dataKey="second" stroke="#475569" tick={{ fontSize: 9 }} />
          <YAxis stroke="#475569" tick={{ fontSize: 9 }} unit="ms" />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: '6px', fontSize: '10px' }}
            formatter={(v) => [`${v} ms`]}
            labelFormatter={(v) => `Second ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: '9px' }} />
          <Line type="monotone" dataKey="avgLatency" stroke="#60a5fa" name="Avg" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="maxLatency" stroke="#f87171" name="Max" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LiveStats({ ticks }) {
  if (!ticks.length) return null;
  const last = ticks[ticks.length - 1];
  const totalReqs = ticks.reduce((s, t) => s + t.count, 0);
  const totalErr = ticks.reduce((s, t) => s + t.errors, 0);
  return (
    <div className="live-stats">
      {[
        { label: 'Requests', value: totalReqs.toLocaleString() },
        { label: 'Errors', value: totalErr, color: totalErr > 0 ? '#f87171' : '#22c55e' },
        { label: 'Avg (last s)', value: `${last.avgLatency}ms` },
        { label: 'Max (last s)', value: `${last.maxLatency}ms` },
      ].map(s => (
        <div key={s.label} className="live-stat-item">
          <div className="live-stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
          <div className="live-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Navigation Tabs ───────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'stress',    label: '⚡ Stress Test',    desc: 'HTTP load testing' },
  { id: 'suites',   label: '📊 Test Suites',    desc: '82 test cases across 5 suites' },
  { id: 'websocket',label: '🔵 WebSocket',       desc: 'WS load & security testing' },
  { id: 'security', label: '🔴 Security Scan',   desc: '30 OWASP policies' },
  { id: 'mock',     label: '🎲 Mock AI',         desc: 'AI-powered mock data generator' },
  { id: 'workflow', label: '🔬 Full Analysis',   desc: '7-step automated analysis pipeline' },
];

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('stress');
  const [view, setView] = useState('form');
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(10);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [testId, setTestId] = useState(null);
  const [healthInfo, setHealthInfo] = useState(null);
  const [preFill, setPreFill] = useState(null);
  const [liveTicks, setLiveTicks] = useState([]);
  const esRef = useRef(null);

  // Suite state
  const [suiteResults, setSuiteResults] = useState(null);
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteBaseUrl, setSuiteBaseUrl] = useState('');
  const [suiteAuthToken, setSuiteAuthToken] = useState('');

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then(r => r.json())
      .then(setHealthInfo)
      .catch(() => setHealthInfo({ engine: 'autocannon', aiAvailable: false, k6Available: false }));

    const params = new URLSearchParams(window.location.search);

    const tabParam = params.get('tab');
    if (tabParam) setActiveTab(tabParam);

    const reqParam = params.get('request');
    if (reqParam) {
      try { setPreFill(JSON.parse(atob(reqParam))); } catch (_) {}
      window.history.replaceState({}, '', window.location.pathname);
    }

    const tid = params.get('testId');
    if (tid) {
      window.history.replaceState({}, '', window.location.pathname);
      setTestId(tid);
      setView('running');
      setDuration(30);
      attachStream(tid);
    }

    // Load suite definitions
    fetch(`${API}/api/suites`)
      .then(r => r.json())
      .then(defs => setSuiteResults(defs))
      .catch(() => {});
  }, []);

  const attachStream = (id) => {
    const es = new EventSource(`${API}/api/test/${id}/stream`);
    esRef.current = es;

    es.addEventListener('tick', (e) => {
      const tick = JSON.parse(e.data);
      setLiveTicks(prev => {
        const filtered = prev.filter(t => t.second !== tick.second);
        return [...filtered, tick].sort((a, b) => a.second - b.second);
      });
    });

    es.addEventListener('log', (e) => {
      const { text } = JSON.parse(e.data);
      setLogs(prev => [...prev, text]);
    });

    es.addEventListener('status', (e) => {
      const { status: s, elapsed: el } = JSON.parse(e.data);
      setStatus(s);
      setElapsed(el);
    });

    es.addEventListener('complete', (e) => {
      const { status: s, results: r, error: err } = JSON.parse(e.data);
      es.close();
      setResults(r);
      setError(err || (s === 'failed' && !r ? 'Test failed — check the target URL is reachable.' : null));
      setView('results');
    });

    es.onerror = () => { es.close(); setError('Lost connection to backend.'); setView('results'); };
  };

  const runTest = async (cfg) => {
    setConfig(cfg);
    setDuration(cfg.duration);
    setLogs([]);
    setLiveTicks([]);
    setStatus('starting');
    setElapsed(0);
    setResults(null);
    setError(null);
    setView('running');

    try {
      const resp = await fetch(`${API}/api/start-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!resp.ok) {
        const e = await resp.json();
        throw new Error(e.error || 'Failed to start test');
      }
      const { testId: id } = await resp.json();
      setTestId(id);
      attachStream(id);
    } catch (err) {
      setError(err.message);
      setView('results');
    }
  };

  const cancelTest = async () => {
    if (esRef.current) esRef.current.close();
    if (testId) await fetch(`${API}/api/test/${testId}`, { method: 'DELETE' }).catch(() => {});
    setView('form');
  };

  const progressPct = duration > 0 ? Math.min((elapsed / 1000 / duration) * 100, 99) : 0;

  // Suite runner
  const runSuite = async (suiteName) => {
    if (!suiteBaseUrl) return;
    setSuiteRunning(true);

    // Merge pending state into existing
    setSuiteResults(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      const names = suiteName ? [suiteName] : Object.keys(next);
      for (const n of names) {
        next[n] = (next[n] || []).map(tc => ({ ...tc, status: 'running' }));
      }
      return next;
    });

    try {
      const resp = await fetch(`${API}/api/suites/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite: suiteName, baseUrl: suiteBaseUrl, authToken: suiteAuthToken }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      const { testId: id } = await resp.json();

      const poll = setInterval(async () => {
        const r = await fetch(`${API}/api/test/${id}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.status === 'completed') {
          clearInterval(poll);
          setSuiteRunning(false);
          // Merge results
          setSuiteResults(prev => {
            const next = { ...prev };
            if (Array.isArray(data.results)) {
              // Single suite result
              const suite = data.results[0]?.suite;
              if (suite) next[suite] = data.results;
            } else if (data.results && typeof data.results === 'object') {
              // All suites
              for (const [k, v] of Object.entries(data.results)) {
                next[k] = v;
              }
            }
            return next;
          });
        } else if (data.status === 'error') {
          clearInterval(poll);
          setSuiteRunning(false);
        }
      }, 1000);
    } catch (err) {
      setSuiteRunning(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>⚡ Load Testing Dashboard</h1>
            <span className="header-badge">autocannon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {healthInfo && (
              <div className="k6-status">
                <span className="status-dot ok" />
                {healthInfo.engineVersion || 'autocannon'}
                {healthInfo.aiAvailable && (
                  <span style={{ marginLeft: '0.5rem', color: '#a78bfa' }}>· AI ✓</span>
                )}
              </div>
            )}
            {activeTab === 'stress' && view !== 'form' && (
              <button className="btn-secondary" onClick={() => {
                if (esRef.current) esRef.current.close();
                setView('form');
              }}>
                New Test
              </button>
            )}
          </div>
        </div>

        {/* ── Navigation Tabs ─────────────────────────── */}
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', gap: '0.25rem', paddingBottom: '0.5rem' }}>
          {NAV_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#1d4ed822' : 'transparent',
                color: activeTab === tab.id ? '#60a5fa' : '#64748b',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #60a5fa' : '2px solid transparent',
                padding: '0.4rem 1rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="main">

        {/* ── Stress Test Tab ─────────────────────────── */}
        {activeTab === 'stress' && (
          <>
            {view === 'form' && (
              <TestForm onSubmit={runTest} preFill={preFill} onPreFillUsed={() => setPreFill(null)} />
            )}

            {view === 'running' && (
              <div className="running-view">
                <div className="running-left">
                  <div className="running-indicator">
                    <div className="spinner-ring" />
                    <h2>Test Running</h2>
                    <p className="elapsed">{(elapsed / 1000).toFixed(1)}s / {duration}s</p>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar" style={{ width: `${progressPct}%` }} />
                    </div>
                    {config && (
                      <div className="running-config">
                        <div className="config-chip"><strong>{config.method}</strong></div>
                        <div className="config-chip"><strong>{config.vus}</strong> VUs</div>
                        <div className="config-chip"><strong>{config.duration}</strong>s</div>
                      </div>
                    )}
                    {config && <p className="running-url">{config.url}</p>}
                    <button className="btn-cancel" onClick={cancelTest}>Cancel</button>
                  </div>
                  <LiveStats ticks={liveTicks} />
                  <LiveChart data={liveTicks} />
                </div>
                <div className="log-panel">
                  <div className="log-panel-header">
                    <h3>Live Output</h3>
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>{status}</span>
                  </div>
                  <pre className="log-output">
                    {logs.length > 0
                      ? logs.join('')
                      : liveTicks.length > 0
                        ? `autocannon running...\n${liveTicks.length} second(s) of data collected\n`
                        : 'Starting autocannon...\n'}
                  </pre>
                </div>
              </div>
            )}

            {view === 'results' && (
              <Dashboard
                results={results}
                config={config}
                error={error}
                logs={logs}
                aiAvailable={healthInfo?.aiAvailable}
              />
            )}
          </>
        )}

        {/* ── Test Suites Tab ──────────────────────────── */}
        {activeTab === 'suites' && (
          <SuiteDashboard
            suiteResults={suiteResults}
            onRunSuite={runSuite}
            onRunAll={() => runSuite(null)}
            running={suiteRunning}
            baseUrl={suiteBaseUrl}
            setBaseUrl={setSuiteBaseUrl}
            authToken={suiteAuthToken}
            setAuthToken={setSuiteAuthToken}
          />
        )}

        {/* ── WebSocket Tab ────────────────────────────── */}
        {activeTab === 'websocket' && <WSTestPanel />}

        {/* ── Security Tab ─────────────────────────────── */}
        {activeTab === 'security' && <SecurityPanel />}

        {/* ── Mock AI Tab ───────────────────────────────── */}
        {activeTab === 'mock' && <MockPanel />}

        {/* ── Full Analysis Tab ──────────────────────────── */}
        {activeTab === 'workflow' && <WorkflowPanel preFill={preFill} />}

      </main>
    </div>
  );
}

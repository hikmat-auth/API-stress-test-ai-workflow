// ── WebSocket Test Panel ──────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const API = 'http://localhost:3001';

const CHART_THEME = {
  grid: '#1f2d45',
  axis: '#475569',
  tooltip: { backgroundColor: '#111827', border: '1px solid #1f2d45', borderRadius: '8px', fontSize: '11px' },
};

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 10, padding: '0.75rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || '#e2e8f0' }}>{value}{unit && <span style={{ fontSize: '0.7rem', marginLeft: 2 }}>{unit}</span>}</div>
      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function WSTestPanel() {
  const [config, setConfig] = useState({ url: '', connections: 10, duration: 15, token: '', pingInterval: 5000 });
  const [messages, setMessages] = useState([{ id: 1, type: 'subscribe', value: '{"type":"subscribe","channel":"prices"}' }]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [testId, setTestId] = useState(null);
  const [secResults, setSecResults] = useState(null);
  const [secLoading, setSecLoading] = useState(false);
  const pollRef = useRef(null);

  const addMessage = () => setMessages(ms => [...ms, { id: Date.now(), type: 'custom', value: '{}' }]);
  const removeMessage = (id) => setMessages(ms => ms.filter(m => m.id !== id));

  const startTest = async () => {
    if (!config.url) return setError('WebSocket URL is required');
    setRunning(true);
    setResults(null);
    setError(null);
    setLogs([]);

    try {
      const parsedMessages = messages.map(m => {
        try { return JSON.parse(m.value); }
        catch { return m.value; }
      });

      const resp = await fetch(`${API}/api/ws-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.url,
          connections: parseInt(config.connections),
          duration: parseInt(config.duration),
          token: config.token || null,
          messages: parsedMessages,
          pingInterval: parseInt(config.pingInterval),
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      const { testId: id } = await resp.json();
      setTestId(id);

      // Poll for results
      pollRef.current = setInterval(async () => {
        const r = await fetch(`${API}/api/test/${id}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.status === 'completed') {
          clearInterval(pollRef.current);
          setRunning(false);
          setResults(data.results);
        } else if (data.status === 'error') {
          clearInterval(pollRef.current);
          setRunning(false);
          setError(data.error);
        }
        if (data.results) setLogs(l => [...l, `Status: ${data.status}`]);
      }, 1000);
    } catch (err) {
      setRunning(false);
      setError(err.message);
    }
  };

  const runSecurityCheck = async () => {
    if (!config.url) return setError('WebSocket URL is required');
    setSecLoading(true);
    setSecResults(null);
    try {
      const resp = await fetch(`${API}/api/ws-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: config.url, token: config.token || null }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setSecResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSecLoading(false);
    }
  };

  const stopTest = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (testId) fetch(`${API}/api/test/${testId}`, { method: 'DELETE' }).catch(() => {});
    setRunning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Config ───────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem', fontWeight: 600 }}>🔵 WEBSOCKET LOAD TEST</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>WebSocket URL</label>
            <input
              style={inputStyle}
              value={config.url}
              onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
              placeholder="wss://api.yourapp.com/ws"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Auth Token (for WS handshake)</label>
            <input
              type="password"
              style={inputStyle}
              value={config.token}
              onChange={e => setConfig(c => ({ ...c, token: e.target.value }))}
              placeholder="Bearer token or API key"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Connections (concurrent)</label>
            <input type="number" style={inputStyle} value={config.connections} min={1} max={500}
              onChange={e => setConfig(c => ({ ...c, connections: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Duration (seconds)</label>
            <input type="number" style={inputStyle} value={config.duration} min={5} max={3600}
              onChange={e => setConfig(c => ({ ...c, duration: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Ping Interval (ms, 0 = disable)</label>
            <input type="number" style={inputStyle} value={config.pingInterval} min={0} max={60000}
              onChange={e => setConfig(c => ({ ...c, pingInterval: e.target.value }))} />
          </div>
        </div>

        {/* Messages */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>MESSAGES TO SEND ON CONNECT</label>
            <button onClick={addMessage} style={smallBtn('#2563eb')}>＋ Add Message</button>
          </div>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.75rem', flex: 1 }}
                value={m.value}
                onChange={e => setMessages(ms => ms.map(x => x.id === m.id ? { ...x, value: e.target.value } : x))}
                placeholder='{"type":"subscribe","channel":"prices"}'
              />
              <button onClick={() => removeMessage(m.id)} style={smallBtn('#ef4444')}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button onClick={startTest} disabled={running} style={btnStyle(running ? '#1f2d45' : '#2563eb', running)}>
            {running ? '⏳ Running…' : '⚡ Start WS Load Test'}
          </button>
          <button onClick={runSecurityCheck} disabled={secLoading || running} style={btnStyle(secLoading ? '#1f2d45' : '#7c3aed', secLoading)}>
            {secLoading ? '🔍 Checking…' : '🔐 WS Security Check'}
          </button>
          {running && <button onClick={stopTest} style={btnStyle('#dc2626')}>■ Stop</button>}
        </div>

        {error && <div style={{ marginTop: '0.75rem', background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}
      </div>

      {/* ── Running Indicator ─────────────────────────── */}
      {running && (
        <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '1rem', marginBottom: '0.5rem' }}>⏳ WebSocket test running…</div>
          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{config.connections} connections × {config.duration}s</div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner-ring" />
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────── */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>WS Test Results</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
            <StatCard label="Connections"    value={`${results.summary.successConnections}/${results.summary.totalConnections}`} color="#22c55e" />
            <StatCard label="Success Rate"   value={`${results.summary.connectionSuccessRate}%`} color={results.summary.connectionSuccessRate > 95 ? '#22c55e' : '#f87171'} />
            <StatCard label="Messages Sent"  value={results.summary.totalMessages} color="#60a5fa" />
            <StatCard label="Events Received" value={results.summary.totalEvents} color="#a78bfa" />
            <StatCard label="Avg Latency"    value={results.summary.avgLatency} unit="ms" color="#fbbf24" />
            <StatCard label="P95 Latency"    value={results.summary.p95} unit="ms" color="#fb923c" />
            <StatCard label="P99 Latency"    value={results.summary.p99} unit="ms" color="#f87171" />
            <StatCard label="Disconnects"    value={results.summary.totalDisconnects} color="#94a3b8" />
          </div>

          {results.timeline?.length > 0 && (
            <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1rem' }}>Connection & Message Timeline</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={results.timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="second" stroke={CHART_THEME.axis} tick={{ fontSize: 10 }} label={{ value: 'Second', position: 'insideBottom', offset: -2, fill: CHART_THEME.axis, fontSize: 10 }} />
                  <YAxis stroke={CHART_THEME.axis} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={CHART_THEME.tooltip} />
                  <Line type="monotone" dataKey="connected" stroke="#22c55e" name="Connections" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="messages" stroke="#60a5fa" name="Messages" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="errors" stroke="#f87171" name="Errors" dot={false} strokeWidth={1.5} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Event type distribution */}
          {results.statusMap && Object.keys(results.statusMap).length > 0 && (
            <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem' }}>Event Type Distribution</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(results.statusMap).map(([type, count]) => (
                  <div key={type} style={{ background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#60a5fa' }}>{type}</span>
                    <span style={{ color: '#64748b', marginLeft: 6 }}>×{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.summary.errors?.length > 0 && (
            <div style={{ background: '#111827', border: '1px solid #ef444422', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171', marginBottom: '0.75rem' }}>Errors ({results.summary.errors.length})</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#f87171' }}>
                {results.summary.errors.slice(0, 10).map((e, i) => (
                  <div key={i} style={{ padding: '0.2rem 0' }}>[VU {e.vu}] {e.phase}: {e.message}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Security Results ──────────────────────────── */}
      {secResults && (
        <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1f2d45' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>🔐 WebSocket Security Check Results</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#0b0f1a', borderBottom: '1px solid #1f2d45' }}>
                {['Check', 'Status', 'Detail'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {secResults.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1f2d4520' }}>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#e2e8f0' }}>{r.name}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ color: r.passed ? '#22c55e' : '#f87171', fontWeight: 600 }}>
                      {r.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.75rem' }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#0b0f1a', border: '1px solid #1f2d45',
  borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.85rem',
};

const btnStyle = (bg, disabled = false) => ({
  background: bg, color: disabled ? '#64748b' : '#fff', border: 'none',
  borderRadius: 8, padding: '0.55rem 1.1rem', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.82rem', fontWeight: 600,
});

const smallBtn = (color) => ({
  background: color + '22', color, border: `1px solid ${color}44`,
  borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
});

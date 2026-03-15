// ── Security Scanner Panel ────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const API = 'http://localhost:3001';

const RISK_COLORS = { CRITICAL: '#ef4444', HIGH: '#f87171', MEDIUM: '#fbbf24', LOW: '#4ade80' };
const RISK_BG     = { CRITICAL: '#ef444415', HIGH: '#f8717115', MEDIUM: '#fbbf2415', LOW: '#4ade8015' };

const CATEGORIES_META = {
  'Broken Access Control':            { color: '#f87171', icon: '🔐' },
  'Cryptographic Failures':           { color: '#fb923c', icon: '🔒' },
  'Injection':                        { color: '#ef4444', icon: '💉' },
  'Insecure Design':                  { color: '#fbbf24', icon: '🏗' },
  'Security Misconfiguration':        { color: '#a78bfa', icon: '⚙️' },
  'Vulnerable Components':            { color: '#60a5fa', icon: '📦' },
  'Identification & Auth Failures':   { color: '#f87171', icon: '🔑' },
  'Software & Data Integrity':        { color: '#34d399', icon: '✅' },
  'Logging & Monitoring Failures':    { color: '#94a3b8', icon: '📋' },
  'Server-Side Request Forgery':      { color: '#c084fc', icon: '🕵️' },
  'Additional Security':              { color: '#67e8f9', icon: '🛡' },
};

function RiskBadge({ risk }) {
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: 4,
      background: RISK_COLORS[risk] + '22', color: RISK_COLORS[risk],
      border: `1px solid ${RISK_COLORS[risk]}44`, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{risk}</span>
  );
}

function ScoreGauge({ score, riskLevel }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#fbbf24' : '#ef4444';
  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <div style={{ fontSize: '3rem', fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Security Score</div>
      <div style={{ marginTop: '0.5rem', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 8, background: RISK_COLORS[riskLevel] + '22', color: RISK_COLORS[riskLevel], fontSize: '0.75rem', fontWeight: 700 }}>
        {riskLevel} RISK
      </div>
    </div>
  );
}

export default function SecurityPanel() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', risk: 'all', category: 'all' });
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const pollRef = useRef(null);

  const runScan = async () => {
    if (!url) return setError('Target URL is required');
    setRunning(true);
    setResults(null);
    setError(null);
    setLogs([]);

    try {
      const resp = await fetch(`${API}/api/security/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      const { testId } = await resp.json();

      pollRef.current = setInterval(async () => {
        const r = await fetch(`${API}/api/test/${testId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.logs) setLogs(data.logs.map(l => l.text || l));
        if (data.status === 'completed') {
          clearInterval(pollRef.current);
          setRunning(false);
          setResults(data.results);
        } else if (data.status === 'error') {
          clearInterval(pollRef.current);
          setRunning(false);
          setError(data.error);
        }
      }, 800);
    } catch (err) {
      setRunning(false);
      setError(err.message);
    }
  };

  const stopScan = () => {
    clearInterval(pollRef.current);
    setRunning(false);
  };

  // Build filtered results
  const allResults = results?.results || [];
  const filteredResults = allResults.filter(r => {
    if (filter.status === 'pass' && !r.passed) return false;
    if (filter.status === 'fail' && r.passed !== false) return false;
    if (filter.status === 'skipped' && !r.skipped) return false;
    if (filter.risk !== 'all' && r.risk !== filter.risk) return false;
    if (filter.category !== 'all' && r.category !== filter.category) return false;
    return true;
  });

  // Chart data
  const riskData = Object.entries(RISK_COLORS).map(([risk, color]) => ({
    risk,
    fail: allResults.filter(r => r.risk === risk && r.passed === false).length,
    pass: allResults.filter(r => r.risk === risk && r.passed === true).length,
    color,
  })).filter(d => d.fail + d.pass > 0);

  const categoryData = Object.keys(CATEGORIES_META).map(cat => ({
    cat: cat.split(' ').slice(0, 2).join(' '),
    full: cat,
    fail: allResults.filter(r => r.category === cat && r.passed === false).length,
    pass: allResults.filter(r => r.category === cat && r.passed === true).length,
  })).filter(d => d.fail + d.pass > 0);

  const pieData = [
    { name: 'Pass', value: results?.summary?.passed || 0, color: '#22c55e' },
    { name: 'Fail', value: results?.summary?.failed || 0, color: '#ef4444' },
    { name: 'Skipped', value: results?.summary?.skipped || 0, color: '#64748b' },
  ].filter(d => d.value > 0);

  const categories = [...new Set(allResults.map(r => r.category))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Config ───────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem', fontWeight: 600 }}>🔴 OWASP SECURITY SCANNER — 30 POLICIES</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Target URL</label>
            <input
              style={inputStyle}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.yourapp.com/api/tokens"
            />
          </div>
          <button onClick={runScan} disabled={running} style={btnStyle(running ? '#1f2d45' : '#dc2626', running)}>
            {running ? '🔍 Scanning…' : '🔍 Run Security Scan'}
          </button>
          {running && <button onClick={stopScan} style={btnStyle('#475569')}>■ Stop</button>}
        </div>
        {error && <div style={{ marginTop: '0.75rem', background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}

        {/* Policy list */}
        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {Object.entries(CATEGORIES_META).map(([cat, meta]) => (
            <span key={cat} style={{ fontSize: '0.65rem', background: meta.color + '15', color: meta.color, border: `1px solid ${meta.color}33`, borderRadius: 9999, padding: '0.2rem 0.5rem' }}>
              {meta.icon} {cat}
            </span>
          ))}
        </div>
      </div>

      {/* ── Running logs ─────────────────────────────── */}
      {running && logs.length > 0 && (
        <div style={{ background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>SCAN PROGRESS</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#60a5fa', maxHeight: 200, overflowY: 'auto' }}>
            {logs.slice(-20).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {/* ── Summary ──────────────────────────────────── */}
      {results && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
            <ScoreGauge score={results.summary.score} riskLevel={results.riskLevel} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.6rem', alignContent: 'center' }}>
              {[
                { label: 'Total Policies', value: results.summary.total, color: '#94a3b8' },
                { label: 'Passed', value: results.summary.passed, color: '#22c55e' },
                { label: 'Failed', value: results.summary.failed, color: '#f87171' },
                { label: 'Skipped', value: results.summary.skipped, color: '#64748b' },
                { label: 'Critical Fails', value: results.summary.criticalFails, color: '#ef4444' },
                { label: 'High Fails', value: results.summary.highFails, color: '#f87171' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0b0f1a', borderRadius: 8, padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1rem' }}>Results Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1rem' }}>Failures by Risk Level</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={riskData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45" />
                  <XAxis dataKey="risk" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="fail" name="Failed" radius={[4, 4, 0, 0]}>
                    {riskData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Critical findings highlight */}
          {results.summary.criticalFails > 0 && (
            <div style={{ background: '#ef444410', border: '1px solid #ef444433', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ CRITICAL VULNERABILITIES DETECTED</div>
              {allResults.filter(r => r.risk === 'CRITICAL' && r.passed === false).map(r => (
                <div key={r.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #ef444420', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ef4444', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.id}</span>
                  <div>
                    <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>{r.name}</div>
                    {r.evidence && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 2 }}>Evidence: {r.evidence}</div>}
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 2 }}>{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full results table */}
          <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #1f2d45', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>All Policy Results ({filteredResults.length})</span>
              <select style={selectStyle} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="all">All Status</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="skipped">Skipped</option>
              </select>
              <select style={selectStyle} value={filter.risk} onChange={e => setFilter(f => ({ ...f, risk: e.target.value }))}>
                <option value="all">All Risk</option>
                {Object.keys(RISK_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select style={selectStyle} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#0b0f1a', borderBottom: '1px solid #1f2d45' }}>
                    {['ID', 'Category', 'Policy Name', 'Risk', 'Status', 'Detail / Evidence'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => {
                    const catMeta = CATEGORIES_META[r.category] || { color: '#94a3b8', icon: '🔍' };
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #1f2d4520', background: i % 2 === 0 ? 'transparent' : '#0b0f1a08' }}>
                        <td style={{ padding: '0.55rem 0.75rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{r.id}</td>
                        <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.72rem', color: catMeta.color }}>{catMeta.icon} {r.category?.split(' ').slice(0, 3).join(' ')}</span>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{r.name}</div>
                          <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2 }}>{r.description}</div>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}><RiskBadge risk={r.risk} /></td>
                        <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {r.skipped
                            ? <span style={{ color: '#64748b', fontSize: '0.72rem' }}>skipped</span>
                            : r.passed
                              ? <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.75rem' }}>✓ PASS</span>
                              : <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>✗ FAIL</span>
                          }
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.72rem', maxWidth: 280 }}>
                          <div style={{ color: '#94a3b8' }}>{r.detail}</div>
                          {r.evidence && (
                            <div style={{ color: '#f87171', marginTop: 2, fontWeight: 500 }}>⚠ {r.evidence}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.85rem' };
const selectStyle = { background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 6, padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.75rem' };
const btnStyle = (bg, disabled = false) => ({ background: bg, color: disabled ? '#64748b' : '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600 });

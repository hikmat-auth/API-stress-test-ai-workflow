// ── Test Suite Summary Dashboard ──────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:3001';

const SUITE_META = {
  api:         { label: 'API Testing',         color: '#a78bfa', bg: '#3b1f6e', icon: '🟣', total: 20 },
  ws:          { label: 'WebSocket Testing',    color: '#60a5fa', bg: '#1e3a5f', icon: '🔵', total: 15 },
  security:    { label: 'Security Testing',     color: '#f87171', bg: '#5f1e1e', icon: '🔴', total: 20 },
  performance: { label: 'Performance Testing',  color: '#4ade80', bg: '#1e4d2e', icon: '🟢', total: 14 },
  stress:      { label: 'Stress Testing',       color: '#fb923c', bg: '#5c2c0e', icon: '🟠', total: 13 },
};

const RISK_COLORS = {
  CRITICAL: '#ef4444',
  HIGH:     '#f87171',
  MEDIUM:   '#fbbf24',
  LOW:      '#4ade80',
};

const STATUS_COLORS = {
  pass:    '#22c55e',
  fail:    '#ef4444',
  error:   '#f87171',
  skipped: '#64748b',
  pending: '#475569',
  running: '#60a5fa',
};

function RiskBadge({ risk }) {
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
      borderRadius: 4, background: RISK_COLORS[risk] + '22',
      color: RISK_COLORS[risk], border: `1px solid ${RISK_COLORS[risk]}44`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{risk}</span>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem',
      borderRadius: 9999, background: color + '22', color,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{status}</span>
  );
}

function SuiteCard({ name, meta, counts, onClick, selected }) {
  const total = meta.total;
  const passPct = total > 0 ? Math.round((counts.pass / total) * 100) : 0;
  return (
    <div
      onClick={() => onClick(name)}
      style={{
        background: selected ? meta.bg : '#111827',
        border: `2px solid ${selected ? meta.color : '#1f2d45'}`,
        borderRadius: 12, padding: '1.25rem', cursor: 'pointer',
        transition: 'all 0.15s', minWidth: 180,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total', value: total, color: '#94a3b8' },
          { label: 'Pass', value: counts.pass, color: '#22c55e' },
          { label: 'Fail', value: counts.fail + counts.error, color: '#f87171' },
          { label: 'Pending', value: counts.pending + counts.skipped, color: '#64748b' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div style={{ background: '#0b0f1a', borderRadius: 9999, height: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 9999, background: meta.color, width: `${passPct}%`, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4, textAlign: 'right' }}>{passPct}% pass</div>
    </div>
  );
}

export default function SuiteDashboard({ suiteResults, onRunSuite, onRunAll, running, baseUrl, setBaseUrl, authToken, setAuthToken }) {
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', risk: 'all', search: '' });

  // Compute counts per suite
  const counts = {};
  for (const name of Object.keys(SUITE_META)) {
    const cases = suiteResults?.[name] || [];
    counts[name] = { pass: 0, fail: 0, error: 0, skipped: 0, pending: 0 };
    for (const tc of cases) {
      counts[name][tc.status || 'pending'] = (counts[name][tc.status || 'pending'] || 0) + 1;
    }
    // Pad pending if no results yet
    if (cases.length === 0) counts[name].pending = SUITE_META[name].total;
  }

  // Overall totals
  const overallTotal = Object.values(SUITE_META).reduce((s, m) => s + m.total, 0);
  const overallPass  = Object.values(counts).reduce((s, c) => s + c.pass, 0);
  const overallFail  = Object.values(counts).reduce((s, c) => s + c.fail + c.error, 0);
  const overallPending = Object.values(counts).reduce((s, c) => s + c.pending + c.skipped, 0);

  // Risk counts for selected/all suites
  const activeCases = selectedSuite
    ? (suiteResults?.[selectedSuite] || [])
    : Object.values(suiteResults || {}).flat();

  const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const tc of activeCases) {
    if (tc.risk) riskCounts[tc.risk] = (riskCounts[tc.risk] || 0) + 1;
  }

  // Filtered table cases
  const tableCases = activeCases.filter(tc => {
    if (filter.status !== 'all' && tc.status !== filter.status) return false;
    if (filter.risk !== 'all' && tc.risk !== filter.risk) return false;
    if (filter.search && !tc.name.toLowerCase().includes(filter.search.toLowerCase()) &&
        !tc.id.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Config Bar ────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: 600 }}>TARGET CONFIGURATION</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Base URL</label>
            <input
              style={{ width: '100%', background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.85rem' }}
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.yourapp.com"
            />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Auth Token (JWT)</label>
            <input
              type="password"
              style={{ width: '100%', background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.85rem' }}
              value={authToken}
              onChange={e => setAuthToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onRunSuite(selectedSuite)}
              disabled={running || !baseUrl}
              style={{
                background: running ? '#1f2d45' : '#2563eb',
                color: running ? '#64748b' : '#fff',
                border: 'none', borderRadius: 8, padding: '0.55rem 1rem',
                cursor: running || !baseUrl ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem', fontWeight: 600,
              }}
            >
              {running ? '⏳ Running…' : selectedSuite ? `▶ Run ${SUITE_META[selectedSuite]?.icon} ${SUITE_META[selectedSuite]?.label}` : '▶ Run Selected Suite'}
            </button>
            <button
              onClick={onRunAll}
              disabled={running || !baseUrl}
              style={{
                background: running ? '#1f2d45' : '#7c3aed',
                color: running ? '#64748b' : '#fff',
                border: 'none', borderRadius: 8, padding: '0.55rem 1rem',
                cursor: running || !baseUrl ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem', fontWeight: 600,
              }}
            >
              ▶ Run All Suites
            </button>
          </div>
        </div>
      </div>

      {/* ── Overall Summary ───────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem', fontWeight: 600 }}>📊 OVERALL SUMMARY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Total TCs', value: overallTotal, color: '#60a5fa' },
            { label: 'Pass', value: overallPass, color: '#22c55e' },
            { label: 'Fail', value: overallFail, color: '#f87171' },
            { label: 'Pending / Skipped', value: overallPending, color: '#64748b' },
            { label: 'Coverage', value: `${Math.round((overallPass + overallFail) / overallTotal * 100)}%`, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', background: '#0b0f1a', borderRadius: 10, padding: '0.75rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Risk level summary */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {Object.entries(riskCounts).filter(([, v]) => v > 0).map(([risk, cnt]) => (
            <div key={risk} style={{ background: RISK_COLORS[risk] + '15', border: `1px solid ${RISK_COLORS[risk]}33`, borderRadius: 8, padding: '0.3rem 0.7rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLORS[risk], display: 'inline-block' }} />
              <span style={{ fontSize: '0.7rem', color: RISK_COLORS[risk], fontWeight: 600 }}>{risk}</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{cnt} TCs</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Suite Cards ───────────────────────────────── */}
      <div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: 600 }}>SELECT SUITE TO VIEW / RUN</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {Object.entries(SUITE_META).map(([name, meta]) => (
            <SuiteCard
              key={name}
              name={name}
              meta={meta}
              counts={counts[name]}
              onClick={(n) => setSelectedSuite(s => s === n ? null : n)}
              selected={selectedSuite === name}
            />
          ))}
        </div>
      </div>

      {/* ── Test Case Table ───────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1f2d45', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>
            {selectedSuite ? `${SUITE_META[selectedSuite].icon} ${SUITE_META[selectedSuite].label}` : 'All Test Cases'}
            <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#64748b' }}>({tableCases.length} shown)</span>
          </span>
          <input
            style={{ background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 6, padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.75rem', minWidth: 160 }}
            placeholder="Search…"
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
          <select
            style={{ background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 6, padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.75rem' }}
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          >
            <option value="all">All Status</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
            <option value="skipped">Skipped</option>
          </select>
          <select
            style={{ background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 6, padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.75rem' }}
            value={filter.risk}
            onChange={e => setFilter(f => ({ ...f, risk: e.target.value }))}
          >
            <option value="all">All Risk</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2d45', background: '#0b0f1a' }}>
                {['ID', 'Suite', 'Test Name', 'Risk', 'Status', 'Detail'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableCases.map((tc, i) => (
                <tr key={tc.id} style={{ borderBottom: '1px solid #1f2d4522', background: i % 2 === 0 ? 'transparent' : '#0b0f1a08' }}>
                  <td style={{ padding: '0.55rem 0.75rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{tc.id}</td>
                  <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.7rem' }}>{SUITE_META[tc.suite]?.icon} {SUITE_META[tc.suite]?.label?.split(' ')[0]}</span>
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{tc.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2 }}>{tc.description}</div>
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}><RiskBadge risk={tc.risk} /></td>
                  <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}><StatusBadge status={tc.status || 'pending'} /></td>
                  <td style={{ padding: '0.55rem 0.75rem', color: tc.evidence ? '#f87171' : '#94a3b8', fontSize: '0.72rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tc.evidence ? `⚠ ${tc.evidence}` : tc.detail || '—'}
                  </td>
                </tr>
              ))}
              {tableCases.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    {suiteResults ? 'No test cases match filters' : 'Select a suite and run tests to see results'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

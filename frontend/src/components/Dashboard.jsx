import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API = 'http://localhost:3001';

const CHART_THEME = {
  grid: '#1f2d45',
  axis: '#475569',
  tooltip: { backgroundColor: '#111827', border: '1px solid #1f2d45', borderRadius: '8px', fontSize: '11px' },
};
const PIE_COLORS = ['#22c55e', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c', '#34d399'];

// ── Rule-based fallback insights ──────────────────────────────────────────────
function ruleInsights(summary) {
  const out = [];
  if (summary.errorRate > 10)
    out.push({ type: 'error', icon: '🔴', title: 'High Error Rate', desc: `${summary.errorRate}% of requests failed.`, tip: 'Check server logs and verify the endpoint handles the load.' });
  else if (summary.errorRate > 0)
    out.push({ type: 'warning', icon: '🟡', title: 'Some Errors', desc: `${summary.failedRequests} requests failed (${summary.errorRate}%).`, tip: 'Review which status codes are failing.' });

  if (summary.p99 > 5000)
    out.push({ type: 'error', icon: '🐢', title: 'Critical P99 Latency', desc: `P99 = ${summary.p99}ms — severe tail latency under load.`, tip: 'Scale horizontally or optimize slow database queries.' });
  else if (summary.p95 > 2000)
    out.push({ type: 'warning', icon: '⚠️', title: 'High P95 Latency', desc: `P95 = ${summary.p95}ms.`, tip: 'Add caching, connection pooling, or a CDN.' });

  if (summary.maxResponseTime > summary.avgResponseTime * 15)
    out.push({ type: 'info', icon: '📊', title: 'Latency Spikes Detected', desc: `Max (${summary.maxResponseTime}ms) is far above avg (${summary.avgResponseTime}ms).`, tip: 'Investigate GC pauses, cold starts, or resource contention.' });

  if (summary.errorRate === 0 && summary.p95 < 500)
    out.push({ type: 'success', icon: '✅', title: 'Excellent Performance', desc: `Zero errors, P95 = ${summary.p95}ms.`, tip: 'Try increasing VUs to find the performance ceiling.' });
  else if (summary.errorRate === 0)
    out.push({ type: 'success', icon: '✅', title: 'No Errors Detected', desc: 'All requests completed successfully.', tip: 'Increase VUs or duration for a more aggressive test.' });

  return out;
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color }) {
  return (
    <div className="metric-card" style={{ borderLeftColor: color }}>
      <div className="metric-value" style={{ color }}>{value}</div>
      <div className="metric-label">{label}</div>
      {unit && <div className="metric-unit">{unit}</div>}
    </div>
  );
}

// ── AI Analysis Panel ─────────────────────────────────────────────────────────
function AIInsights({ results, config, aiAvailable }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [model, setModel] = useState('');
  const [aiError, setAiError] = useState('');

  const analyze = async () => {
    setLoading(true);
    setAiError('');
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, config }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setInsights(data.insights);
      setModel(data.model);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const iconMap = { error: '🔴', warning: '🟡', info: '🔵', success: '✅' };

  return (
    <div className="ai-section">
      <div className="ai-header">
        <div>
          <span className="ai-title">🤖 AI Performance Analysis</span>
          {model && <span className="ai-model">{model}</span>}
        </div>
        <button
          className={`btn-ai ${!aiAvailable ? 'btn-ai-disabled' : ''}`}
          onClick={analyze}
          disabled={loading || !aiAvailable}
        >
          {loading
            ? <><span className="ai-spinner" /> Analyzing…</>
            : insights
              ? '↺ Re-analyze'
              : aiAvailable
                ? '✨ Analyze with Claude'
                : 'Set ANTHROPIC_API_KEY'}
        </button>
      </div>

      {!aiAvailable && !insights && (
        <div className="ai-hint">
          Add <code>ANTHROPIC_API_KEY=sk-ant-…</code> to <code>backend/.env</code> and restart the backend to enable AI analysis.
        </div>
      )}

      {aiError && <div className="ai-error">{aiError}</div>}

      {insights && (
        <div className="insights-grid">
          {insights.map((ins, i) => (
            <div key={i} className={`insight-card ${ins.type}`}>
              <span className="insight-icon">{iconMap[ins.type] || '💡'}</span>
              <div className="insight-body">
                <div className="insight-title">{ins.title}</div>
                <div className="insight-desc">{ins.description}</div>
                <div className="insight-suggestion">{ins.suggestion}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ results, config, error, logs, aiAvailable }) {
  if (!results && error) {
    return (
      <div className="dashboard">
        <div className="error-box">
          <h2>Test Failed</h2>
          <p>{error}</p>
          {logs?.length > 0 && <pre className="log-output" style={{ marginTop: '1rem' }}>{logs.join('')}</pre>}
        </div>
      </div>
    );
  }

  if (!results || results.summary?.totalRequests === 0) {
    return (
      <div className="dashboard">
        <div className="error-box">
          <h2>No Metrics Collected</h2>
          <p>The test ran but captured no data. Ensure the target URL is reachable.</p>
          {logs?.length > 0 && <pre className="log-output" style={{ marginTop: '1rem' }}>{logs.join('')}</pre>}
        </div>
      </div>
    );
  }

  const { summary, charts, engine } = results;
  const fallback = ruleInsights(summary);

  const statusData = Object.entries(charts.statusCodes || {}).map(([code, count]) => ({
    name: `HTTP ${code}`, value: count,
  }));

  const fmtBytes = (b) => {
    if (!b) return '—';
    if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    if (b > 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
  };

  return (
    <div className="dashboard">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="dashboard-header">
        <div>
          <h2>Test Results <span className="engine-badge">{engine || 'autocannon'}</span></h2>
          {config && (
            <div className="test-info">
              {config.method} {config.url} &mdash; {config.vus} VUs × {config.duration}s
            </div>
          )}
        </div>
      </div>

      {/* ── Summary metrics ──────────────────────────────── */}
      <div className="metrics-grid">
        <MetricCard label="Total Requests"   value={summary.totalRequests.toLocaleString()} color="#60a5fa" />
        <MetricCard label="Success"          value={summary.successRequests.toLocaleString()} color="#22c55e" />
        <MetricCard label="Failed"           value={summary.failedRequests.toLocaleString()} color="#f87171" />
        <MetricCard label="Error Rate"       value={`${summary.errorRate}%`} color={summary.errorRate > 5 ? '#f87171' : '#22c55e'} />
        <MetricCard label="Min"              value={summary.minResponseTime} unit="ms" color="#94a3b8" />
        <MetricCard label="Max"              value={summary.maxResponseTime} unit="ms" color="#94a3b8" />
        <MetricCard label="Req / sec"        value={summary.requestsPerSecond} color="#34d399" />
        {summary.dataReceivedBytes > 0 && (
          <MetricCard label="Data Received"  value={fmtBytes(summary.dataReceivedBytes)} color="#67e8f9" />
        )}
        {summary.connections && (
          <MetricCard label="Connections"    value={summary.connections} color="#818cf8" />
        )}
      </div>

      {/* ── AI Analysis ──────────────────────────────────── */}
      <AIInsights results={results} config={config} aiAvailable={aiAvailable} />

      {/* ── Quick rule-based insights ─────────────────────── */}
      {fallback.length > 0 && (
        <div>
          <div className="section-label">Quick Insights</div>
          <div className="insights-grid">
            {fallback.map((ins, i) => (
              <div key={i} className={`insight-card ${ins.type}`}>
                <span className="insight-icon">{ins.icon}</span>
                <div className="insight-body">
                  <div className="insight-title">{ins.title}</div>
                  <div className="insight-desc">{ins.desc}</div>
                  <div className="insight-suggestion">{ins.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────── */}
      <div className="section-label">Charts</div>
      <div className="charts-grid">

        {charts.responseTime?.length > 0 && (
          <div className="chart-card">
            <h3>Response Time Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.responseTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="second" stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} label={{ value: 'Second', position: 'insideBottom', offset: -2, fill: CHART_THEME.axis, fontSize: 10 }} />
                <YAxis stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip contentStyle={CHART_THEME.tooltip} labelFormatter={(v) => `Second ${v}`} formatter={(v) => [`${v} ms`]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="avg" stroke="#60a5fa" name="Avg" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="max" stroke="#f87171" name="Max" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="min" stroke="#22c55e" name="Min" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {charts.requestRate?.length > 0 && (
          <div className="chart-card">
            <h3>Requests Per Second</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.requestRate} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="second" stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={CHART_THEME.tooltip} labelFormatter={(v) => `Second ${v}`} />
                <Bar dataKey="count" fill="#3b82f6" name="Requests" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {charts.errorRate?.some(e => e.rate > 0) && (
          <div className="chart-card">
            <h3>Error Rate Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.errorRate} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="second" stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={CHART_THEME.axis} tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={CHART_THEME.tooltip} labelFormatter={(v) => `Second ${v}`} formatter={(v) => [`${v}%`]} />
                <Line type="monotone" dataKey="rate" stroke="#f87171" name="Error %" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {statusData.length > 0 && (
          <div className="chart-card">
            <h3>HTTP Status Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {statusData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_THEME.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {logs?.length > 0 && (
        <div className="chart-card">
          <h3>Output Log</h3>
          <pre className="log-output">{logs.join('')}</pre>
        </div>
      )}
    </div>
  );
}

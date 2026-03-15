// ── AI Mock Data Analyzer ─────────────────────────────────────────────────────
import { useState } from 'react';

const API = 'http://localhost:3001';

const RISK_COLORS = { LOW: '#4ade80', MEDIUM: '#fbbf24', HIGH: '#f87171', CRITICAL: '#ef4444' };

const CONTENT_TYPES = [
  { value: 'application/json',                  label: 'JSON',              placeholder: '{\n  "ticker": "BTC",\n  "side": "buy",\n  "amount": 100.0,\n  "userId": 42\n}' },
  { value: 'application/graphql',               label: 'GraphQL',           placeholder: 'query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n    orders { id total }\n  }\n}' },
  { value: 'application/xml',                   label: 'XML / SOAP',        placeholder: '<order>\n  <symbol>AAPL</symbol>\n  <side>buy</side>\n  <quantity>10</quantity>\n  <price>182.50</price>\n</order>' },
  { value: 'application/x-www-form-urlencoded', label: 'Form URL-encoded',  placeholder: 'username=alice&password=secret123&remember=true' },
  { value: 'multipart/form-data',               label: 'Multipart',         placeholder: 'name: Alice Johnson\nfile: [profile.jpg — 256 KB image]\nrole: admin' },
  { value: 'application/x-ndjson',              label: 'NDJSON',            placeholder: '{"index":{"_id":"1"}}\n{"name":"Alice","score":99}\n{"index":{"_id":"2"}}\n{"name":"Bob","score":87}' },
  { value: 'text/csv',                          label: 'CSV',               placeholder: 'id,name,email,amount\n1,Alice,alice@test.com,299.99\n2,Bob,bob@test.com,149.50' },
  { value: 'text/plain',                        label: 'Plain Text',        placeholder: 'Hello, this is a plain text message payload.' },
];

const TYPE_COLORS  = {
  string: '#60a5fa', number: '#fbbf24', boolean: '#a78bfa',
  email: '#34d399', uuid: '#94a3b8', enum: '#fb923c',
  date: '#67e8f9', url: '#c084fc', phone: '#f472b6', object: '#475569', array: '#475569',
};

// ── Reusable sub-components ───────────────────────────────────────────────────

function TypeBadge({ type }) {
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
      background: (TYPE_COLORS[type] || '#475569') + '22',
      color: TYPE_COLORS[type] || '#94a3b8',
      border: `1px solid ${(TYPE_COLORS[type] || '#475569')}44`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{type}</span>
  );
}

function CopyBtn({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} style={{
      background: copied ? '#16532d' : '#1f2d45', color: copied ? '#4ade80' : '#94a3b8',
      border: '1px solid ' + (copied ? '#166534' : '#1f2d45'),
      borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
    }}>
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1f2d45', borderRadius: 12, padding: '1.25rem', ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4b6baa', marginBottom: '0.75rem' }}>
      {children}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPayload(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  return JSON.stringify(val, null, 2);
}

// ── Payload Preview Switcher ──────────────────────────────────────────────────

function PayloadSwitcher({ items, labelKey = 'description', payloadKey = 'payload' }) {
  const [idx, setIdx] = useState(0);
  if (!items?.length) return null;
  const current = items[idx];
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            style={{
              background: idx === i ? '#1d4ed8' : '#0b0f1a',
              border: `1px solid ${idx === i ? '#3b82f6' : '#1f2d45'}`,
              color: idx === i ? '#bfdbfe' : '#64748b',
              borderRadius: 6, padding: '0.25rem 0.6rem',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500,
            }}
          >
            {item[labelKey] || `Sample ${i + 1}`}
          </button>
        ))}
      </div>
      {current.description && payloadKey === 'payload' && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          {current.description}
        </div>
      )}
      {current.expectedBehavior && (
        <div style={{ fontSize: '0.72rem', color: '#4ade80', marginBottom: '0.4rem' }}>
          Expected: {current.expectedBehavior}
        </div>
      )}
      {current.expectedStatus && (
        <div style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: '0.4rem' }}>
          Expected status: {current.expectedStatus} — {current.expectedError}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8,
          padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.78rem',
          color: '#7dd3fc', overflowX: 'auto', margin: 0, lineHeight: 1.6,
        }}>
          {formatPayload(current[payloadKey] ?? current)}
        </pre>
        <div style={{ position: 'absolute', top: 6, right: 8 }}>
          <CopyBtn text={formatPayload(current[payloadKey] ?? current)} label="📋" />
        </div>
      </div>
    </div>
  );
}

// ── Field Table ───────────────────────────────────────────────────────────────

function FieldTable({ fields }) {
  if (!fields?.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: '#0b0f1a', borderBottom: '1px solid #1f2d45' }}>
            {['Field', 'Type', 'Description', 'Constraints', 'Generator Strategy'].map(h => (
              <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1f2d4520', background: i % 2 === 0 ? 'transparent' : '#0b0f1a08' }}>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                <code style={{ color: '#c084fc', fontSize: '0.78rem' }}>{f.key}</code>
                {f.sensitive && (
                  <span style={{ marginLeft: 6, fontSize: '0.6rem', color: '#f87171', background: '#f8717122', borderRadius: 4, padding: '1px 4px' }}>sensitive</span>
                )}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}><TypeBadge type={f.type} /></td>
              <td style={{ padding: '0.5rem 0.75rem', color: '#e2e8f0', maxWidth: 220 }}>{f.description}</td>
              <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8', fontSize: '0.72rem', maxWidth: 160 }}>
                {f.constraints || '—'}
                {f.allowedValues?.length > 0 && (
                  <div style={{ marginTop: 3, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {f.allowedValues.map(v => (
                      <span key={v} style={{ background: '#fb923c22', color: '#fb923c', borderRadius: 4, padding: '1px 5px', fontSize: '0.68rem' }}>{v}</span>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.72rem', maxWidth: 200 }}>{f.generatorStrategy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main MockPanel ────────────────────────────────────────────────────────────

export default function MockPanel() {
  const [form, setForm] = useState({ url: '', method: 'POST', payload: '', responseBody: '', contentType: 'application/json' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('fields');

  const ctInfo = CONTENT_TYPES.find(c => c.value === form.contentType) || CONTENT_TYPES[0];
  const isJson = form.contentType === 'application/json';

  const analyze = async () => {
    if (!form.payload.trim()) return setError('Payload is required');

    // For JSON, try to parse so AI gets a structured object; other formats send as raw string
    let payloadToSend = form.payload;
    if (isJson) {
      try { payloadToSend = JSON.parse(form.payload); }
      catch (e) { return setError('Invalid JSON payload: ' + e.message); }
    }

    let parsedResponse = null;
    if (form.responseBody.trim()) {
      try { parsedResponse = JSON.parse(form.responseBody); } catch { parsedResponse = form.responseBody; }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${API}/api/mock/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.url || 'https://api.example.com/endpoint',
          method: form.method,
          payload: payloadToSend,
          responseBody: parsedResponse,
          contentType: form.contentType,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setResult(data);
      setActiveSection('fields');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const SECTIONS = [
    { id: 'fields',    label: '🔍 Fields',         count: result?.fields?.length },
    { id: 'happy',     label: '✅ Happy Path',      count: result?.happyPath?.length },
    { id: 'edge',      label: '⚠️ Edge Cases',      count: result?.edgeCases?.length },
    { id: 'negative',  label: '❌ Negative Tests',  count: result?.negativeCases?.length },
    { id: 'k6',        label: '⚡ k6 Script',       count: null },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Input Form ──────────────────────────────── */}
      <Card>
        <SectionLabel>🎲 AI Mock Data Analyzer</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 180px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Method</label>
            <select
              style={inputStyle}
              value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
            >
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Payload Format</label>
            <select
              style={inputStyle}
              value={form.contentType}
              onChange={e => setForm(f => ({ ...f, contentType: e.target.value, payload: '' }))}
            >
              {CONTENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>API URL <span style={{ color: '#64748b', fontWeight: 400 }}>(helps AI understand context)</span></label>
            <input
              style={inputStyle}
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://api.yourapp.com/api/tokens"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
              Request Payload <span style={{ color: '#4b6baa', fontWeight: 500 }}>({ctInfo.label})</span> <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              style={{ ...inputStyle, height: 160, fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              value={form.payload}
              onChange={e => setForm(f => ({ ...f, payload: e.target.value }))}
              placeholder={ctInfo.placeholder}
              spellCheck={false}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
              Response Sample (optional — improves AI context)
            </label>
            <textarea
              style={{ ...inputStyle, height: 160, fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              value={form.responseBody}
              onChange={e => setForm(f => ({ ...f, responseBody: e.target.value }))}
              placeholder='{\n  "id": "tok_abc123",\n  "status": "created"\n}'
              spellCheck={false}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={analyze}
            disabled={loading}
            style={{
              background: loading ? '#1f2d45' : 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
              color: loading ? '#64748b' : '#fff',
              border: 'none', borderRadius: 8, padding: '0.6rem 1.4rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {loading
              ? <><span style={spinnerStyle} /> Analyzing with Claude…</>
              : '✨ Analyze with AI'}
          </button>
          {result?._model && (
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
              {result._model} · {result._tokensUsed} tokens
            </span>
          )}
        </div>

        {error && (
          <div style={{ marginTop: '0.75rem', background: '#ef444415', border: '1px solid #ef444433', borderRadius: 8, padding: '0.6rem 0.8rem', color: '#f87171', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}
      </Card>

      {/* ── Results ──────────────────────────────────── */}
      {result && (
        <>
          {/* Context card */}
          <Card style={{ background: '#0d1b2e', borderColor: '#1e3a5f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#4b6baa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI ANALYSIS</div>
                  {result._payloadFormat && (
                    <span style={{ fontSize: '0.62rem', background: '#1d4ed822', color: '#60a5fa', border: '1px solid #3b82f644', borderRadius: 4, padding: '1px 6px', fontWeight: 600, textTransform: 'uppercase' }}>
                      {result._payloadFormat}
                    </span>
                  )}
                </div>
                <p style={{ color: '#93c5fd', fontSize: '0.85rem', lineHeight: 1.7 }}>{result.context}</p>
                {result.loadTestStrategy && (
                  <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.6, marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Load test strategy: {result.loadTestStrategy}
                  </p>
                )}
              </div>
              {result.riskLevel && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: 4 }}>DATA RISK</div>
                  <div style={{
                    background: RISK_COLORS[result.riskLevel] + '22',
                    border: `2px solid ${RISK_COLORS[result.riskLevel]}`,
                    borderRadius: 10, padding: '0.4rem 0.75rem',
                    color: RISK_COLORS[result.riskLevel], fontWeight: 800, fontSize: '0.9rem',
                  }}>{result.riskLevel}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  background: activeSection === s.id ? '#1d4ed822' : '#111827',
                  border: `1px solid ${activeSection === s.id ? '#3b82f6' : '#1f2d45'}`,
                  color: activeSection === s.id ? '#60a5fa' : '#64748b',
                  borderRadius: 8, padding: '0.4rem 0.9rem',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: activeSection === s.id ? 600 : 400,
                }}
              >
                {s.label}
                {s.count != null && (
                  <span style={{ marginLeft: 6, background: '#1f2d45', borderRadius: 9999, padding: '1px 6px', fontSize: '0.65rem', color: '#94a3b8' }}>{s.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Fields */}
          {activeSection === 'fields' && (
            <Card>
              <SectionLabel>🔍 Field Analysis — {result.fields?.length} fields detected</SectionLabel>
              <FieldTable fields={result.fields} />
            </Card>
          )}

          {/* Happy Path */}
          {activeSection === 'happy' && (
            <Card>
              <SectionLabel>✅ Happy Path Samples — {result.happyPath?.length} variations</SectionLabel>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                Realistic, production-like payloads for positive load testing. Click tabs to switch between variations.
              </div>
              <PayloadSwitcher items={result.happyPath} labelKey="description" payloadKey="payload" />
            </Card>
          )}

          {/* Edge Cases */}
          {activeSection === 'edge' && (
            <Card>
              <SectionLabel>⚠️ Edge Cases — {result.edgeCases?.length} scenarios</SectionLabel>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                Boundary values and unusual-but-valid inputs. The server should handle these without errors.
              </div>
              <PayloadSwitcher items={result.edgeCases} labelKey="description" payloadKey="payload" />
            </Card>
          )}

          {/* Negative Tests */}
          {activeSection === 'negative' && (
            <Card>
              <SectionLabel>❌ Negative Test Cases — {result.negativeCases?.length} scenarios</SectionLabel>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                Invalid payloads that should trigger validation errors. The server must reject these with 4xx responses.
              </div>
              <PayloadSwitcher items={result.negativeCases} labelKey="description" payloadKey="payload" />
            </Card>
          )}

          {/* k6 Script */}
          {activeSection === 'k6' && result.k6DataPool && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <SectionLabel style={{ margin: 0 }}>⚡ k6 Script — AI-generated data pool</SectionLabel>
                <CopyBtn text={result.k6DataPool.code} label="📋 Copy Script" />
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                {result.k6DataPool.description}
              </div>
              <pre style={{
                background: '#0b0f1a', border: '1px solid #1f2d45', borderRadius: 8,
                padding: '1rem', fontFamily: 'monospace', fontSize: '0.78rem',
                color: '#7dd3fc', overflowX: 'auto', lineHeight: 1.7, margin: 0,
                maxHeight: 500, overflowY: 'auto',
              }}>
                {result.k6DataPool.code}
              </pre>
            </Card>
          )}
        </>
      )}

      {/* ── Empty state ──────────────────────────────── */}
      {!result && !loading && (
        <Card style={{ textAlign: 'center', padding: '3rem 2rem', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🤖</div>
          <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '0.5rem' }}>AI-powered mock data generation</div>
          <div style={{ color: '#64748b', fontSize: '0.82rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Select your payload format, paste any request body (JSON, GraphQL, XML, form data, CSV…) and click <strong style={{ color: '#60a5fa' }}>Analyze with AI</strong>.
            Claude will understand the API context and generate:
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {[
              ['🔍', 'Field breakdown', 'Types, constraints, purpose of each field'],
              ['✅', 'Happy path data', '5 varied realistic samples'],
              ['⚠️', 'Edge cases', '3 boundary-value payloads'],
              ['❌', 'Negative tests', '3 invalid payloads + expected errors'],
              ['⚡', 'k6 script', 'Ready-to-run load test script'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ textAlign: 'center', maxWidth: 120 }}>
                <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{icon}</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600 }}>{title}</div>
                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{desc}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#0b0f1a', border: '1px solid #1f2d45',
  borderRadius: 8, padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.85rem',
};

const spinnerStyle = {
  display: 'inline-block', width: 13, height: 13,
  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
  borderRadius: '50%', animation: 'spin 0.7s linear infinite',
};

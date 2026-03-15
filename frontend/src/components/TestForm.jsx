import { useState, useEffect } from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function TestForm({ onSubmit, preFill, onPreFillUsed }) {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [payload, setPayload] = useState('');
  const [vus, setVus] = useState(10);
  const [duration, setDuration] = useState(10);
  const [headers, setHeaders] = useState([{ key: 'Authorization', value: '' }]);
  const [payloadError, setPayloadError] = useState('');

  useEffect(() => {
    if (!preFill) return;
    if (preFill.url) setUrl(preFill.url);
    if (preFill.method) setMethod(preFill.method);
    if (preFill.vus) setVus(preFill.vus);
    if (preFill.duration) setDuration(preFill.duration);
    if (preFill.payload) setPayload(typeof preFill.payload === 'string' ? preFill.payload : JSON.stringify(preFill.payload, null, 2));
    if (preFill.headers && Object.keys(preFill.headers).length) {
      setHeaders(Object.entries(preFill.headers).map(([key, value]) => ({ key, value })));
    }
    onPreFillUsed?.();
  }, [preFill]);

  const handleSubmit = (e) => {
    e.preventDefault();

    let parsedPayload = null;
    if (payload.trim()) {
      try {
        parsedPayload = JSON.parse(payload);
        setPayloadError('');
      } catch {
        setPayloadError('Invalid JSON — check your request body.');
        return;
      }
    }

    const headersObj = {};
    for (const h of headers) {
      if (h.key.trim() && h.value.trim()) headersObj[h.key.trim()] = h.value.trim();
    }

    onSubmit({
      url,
      method,
      payload: parsedPayload,
      vus: parseInt(vus) || 1,
      duration: parseInt(duration) || 10,
      headers: headersObj,
    });
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (i) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i, field, val) => {
    const updated = [...headers];
    updated[i] = { ...updated[i], [field]: val };
    setHeaders(updated);
  };

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  return (
    <form className="test-form" onSubmit={handleSubmit}>

      {/* ─ API Configuration ─────────────────────────── */}
      <div className="form-section">
        <div className="section-title">API Configuration</div>

        <div className="form-row">
          <div className="form-group" style={{ flex: '0 0 130px', minWidth: 'auto' }}>
            <label>Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Target URL</label>
            <input
              type="url"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Headers</label>
          <div className="header-rows">
            {headers.map((h, i) => (
              <div key={i} className="header-row">
                <input placeholder="Header name" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} />
                <input placeholder="Value" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} />
                <button type="button" className="btn-icon" onClick={() => removeHeader(i)}>×</button>
              </div>
            ))}
            <button type="button" className="btn-text" onClick={addHeader}>+ Add header</button>
          </div>
        </div>

        {hasBody && (
          <div className="form-group">
            <label>Request Body (JSON)</label>
            <textarea
              placeholder={'{\n  "key": "value"\n}'}
              value={payload}
              onChange={e => setPayload(e.target.value)}
              rows={5}
            />
            {payloadError && <p className="error-text">{payloadError}</p>}
          </div>
        )}
      </div>

      {/* ─ Load Configuration ────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Load Configuration</div>

        <div className="form-row">
          <div className="form-group">
            <label>Virtual Users (VUs) — {vus}</label>
            <div className="slider-group">
              <input type="range" min="1" max="500" value={vus} onChange={e => setVus(e.target.value)} />
              <input type="number" min="1" max="1000" value={vus} onChange={e => setVus(e.target.value)} className="number-input" />
            </div>
          </div>
          <div className="form-group">
            <label>Duration — {duration}s</label>
            <div className="slider-group">
              <input type="range" min="5" max="300" value={duration} onChange={e => setDuration(e.target.value)} />
              <input type="number" min="1" max="600" value={duration} onChange={e => setDuration(e.target.value)} className="number-input" />
            </div>
          </div>
        </div>

        <div className="estimate-box">
          <span>Concurrent users: <strong>{vus}</strong></span>
          <span>Test duration: <strong>{duration}s</strong></span>
          <span>Estimated total requests: <strong>~{(vus * duration * 5).toLocaleString()}+</strong></span>
        </div>
      </div>

      <button type="submit" className="btn-primary">Run Load Test →</button>
    </form>
  );
}

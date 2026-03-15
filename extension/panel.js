// ── Constants ─────────────────────────────────────────────────────────────────

const K6_BACKEND = 'http://localhost:3001';
const K6_DASHBOARD = 'http://localhost:3000';

const SKIP_TYPES = new Set(['image', 'stylesheet', 'script', 'font', 'media', 'ping', 'other']);
const SKIP_HOSTS = new Set(['localhost:3000', 'localhost:3001']);
const VARY_KEYS = ['email', 'user_id', 'userId', 'user', 'username', 'id', 'qty', 'quantity',
  'amount', 'phone', 'name', 'token', 'session_id', 'sessionId', 'cart_id', 'cartId',
  'order_id', 'orderId', 'product_id', 'productId', 'customer_id', 'customerId'];

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  requests: [],
  selected: null,
  isRecording: true,
  journeyMode: false,
  journey: [],
  wsMode: false,
  wsConnections: [],   // captured WS connections
  filter: '',
  methodFilter: 'ALL',
  variationModes: {},
  mockAnalysis: null,  // analyzed payload fields
};

// ── DOM Refs ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const ui = {
  btnRecord:       $('btn-record'),
  btnJourney:      $('btn-journey'),
  btnWsMode:       $('btn-ws-mode'),
  btnClear:        $('btn-clear'),
  search:          $('search'),
  methodFilter:    $('method-filter'),
  reqCount:        $('req-count'),
  reqList:         $('req-list'),
  journeyBanner:   $('journey-banner'),
  journeyCount:    $('journey-count'),
  wsBanner:        $('ws-banner'),
  wsConnCount:     $('ws-conn-count'),
  wsFrameCount:    $('ws-frame-count'),
  btnExportScript: $('btn-export-script'),
  btnStressJourney:$('btn-stress-journey'),
  btnClearJourney: $('btn-clear-journey'),
  btnStressWs:     $('btn-stress-ws'),
  btnWsSecurity:   $('btn-ws-security'),
  btnClearWs:      $('btn-clear-ws'),
  detailEmpty:     $('detail-empty'),
  detailContent:   $('detail-content'),
  ovMethod:        $('ov-method'),
  ovStatus:        $('ov-status'),
  ovUrl:           $('ov-url'),
  ovTime:          $('ov-time'),
  overviewRows:    $('overview-rows'),
  reqHeadersBody:  $('req-headers-body'),
  resHeadersBody:  $('res-headers-body'),
  reqBodyContent:  $('req-body-content'),
  resBodyContent:  $('res-body-content'),
  variationsList:  $('variations-list'),
  variationsPreview: $('variations-preview'),
  quickVus:        $('quick-vus'),
  quickDur:        $('quick-dur'),
  btnStress:       $('btn-stress'),
  btnConfigure:    $('btn-configure'),
  btnAddJourney:   $('btn-add-journey'),
  btnSecurityScan:  $('btn-security-scan'),
  btnFullAnalysis:  $('btn-full-analysis'),
  // Mock data
  mockVu:          $('mock-vu'),
  mockIter:        $('mock-iter'),
  btnMockRefresh:  $('btn-mock-refresh'),
  btnMockAnalyze:  $('btn-mock-analyze'),
  mockFieldsList:  $('mock-fields-list'),
  mockPreview:     $('mock-preview'),
  mockK6Script:    $('mock-k6-script'),
  btnMockCopyScript: $('btn-mock-copy-script'),
  btnMockStress:   $('btn-mock-stress'),
  // WS
  wsFrList:        $('ws-frames-list'),
  wsInfoRows:      $('ws-info-rows'),
  tabWsFramesBtn:  $('tab-ws-frames-btn'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodClass(m) {
  const map = { GET:'GET', POST:'POST', PUT:'PUT', PATCH:'PATCH', DELETE:'DELETE', WS:'WS' };
  return `method-${map[m] || 'OTHER'}`;
}

function statusClass(code) {
  if (code >= 500) return 'status-5xx';
  if (code >= 400) return 'status-4xx';
  if (code >= 300) return 'status-3xx';
  if (code >= 200) return 'status-2xx';
  return 'status-0';
}

function parseUrl(url) {
  try { const u = new URL(url); return { host: u.host, path: u.pathname + u.search }; }
  catch { return { host: '', path: url }; }
}

function tryPrettyJson(text) {
  if (!text) return null;
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch { return text; }
}

function buildHeadersObj(headersList = []) {
  const skip = new Set(['host', 'content-length', ':method', ':path', ':scheme', ':authority',
    'accept-encoding', 'connection', 'transfer-encoding']);
  const obj = {};
  for (const h of headersList) {
    if (!skip.has(h.name.toLowerCase())) obj[h.name] = h.value;
  }
  return obj;
}

function buildK6Config(req) {
  const headers = buildHeadersObj(req.requestHeaders);
  let payload = null;
  if (req.requestBody?.text) {
    try { payload = JSON.parse(req.requestBody.text); }
    catch { payload = req.requestBody.text; }
  }
  if (payload && typeof payload === 'object') payload = applyVariations(payload);
  return { url: req.url, method: req.method, headers, payload };
}

function applyVariations(obj, modes = state.variationModes) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(out)) {
    const mode = modes[key];
    if (mode === 'vu')   out[key] = `\${__VU}`;
    else if (mode === 'iter') out[key] = `\${__ITER}`;
    else if (typeof out[key] === 'object') out[key] = applyVariations(out[key], modes);
  }
  return out;
}

function detectVariableFields(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const fields = [];
  const walk = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = path ? `${path}.${k}` : k;
      if (VARY_KEYS.some(vk => k.toLowerCase().includes(vk.toLowerCase()))) {
        fields.push({ key: fullKey, origValue: v });
      }
      if (v && typeof v === 'object') walk(v, fullKey);
    }
  };
  walk(payload);
  return fields;
}

// ── Mock Data Generation (client-side) ────────────────────────────────────────

const MOCK_GENERATORS = {
  email:      (vu, it) => `user${vu * 1000 + it}@loadtest.dev`,
  username:   (vu, it) => `testuser_${vu}`,
  user:       (vu, it) => `testuser_${vu}`,
  password:   (vu, it) => `P@ssw0rd_${vu}`,
  token:      (vu, it) => `tok_${randomHex(16)}_vu${vu}`,
  id:         (vu, it) => vu * 1000 + it,
  user_id:    (vu, it) => 1000 + vu,
  userId:     (vu, it) => 1000 + vu,
  order_id:   (vu, it) => 8000 + vu * 100 + it,
  orderId:    (vu, it) => 8000 + vu * 100 + it,
  product_id: (vu, it) => (it % 200) + 1,
  productId:  (vu, it) => (it % 200) + 1,
  qty:        (vu, it) => (it % 10) + 1,
  quantity:   (vu, it) => (it % 10) + 1,
  amount:     (vu, it) => parseFloat((Math.random() * 1000 + 1).toFixed(2)),
  price:      (vu, it) => parseFloat((Math.random() * 500 + 0.01).toFixed(2)),
  name:       (vu, it) => `Test User ${vu}`,
  ticker:     (vu, it) => ['BTC','ETH','SOL','USDC'][it % 4],
  symbol:     (vu, it) => ['BTC','ETH','SOL','USDC'][it % 4],
  side:       (vu, it) => it % 2 === 0 ? 'buy' : 'sell',
  page:       (vu, it) => (it % 10) + 1,
  limit:      (vu, it) => [10,20,50,100][it % 4],
  message:    (vu, it) => `Test message VU ${vu} iter ${it}`,
};

function randomHex(len) {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function findMockGen(key) {
  const lk = key.toLowerCase();
  for (const [k, fn] of Object.entries(MOCK_GENERATORS)) {
    if (lk === k || lk.includes(k) || k.includes(lk)) return fn;
  }
  return null;
}

function generateMockValue(key, originalValue, vu, iter) {
  const gen = findMockGen(key);
  if (gen) return gen(vu, iter);
  // Fallback
  if (typeof originalValue === 'number') return Number.isInteger(originalValue) ? originalValue + vu * 100 + iter : parseFloat((originalValue + Math.random()).toFixed(2));
  if (typeof originalValue === 'string' && originalValue.length < 50) return `${originalValue}_vu${vu}_it${iter}`;
  if (typeof originalValue === 'boolean') return (vu + iter) % 2 === 0;
  return originalValue;
}

function generateMockPayload(payload, vu, iter) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = generateMockPayload(value, vu, iter);
    } else {
      out[key] = generateMockValue(key, value, vu, iter);
    }
  }
  return out;
}

function analyzePayloadFields(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const fields = [];
  const walk = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = path ? `${path}.${k}` : k;
      const gen = findMockGen(k);
      fields.push({
        key: fullKey, shortKey: k,
        originalValue: typeof v === 'object' ? JSON.stringify(v) : String(v),
        valueType: typeof v,
        hasGenerator: !!gen,
        generatorName: gen ? Object.entries(MOCK_GENERATORS).find(([gk]) => k.toLowerCase().includes(gk))?.[0] || 'auto' : null,
      });
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, fullKey);
    }
  };
  walk(payload);
  return fields;
}

// ── Request Capture ───────────────────────────────────────────────────────────

chrome.devtools.network.onRequestFinished.addListener((raw) => {
  if (!state.isRecording) return;

  const url = raw.request.url;
  if (url.startsWith('data:') || url.startsWith('chrome-extension://')) return;

  const { host } = parseUrl(url);
  if (SKIP_HOSTS.has(host)) return;

  const type = raw._resourceType || '';
  if (SKIP_TYPES.has(type) && type !== '') return;

  const entry = {
    id: Date.now() + Math.random(),
    url,
    method: raw.request.method,
    status: raw.response.status,
    statusText: raw.response.statusText,
    timingMs: Math.round(raw.time),
    requestHeaders: raw.request.headers,
    requestBody: raw.request.postData || null,
    responseHeaders: raw.response.headers,
    contentType: raw.response.content?.mimeType || '',
    startedDateTime: raw.startedDateTime,
    _raw: raw,
    journeyStep: state.journeyMode ? state.journey.length + 1 : null,
    type: 'http',
  };

  if (state.journeyMode) state.journey.push(entry);
  state.requests.unshift(entry);
  renderList();
});

// ── WebSocket Capture ─────────────────────────────────────────────────────────
// Note: Chrome DevTools API provides limited WS frame access
// We track WS connections via network interception of upgrade requests

function captureWebSocketConnection(url) {
  if (!state.wsMode) return;
  const existing = state.wsConnections.find(c => c.url === url);
  if (existing) return;

  const wsEntry = {
    id: Date.now() + Math.random(),
    url,
    method: 'WS',
    status: 101,
    statusText: 'Switching Protocols',
    timingMs: 0,
    requestHeaders: [],
    requestBody: null,
    responseHeaders: [],
    contentType: 'websocket',
    startedDateTime: new Date().toISOString(),
    type: 'ws',
    frames: [],
    connectedAt: Date.now(),
    _raw: null,
  };

  state.wsConnections.push(wsEntry);
  state.requests.unshift(wsEntry);

  ui.wsConnCount.textContent = state.wsConnections.length;
  renderList();
  return wsEntry;
}

// Track WS via devtools network (upgrade requests)
chrome.devtools.network.onRequestFinished.addListener((raw) => {
  if (!state.wsMode) return;
  const url = raw.request.url;
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    // Check if it's a WebSocket upgrade via HTTP
    const upgrade = raw.request.headers?.find(h => h.name.toLowerCase() === 'upgrade');
    if (!upgrade || upgrade.value.toLowerCase() !== 'websocket') return;
  }
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    captureWebSocketConnection(url);
  }
});

// ── Render ────────────────────────────────────────────────────────────────────

function renderList() {
  const visible = state.requests.filter(r => {
    if (state.methodFilter !== 'ALL') {
      if (state.methodFilter === 'WS' && r.type !== 'ws') return false;
      if (state.methodFilter !== 'WS' && r.method !== state.methodFilter) return false;
    }
    if (state.filter && !r.url.toLowerCase().includes(state.filter.toLowerCase())) return false;
    return true;
  });

  ui.reqCount.textContent = `${visible.length} / ${state.requests.length} requests`;

  if (visible.length === 0) {
    ui.reqList.innerHTML = `<div class="empty-state"><div class="empty-icon">📡</div><p>No requests match filter</p></div>`;
    return;
  }

  ui.reqList.innerHTML = visible.map(r => {
    const { host, path } = parseUrl(r.url);
    const isSelected = state.selected?.id === r.id;
    const isStep = r.journeyStep !== null;
    const isWs = r.type === 'ws';
    return `
      <div class="req-item ${isSelected ? 'selected' : ''} ${isStep ? 'journey-step' : ''} ${isWs ? 'ws-item' : ''}"
           data-id="${r.id}">
        <div class="req-method ${isWs ? 'method-WS' : methodClass(r.method)}">${isWs ? 'WS' : r.method}</div>
        <div class="req-url-cell">
          <div class="req-url" title="${r.url}">${path || r.url}</div>
          <div class="req-host">${host}</div>
        </div>
        <div class="req-meta">
          <div class="req-status ${isWs ? 'status-ws' : statusClass(r.status)}">${isWs ? '🔵' : (r.status || '—')}</div>
          <div class="req-time-small">${r.timingMs}ms</div>
        </div>
      </div>`;
  }).join('');

  ui.reqList.querySelectorAll('.req-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseFloat(el.dataset.id);
      const req = state.requests.find(r => r.id === id);
      if (req) selectRequest(req);
    });
  });
}

function selectRequest(req) {
  state.selected = req;
  state.variationModes = {};
  state.mockAnalysis = null;
  renderList();

  ui.detailEmpty.classList.add('hidden');
  ui.detailContent.classList.remove('hidden');

  // Show/hide WS tab
  const isWs = req.type === 'ws';
  if (ui.tabWsFramesBtn) ui.tabWsFramesBtn.style.display = isWs ? '' : 'none';

  // Overview bar
  ui.ovMethod.textContent = isWs ? 'WS' : req.method;
  ui.ovMethod.className = `method-badge ${isWs ? 'method-WS' : methodClass(req.method)}`;
  ui.ovStatus.textContent = isWs ? '101 WebSocket' : `${req.status} ${req.statusText}`;
  ui.ovStatus.style.color = isWs ? '#60a5fa' : (req.status >= 400 ? '#f87171' : req.status >= 300 ? '#60a5fa' : '#4ade80');
  ui.ovUrl.textContent = req.url;
  ui.ovUrl.title = req.url;
  ui.ovTime.textContent = `${req.timingMs} ms`;

  // Overview rows
  const { host, path } = parseUrl(req.url);
  ui.overviewRows.innerHTML = rows([
    ['URL', `<span style="word-break:break-all">${req.url}</span>`],
    ['Host', host],
    ['Path', path],
    ['Method', isWs ? 'WebSocket' : req.method],
    ['Status', isWs ? '101 Switching Protocols' : `${req.status} ${req.statusText}`],
    ['Response Time', `${req.timingMs} ms`],
    ['Type', isWs ? 'WebSocket Connection' : (req.contentType || '—')],
    ['Started', req.startedDateTime ? new Date(req.startedDateTime).toLocaleTimeString() : '—'],
    ...(isWs ? [['Frames', req.frames?.length || 0], ['Connected', new Date(req.connectedAt).toLocaleTimeString()]] : []),
  ]);

  // Request headers
  ui.reqHeadersBody.innerHTML = (req.requestHeaders || []).map(h =>
    `<tr><td>${esc(h.name)}</td><td>${esc(h.value)}</td></tr>`
  ).join('');

  // Response headers
  ui.resHeadersBody.innerHTML = (req.responseHeaders || []).map(h =>
    `<tr><td>${esc(h.name)}</td><td>${esc(h.value)}</td></tr>`
  ).join('');

  // Request body
  const bodyText = req.requestBody?.text;
  ui.reqBodyContent.textContent = bodyText ? (tryPrettyJson(bodyText) || bodyText) : '— (no body)';

  // Response body (async)
  ui.resBodyContent.textContent = 'Loading…';
  if (req._raw?.getContent) {
    req._raw.getContent((body, encoding) => {
      if (!body) { ui.resBodyContent.textContent = '— (empty response)'; return; }
      const decoded = encoding === 'base64' ? atob(body) : body;
      ui.resBodyContent.textContent = tryPrettyJson(decoded) || decoded;
    });
  } else {
    ui.resBodyContent.textContent = isWs ? '— (WebSocket connection)' : '— (unavailable)';
  }

  // WS frames
  if (isWs && ui.wsFrList) {
    renderWsFrames(req);
  }

  // Mock data analysis
  renderMockTab(req);

  // Variations
  renderVariations(req);
}

// ── WS Frames Rendering ───────────────────────────────────────────────────────

function renderWsFrames(req) {
  const frames = req.frames || [];
  if (frames.length === 0) {
    ui.wsFrList.innerHTML = '<div style="color:#64748b;padding:0.5rem">No frames captured yet.</div>';
  } else {
    ui.wsFrList.innerHTML = frames.map((f, i) => `
      <div style="padding:0.25rem 0;border-bottom:1px solid #1f2d4520;display:flex;gap:0.5rem">
        <span style="color:${f.type === 'send' ? '#60a5fa' : '#4ade80'};min-width:40px">${f.type === 'send' ? '→' : '←'}</span>
        <span style="color:#94a3b8;font-size:0.7rem;min-width:60px">${f.timestamp}</span>
        <span style="color:#e2e8f0;word-break:break-all">${esc(String(f.data).slice(0, 200))}</span>
      </div>`).join('');
  }

  ui.wsInfoRows.innerHTML = rows([
    ['URL', req.url],
    ['Status', 'Connected'],
    ['Frames', frames.length],
  ]);
}

// ── Mock Data Tab ─────────────────────────────────────────────────────────────

function renderMockTab(req) {
  let payload = null;
  if (req.requestBody?.text) {
    try { payload = JSON.parse(req.requestBody.text); } catch {}
  }

  if (!payload) {
    ui.mockFieldsList.innerHTML = '<div style="color:#64748b;padding:0.5rem">No JSON body found in this request.</div>';
    ui.mockPreview.textContent = '— (no body)';
    ui.mockK6Script.textContent = '— (no body to generate script)';
    return;
  }

  const fields = analyzePayloadFields(payload);
  state.mockAnalysis = { payload, fields };

  renderMockFields(fields);
  updateMockPreview();
}

function renderMockFields(fields) {
  if (!fields.length) {
    ui.mockFieldsList.innerHTML = '<div style="color:#64748b;padding:0.5rem">No fields detected.</div>';
    return;
  }

  ui.mockFieldsList.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem">
      <thead>
        <tr style="color:#64748b;border-bottom:1px solid #1f2d45">
          <th style="text-align:left;padding:0.3rem 0.5rem">Field</th>
          <th style="text-align:left;padding:0.3rem 0.5rem">Original</th>
          <th style="text-align:left;padding:0.3rem 0.5rem">Type</th>
          <th style="text-align:left;padding:0.3rem 0.5rem">Generator</th>
        </tr>
      </thead>
      <tbody>
        ${fields.map(f => `
          <tr style="border-bottom:1px solid #1f2d4520">
            <td style="padding:0.3rem 0.5rem;color:#e2e8f0;font-weight:500">${esc(f.key)}</td>
            <td style="padding:0.3rem 0.5rem;color:#94a3b8;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.originalValue)}</td>
            <td style="padding:0.3rem 0.5rem;color:#64748b">${f.valueType}</td>
            <td style="padding:0.3rem 0.5rem">
              ${f.hasGenerator
                ? `<span style="color:#22c55e;font-size:0.7rem">✓ ${f.generatorName || 'auto'}</span>`
                : `<span style="color:#64748b;font-size:0.7rem">— fallback</span>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function updateMockPreview() {
  if (!state.mockAnalysis) return;
  const vu = parseInt(ui.mockVu.value) || 1;
  const iter = parseInt(ui.mockIter.value) || 0;
  const mock = generateMockPayload(state.mockAnalysis.payload, vu, iter);
  ui.mockPreview.textContent = JSON.stringify(mock, null, 2);

  // Generate k6 script
  if (state.selected) {
    const headers = buildHeadersObj(state.selected.requestHeaders || []);
    ui.mockK6Script.textContent = buildK6ScriptWithMock(state.selected.url, state.selected.method, headers, state.mockAnalysis.payload);
  }
}

function buildK6ScriptWithMock(url, method, headers, payload) {
  const payloadCode = buildPayloadExpr(payload);
  return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${ui.quickVus.value || 50},
  duration: '${ui.quickDur.value || 30}s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

function randomHex(n) {
  const c='0123456789abcdef';let s='';
  for(let i=0;i<n;i++)s+=c[Math.floor(Math.random()*16)];return s;
}

export default function() {
  const vu = __VU, iter = __ITER;
  const payload = ${payloadCode};

  const res = http.${method.toLowerCase()}(
    ${JSON.stringify(url)},
    ${['GET','HEAD','DELETE'].includes(method.toUpperCase()) ? 'null' : 'JSON.stringify(payload)'},
    { headers: ${JSON.stringify(headers)}, timeout: '30s' }
  );

  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
    'response < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(0.3);
}`;
}

function buildPayloadExpr(payload) {
  if (!payload || typeof payload !== 'object') return JSON.stringify(payload);
  const parts = Object.entries(payload).map(([key, value]) => {
    const gen = findMockGen(key);
    const K6_EXPRS = {
      email: '`user${vu}@loadtest.dev`',
      username: '`testuser_${vu}`',
      user: '`testuser_${vu}`',
      password: '`P@ssw0rd_${vu}`',
      token: '`tok_${randomHex(16)}_vu${vu}`',
      id: 'vu * 1000 + iter',
      user_id: '1000 + vu',
      userId: '1000 + vu',
      order_id: '8000 + vu * 100 + iter',
      orderId: '8000 + vu * 100 + iter',
      product_id: '(iter % 200) + 1',
      productId: '(iter % 200) + 1',
      qty: '(iter % 10) + 1',
      quantity: '(iter % 10) + 1',
      amount: 'parseFloat((Math.random()*1000+1).toFixed(2))',
      price: 'parseFloat((Math.random()*500+0.01).toFixed(2))',
      name: '`Test User ${vu}`',
      ticker: "['BTC','ETH','SOL','USDC'][iter%4]",
      symbol: "['BTC','ETH','SOL','USDC'][iter%4]",
      side: "iter%2===0?'buy':'sell'",
      page: '(iter%10)+1',
      limit: '[10,20,50,100][iter%4]',
      message: '`Msg from VU ${vu} iter ${iter}`',
    };
    const lk = key.toLowerCase();
    const exprKey = Object.keys(K6_EXPRS).find(k => lk === k || lk.includes(k));
    if (exprKey) return `  ${JSON.stringify(key)}: ${K6_EXPRS[exprKey]}`;
    if (typeof value === 'object') return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{\n${parts.join(',\n')}\n}`;
}

// ── Journey ───────────────────────────────────────────────────────────────────

function updateJourneyBanner() {
  if (state.journeyMode) {
    ui.journeyBanner.classList.remove('hidden');
    ui.journeyCount.textContent = state.journey.length;
  } else {
    ui.journeyBanner.classList.add('hidden');
  }
}

function updateWsBanner() {
  if (state.wsMode) {
    ui.wsBanner.classList.remove('hidden');
    ui.wsConnCount.textContent = state.wsConnections.length;
    ui.wsFrameCount.textContent = state.wsConnections.reduce((s, c) => s + (c.frames?.length || 0), 0);
  } else {
    ui.wsBanner.classList.add('hidden');
  }
}

function buildJourneyScript() {
  const steps = state.journey.map((req, i) => {
    const headers = buildHeadersObj(req.requestHeaders);
    const m = req.method.toLowerCase();
    const hasBody = req.requestBody?.text;
    let call;
    if (['get', 'delete', 'head'].includes(m)) {
      call = `  const r${i} = http.${m}(${JSON.stringify(req.url)}, { headers: ${JSON.stringify(headers)} });`;
    } else {
      const body = hasBody ? JSON.stringify(tryPrettyJson(req.requestBody.text) ? req.requestBody.text : req.requestBody.text) : 'null';
      call = `  const r${i} = http.${m}(${JSON.stringify(req.url)}, ${body}, { headers: ${JSON.stringify(headers)} });`;
    }
    return `  // Step ${i + 1}: ${req.method} ${req.url}\n${call}\n  check(r${i}, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });\n  sleep(0.3);`;
  }).join('\n\n');

  return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
${steps}
}
`;
}

function downloadScript(script, filename) {
  const blob = new Blob([script], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function stressRequest(req) {
  const cfg = buildK6Config(req);
  cfg.vus = parseInt(ui.quickVus.value) || 50;
  cfg.duration = parseInt(ui.quickDur.value) || 30;

  try {
    const r = await fetch(`${K6_BACKEND}/api/start-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    if (!r.ok) throw new Error('Backend error');
    const { testId } = await r.json();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', url: `${K6_DASHBOARD}/?testId=${testId}` });
  } catch (e) {
    alert(`Could not reach k6 backend at ${K6_BACKEND}\n\nMake sure the backend is running:\n  cd backend && npm start`);
  }
}

function configureRequest(req) {
  const cfg = buildK6Config(req);
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', url: `${K6_DASHBOARD}/?request=${encoded}` });
}

async function stressJourney() {
  const script = buildJourneyScript();
  try {
    const r = await fetch(`${K6_BACKEND}/api/run-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, label: 'Journey Test' }),
    });
    if (!r.ok) throw new Error('Backend error');
    const { testId } = await r.json();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', url: `${K6_DASHBOARD}/?testId=${testId}` });
  } catch (e) {
    alert(`Could not reach k6 backend at ${K6_BACKEND}`);
  }
}

async function stressWs() {
  if (!state.wsConnections.length) { alert('No WS connections captured yet.'); return; }
  const wsConn = state.wsConnections[0];
  const wsUrl = wsConn.url.replace(/^http/, 'ws').replace(/^https/, 'wss');
  chrome.runtime.sendMessage({
    type: 'OPEN_DASHBOARD',
    url: `${K6_DASHBOARD}/?tab=websocket&wsUrl=${encodeURIComponent(wsUrl)}`,
  });
}

async function runWsSecurity() {
  if (!state.wsConnections.length && !state.selected?.type === 'ws') {
    alert('No WS connection selected.'); return;
  }
  const conn = state.wsConnections[0] || state.selected;
  const wsUrl = conn.url.startsWith('ws') ? conn.url : conn.url.replace(/^http/, 'ws');
  chrome.runtime.sendMessage({
    type: 'OPEN_DASHBOARD',
    url: `${K6_DASHBOARD}/?tab=websocket&wsUrl=${encodeURIComponent(wsUrl)}&securityCheck=1`,
  });
}

async function runSecurityScan(req) {
  if (!req) return;
  const parsed = new URL(req.url);
  const baseUrl = `${parsed.protocol}//${parsed.host}`;
  chrome.runtime.sendMessage({
    type: 'OPEN_DASHBOARD',
    url: `${K6_DASHBOARD}/?tab=security&scanUrl=${encodeURIComponent(req.url)}`,
  });
}

function runFullAnalysis(req) {
  if (!req) return;
  const vus  = parseInt(ui.quickVus?.value) || 20;
  const dur  = parseInt(ui.quickDur?.value) || 15;
  let payload = null;
  try { payload = req.postData ? JSON.parse(req.postData) : null; } catch (_) {}
  const cfg = {
    url:      req.url,
    method:   req.method || 'GET',
    payload,
    headers:  req.requestHeaders || {},
    vus,
    duration: dur,
  };
  chrome.runtime.sendMessage({
    type: 'OPEN_DASHBOARD',
    url: `${K6_DASHBOARD}/?tab=workflow&request=${btoa(JSON.stringify(cfg))}`,
  });
}

async function stressWithMock(req) {
  if (!req || !state.mockAnalysis) return;
  const headers = buildHeadersObj(req.requestHeaders || []);
  const script = buildK6ScriptWithMock(req.url, req.method, headers, state.mockAnalysis.payload);
  try {
    const r = await fetch(`${K6_BACKEND}/api/run-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, label: `Mock Stress: ${req.method} ${new URL(req.url).pathname}` }),
    });
    if (!r.ok) throw new Error('Backend error');
    const { testId } = await r.json();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', url: `${K6_DASHBOARD}/?testId=${testId}` });
  } catch (e) {
    alert(`Could not reach k6 backend: ${e.message}`);
  }
}

// ── Variations (legacy) ───────────────────────────────────────────────────────

function rows(pairs) {
  return pairs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderVariations(req) {
  let payload = null;
  if (req.requestBody?.text) {
    try { payload = JSON.parse(req.requestBody.text); } catch {}
  }

  const fields = detectVariableFields(payload);
  if (fields.length === 0) {
    ui.variationsList.innerHTML = '<div class="variations-help" style="color:#64748b">No auto-detectable fields in this request body.</div>';
    ui.variationsPreview.textContent = payload ? JSON.stringify(payload, null, 2) : '— (no body)';
    return;
  }

  ui.variationsList.innerHTML = fields.map(f => `
    <div class="variation-row">
      <span class="variation-key">${esc(f.key)}</span>
      <span class="variation-orig">${esc(String(f.origValue))}</span>
      <button class="variation-mode ${state.variationModes[f.key] === 'vu' ? 'active' : ''}"
              data-key="${esc(f.key)}" data-mode="vu">VU#</button>
      <button class="variation-mode ${state.variationModes[f.key] === 'iter' ? 'active' : ''}"
              data-key="${esc(f.key)}" data-mode="iter">ITER#</button>
    </div>`).join('');

  ui.variationsList.querySelectorAll('.variation-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const mode = btn.dataset.mode;
      state.variationModes[key] = state.variationModes[key] === mode ? 'off' : mode;
      renderVariations(req);
    });
  });

  const preview = payload ? applyVariations(payload) : null;
  ui.variationsPreview.textContent = preview ? JSON.stringify(preview, null, 2) : '—';
}

// ── Tab Switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
    });
    tab.classList.add('active');
    const pane = document.getElementById(`tab-${tab.dataset.tab}`);
    if (pane) {
      pane.classList.add('active');
      pane.classList.remove('hidden');
    }
  });
});

// ── Toolbar Events ────────────────────────────────────────────────────────────

ui.btnRecord.addEventListener('click', () => {
  state.isRecording = !state.isRecording;
  ui.btnRecord.classList.toggle('active', state.isRecording);
});

ui.btnJourney.addEventListener('click', () => {
  state.journeyMode = !state.journeyMode;
  ui.btnJourney.classList.toggle('active', state.journeyMode);
  updateJourneyBanner();
});

ui.btnWsMode.addEventListener('click', () => {
  state.wsMode = !state.wsMode;
  ui.btnWsMode.classList.toggle('active', state.wsMode);
  updateWsBanner();
  if (state.wsMode) {
    ui.methodFilter.value = 'ALL'; // Show all
    renderList();
  }
});

ui.btnClear.addEventListener('click', () => {
  state.requests = [];
  state.wsConnections = [];
  state.selected = null;
  ui.detailEmpty.classList.remove('hidden');
  ui.detailContent.classList.add('hidden');
  renderList();
  updateWsBanner();
});

ui.search.addEventListener('input', (e) => { state.filter = e.target.value; renderList(); });
ui.methodFilter.addEventListener('change', (e) => { state.methodFilter = e.target.value; renderList(); });

// Journey toolbar
ui.btnExportScript.addEventListener('click', () => {
  if (state.journey.length === 0) { alert('No journey steps recorded.'); return; }
  downloadScript(buildJourneyScript(), 'journey-test.js');
});

ui.btnStressJourney.addEventListener('click', () => {
  if (state.journey.length === 0) { alert('No journey steps recorded.'); return; }
  stressJourney();
});

ui.btnClearJourney.addEventListener('click', () => {
  state.journey = [];
  state.requests.forEach(r => { r.journeyStep = null; });
  updateJourneyBanner();
  renderList();
});

// WS toolbar
ui.btnStressWs.addEventListener('click', stressWs);
ui.btnWsSecurity.addEventListener('click', runWsSecurity);
ui.btnClearWs.addEventListener('click', () => {
  state.wsConnections = [];
  state.requests = state.requests.filter(r => r.type !== 'ws');
  updateWsBanner();
  renderList();
});

// Detail actions
ui.btnStress.addEventListener('click', () => { if (state.selected) stressRequest(state.selected); });
ui.btnConfigure.addEventListener('click', () => { if (state.selected) configureRequest(state.selected); });
ui.btnAddJourney.addEventListener('click', () => {
  if (!state.selected) return;
  if (!state.journey.find(r => r.id === state.selected.id)) {
    state.journey.push(state.selected);
    state.selected.journeyStep = state.journey.length;
    updateJourneyBanner();
    renderList();
  }
});
ui.btnSecurityScan.addEventListener('click', () => { if (state.selected) runSecurityScan(state.selected); });
ui.btnFullAnalysis.addEventListener('click', () => { if (state.selected) runFullAnalysis(state.selected); });

// Mock data tab events
ui.btnMockRefresh.addEventListener('click', updateMockPreview);
ui.btnMockAnalyze.addEventListener('click', () => {
  if (state.selected) renderMockTab(state.selected);
});
ui.mockVu.addEventListener('input', updateMockPreview);
ui.mockIter.addEventListener('input', updateMockPreview);
ui.btnMockCopyScript.addEventListener('click', () => {
  const text = ui.mockK6Script.textContent;
  if (text && text !== '—') {
    navigator.clipboard.writeText(text).then(() => {
      ui.btnMockCopyScript.textContent = '✓ Copied!';
      setTimeout(() => { ui.btnMockCopyScript.textContent = '📋 Copy k6 Script'; }, 2000);
    });
  }
});
ui.btnMockStress.addEventListener('click', () => { if (state.selected) stressWithMock(state.selected); });

// ── Init ──────────────────────────────────────────────────────────────────────

renderList();

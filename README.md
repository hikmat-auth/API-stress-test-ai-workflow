# Authornate k6 — API Load Testing & Security Suite

A full-stack API testing platform that combines HTTP load testing, WebSocket testing, security scanning, AI-powered mock data generation, and a Chrome DevTools extension — all in one tool.

---

## What It Does

| Feature | Description |
|---|---|
| **HTTP Load Testing** | Blast any API endpoint with configurable VUs, duration, and rate limits using autocannon |
| **WebSocket Testing** | Open N concurrent WS connections, measure latency/throughput, run security checks |
| **Security Scanning** | 33 OWASP-based policy checks across 11 vulnerability categories |
| **AI Mock Data** | Claude AI analyzes any payload format and generates realistic test data, edge cases, and negative tests |
| **82 Predefined Test Cases** | 5 suites covering API, WebSocket, Security, Performance, and Stress testing |
| **Chrome Extension** | Intercept live requests from any website and instantly stress-test them |

---

## Project Structure

```
k6/
├── backend/          # Node.js API server (Express)
│   ├── server.js         # Main server, all REST routes
│   ├── mock-generator.js # Pattern-based mock data engine
│   ├── ai-mock.js        # Claude AI payload analyzer
│   ├── ws-tester.js      # WebSocket load tester
│   ├── security-scanner.js # OWASP security scanner
│   ├── test-suites.js    # 82 predefined test cases
│   └── .env              # API keys and port config
│
├── frontend/         # React + Vite dashboard
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── TestForm.jsx       # HTTP load test form
│           ├── Dashboard.jsx      # Live results charts
│           ├── SuiteDashboard.jsx # Test suite results
│           ├── WSTestPanel.jsx    # WebSocket test panel
│           ├── SecurityPanel.jsx  # Security scan panel
│           └── MockPanel.jsx      # AI mock data panel
│
└── extension/        # Chrome DevTools extension (MV3)
    ├── manifest.json
    ├── devtools.html / devtools.js
    ├── panel.html / panel.js / panel.css
    ├── background.js
    └── popup.html
```

---

## Setup

### Prerequisites

- Node.js 18+
- npm
- (Optional) k6 binary — for script-based tests
- Chrome — for the DevTools extension
- Anthropic API key — for AI mock generation

---

### 1. Backend

```bash
cd backend
npm install
```

Create or edit `.env`:

```env
ANTHROPIC_API_KEY=your_claude_api_key_here
PORT=3001
```

Start the server:

```bash
npm start          # production
npm run dev        # nodemon (auto-restart on change)
```

The server runs at **http://localhost:3001**.

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at **http://localhost:5173**.

---

### 3. Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Open DevTools on any page (`F12`) → find the **k6** panel tab

---

## Using the Tool

### HTTP Load Test (Stress Test tab)

1. Enter the target URL and HTTP method
2. Set request headers (JSON key-value pairs)
3. Paste the request body
4. Configure:
   - **Connections** — concurrent virtual users
   - **Duration** — how long to run (seconds)
   - **Rate** — requests per second cap (optional)
5. Click **Start Test**
6. Watch the live chart: requests/sec, latency, error rate

---

### Test Suites (📊 Test Suites tab)

Runs 82 predefined test cases across 5 suites against your target URL.

| Suite | Color | TCs | What it tests |
|---|---|---|---|
| API Testing | 🟣 Purple | 20 | Happy path, validation, auth, error handling, rate limiting |
| WebSocket Testing | 🔵 Blue | 15 | Connection lifecycle, real-time events, subscriptions, malformed messages |
| Security Testing | 🔴 Red | 20 | SQLi, XSS, command injection, IDOR, JWT attacks, CORS, CSRF, file upload |
| Performance Testing | 🟢 Green | 14 | Baseline latency, load at 100–500 VUs, throughput, resource usage |
| Stress Testing | 🟠 Orange | 13 | Spike, soak/endurance, break point, recovery after crash/DB/WS restart |

Results show pass/fail/pending per suite with a filterable table by status, risk level, and keyword search.

---

### WebSocket Test (🔵 WebSocket tab)

- Enter a WebSocket URL (`wss://` or `ws://`)
- Set concurrent connections and test duration
- Optionally configure messages to send on connect
- Click **Start WS Test** — see per-second timeline, event distribution, latency stats
- Click **WS Security Check** — runs 4 security probes:
  - Valid connection check
  - No-auth rejection
  - Malformed JSON handling
  - Oversized frame handling

---

### Security Scan (🔴 Security Scan tab)

Runs 33 OWASP-based checks against a target URL:

| Category | Checks include |
|---|---|
| A01 Broken Access Control | IDOR patterns, path traversal, forced browsing |
| A02 Cryptographic Failures | HTTPS enforcement, cookie flags, data exposure |
| A03 Injection | SQL injection (basic + UNION), XSS (reflected + POST), command injection, XXE |
| A05 Security Misconfiguration | Security headers, TRACE method, server fingerprinting, stack traces |
| A07 Auth Failures | JWT alg:none attack, expired JWT, brute force detection |
| A08 Software/Data Integrity | Mass assignment, file upload bypass |
| A09 Logging & Monitoring | Rate limiting detection |
| A10 SSRF | SSRF probes, open redirect |
| Additional | CORS wildcard, clickjacking |

Returns a **score 0–100** and risk level (LOW / MEDIUM / HIGH / CRITICAL) with per-finding evidence and fix recommendations.

---

### AI Mock Data (🎲 Mock AI tab)

1. Select the **payload format**: JSON, GraphQL, XML/SOAP, Form URL-encoded, Multipart, NDJSON, CSV, or Plain Text
2. Enter the API URL (gives Claude context about what the endpoint does)
3. Paste your request payload
4. Optionally paste a response sample (improves AI understanding)
5. Click **✨ Analyze with AI**

Claude analyzes the payload and returns:

- **Field breakdown** — type, description, constraints, allowed values, generator strategy for each field
- **5 Happy path samples** — realistic production-like variations
- **3 Edge cases** — boundary values and unusual-but-valid inputs
- **3 Negative tests** — invalid payloads with expected HTTP status codes and error messages
- **k6 script** — ready-to-run load test with a data pool of all generated samples

#### Supported Payload Formats

| Format | Content-Type | Example |
|---|---|---|
| JSON | `application/json` | `{"ticker":"BTC","amount":100}` |
| GraphQL | `application/graphql` | `query { user(id: $id) { name } }` |
| XML / SOAP | `application/xml` | `<order><symbol>AAPL</symbol></order>` |
| Form URL-encoded | `application/x-www-form-urlencoded` | `username=alice&password=secret` |
| Multipart | `multipart/form-data` | file uploads + fields |
| NDJSON | `application/x-ndjson` | newline-delimited JSON records |
| CSV | `text/csv` | column headers + data rows |
| Plain Text | `text/plain` | any raw text body |

---

### Chrome Extension

The DevTools panel captures every request made by the page you are inspecting.

**Request list** — click any request to see:
- Headers and request body
- Response body and status
- Timing

**Actions per request:**
- **▶ Stress** — send directly to the load tester
- **🔐 Scan** — run a security scan against that endpoint
- **🎲 Mock Data tab** — AI field analysis + VU/ITER mock generation + k6 script

**WebSocket mode (🔵 WS button):**
- Monitors WebSocket upgrade connections
- Shows frame counts and connection status
- **Stress WS** — opens WS load test with captured URL
- **WS Security** — runs security probes against the WS endpoint

---

## Backend API Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/test` | Start an HTTP load test |
| `GET` | `/api/test/:id` | Poll test status / results |
| `POST` | `/api/test/:id/stop` | Stop a running test |
| `POST` | `/api/mock/analyze` | Pattern-based field analysis |
| `POST` | `/api/mock/generate` | Generate mock payload (VU + ITER indexed) |
| `POST` | `/api/mock/ai-analyze` | Full Claude AI analysis + samples |
| `POST` | `/api/mock/ai-hints` | Quick per-field AI hints |
| `POST` | `/api/ws-test` | Start a WebSocket load test |
| `POST` | `/api/ws-security` | Run WebSocket security checks |
| `POST` | `/api/security/scan` | Run OWASP security scan |
| `GET` | `/api/security/policies` | List all 33 security policies |
| `GET` | `/api/suites` | Get suite definitions (no run) |
| `POST` | `/api/suites/run` | Run one or all test suites |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | For AI features | Claude API key from console.anthropic.com |
| `PORT` | No (default 3001) | Port the backend server listens on |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, autocannon, ws, @anthropic-ai/sdk |
| Frontend | React, Vite, Recharts |
| Extension | Chrome MV3, DevTools API |
| AI | Claude Haiku (claude-haiku-4-5) |
| Load engine | autocannon (HTTP), ws (WebSocket) |
| Optional | k6 binary for script-based journey tests |

# API Endpoint Report

Date: 2026-03-14
Tool: Authornate k6 Load Testing Suite — Self-Analysis

A structured report of all backend API routes, covering purpose, request/response contract, observed behaviors derived from code analysis, and improvement notes.

---

## 1. POST /api/start-test

**Purpose**: Launch an HTTP load test against a target URL using autocannon.

**Request**:
```json
{
  "url": "https://target.com/api",
  "method": "POST",
  "payload": {},
  "headers": {},
  "vus": 50,
  "duration": 30
}
```

**Response**:
```json
{ "testId": "uuid" }
```

**Behavior**:
- Starts autocannon immediately and responds before the test completes.
- Tracks per-second result buckets in memory via an internal `createTracker` structure.
- Test state expires automatically after 15 minutes.
- Content-Type is always forced to `application/json` regardless of the payload type provided.

**Issues**:
- No URL validation — SSRF possible against internal hosts and cloud metadata endpoints.
- No upper bound on `vus` or `duration` — a caller can request 100,000 VUs for 24 hours.
- Content-Type is hardcoded to `application/json` — callers cannot test non-JSON APIs at the HTTP level.
- No concurrent test limit — unlimited simultaneous tests can exhaust server memory.

**Improvements Needed**:
- Enforce `maxVus: 1000` and `maxDuration: 300` in the route handler.
- Add a URL blocklist rejecting private IP ranges and non-HTTP/HTTPS schemes.
- Accept a `contentType` field in the request body to override the forced content type header.
- Return HTTP 429 when the active test count exceeds a defined cap (recommended: 50).

---

## 2. GET /api/test/:testId/stream

**Purpose**: Server-Sent Events stream providing live tick data while a test is running.

**Response**: `Content-Type: text/event-stream` with named events:
- `tick` — per-second metrics bucket
- `status` — test phase changes
- `log` — informational messages
- `complete` — final results payload, stream closes

**Behavior**:
- Polls the internal tracker every 300ms.
- Emits per-second buckets as they complete.
- Flushes the final accumulated results on test completion.

**Issues**:
- No UUID format validation on `testId` — any arbitrary string is accepted (a 404 is returned correctly if not found, but format is not enforced).
- `res.flushHeaders()` is not called immediately — headers may be buffered by the HTTP layer before the first event is sent.
- `X-Accel-Buffering: no` header is absent — intermediate proxies such as nginx or Cloudflare may buffer the SSE stream, causing clients to receive batched or delayed events.

**Improvements Needed**:
- Call `res.flushHeaders()` immediately after setting `Content-Type` and `Cache-Control` headers.
- Add `res.setHeader('X-Accel-Buffering', 'no')` to disable proxy buffering.

---

## 3. GET /api/test/:testId

**Purpose**: Polling fallback — retrieve the current status and accumulated results for a test.

**Response**:
```json
{
  "status": "running | completed | error | cancelled",
  "results": {},
  "error": "..."
}
```

**Behavior**: Simple Map lookup returning the raw state object for the given test ID.

**Issues**:
- No ownership check — any caller who knows or guesses a `testId` can poll another user's test. UUID v4 provides 122 bits of entropy so guessing is not practical, but there is no access control in place.

**Improvements Needed**: Bind `testId` to the requesting IP address or a session token at creation time and validate on every poll.

---

## 4. DELETE /api/test/:testId

**Purpose**: Cancel a running test before it completes naturally.

**Behavior**:
- For autocannon-backed tests: calls `instance.stop()`.
- For k6-backed tests: sends `SIGTERM` to the child process.
- Updates the test state to `cancelled` in the Map.

**Issues**:
- Same ownership concern as `GET /api/test/:testId` — any caller can cancel any running test by ID.

**Improvements Needed**: Apply the same ownership binding recommended for the GET route.

---

## 5. POST /api/analyze

**Purpose**: Send completed load test results to Claude AI for performance insights and recommendations.

**Request**:
```json
{
  "results": { "summary": {}, "charts": {} },
  "config": {}
}
```

**Response**:
```json
{
  "insights": [{}, {}, {}, {}, {}],
  "model": "claude-haiku-..."
}
```

**Behavior**: Passes summary and chart data to Claude with a structured prompt requesting five insight objects. Returns the parsed JSON array from the AI response.

**Issues**:
- No timeout on the Claude API call — a slow or stalled Anthropic response hangs the server-side promise indefinitely.
- Raw `err.message` is returned to the client on failure, exposing internals.
- No request-specific size limit beyond the global 10MB body limit — callers can send large `charts` payloads that are forwarded entirely to the AI.

**Improvements Needed**:
- Truncate or strip `charts` data before forwarding to the AI; only the `summary` is needed for performance analysis.
- Add a 30-second timeout via `Promise.race`.
- Return a generic error message to the client; log the full error server-side.

---

## 6. POST /api/run-script

**Purpose**: Execute an arbitrary k6 JavaScript script on the server and stream results.

**Request**:
```json
{
  "script": "import http from 'k6/http'; export default function() { ... }",
  "label": "My Test"
}
```

**Response**:
```json
{ "testId": "uuid" }
```

**Behavior**:
- Writes the provided script to a temporary file using a UUID filename.
- Executes `k6 run` via `child_process.spawn` with `shell: true`.
- Parses k6 JSON output and populates the `activeTests` tracker.
- Result accessible via `GET /api/test/:testId` or the SSE stream.

**Issues**:
- **Critical**: Executes arbitrary user-supplied JavaScript with no sandboxing, no content validation, and no authentication. The script runs with full server privileges.
- The script can read environment variables (`__ENV.ANTHROPIC_API_KEY`), access the local file system, and make outbound HTTP requests to internal infrastructure.
- `shell: true` in the `spawn` call is unnecessary and expands the attack surface.
- `fs.writeFileSync` is used synchronously, blocking the Node.js event loop during the file write.

**Improvements Needed**:
- Require a secret API key header (e.g., `X-API-Secret`) on this route.
- Validate the script content: reject if it contains `open(`, `exec(`, `__ENV`, filesystem access patterns, or shell escape sequences.
- Replace `fs.writeFileSync` with `await fs.promises.writeFile`.
- Use `spawn('k6', [...], { shell: false })`.

---

## 7. POST /api/mock/analyze

**Purpose**: Pattern-based static analysis of a JSON request payload to identify fields and their types. Does not call any AI service.

**Request**:
```json
{
  "payload": {},
  "url": "https://target.com/api",
  "method": "POST",
  "headers": {}
}
```

**Response**:
```json
{
  "fields": [],
  "preview": {},
  "k6Script": "..."
}
```

**Behavior**: Inspects the payload using deterministic pattern matching to classify fields. Generates a k6 script template based on identified field types.

**Issues**:
- Only handles JSON object payloads — returns HTTP 400 for strings, arrays, `null`, and other types.
- No payload-specific size limit beyond the global 10MB body limit.

**Improvements Needed**:
- Accept and handle array and primitive payloads with appropriate analysis.
- Apply a tighter per-route body size limit (e.g., 1MB).

---

## 8. POST /api/mock/generate

**Purpose**: Generate a single deterministic mock payload for a given VU and iteration index combination.

**Request**:
```json
{
  "payload": {},
  "vuIndex": 5,
  "iterIndex": 3,
  "enabledKeys": ["email", "username"]
}
```

**Response**:
```json
{ "mock": {} }
```

**Behavior**: Uses `vuIndex` and `iterIndex` as seeds to produce a stable, reproducible mock value for each field. Only fields listed in `enabledKeys` are randomized.

**Issues**:
- `vuIndex` and `iterIndex` are accepted without bounds checking. The seed computation `vuIndex * 1000 + iterIndex` can produce very large float values for extreme inputs, potentially causing unexpected generator behavior.

**Improvements Needed**:
- Clamp both inputs: `Math.max(0, Math.min(parseInt(vuIndex) || 0, 10000))`.

---

## 9. POST /api/mock/ai-analyze

**Purpose**: Full Claude AI deep analysis of a request payload — produces field classification, happy path cases, edge cases, negative test cases, and a complete k6 data pool script.

**Request**:
```json
{
  "url": "https://target.com/api",
  "method": "POST",
  "payload": "...",
  "contentType": "application/json",
  "responseBody": "..."
}
```

**Response**:
```json
{
  "context": "...",
  "fields": [],
  "happyPath": [],
  "edgeCases": [],
  "negativeCases": [],
  "k6DataPool": {},
  "_model": "claude-haiku-...",
  "_tokensUsed": 1234
}
```

**Behavior**:
- Detects payload type via `detectPayloadType()` — supports JSON, GraphQL, XML, form-urlencoded, multipart, NDJSON, CSV, binary, and plain text.
- Sends a structured prompt to Claude requesting the full analysis object.
- Uses `max_tokens: 4096` for the AI response budget.
- Extracts the JSON result from the AI response using a greedy regex.

**Issues**:
- A new Anthropic SDK client is instantiated on every call — connection pools are never reused.
- No timeout on the AI API call.
- `JSON.parse` of the AI response is not wrapped in `try-catch` — malformed AI output causes an unhandled exception.
- The greedy regex `\{[\s\S]*\}` fails when Claude includes multiple JSON blocks in a single response, merging them into invalid JSON.

**Improvements Needed**:
- Move the Anthropic client to module-level initialization (singleton).
- Add a 30-second `Promise.race` timeout.
- Wrap `JSON.parse` in `try-catch` with a user-friendly fallback error.
- Replace the greedy regex with a non-greedy variant or a bracket-depth parser.

---

## 10. POST /api/mock/ai-hints

**Purpose**: Lightweight per-field AI description generation for the browser extension popup UI.

**Behavior**: Sends a reduced prompt to Claude (capped at 1,500 output tokens) requesting short field descriptions. Follows the same code path as `/api/mock/ai-analyze` at a smaller scale.

**Issues**: Same fundamental issues as `/api/mock/ai-analyze` — new client per call, no timeout, unguarded `JSON.parse`, greedy regex extraction — but with reduced impact due to smaller token budgets.

**Improvements Needed**: Apply the same fixes as `/api/mock/ai-analyze`. Given the lightweight nature of the endpoint, the 1,500-token cap is appropriate; retain it.

---

## 11. POST /api/ws-test

**Purpose**: Open N concurrent WebSocket connections to a target, collect connection and messaging metrics, and return a test ID for polling.

**Request**:
```json
{
  "url": "wss://target.com/ws",
  "connections": 20,
  "duration": 30,
  "token": "Bearer ...",
  "messages": [{ "type": "subscribe", "data": {} }]
}
```

**Response**:
```json
{ "testId": "uuid" }
```

**Behavior**:
- Staggers connection openings across the test duration using `ws-tester.js`.
- Tracks per-connection latency, message counts, and error rates.
- Stores results in `activeTests` for polling via `GET /api/test/:testId`.

**Issues**:
- No WebSocket URL validation — attackers can target internal services via WebSocket (SSRF via `ws://`).
- No maximum connection limit — callers can request thousands of simultaneous WebSocket connections.
- Stagger calculation evaluates to 0 for all connections when `duration=0`, causing a simultaneous connection flood.

**Improvements Needed**:
- Apply the same private-IP blocklist recommended for `/api/start-test`.
- Cap `connections` at a reasonable maximum (e.g., 500).
- Enforce `duration >= 5` in the route handler.

---

## 12. POST /api/ws-security

**Purpose**: Synchronous four-check WebSocket security probe covering authentication, message validation, payload size limits, and connection behavior.

**Response**:
```json
{ "results": [{}, {}, {}, {}] }
```

**Behavior**: Runs four sequential or parallel WebSocket security checks and returns all results in a single synchronous response. One check (TC-WS-04) deliberately sends a 1MB message to test the target's payload size limit enforcement.

**Issues**:
- The 1MB message test (TC-WS-04) can be weaponized as traffic amplification — callers direct large outbound traffic at a target using the server's bandwidth and IP.
- No route-level timeout — if all four checks stall (e.g., target accepts but never responds), the HTTP response never arrives.

**Improvements Needed**:
- Add a per-check timeout (e.g., 10 seconds) and an overall route timeout (e.g., 45 seconds).
- Apply URL validation to prevent SSRF via the WebSocket protocol.

---

## 13. POST /api/security/scan

**Purpose**: Run 33 OWASP-aligned policy checks against a target URL and return a test ID for polling.

**Request**:
```json
{
  "url": "https://target.com",
  "authToken": "Bearer ...",
  "scanDepth": "full"
}
```

**Response**:
```json
{ "testId": "uuid" }
```

**Behavior**:
- Executes checks across OWASP Top 10 categories (A01–A10).
- Policies include: authentication checks, injection probes, rate limit validation, security header inspection, cookie attribute validation, and brute-force simulation.
- Results stored in `activeTests` for polling.

**Issues**:
- No URL validation — the scanner can be directed at internal hosts (SSRF).
- The rate-limit policy (A04-002) fires 30 simultaneous requests at the target — a denial-of-service pulse embedded in the scanner.
- The oversized-payload policy allocates an 11MB string in heap memory per scan.
- The brute-force policy (A07-003) attempts known passwords against `/api/login` — this may lock out real accounts if run against a production target.

**Improvements Needed**:
- Add private-IP URL blocklist before initiating any scan.
- Replace the 30-simultaneous-request rate check with sequential requests or a smaller concurrency with delays.
- Reduce the oversized payload to 2MB.
- Add a prominent warning when the target URL is not `localhost` or `127.0.0.1`, noting that brute-force and stress checks will be executed.

---

## 14. GET /api/security/policies

**Purpose**: Return metadata for all 33 security scan policies (run functions are stripped from the response).

**Response**:
```json
{
  "policies": [
    { "id": "A01-001", "name": "...", "category": "...", "severity": "..." }
  ]
}
```

**Behavior**: Reads the policy registry and returns metadata objects for all 33 policies in a single response. No filtering, search, or pagination is supported.

**Issues**:
- All 33 policies returned in one response — acceptable at current scale but will grow as new policies are added.

**Improvements Needed**:
- Add optional `?category=A04` filtering to allow clients to fetch policies by OWASP category.
- Add pagination support (`?page=1&limit=10`) as a precaution for future growth.

---

## 15. GET /api/suites

**Purpose**: Return all test suite definitions including the 82 individual test case metadata objects across 5 suites.

**Response**: Array of suite objects, each containing an array of test case definitions with ID, name, description, category, and severity.

**Issues**:
- All 82 test case objects are returned in a single response with no limit or pagination.
- Response size will grow as new suites and test cases are added.

**Improvements Needed**:
- Add `?suite=api` filtering to allow retrieval of a single suite.
- Add pagination for the test case list within each suite.

---

## 16. POST /api/suites/run

**Purpose**: Execute one or all test suites against a caller-provided base URL and return a test ID for polling.

**Request**:
```json
{
  "baseUrl": "https://target.com",
  "authToken": "Bearer ...",
  "suite": "api"
}
```

**Response**:
```json
{ "testId": "uuid" }
```

**Behavior**:
- Selects the specified suite (or all suites if `suite` is omitted).
- Executes up to 82 test cases sequentially against the `baseUrl`.
- Test cases use hardcoded relative paths (e.g., `/api/tokens`, `/api/login`, `/api/orders`).
- Results accumulated and stored for polling via `GET /api/test/:testId`.

**Issues**:
- No URL validation on `baseUrl` — SSRF via suite execution is possible.
- Suite definitions hardcode API paths that only match a specific API design convention. Callers whose APIs use different paths will receive incorrect results.
- Running all 82 test cases against a production API causes real side effects: token creation, order creation, and brute-force login attempts.

**Improvements Needed**:
- Apply private-IP URL blocklist to `baseUrl` before any requests are made.
- Add a `dryRun: true` mode that returns which endpoints will be called and with what methods, without executing them.
- Allow per-suite path prefix customization so the suite definitions are not tied to a specific API structure.
- Display a confirmation warning when the target is not `localhost` or `127.0.0.1`, clearly listing which test cases will make write operations or attempt brute-force actions.

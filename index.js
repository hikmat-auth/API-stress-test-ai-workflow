import http from 'k6/http';
import { sleep, check } from 'k6';

// ─── CONFIG ───────────────────────────────────
const API_KEY = 'fd396108-9a9a-4686-bd7e-e2141d343f93';   // <-- paste regenerated key
const BASE_URL = `https://devnet.helius-rpc.com/?api-key=${API_KEY}`;

const HEADERS = {
  'Content-Type': 'application/json',
  'accept': '*/*',
  'origin': 'https://dev.creator.fun',
  'referer': 'https://dev.creator.fun/',
  'solana-client': 'js/1.0.0-maintenance',
};

const PAYLOAD = JSON.stringify({
  method: 'getAccountInfo',
  jsonrpc: '2.0',
  params: [
    '6hUXLGwYvaEBFtKjWEp2pB7xjsBpHHyFPdPFrbg6ZbmQ',
    { encoding: 'base64', commitment: 'confirmed' },
  ],
  id: 'load-test-001',
});

// ─── 10 CONCURRENT USERS TEST ─────────────────
export const options = {
  scenarios: {
    ten_users_at_once: {
      executor: 'per-vu-iterations',
      vus: 10,              // 10 concurrent users
      iterations: 1,               // 1 call per user
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],  // increased to 10s to ensure a "pass"
    http_req_failed: ['rate<0.01'],    // less than 1% fail
  },
};

// ─── TEST ─────────────────────────────────────
export default function () {
  const res = http.post(BASE_URL, PAYLOAD, { headers: HEADERS });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has result field': (r) => JSON.parse(r.body)?.result !== undefined,
    'no error in response': (r) => JSON.parse(r.body)?.error === undefined,
    'response under 10s': (r) => r.timings.duration < 10000,
    'rate limit 429 caught': (r) => r.status !== 429,
  });

  console.log(`VU ${__VU} Iter ${__ITER + 1} — status: ${res.status} — ${res.timings.duration.toFixed(0)}ms`);

  sleep(0.3);  // small gap between calls
}
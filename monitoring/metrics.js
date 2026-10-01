// A /metrics endpoint written longhand, with zero dependencies.
//
// Real projects use `prom-client`, which does all of this for you in about four lines.
// This file exists so you can see what that library actually produces: a plain text page
// that Prometheus fetches over HTTP every few seconds. There is no magic and no protocol.
//
// Wiring it into app.js is shown in README.md in this folder.

const os = require('os');

// Latency buckets, in seconds. A histogram counts how many requests fell into each bucket,
// which is what lets Grafana calculate a p95 later without storing every single request.
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const requests = new Map(); // "method|path|status" -> count
const latency = new Map(); // "method|path"        -> { buckets: [], sum, count }

// Every distinct label value creates a separate time series, so an unbounded label such as a
// raw URL will eventually take Prometheus down. Fold anything unrecognised into one bucket.
function normalisePath(url) {
  const path = (url || '/').split('?')[0];
  const known = ['/', '/health', '/break', '/fix', '/metrics'];
  return known.includes(path) ? path : '/other';
}

function observe(method, url, status, seconds) {
  const path = normalisePath(url);

  const rKey = `${method}|${path}|${status}`;
  requests.set(rKey, (requests.get(rKey) || 0) + 1);

  const lKey = `${method}|${path}`;
  let h = latency.get(lKey);
  if (!h) {
    h = { buckets: new Array(BUCKETS.length).fill(0), sum: 0, count: 0 };
    latency.set(lKey, h);
  }
  h.sum += seconds;
  h.count += 1;
  for (let i = 0; i < BUCKETS.length; i++) {
    if (seconds <= BUCKETS[i]) h.buckets[i] += 1;
  }
}

// Saturation signal: how far behind the event loop is running. If this climbs, the process
// is busier than it can keep up with - long before memory or CPU look alarming.
let eventLoopLag = 0;
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  eventLoopLag = Math.max(0, (now - lastTick - 500) / 1000);
  lastTick = now;
}, 500).unref();

function render(isHealthy) {
  const lines = [];
  const instance = os.hostname();

  lines.push('# HELP app_healthy Whether the app considers itself healthy. 1 = yes, 0 = no.');
  lines.push('# TYPE app_healthy gauge');
  lines.push(`app_healthy{instance="${instance}"} ${isHealthy ? 1 : 0}`);

  lines.push('# HELP http_requests_total Total HTTP requests handled.');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, value] of requests) {
    const [method, path, status] = key.split('|');
    lines.push(
      `http_requests_total{method="${method}",path="${path}",status="${status}"} ${value}`
    );
  }

  lines.push('# HELP http_request_duration_seconds Request latency in seconds.');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, h] of latency) {
    const [method, path] = key.split('|');
    const labels = `method="${method}",path="${path}"`;
    // Prometheus histogram buckets are cumulative: each le="..." counts everything at or below it.
    let cumulative = 0;
    for (let i = 0; i < BUCKETS.length; i++) {
      cumulative = h.buckets[i];
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${BUCKETS[i]}"} ${cumulative}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${h.count}`);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${h.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${h.count}`);
  }

  lines.push('# HELP process_resident_memory_bytes Resident memory used by this process.');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${process.memoryUsage().rss}`);

  lines.push('# HELP nodejs_eventloop_lag_seconds How far behind the event loop is running.');
  lines.push('# TYPE nodejs_eventloop_lag_seconds gauge');
  lines.push(`nodejs_eventloop_lag_seconds ${eventLoopLag.toFixed(4)}`);

  lines.push('# HELP process_uptime_seconds Seconds since this process started.');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${process.uptime().toFixed(0)}`);

  return lines.join('\n') + '\n';
}

module.exports = { observe, render };

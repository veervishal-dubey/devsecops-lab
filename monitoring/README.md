# Monitoring — a worked example

> **This is reference material, not a timed lab.** Nothing here runs during the 4-hour session.
> Read it to understand where a dashboard's numbers actually come from, and run it at home if
> you want to see the whole chain working.

`play.grafana.org` shows you a finished dashboard. It does not show you how the numbers got
there. This folder is the missing half.

---

## The chain, end to end

Every monitoring system you will ever meet is these five steps. There is no sixth.

```
 1. INSTRUMENT        your code counts things              metrics.js
        |
 2. EXPOSE            a plain text page at /metrics        GET /metrics
        |
 3. SCRAPE            Prometheus fetches it on a timer     prometheus.yml
        |
 4. STORE             kept as a time series
        |
 5. QUERY + DRAW      PromQL, rendered as a panel          grafana-dashboard.json
        |
 6. ACT               a threshold with something attached  alert-rules.yml
                                                           or a liveness probe
```

**Step 2 is the one people get wrong.** They assume the app pushes metrics somewhere. It does
not. It publishes a page and waits. Prometheus does the fetching. That is the whole "pull model".

---

## Step 1–2 — what your app has to do

Look at [metrics.js](metrics.js). It has **no dependencies**, so you can read every line and see
that there is no magic. Real projects use `prom-client`, which does the same thing in four lines.

Wire it into `app.js` like this:

```js
const metrics = require('./metrics');

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    metrics.observe(req.method, req.url, res.statusCode, seconds);
  });

  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    return res.end(metrics.render(healthy));
  }

  // ...the rest of the existing handler
});
```

> ⚠️ If you do this, add `metrics.js` to the `COPY` line in `app/Dockerfile.hardened`.
> It copies named files deliberately, so a new file that is not listed simply will not be in the
> image, and the container will crash on `require`. That is the `COPY . .` lesson from Lab B.3
> working in the other direction.

Then look at what it produces:

```bash
curl localhost:3000/metrics
```

```
# HELP http_requests_total Total HTTP requests handled.
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/",status="200"} 47
http_requests_total{method="GET",path="/health",status="200"} 312
http_requests_total{method="GET",path="/health",status="500"} 9
```

That is it. That is the entire interface between your app and every monitoring tool in the world.
A text page over HTTP.

---

## The four metric types

| Type | Behaviour | Example here | You almost always query it with |
|---|---|---|---|
| **Counter** | Only ever goes up. Resets to 0 on restart | `http_requests_total` | `rate()` |
| **Gauge** | Goes up and down | `process_resident_memory_bytes` | the raw value |
| **Histogram** | Counts observations into buckets | `http_request_duration_seconds` | `histogram_quantile()` |
| **Summary** | Percentiles calculated in the app | — | rarely; prefer histograms |

**Why a counter is never read directly:** "4,912,338 requests since the process started" tells
you nothing. `rate(http_requests_total[5m])` turns it into "31 requests per second right now",
which is the number you actually wanted. Counters are stored cheaply and made useful at query
time.

---

## The one rule that stops you breaking Prometheus

**Every distinct combination of label values is a separate time series.**

```js
// ❌ unbounded — a new series for every user, forever. This kills Prometheus.
http_requests_total{path="/users/8837461"}

// ✅ bounded — one series per route
http_requests_total{path="/users/:id"}
```

This is why [metrics.js](metrics.js) folds unknown URLs into `/other`. Never put a user ID, an
email, a session token or a full URL in a label. This mistake has taken down more monitoring
systems than any other.

---

## Step 5 — the dashboard, panel by panel

Import [grafana-dashboard.json](grafana-dashboard.json) into any Grafana:
**Dashboards → New → Import → Upload JSON file**.

It is laid out as **one row per golden signal**, so the structure of the dashboard teaches the
structure of the idea.

| Panel | Golden signal | Query | Why it is written that way |
|---|---|---|---|
| Health | — | `min(app_healthy)` | `min` across pods: if *any* pod is unwell, say so |
| Requests/sec by path | **Traffic** | `sum by (path) (rate(http_requests_total[1m]))` | `rate` first, then `sum`. The other order is wrong |
| Requests/sec by status | **Errors** | `sum by (status) (rate(http_requests_total[1m]))` | Same counter, grouped differently |
| Error rate % | **Errors** | 5xx rate ÷ total rate | A ratio, so it stays meaningful as traffic changes |
| Latency p50/p95/p99 | **Latency** | `histogram_quantile(0.95, ...)` | Buckets → percentiles at query time |
| Average latency | **Latency** | `sum / count` | Shown *next to* p95 on purpose — see below |
| Memory per pod | **Saturation** | `process_resident_memory_bytes` | A line that only climbs is a leak |
| Event loop lag | **Saturation** | `nodejs_eventloop_lag_seconds` | Rises before CPU does. The early warning |

### Why average and p95 sit side by side

Put 99 requests at 10 ms and 1 request at 5 s through the same panel. The average is 60 ms and
looks fine. The p95 is fine too. The **p99 is 5 seconds** — and that one user is having a
terrible time, every hundredth request.

**Averages hide exactly the users you most need to know about.** Watch percentiles.

---

## Step 6 — from a picture to an action

[alert-rules.yml](alert-rules.yml) is the same shape as the liveness probe in
`k8s/deployment-probes.yaml`:

| | Liveness probe | Alert rule |
|---|---|---|
| Condition | `/health` returns non-200 | `error rate > 5%` |
| Must hold for | `failureThreshold: 3` × `periodSeconds: 5` | `for: 2m` |
| What happens | Kubernetes **restarts the container** | Alertmanager **tells a human** |
| Takes | ~15 seconds | as long as the human takes |

Both are `for:` clauses. Both exist so one bad second does not trigger anything. The difference
is only what is attached to the end.

> **Prefer the probe wherever the fix is mechanical.** Only page a human when judgement is
> genuinely required. Every alert that a machine could have handled is an alert that trains
> people to ignore alerts.

Note `TargetDown` at the bottom of the file. If Prometheus cannot reach your app at all, every
other metric stops existing and none of the other rules can fire. **A silent dashboard is not a
healthy one** — this is OWASP **A09**, logging and monitoring failures, in three lines of YAML.

---

## Run the whole thing

Not in a Codespace — this stack plus minikube will exhaust a 2-core machine. On a laptop:

```bash
cd lab-starter
docker compose -f monitoring/docker-compose.monitoring.yml up
```

| | URL | |
|---|---|---|
| The app | http://localhost:3000 | |
| Prometheus | http://localhost:9090 | try **Status → Targets** |
| Grafana | http://localhost:3001 | dashboard already loaded |

Then make the graphs move:

```bash
# generate traffic
while true; do curl -s localhost:3000 > /dev/null; sleep 0.2; done

# in another terminal, make it unhealthy and watch every panel react
curl localhost:3000/break
```

**What to watch, in order:**

1. **Traffic** climbs as soon as the loop starts.
2. **Health** flips to DOWN within 5 seconds of `/break`.
3. **Error rate** starts rising as `/health` returns 500s.
4. `curl localhost:3000/fix` — everything recovers.

Then open Prometheus at **Status → Targets** and watch it fetch `/metrics` every 5 seconds.
That list is the pull model, visible.

---

## Things worth trying yourself

1. Add a counter for `/break` calls specifically. How would you graph "how many times did
   somebody break this today?"
2. Set `scrape_interval` to `60s` and reload. What happens to a 5-second outage? (This is the
   real trade-off: resolution versus storage cost.)
3. Stop the `app` container. Which panels go blank, and which go to zero? **They mean different
   things** — blank is "no data", zero is "measured, and it was zero".
4. Write an alert for "traffic dropped to zero". Why is that harder than it sounds at 3am on a
   Sunday?

---

## Files here

| File | What it is |
|---|---|
| [metrics.js](metrics.js) | A `/metrics` endpoint with zero dependencies, written longhand |
| [prometheus.yml](prometheus.yml) | Scrape config — static targets and Kubernetes discovery |
| [prometheus-local.yml](prometheus-local.yml) | The cut-down version used by the compose file |
| [alert-rules.yml](alert-rules.yml) | Alerts for each golden signal, plus `TargetDown` |
| [grafana-dashboard.json](grafana-dashboard.json) | Importable dashboard, one row per signal |
| [docker-compose.monitoring.yml](docker-compose.monitoring.yml) | Runs app + Prometheus + Grafana locally |
| `provisioning/` | Makes Grafana load the data source and dashboard by itself |

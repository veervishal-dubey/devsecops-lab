// The Unit 4 lab app. Same idea as Unit 3's web service, with two additions:
//   /break  makes the health check start failing, so Kubernetes has to react
//   /fix    makes it healthy again

const http = require('http');
const fs = require('fs');
const os = require('os');

const PORT = 3000;

// Flipped by /break. When false, /health returns 500 and the liveness probe fails.
let healthy = true;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    if (healthy) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }
    console.log('health check failed - this container is unwell');
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('UNHEALTHY');
  }

  if (req.url === '/break') {
    healthy = false;
    console.log('/break called - health checks will now fail');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ healthy, container: os.hostname() }));
  }

  if (req.url === '/fix') {
    healthy = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ healthy, container: os.hostname() }));
  }

  const page = fs
    .readFileSync(__dirname + '/index.html', 'utf8')
    .replace('__CONTAINER__', os.hostname())
    .replace('__STATUS__', healthy ? 'healthy' : 'UNHEALTHY');

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page);
});

server.listen(PORT, () => console.log(`app listening on port ${PORT}`));

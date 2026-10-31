const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');
const url = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4'
};

function startServer(options = {}) {
  const staticDir = options.staticDir || path.join(__dirname, '..', 'dist-web');
  const targetBackend = options.targetBackendUrl || 'http://localhost:8080';
  const backendUrlObj = new URL(targetBackend);
  const preferredPort = options.port || 0;

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname || '/';

    // 1. Proxy API requests to backend
    if (pathname.startsWith('/api/')) {
      const isHttps = backendUrlObj.protocol === 'https:';
      const transport = isHttps ? https : http;

      const proxyReq = transport.request(
        {
          hostname: backendUrlObj.hostname,
          port: backendUrlObj.port || (isHttps ? 443 : 80),
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: backendUrlObj.host,
            'x-forwarded-for': req.socket.remoteAddress,
            'x-forwarded-proto': 'http'
          }
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (err) => {
        console.error('[Desktop Server] API Proxy Error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend unreachable', details: err.message }));
      });

      req.pipe(proxyReq);
      return;
    }

    // 2. Serve static files from staticDir
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';
    let filePath = path.join(staticDir, safePath);

    fs.stat(filePath, (err, stats) => {
      // If file not found or is a directory, fallback to index.html (SPA routing)
      if (err || !stats.isFile()) {
        filePath = path.join(staticDir, 'index.html');
      }

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
        });
        res.end(content);
      });
    });
  });

  // 3. WebSocket Upgrade Proxy
  server.on('upgrade', (req, clientSocket, head) => {
    const targetPort = parseInt(backendUrlObj.port || '8080', 10);
    const targetHost = backendUrlObj.hostname || 'localhost';

    const serverSocket = net.connect(targetPort, targetHost, () => {
      serverSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        serverSocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
      }
      serverSocket.write('\r\n');
      if (head && head.length > 0) {
        serverSocket.write(head);
      }
      clientSocket.pipe(serverSocket);
      serverSocket.pipe(clientSocket);
    });

    serverSocket.on('error', (err) => {
      console.error('[Desktop Server] WebSocket tunnel error:', err.message);
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      serverSocket.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      const localUrl = `http://127.0.0.1:${port}`;
      console.log(`[Desktop Server] Embedded server listening on ${localUrl}`);
      resolve({ server, port, localUrl });
    });
    server.on('error', reject);
  });
}

module.exports = { startServer };

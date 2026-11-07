const path = require('path');
const { startServer } = require(path.join(__dirname, '..', 'apps', 'desktop', 'src', 'server.cjs'));

const PORT = 5180;
const staticDir = path.resolve(__dirname, '..', 'apps', 'web', 'dist');
const targetBackendUrl = 'http://127.0.0.1:8099';

startServer({
  port: PORT,
  staticDir,
  targetBackendUrl
}).then(({ localUrl }) => {
  console.log(`[Review Web Server] Serving production web bundle at ${localUrl} (proxying to ${targetBackendUrl})`);
}).catch((err) => {
  console.error('[Review Web Server] Failed to start:', err);
  process.exit(1);
});


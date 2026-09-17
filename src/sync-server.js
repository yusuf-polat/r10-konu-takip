const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { config } = require('./config.js');

const SYNC_PORT = process.env.MCP_SYNC_PORT || 9922;
let serverInstance = null;
let lastSyncTime = null;

/**
 * Updates the .env file with fresh credentials so they persist across server restarts.
 */
function updateEnvFile(cookie, securityToken, userAgent) {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const updates = {
      R10_COOKIE: cookie,
      R10_SECURITY_TOKEN: securityToken,
      R10_USER_AGENT: userAgent
    };

    for (const [key, val] of Object.entries(updates)) {
      if (!val) continue;
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}="${val.replace(/"/g, '\\"')}"`;
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += `\n${newLine}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  } catch (err) {
    console.error('[Sync Server] Warning: Could not write to .env file:', err.message);
  }
}

/**
 * Applies credentials to in-memory config and persistent .env file.
 */
function applyCredentials({ cookie, securityToken, userAgent }) {
  if (cookie) config.cookie = cookie;
  if (securityToken) config.securityToken = securityToken;
  if (userAgent) config.userAgent = userAgent;

  lastSyncTime = new Date().toISOString();
  updateEnvFile(cookie, securityToken, userAgent);

  console.error(`[Sync Server] ✅ Credentials successfully synced at ${lastSyncTime}!`);
  console.error(`[Sync Server] Details: Cookie length=${cookie ? cookie.length : 0}, Token=${securityToken ? 'Set' : 'None'}, User-Agent=${userAgent ? 'Updated' : 'Default'}`);
}

/**
 * Starts the local HTTP & WebSocket synchronization server.
 */
function startSyncServer(port = SYNC_PORT) {
  if (serverInstance) return serverInstance;

  const server = http.createServer((req, res) => {
    // Enable CORS for Chrome Extension origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        hasCookie: Boolean(config.cookie),
        hasSecurityToken: Boolean(config.securityToken),
        lastSync: lastSyncTime
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/sync') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          applyCredentials(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'R10 credentials synced successfully.', syncedAt: lastSyncTime }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Sync Server] Note: Port ${port} is already in use by another instance. Skipping sync listener.`);
    } else {
      console.error('[Sync Server] Server error:', err.message);
    }
  });

  // Attach WebSocket Server with its own error handler to prevent unhandled error crashes
  let wss = null;
  try {
    wss = new WebSocketServer({ server });

    wss.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        console.error('[Sync Server] WebSocket server error:', err.message);
      }
    });

    wss.on('connection', (ws) => {
      console.error('[Sync Server] 🔌 Chrome Extension WebSocket connected!');

      ws.send(JSON.stringify({
        type: 'INIT_ACK',
        message: 'Connected to R10 MCP Sync Server',
        lastSync: lastSyncTime
      }));

      ws.on('message', (message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.type === 'R10_SYNC' || payload.cookie) {
            applyCredentials(payload);
            ws.send(JSON.stringify({
              type: 'SYNC_ACK',
              success: true,
              syncedAt: lastSyncTime
            }));
          }
        } catch (err) {
          console.error('[Sync Server] WebSocket message error:', err.message);
          ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
        }
      });

      ws.on('close', () => {
        console.error('[Sync Server] Chrome Extension WebSocket disconnected.');
      });
    });
  } catch (wsInitErr) {
    console.error('[Sync Server] WebSocket initialization notice:', wsInitErr.message);
  }

  try {
    server.listen(port, '127.0.0.1', () => {
      console.error(`[Sync Server] 🚀 Listening for Chrome Extension sync on http://127.0.0.1:${port} & ws://127.0.0.1:${port}`);
    });
  } catch (listenErr) {
    console.error('[Sync Server] Listen notice:', listenErr.message);
  }

  serverInstance = server;
  return server;
}

module.exports = {
  startSyncServer,
  applyCredentials
};

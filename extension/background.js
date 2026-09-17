// R10 MCP Sync Bridge - Background Service Worker
const MCP_SYNC_URL = 'http://127.0.0.1:9922/sync';
const MCP_STATUS_URL = 'http://127.0.0.1:9922/status';
const MCP_WS_URL = 'ws://127.0.0.1:9922';

let socket = null;
let lastKnownToken = null;

// Connect to local MCP WebSocket server if available
function initWebSocket() {
  try {
    socket = new WebSocket(MCP_WS_URL);

    socket.onopen = () => {
      console.log('[R10 Sync] WebSocket connected to MCP Server.');
    };

    socket.onmessage = (event) => {
      console.log('[R10 Sync] Message from MCP Server:', event.data);
    };

    socket.onclose = () => {
      socket = null;
    };

    socket.onerror = () => {
      socket = null;
    };
  } catch (err) {
    socket = null;
  }
}

// Format all R10 cookies into a standard header string
async function getR10CookieString() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'r10.net' });
    if (!cookies || cookies.length === 0) return '';
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (e) {
    console.error('[R10 Sync] Error getting cookies:', e);
    return '';
  }
}

// Sync credentials to MCP server (WebSocket with HTTP fallback)
async function syncToMcpServer(tokenOverride = null) {
  const cookieString = await getR10CookieString();
  const stored = await chrome.storage.local.get(['securityToken', 'autoSync']);
  const token = tokenOverride || lastKnownToken || stored.securityToken || '';
  const userAgent = navigator.userAgent;

  if (!cookieString) {
    return { success: false, error: 'No R10 cookies found. Please log in to https://www.r10.net' };
  }

  const payload = {
    type: 'R10_SYNC',
    cookie: cookieString,
    securityToken: token,
    userAgent: userAgent
  };

  // Try WebSocket first
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    const now = new Date().toISOString();
    await chrome.storage.local.set({ lastSync: now });
    return { success: true, method: 'websocket', timestamp: now };
  }

  // Fallback to HTTP POST
  try {
    const res = await fetch(MCP_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const now = new Date().toISOString();
    await chrome.storage.local.set({ lastSync: now });
    return { success: true, method: 'http', timestamp: now, data };
  } catch (err) {
    return { success: false, error: `Could not connect to MCP server: ${err.message}` };
  }
}

// Listen to messages from content script & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'R10_TOKEN_EXTRACTED') {
    lastKnownToken = message.securityToken;
    chrome.storage.local.set({ securityToken: message.securityToken });

    // Check if auto-sync is enabled
    chrome.storage.local.get(['autoSync'], (res) => {
      if (res.autoSync !== false) {
        syncToMcpServer(message.securityToken);
      }
    });
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'MANUAL_SYNC') {
    syncToMcpServer().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'CHECK_SERVER_STATUS') {
    fetch(MCP_STATUS_URL)
      .then(res => res.json())
      .then(data => sendResponse({ online: true, data }))
      .catch(err => sendResponse({ online: false, error: err.message }));
    return true;
  }
});

// Auto-sync when user navigates on r10.net
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('r10.net')) {
    chrome.storage.local.get(['autoSync'], (res) => {
      if (res.autoSync !== false) {
        syncToMcpServer();
      }
    });
  }
});

// Try establishing WebSocket connection at startup
initWebSocket();

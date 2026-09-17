// R10 MCP Sync Bridge - Background Service Worker
const MCP_SYNC_URL = 'http://127.0.0.1:9922/sync';
const MCP_STATUS_URL = 'http://127.0.0.1:9922/status';
const MCP_WS_URL = 'ws://127.0.0.1:9922';

let socket = null;
let lastKnownToken = null;
let isConnecting = false;

// Connect to local MCP WebSocket server safely
function initWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (isConnecting) return;

  try {
    isConnecting = true;
    const ws = new WebSocket(MCP_WS_URL);

    ws.onopen = () => {
      isConnecting = false;
      socket = ws;
      console.log('[R10 Sync] WebSocket connected to MCP Server.');
    };

    ws.onmessage = (event) => {
      console.log('[R10 Sync] Server message:', event.data);
    };

    ws.onclose = () => {
      isConnecting = false;
      socket = null;
    };

    ws.onerror = () => {
      isConnecting = false;
      socket = null;
    };
  } catch (err) {
    isConnecting = false;
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
    return { success: false, error: 'R10 çerezleri bulunamadı. Lütfen https://www.r10.net adresine giriş yapın.' };
  }

  const payload = {
    type: 'R10_SYNC',
    cookie: cookieString,
    securityToken: token,
    userAgent: userAgent
  };

  // Try WebSocket if connected
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(payload));
      const now = new Date().toISOString();
      await chrome.storage.local.set({ lastSync: now });
      return { success: true, method: 'websocket', timestamp: now };
    } catch (e) {
      // fallback to HTTP
    }
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

    // Server is up -> try initializing WebSocket
    initWebSocket();

    return { success: true, method: 'http', timestamp: now, data };
  } catch (err) {
    return { success: false, error: `MCP sunucusuna bağlanılamadı. Lütfen 'npm start' veya 'npm run sync-server' ile sunucuyu başlatın.` };
  }
}

// Listen to messages from content script & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'R10_TOKEN_EXTRACTED') {
    lastKnownToken = message.securityToken;
    chrome.storage.local.set({ securityToken: message.securityToken });

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
    return true;
  }

  if (message.action === 'CHECK_SERVER_STATUS') {
    fetch(MCP_STATUS_URL)
      .then(res => res.json())
      .then(data => {
        initWebSocket();
        sendResponse({ online: true, data });
      })
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

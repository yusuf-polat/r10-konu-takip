// R10 MCP Sync Bridge - Popup Logic
document.addEventListener('DOMContentLoaded', async () => {
  const serverStatusEl = document.getElementById('serverStatus');
  const cookieCountEl = document.getElementById('cookieCount');
  const lastSyncEl = document.getElementById('lastSync');
  const syncBtn = document.getElementById('syncBtn');
  const messageEl = document.getElementById('message');
  const autoSyncToggle = document.getElementById('autoSyncToggle');

  // Load autoSync setting
  chrome.storage.local.get(['autoSync', 'lastSync'], (data) => {
    if (data.autoSync !== undefined) {
      autoSyncToggle.checked = Boolean(data.autoSync);
    }
    if (data.lastSync) {
      const date = new Date(data.lastSync);
      lastSyncEl.textContent = date.toLocaleTimeString();
    }
  });

  // Toggle autoSync
  autoSyncToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoSync: autoSyncToggle.checked });
  });

  // Check cookies count
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'r10.net' });
    if (cookies.length > 0) {
      cookieCountEl.textContent = `${cookies.length} active cookies`;
      cookieCountEl.style.color = '#10b981';
    } else {
      cookieCountEl.textContent = 'None (Please log in)';
      cookieCountEl.style.color = '#ef4444';
    }
  } catch (e) {
    cookieCountEl.textContent = 'Error reading cookies';
  }

  // Check MCP Server status
  chrome.runtime.sendMessage({ action: 'CHECK_SERVER_STATUS' }, (res) => {
    if (res && res.online) {
      serverStatusEl.innerHTML = '<span class="indicator online"></span>Online (Port 9922)';
      serverStatusEl.style.color = '#10b981';
    } else {
      serverStatusEl.innerHTML = '<span class="indicator offline"></span>Offline (Start MCP)';
      serverStatusEl.style.color = '#ef4444';
    }
  });

  // Manual sync button
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    messageEl.className = 'message';
    messageEl.textContent = '';

    chrome.runtime.sendMessage({ action: 'MANUAL_SYNC' }, (response) => {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        Sync Now to MCP
      `;

      if (response && response.success) {
        messageEl.className = 'message success';
        messageEl.textContent = '✅ Synced successfully with MCP Server!';
        const now = new Date();
        lastSyncEl.textContent = now.toLocaleTimeString();
        serverStatusEl.innerHTML = '<span class="indicator online"></span>Online (Synced)';
        serverStatusEl.style.color = '#10b981';
      } else {
        messageEl.className = 'message error';
        messageEl.textContent = `❌ ${response?.error || 'Sync failed. Ensure MCP server is running.'}`;
      }
    });
  });
});

// R10 MCP Sync Bridge - Content Script
(function() {
  function extractSecurityToken() {
    // 1. Try checking inline script content
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const match = s.textContent.match(/var\s+SECURITYTOKEN\s*=\s*["']([^"']+)["']/i) ||
                    s.textContent.match(/SECURITYTOKEN\s*=\s*["']([^"']+)["']/i);
      if (match && match[1] && match[1] !== 'guest') {
        return match[1];
      }
    }

    // 2. Try checking hidden form inputs
    const input = document.querySelector('input[name="securitytoken"]');
    if (input && input.value && input.value !== 'guest') {
      return input.value;
    }

    return null;
  }

  const token = extractSecurityToken();
  if (token) {
    chrome.runtime.sendMessage({
      action: 'R10_TOKEN_EXTRACTED',
      securityToken: token,
      url: window.location.href
    }).catch(() => {
      // Background worker might be sleeping, ignored
    });
  }
})();

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');

// Parse .env silently without stdout output to prevent breaking MCP JSON-RPC
if (fs.existsSync(envPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  } catch (e) {
    console.error('[R10 MCP Config] .env yükleme uyarısı:', e.message);
  }
}

const config = {
  cookie: process.env.R10_COOKIE || '',
  securityToken: process.env.R10_SECURITY_TOKEN || '',
  userAgent: process.env.R10_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  baseUrl: 'https://www.r10.net'
};

/**
 * Dinamik olarak ana sayfadan güncel SECURITYTOKEN değerini çeker.
 */
async function refreshSecurityToken() {
  try {
    const res = await fetch(`${config.baseUrl}/`, {
      headers: {
        'user-agent': config.userAgent,
        'cookie': config.cookie
      }
    });

    if (!res.ok) {
      throw new Error(`Ana sayfa açılamadı: HTTP ${res.status}`);
    }

    const html = await res.text();
    const tokenMatch = html.match(/var\s+SECURITYTOKEN\s*=\s*["']([^"']+)["']/i) ||
                       html.match(/securitytoken\s*[:=]\s*["']([^"']+)["']/i);

    if (tokenMatch && tokenMatch[1] && tokenMatch[1] !== 'guest') {
      config.securityToken = tokenMatch[1];
      return config.securityToken;
    }
  } catch (err) {
    console.error('[R10 MCP Config] SecurityToken yenileme hatası:', err.message);
  }
  return config.securityToken;
}

module.exports = {
  config,
  refreshSecurityToken
};

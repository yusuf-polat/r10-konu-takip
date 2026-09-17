# R10.net Forum Tracker MCP Server

[![MCP Standard](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue.svg)](https://modelcontextprotocol.io/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-orange.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

A high-performance, production-ready **Model Context Protocol (MCP)** server built in Node.js for interacting with **[R10.net](https://www.r10.net/)**—Turkey's premier webmaster and digital technology community.

Includes a companion **Chrome Extension (Manifest V3)** that automatically synchronizes active session cookies and security tokens to your MCP server in real-time via WebSocket and local HTTP sync.

Empowers AI assistants (such as **Claude Desktop**, **Cursor IDE**, **Antigravity**, **Cline**, and **Windsurf**) to monitor new threads in real-time, search discussions across the entire forum, filter content by category/author/keywords, and read full thread posts and replies.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Two-Part Design](#architecture--two-part-design)
- [Prerequisites](#prerequisites)
- [Quick Start & Installation](#quick-start--installation)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Install Dependencies](#2-install-dependencies)
- [Authentication: Two Flexible Methods](#authentication-two-flexible-methods)
  - [Method A: Chrome Extension Auto-Sync (Recommended — Zero Copy/Paste)](#method-a-chrome-extension-auto-sync-recommended--zero-copypaste)
  - [Method B: Manual Setup via .env (Headless / Standalone)](#method-b-manual-setup-via-env-headless--standalone)
- [Client Integration Guides](#client-integration-guides)
  - [Claude Desktop](#claude-desktop)
  - [Cursor IDE](#cursor-ide)
  - [Antigravity / Gemini CLI](#antigravity--gemini-cli)
  - [Cline / Roo Code / Windsurf](#cline--roo-code--windsurf)
- [Tools Reference](#tools-reference)
  - [`r10_get_latest_threads`](#1-r10_get_latest_threads)
  - [`r10_search_threads`](#2-r10_search_threads)
  - [`r10_filter_threads`](#3-r10_filter_threads)
  - [`r10_track_new_threads`](#4-r10_track_new_threads)
  - [`r10_get_thread_details`](#5-r10_get_thread_details)
  - [`r10_get_categories`](#6-r10_get_categories)
- [Example AI Prompts](#example-ai-prompts)
- [Troubleshooting & FAQs](#troubleshooting--faqs)
- [Verification & Testing](#verification--testing)
- [Contributing](#contributing)
- [License & Disclaimer](#license--disclaimer)

---

## 🌟 Overview

Tracking active forum discussions manually is time-consuming. This MCP server bridges the gap between R10.net and modern LLMs by leveraging R10's native AJAX endpoints (`ajax.php?do=anasayfaTab`) and search infrastructure.

Instead of heavy browser automation or fragile HTML scraping, this project:
- Parses structured XML/CDATA feeds with high-speed Cheerio processing.
- Features **automated real-time session synchronization** via an included Chrome Extension.
- Automatically handles expired `securitytoken` values dynamically.
- Implements a **stateful tracker** that remembers seen threads and yields only fresh items.
- Maintains strict **JSON-RPC stdio compliance** with silent environment loading so host agents never encounter parsing collisions.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **🔌 Real-Time Chrome Extension Sync** | Automatic background sync of active cookies, user-agent, and CSRF tokens over WebSocket/HTTP. No manual DevTools copying required. |
| **⚡ Real-Time Tab Feeds** | Fetch newly opened threads (`sonAcilan`), active replies (`sonCevaplanan`), popular discussions (`populer`), or articles (`blog`). |
| **🔎 Global Forum Search** | Query the entire forum history using R10's native search engine. |
| **🎯 Multi-Page Filtering** | Scan multiple pages simultaneously with Turkish-locale-aware filtering on titles, previews, authors, and categories. |
| **🔔 Stateful Live Tracker** | Detect and stream *only* unseen threads opened after the initial check. Perfect for background polling and alerts. |
| **📖 Deep Thread Reader** | Read the full main post text and the latest member replies cleanly converted from HTML. |
| **🛡️ Auto-Healing Tokens** | If R10 returns an expired CSRF/security token error, the server automatically fetches a fresh token and retries the request. |

---

## 🏗️ Architecture & Two-Part Design

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Client                              │
│       (Claude Desktop, Cursor, Antigravity, Cline)          │
└──────────────────────────────┬──────────────────────────────┘
                               │  Standard JSON-RPC over Stdio
┌──────────────────────────────▼──────────────────────────────┐
│                    R10 MCP Server (Node.js)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ src/index.js (StdioServerTransport & Tool Registry)    │ │
│  └──────────────┬───────────────────────────┬─────────────┘ │
│                 │                           │               │
│  ┌──────────────▼───────────┐ ┌─────────────▼─────────────┐ │
│  │ src/r10-client.js        │ │ src/sync-server.js        │ │
│  │ (Parser, Cache, Search)  │ │ (HTTP & WS on Port 9922)  │ │
│  └──────────────┬───────────┘ └─────────────▲─────────────┘ │
│                 │                           │               │
│  ┌──────────────▼───────────┐               │ WebSocket /   │
│  │ src/config.js            │               │ HTTP POST     │
│  │ (Config & .env Fallback) │               │               │
│  └──────────────┬───────────┘               │               │
└─────────────────┼───────────────────────────┼───────────────┘
                  │                           │
                  │ HTTPS Requests            │
┌─────────────────▼───────────┐ ┌─────────────┴─────────────┐
│     R10.net Cloudflare      │ │  Chrome Extension (MV3)   │
│  (ajax.php / search.php)    │ │  (extension/ directory)   │
└─────────────────────────────┘ └───────────────────────────┘
```

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher (`node -v`)
- **npm**: `v9.0.0` or higher (`npm -v`)
- **Google Chrome** (or Chromium-based browser like Brave, Edge)
- An active **R10.net** user account.

---

## 📦 Quick Start & Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/r10-mcp-server.git
cd r10-mcp-server
```

### 2. Install Dependencies

```bash
npm install
```

---

## 🔐 Authentication: Two Flexible Methods

You can supply R10 session credentials in either of two ways:

### Method A: Chrome Extension Auto-Sync (Recommended — Zero Copy/Paste)

This repository includes a companion Manifest V3 Chrome Extension located in the `extension/` directory. It automatically extracts your session cookies and security token from your browser and pushes them to the local MCP server.

1. Open your browser and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `extension` folder inside this repository:
   ```
   d:/r10-konu-takip/extension
   ```
5. Open **[https://www.r10.net](https://www.r10.net)** in your browser and ensure you are logged in.
6. Click the **R10 MCP Bridge** icon in your Chrome toolbar.
7. Click **"Sync Now to MCP"** (or leave **"Auto-Sync on R10 visit"** enabled).
8. The popup will display `Online (Port 9922)` and confirm successful synchronization.

> 💡 **Why this is awesome:** Whenever your R10 session or Cloudflare token updates, the extension automatically keeps your MCP server synchronized in the background without manual intervention.

---

### Method B: Manual Setup via `.env` (Headless / Standalone)

If you prefer running in a headless environment without the Chrome extension:

1. Copy `.env.example` to create `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `https://www.r10.net` in your browser and log in.
3. Press `F12` to open Developer Tools $\rightarrow$ **Network** tab.
4. Filter by `anasayfaTab` (or click on the "Son Açılan" tab).
5. Copy the request's `Cookie` header into `R10_COOKIE` in your `.env`.
6. (Optional) Copy `securitytoken` from the request payload into `R10_SECURITY_TOKEN`.
7. Ensure `R10_USER_AGENT` matches your browser's User-Agent.

```env
R10_COOKIE="RID=...; r10userid=...; cf_clearance=...; vbseo_loggedin=yes"
R10_SECURITY_TOKEN="1780000000-abcdef0123456789abcdef0123456789abcdef01"
R10_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
```

> ⚠️ **SECURITY WARNING:**  
> Never commit your `.env` file to a public Git repository. `.gitignore` is pre-configured to keep your secrets private.

---

## 🔌 Client Integration Guides

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "r10-tracker": {
      "command": "node",
      "args": ["D:/r10-konu-takip/src/index.js"]
    }
  }
}
```

Restart Claude Desktop. The hammer icon (⚒️) will list all 6 R10 tools.

---

### Cursor IDE

1. Open Cursor Settings (`Ctrl+,` or `Cmd+,`).
2. Go to **Features** $\rightarrow$ **MCP Servers** $\rightarrow$ **Add New MCP Server**:
   - **Name:** `r10-tracker`
   - **Type:** `command`
   - **Command:** `node D:/r10-konu-takip/src/index.js`
3. Save. The status indicator will turn green.

---

### Antigravity / Gemini CLI

Add to `mcp_config.json`:

```json
{
  "mcpServers": {
    "r10-tracker": {
      "command": "node",
      "args": ["d:/r10-konu-takip/src/index.js"]
    }
  }
}
```

---

### Cline / Roo Code / Windsurf

Add to your MCP settings file (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "r10-tracker": {
      "command": "node",
      "args": ["D:/r10-konu-takip/src/index.js"]
    }
  }
}
```

---

## 🧰 Tools Reference

### 1. `r10_get_latest_threads`
Fetches active threads from the chosen homepage tab.

- **Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `tab` | `string` | `"sonAcilan"` | Tab to fetch: `"sonAcilan"`, `"sonCevaplanan"`, `"populer"`, `"blog"`. |
  | `page` | `number` | `1` | Pagination number. |
  | `limit` | `number` | `null` | Max number of threads to return (optional). |

- **Sample Output:**
  ```json
  {
    "sekme": "sonAcilan",
    "sayfa": 1,
    "toplam": 10,
    "konular": [
      {
        "id": "4881102",
        "title": "10 Google News Sitede Tanıtım Yazısı | SEO & Do-Follow Backlink",
        "url": "https://www.r10.net/yazilim-web-hizmetleri/4881102-...html",
        "preview": "Bu Fiyata Gerçekten Tam Bir Fiyat Performans Paketidir...",
        "author": "BHE Digital",
        "authorUrl": "https://www.r10.net/profil/130801-bhe-digital.html",
        "avatarUrl": "https://cdn.r10.net/image.php?u=130801",
        "isOnline": true,
        "replies": 0,
        "views": 25,
        "category": "Yazılım ve Web Hizmetleri",
        "categoryUrl": "https://www.r10.net/yazilim-web-hizmetleri/"
      }
    ]
  }
  ```

---

### 2. `r10_search_threads`
Executes a global query across the entire forum via R10's native search engine.

- **Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `query` | `string` | **Yes** | Search phrase (e.g. `"ücretsiz api"`, `"python bot"`, `"backlink"`). |
  | `limit` | `number` | No (default `15`) | Maximum matching results to return. |

---

### 3. `r10_filter_threads`
Performs deep in-feed scanning over multiple pages, filtering by keyword, category, or author.

- **Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `keyword` | `string` | `null` | Keyword matching against thread title and first post preview. |
  | `category` | `string` | `null` | Category name filter (e.g. `"Off-Topic"`, `"Yapay Zeka"`). |
  | `author` | `string` | `null` | Username of the thread author. |
  | `tab` | `string` | `"sonAcilan"` | Tab to search within. |
  | `maxPages` | `number` | `3` | Number of sequential pages to inspect. |

---

### 4. `r10_track_new_threads`
A state-aware tracker tool. Memorizes seen thread IDs in memory and on subsequent calls outputs **only newly opened threads** since the last check.

- **Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `tab` | `string` | `"sonAcilan"` | Tab to monitor. |
  | `category` | `string` | `null` | Filter new items by category. |
  | `keyword` | `string` | `null` | Filter new items by keyword. |
  | `reset` | `boolean` | `false` | Resets the tracking state and takes a fresh snapshot. |

---

### 5. `r10_get_thread_details`
Reads the full opening post and recent replies from a thread.

- **Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `threadUrlOrId` | `string` | **Yes** | Full thread URL or thread ID (e.g. `"4881102"`). |

- **Returns:**
  - `title`: Clean thread title.
  - `author`: Post author name.
  - `content`: Full textual content of the opening post.
  - `recentReplies`: Array of the latest 5 replies (author, date, text snippet).

---

### 6. `r10_get_categories`
Analyzes recent forum traffic to list active categories and their current activity volume.

- **Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `tab` | `string` | `"sonAcilan"` | Source feed. |
  | `pages` | `number` | `3` | Number of pages to scan for category distribution. |

---

## 💬 Example AI Prompts

Try asking your AI assistant:

- *"List the top 5 newest threads opened on R10."*
- *"Search R10 for free TTS or text-to-speech API recommendations."*
- *"Monitor R10 for new threads in the 'Yazılım ve Web Hizmetleri' category and let me know when a new one is posted."*
- *"Fetch and summarize the discussion in R10 thread 4874052."*
- *"Which categories currently have the most active threads on the homepage?"*

---

## 🔧 Troubleshooting & FAQs

### Q: The server returns `R10 Güvenlik Token hatası` (Security Token Error).
**A:** This indicates that the `R10_SECURITY_TOKEN` has expired or the session is invalidated.
1. The server will automatically try to fetch a fresh token from `https://www.r10.net/`.
2. If using the Chrome Extension, click **"Sync Now to MCP"** in the popup to refresh.
3. If running manually, update your `R10_COOKIE` in `.env`.

### Q: Requests fail with HTTP 403 Forbidden.
**A:** Cloudflare has challenged the connection.
- Ensure your `R10_USER_AGENT` matches the browser from which you copied the cookies.
- Visit R10.net in your browser to pass any Cloudflare Captcha, then trigger a sync via the extension or update `.env`.

### Q: Does the Chrome Extension need to be open all the time?
**A:** No. As long as you have the extension installed and visit R10 periodically, it keeps the MCP server credentials fresh.

---

## 🧪 Verification & Testing

The repository includes standalone validation scripts:

```bash
# 1. Test basic client operations (fetching tabs, filtering, categories):
npm test

# 2. Test full end-to-end JSON-RPC MCP server communication over stdio:
npm run test:rpc
```

---

## 🤝 Contributing

Contributions are welcome! If you'd like to add new features:

1. Fork the Project.
2. Create a Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License & Disclaimer

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.

**Disclaimer:** This project is an unofficial community integration and is not officially affiliated with or endorsed by R10.net. Users are responsible for adhering to the forum's terms of service and reasonable rate-limiting practices.

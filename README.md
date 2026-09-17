# 🚀 R10.net Forum Tracker MCP Server & Chrome Extension Bridge

[![MCP Standard](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue.svg)](https://modelcontextprotocol.io/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-orange.svg)](./extension)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![GitHub Repo](https://img.shields.io/badge/GitHub-yusuf--polat%2Fr10--konu--takip-181717.svg?logo=github)](https://github.com/yusuf-polat/r10-konu-takip)

Türkiye'nin en büyük webmaster ve teknoloji forumu **[R10.net](https://www.r10.net/)** için geliştirilmiş, yüksek performanslı ve çift taraflı senkronizasyon yeteneğine sahip **Model Context Protocol (MCP)** sunucusu ve **Google Chrome Eklentisi (Manifest V3)** köprüsü.

Bu proje sayesinde **Claude Desktop**, **Cursor IDE**, **Google Antigravity**, **Cline**, **Windsurf** gibi tüm modern yapay zeka asistanları R10 üzerindeki yeni konuları canlı takip edebilir, forumda arama yapabilir, belirli kategorileri filtreleyebilir ve konu içeriklerini doğrudan okuyabilir.

---

## 📑 İçindekiler / Table of Contents

- [✨ Temel Özellikler](#-temel-özellikler)
- [🧩 Chrome Eklentisi ve Mimarisi](#-chrome-eklentisi-ve-mimarisi)
- [🛠️ Adım Adım Kurulum Kılavuzu (Türkçe)](#️-adım-adım-kurulum-kılavuzu-türkçe)
  - [1. Projeyi Klonlayın ve Bağımlılıkları Yükleyin](#1-projeyi-klonlayın-ve-bağımlılıkları-yükleyin)
  - [2. Chrome Eklentisini Tarayıcıya Yükleme (Adım Adım)](#2-chrome-eklentisini-tarayıcıya-yükleme-adım-adım)
  - [3. Eklenti ile Tek Tıkla Senkronizasyon (Sıfır Manuel İşlem)](#3-eklenti-ile-tek-tıkla-senkronizasyon-sıfır-manuel-i̇şlem)
  - [4. Alternatif: Manuel .env Yapılandırması (Sunucu / Headless)](#4-alternatif-manuel-env-yapılandırması-sunucu--headless)
- [🤖 Yapay Zeka İstemcilerine Entegrasyon](#-yapay-zeka-i̇stemcilerine-entegrasyon)
  - [Claude Desktop](#claude-desktop)
  - [Cursor IDE](#cursor-ide)
  - [Google Antigravity / Gemini CLI](#google-antigravity--gemini-cli)
  - [Cline / Roo Code / Windsurf](#cline--roo-code--windsurf)
- [🧰 MCP Araçları Referansı (Tools)](#-mcp-araçları-referansı-tools)
- [💬 Örnek Komutlar ve Promptlar](#-örnek-komutlar-ve-promptlar)
- [🔍 Sıkça Sorulan Sorular ve Sorun Giderme](#-sıkça-sorulan-sorular-ve-sorun-giderme)
- [English Documentation](#-english-documentation-summary)
- [Lisans ve Yasal Uyarı](#-lisans-ve-yasal-uyarı)

---

## ✨ Temel Özellikler

| Özellik | Açıklama |
| :--- | :--- |
| 🔌 **Otomatik Chrome Eklentisi Köprüsü** | DevTools açıp cookie kopyalama derdine son! Eklenti, R10 oturum çerezlerini, CSRF güvenlik tokenını ve User-Agent bilgisini WebSocket / HTTP üzerinden yerel MCP sunucunuza aktarır. |
| ⚡ **Canlı Sekme Akışları** | R10 anasayfasındaki **Son Açılan Konular** (`sonAcilan`), **Son Cevaplananlar** (`sonCevaplanan`), **Popüler Konular** (`populer`) ve **Blog** sekmelerini anlık olarak çeker. |
| 🔎 **Gelişmiş Forum İçi Arama** | R10'un yerel arama altyapısını kullanarak tüm forum genelinde kelime bazlı arama yapar. |
| 🎯 **Çok Sayfalı Akıllı Filtreleme** | Birden çok sayfayı aynı anda tarar; kategoriye, yazara veya başlık/içerik anahtar kelimelerine göre Türkçe karakter duyarlı filtreler. |
| 🔔 **Durum Bilgili Canlı Takip (Stateful Tracker)** | Önceden görülen konuları belleğinde tutar ve her sorguda yalnızca **yeni açılmış** konuları döndürür. Arka plan ajanları için mükemmeldir. |
| 📖 **Derin Konu ve Cevap Okuyucu** | Belirtilen konunun ilk mesajını ve son gelen cevapları HTML'den temizlenmiş, okunabilir metin formatında sunar. |
| 🛡️ **Otomatik İyileşen Tokenlar (Self-Healing)** | Token süresi dolarsa MCP sunucusu otomatik olarak yeni `securitytoken` alır ve isteği tekrar dener. |

---

## 🧩 Chrome Eklentisi ve Mimarisi

R10.net Cloudflare koruması ve dinamik `securitytoken` kullandığından, en stabil yöntem kullanıcının kendi tarayıcısındaki geçerli oturumu kullanmaktır. Bu projedeki **Chrome Eklentisi (Manifest V3)**, tarayıcınız ile yerel MCP sunucusu arasında güvenli bir köprü görevi görür:

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Asistanı                            │
│       (Claude Desktop, Cursor, Antigravity, Cline)          │
└──────────────────────────────┬──────────────────────────────┘
                               │  Standart JSON-RPC (Stdio)
┌──────────────────────────────▼──────────────────────────────┐
│                    R10 MCP Server (Node.js)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ src/index.js (Stdio Server & Tool Kayıtları)           │ │
│  └──────────────┬───────────────────────────┬─────────────┘ │
│                 │                           │               │
│  ┌──────────────▼───────────┐ ┌─────────────▼─────────────┐ │
│  │ src/r10-client.js        │ │ src/sync-server.js        │ │
│  │ (Parser, Cache, Arama)   │ │ (HTTP & WS Port 9922)     │ │
│  └──────────────┬───────────┘ └─────────────▲─────────────┘ │
│                 │                           │               │
│  ┌──────────────▼───────────┐               │ WebSocket /   │
│  │ src/config.js            │               │ HTTP POST     │
│  │ (Çerez & Runtime Config) │               │               │
│  └──────────────┬───────────┘               │               │
└─────────────────┼───────────────────────────┼───────────────┘
                  │                           │
                  │ HTTPS İstekleri           │
┌─────────────────▼───────────┐ ┌─────────────┴─────────────┐
│     R10.net Cloudflare      │ │  Chrome Extension (MV3)   │
│  (ajax.php / search.php)    │ │  (extension/ klasörü)     │
└─────────────────────────────┘ └───────────────────────────┘
```

---

## 🛠️ Adım Adım Kurulum Kılavuzu (Türkçe)

### 1. Projeyi Klonlayın ve Bağımlılıkları Yükleyin

Terminal veya PowerShell açın:

```bash
git clone https://github.com/yusuf-polat/r10-konu-takip.git
cd r10-konu-takip
npm install
```

---

### 2. Chrome Eklentisini Tarayıcıya Yükleme (Adım Adım)

Eklenti projenin içindeki `extension/` klasöründe hazır olarak yer almaktadır. Herhangi bir derleme (build) işlemine gerek yoktur.

1. **Google Chrome** (veya Brave, Microsoft Edge, Opera vb. Chromium tabanlı bir tarayıcı) açın.
2. Adres çubuğuna şunu yazıp `Enter` tuşuna basın:
   ```text
   chrome://extensions/
   ```
3. Sağ üst köşede bulunan **"Geliştirici Modu" (Developer Mode)** anahtarını **AÇIK** konuma getirin.
4. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
5. Açılan dosya seçme penceresinde indirdiğiniz projedeki `extension` klasörünü seçin:
   ```text
   Örnek: D:\r10-konu-takip\extension
   ```
6. Eklenti listesinde **"R10 MCP Sync Bridge"** kartını ve tarayıcı araç çubuğunuzda simgesini göreceksiniz.

---

### 3. Eklenti ile Tek Tıkla Senkronizasyon (Sıfır Manuel İşlem)

1. Tarayıcınızda yeni bir sekme açarak **[https://www.r10.net](https://www.r10.net)** adresine gidin ve üye girişi yapın.
2. Tarayıcınızın uzantılar bölümünden **R10 MCP Sync Bridge** simgesine tıklayın:
   - **MCP Server Durumu:** MCP sunucunuz (veya arka plan senkronizasyon sunucusu) çalışırken yeşil `Online (Port 9922)` olarak görünür.
   - **R10 Cookies:** Tespit edilen çerez sayısını gösterir.
3. **"Sync Now to MCP"** butonuna basın.
4. Ekranda **"Successfully synced to MCP Server!"** yazısını göreceksiniz.
5. Dilerseniz açılır penceredeki **"Auto-Sync on R10 visit"** seçeneğini açık bırakabilirsiniz; böylece siz R10'da gezinirken oturum bilgileriniz arka planda daima güncel kalır.

> 💡 **İpucu:** Eğer yapay zeka aracınız henüz açık değilken sadece eklenti köprüsünü başlatıp senkronize etmek isterseniz terminalden şunu çalıştırabilirsiniz:
> ```bash
> npm run sync-server
> ```

---

### 4. Alternatif: Manuel .env Yapılandırması (Sunucu / Headless)

Eğer eklenti kullanmak istemiyorsanız veya sunucu ortamında çalışıyorsanız:

1. `.env.example` dosyasını `.env` olarak kopyalayın:
   ```bash
   cp .env.example .env
   ```
2. Tarayıcınızda R10'a giriş yapıp `F12` (Geliştirici Araçları) -> **Network** sekmesine gelin.
3. Sayfayı yenileyip bir istekteki `Cookie` başlığını kopyalayın ve `.env` içindeki `R10_COOKIE` alanına yapıştırın:
   ```env
   R10_COOKIE="RID=...; r10userid=...; cf_clearance=...; vbseo_loggedin=yes"
   R10_SECURITY_TOKEN="1780000000-abcdef0123456789..."
   R10_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
   ```

---

## 🤖 Yapay Zeka İstemcilerine Entegrasyon

### Claude Desktop

Aşağıdaki yapılandırma dosyasını açın:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Dosyaya sunucuyu ekleyin:

```json
{
  "mcpServers": {
    "r10-takip": {
      "command": "node",
      "args": ["D:/r10-konu-takip/src/index.js"]
    }
  }
}
```
*(Yolu kendi proje konumunuza göre güncelleyin).*  
Claude Desktop'ı yeniden başlattığınızda sağ altta çekiç (⚒️) simgesinde R10 araçları listelenecektir.

---

### Cursor IDE

1. Cursor Ayarlarını açın (`Ctrl + ,` veya `Cmd + ,`).
2. **Features** $\rightarrow$ **MCP Servers** $\rightarrow$ **Add New MCP Server** yolunu izleyin:
   - **Name:** `r10-takip`
   - **Type:** `command`
   - **Command:** `node D:/r10-konu-takip/src/index.js`
3. Kaydedin. Durum ışığı yeşile dönecektir.

---

### Google Antigravity / Gemini CLI

Projenin kök dizinindeki veya `.gemini` altındaki `mcp_config.json` içine ekleyin:

```json
{
  "mcpServers": {
    "r10-takip": {
      "command": "node",
      "args": ["D:/r10-konu-takip/src/index.js"]
    }
  }
}
```

---

### Cline / Roo Code / Windsurf

Kullandığınız eklentinin MCP ayarlar dosyasına (`cline_mcp_settings.json` vb.) ekleyin:

```json
{
  "mcpServers": {
    "r10-takip": {
      "command": "node",
      "args": ["D:/r10-konu-takip/src/index.js"]
    }
  }
}
```

---

## 🧰 MCP Araçları Referansı (Tools)

Sunucu yapay zekaya 6 güçlü fonksiyon sunar:

### 1. `r10_get_latest_threads`
Seçilen anasayfa sekmesinden en güncel konuları çeker.
- **Parametreler:**
  - `tab` *(string)*: `"sonAcilan"`, `"sonCevaplanan"`, `"populer"`, `"blog"` (Varsayılan: `"sonAcilan"`).
  - `page` *(number)*: Sayfa numarası (Varsayılan: `1`).
  - `limit` *(number)*: Getirilecek maksimum konu adedi.

### 2. `r10_search_threads`
R10 genelinde anahtar kelime araması yapar.
- **Parametreler:**
  - `query` *(string, Zorunlu)*: Aranacak ifade (Örn: `"Python bot"`, `"ücretsiz backlink"`).
  - `limit` *(number)*: Sonuç limiti (Varsayılan: `15`).

### 3. `r10_filter_threads`
Birden fazla sayfayı tarayarak kategori, yazar ve anahtar kelimeye göre filtreler.
- **Parametreler:**
  - `keyword` *(string)*: Başlık veya önizleme metninde aranacak kelime.
  - `category` *(string)*: Kategori adı (Örn: `"Yazılım ve Web Hizmetleri"`, `"Off-Topic"`).
  - `author` *(string)*: Konuyu açan kullanıcı adı.
  - `tab` *(string)*: Hangi sekmede taranacağı (Varsayılan: `"sonAcilan"`).
  - `maxPages` *(number)*: Taranacak sayfa derinliği (Varsayılan: `3`).

### 4. `r10_track_new_threads`
Canlı izleme aracı. Daha önce listelenen konuları hafızada tutar ve her çağrıldığında **sadece yeni açılmış** konuları getirir.
- **Parametreler:**
  - `tab` *(string)*: İzlenecek sekme.
  - `category` *(string)*: İsteğe bağlı kategori filtresi.
  - `keyword` *(string)*: İsteğe bağlı kelime filtresi.
  - `reset` *(boolean)*: Takip hafızasını sıfırlayıp mevcut durumu başlangıç kabul eder.

### 5. `r10_get_thread_details`
Belirtilen konunun ilk mesajını ve son üye cevaplarını temiz metin olarak çeker.
- **Parametreler:**
  - `threadUrlOrId` *(string, Zorunlu)*: Konunun tam URL'si veya konu ID numarası (Örn: `"4881102"`).

### 6. `r10_get_categories`
Aktif sayfalardaki konu dağılımını analiz ederek en hareketli kategorileri ve konu sayılarını listeler.
- **Parametreler:**
  - `tab` *(string)*: Sekme (Varsayılan: `"sonAcilan"`).
  - `pages` *(number)*: İncelenecek sayfa sayısı (Varsayılan: `3`).

---

## 💬 Örnek Komutlar ve Promptlar

Yapay zeka asistanınıza doğrudan şu cümlelerle talimat verebilirsiniz:

- 🗣️ *"R10'da son açılan 5 konuyu başlıkları ve kategorileriyle listele."*
- 🗣️ *"R10'da 'yapay zeka' veya 'gemini api' hakkında açılmış konuları ara ve özetle."*
- 🗣️ *"'Yazılım ve Web Hizmetleri' kategorisinde yeni konu açılırsa beni uyar, canlı takip et."*
- 🗣️ *"4874052 numaralı R10 konusunun detayını oku, konudaki sorunu ve verilen çözümleri bana açıkla."*
- 🗣️ *"R10 anasayfasında şu an en çok hangi kategorilerde konu açılıyor?"*

---

## 🔍 Sıkça Sorulan Sorular ve Sorun Giderme

#### S: "R10 Güvenlik Token hatası" uyarısı alıyorum, ne yapmalıyım?
**C:** R10 oturum tokenınızın süresi dolmuş olabilir. Tarayıcınızda R10.net'i yenileyin ve Chrome eklentisinden **"Sync Now to MCP"** butonuna basın. Sunucu yeni tokenı otomatik olarak kaydedecektir.

#### S: Cloudflare 403 Forbidden hatası alıyorum.
**C:** Cloudflare tarayıcı doğrulaması istemiş olabilir. Tarayıcınızda R10.net'i ziyaret edip doğrulama varsa geçin, ardından eklentiden senkronizasyonu yenileyin. Eklenti User-Agent değerinizi birebir aktararak Cloudflare engellerini aşar.

#### S: Chrome eklentisinde "Server Offline" yazıyor.
**C:** MCP sunucusu yapay zeka aracınız (Claude/Cursor) çalıştığında otomatik başlar. Eğer bağımsız olarak eklentiyle senkronizasyon yapmak isterseniz terminalde `npm run sync-server` komutunu çalıştırabilirsiniz.

#### S: Port 9922 çakışması uyarısı alıyorum.
**C:** Sunucu çoklu istemci çalıştırdığınızda (EADDRINUSE) hatası almamak için güvenli port kontrolüne sahiptir. Eğer port başka bir işlem tarafından kullanılıyorsa `.env` dosyasına `MCP_SYNC_PORT=9923` yazarak portu değiştirebilirsiniz.

---

## 🌐 English Documentation Summary

<details>
<summary>Click to expand English quickstart</summary>

### Features:
- Real-time forum tracking via R10.net native AJAX endpoints.
- Companion Chrome Extension (Manifest V3) that auto-syncs session cookies, User-Agent, and CSRF `securitytoken` over WebSocket/HTTP.
- 6 complete MCP tools: `r10_get_latest_threads`, `r10_search_threads`, `r10_filter_threads`, `r10_track_new_threads`, `r10_get_thread_details`, `r10_get_categories`.

### Quick Setup:
1. `git clone https://github.com/yusuf-polat/r10-konu-takip.git`
2. `cd r10-konu-takip && npm install`
3. Load the `extension/` directory into Chrome via `chrome://extensions/` (Developer Mode $\rightarrow$ Load Unpacked).
4. Login to R10.net, click the extension icon, and click **"Sync Now to MCP"**.
5. Add `node <PATH_TO>/src/index.js` to your Claude Desktop or Cursor MCP config.

</details>

---

## 📄 Lisans ve Yasal Uyarı

Bu proje **[MIT Lisansı](LICENSE)** ile lisanslanmıştır.

**Yasal Uyarı:** Bu proje R10.net ile resmi bir bağı olmayan açık kaynaklı bir topluluk aracıdır. R10.net platformunun kullanım şartlarına ve makul istek sıklığı kurallarına uymak kullanıcının kendi sorumluluğundadır.

#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const {
  fetchHomepageTab,
  filterThreads,
  trackNewThreads,
  fetchThreadDetails,
  searchThreads,
  getCategories
} = require('./r10-client.js');

const { startSyncServer } = require('./sync-server.js');

const server = new Server(
  {
    name: 'r10-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Kullanılabilir MCP Araçlarının Listesi
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'r10_get_latest_threads',
        description: 'R10.net üzerindeki son açılan veya son cevaplanan konuları listeler.',
        inputSchema: {
          type: 'object',
          properties: {
            tab: {
              type: 'string',
              enum: ['sonAcilan', 'sonCevaplanan', 'populer', 'blog'],
              description: 'Görüntülenecek sekme (varsayılan: sonAcilan)',
              default: 'sonAcilan',
            },
            page: {
              type: 'number',
              description: 'Sayfa numarası (varsayılan: 1)',
              default: 1,
            },
            limit: {
              type: 'number',
              description: 'Maksimum gösterilecek konu sayısı (opsiyonel)',
            },
          },
        },
      },
      {
        name: 'r10_search_threads',
        description: 'R10 forum genelinde arama motorunu kullanarak anahtar kelimeye göre konuları arar.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Aranacak kelime veya ifade (örn: "ücretsiz api", "gemini key", "backlink")',
            },
            limit: {
              type: 'number',
              description: 'Döndürülecek maksimum sonuç sayısı (varsayılan: 15)',
              default: 15,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'r10_filter_threads',
        description: 'R10 güncel akışında anahtar kelime, kategori adı veya yazar adına göre arama/filtreleme yapar.',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Konu başlığında veya ilk mesaj özetinde aranacak kelime (örn: Yapay Zeka, Backlink, Freelance)',
            },
            category: {
              type: 'string',
              description: 'Kategori adı (örn: Yazılım ve Web Hizmetleri, Off-Topic, Google Optimizasyon)',
            },
            author: {
              type: 'string',
              description: 'Konuyu açan yazarın kullanıcı adı',
            },
            tab: {
              type: 'string',
              enum: ['sonAcilan', 'sonCevaplanan', 'populer', 'blog'],
              description: 'Taranacak sekme (varsayılan: sonAcilan)',
              default: 'sonAcilan',
            },
            maxPages: {
              type: 'number',
              description: 'Geriye doğru taranacak maksimum sayfa sayısı (varsayılan: 3)',
              default: 3,
            },
          },
        },
      },
      {
        name: 'r10_track_new_threads',
        description: 'Canlı R10 konu takipçisi. Her çağrıldığında yalnızca son kontrolden sonra YENİ AÇILAN konuları getirir.',
        inputSchema: {
          type: 'object',
          properties: {
            tab: {
              type: 'string',
              enum: ['sonAcilan', 'sonCevaplanan', 'populer'],
              description: 'Takip edilecek sekme (varsayılan: sonAcilan)',
              default: 'sonAcilan',
            },
            category: {
              type: 'string',
              description: 'Yalnızca belirli bir kategorideki yenileri takip etmek için kategori adı',
            },
            keyword: {
              type: 'string',
              description: 'Yalnızca belirli bir kelimeyi içeren yenileri takip etmek için filtre',
            },
            reset: {
              type: 'boolean',
              description: 'Takip durumunu sıfırla ve şu anki konuları başlangıç noktası olarak al',
              default: false,
            },
          },
        },
      },
      {
        name: 'r10_get_thread_details',
        description: 'Belirli bir R10 konusunun detaylarını, ilk mesajını ve gelen son yanıtları tam metin olarak okur.',
        inputSchema: {
          type: 'object',
          properties: {
            threadUrlOrId: {
              type: 'string',
              description: 'Konunun URL adresi veya konu ID numarası (örn: "4881102" veya "yazilim-web-hizmetleri/4881102-...html")',
            },
          },
          required: ['threadUrlOrId'],
        },
      },
      {
        name: 'r10_get_categories',
        description: 'R10 güncel akışında aktif olan kategorileri ve konu sayılarını listeler.',
        inputSchema: {
          type: 'object',
          properties: {
            tab: {
              type: 'string',
              enum: ['sonAcilan', 'populer'],
              description: 'Sekme adı (varsayılan: sonAcilan)',
              default: 'sonAcilan',
            },
            pages: {
              type: 'number',
              description: 'Taranacak sayfa sayısı (varsayılan: 3)',
              default: 3,
            },
          },
        },
      },
    ],
  };
});

/**
 * Araç Çağrılarının (Tool Calls) İşlenmesi
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'r10_get_latest_threads': {
        const tab = args?.tab || 'sonAcilan';
        const page = Number(args?.page) || 1;
        const limit = args?.limit ? Number(args?.limit) : null;

        const data = await fetchHomepageTab({ tab, page });
        let threads = data.threads;
        if (limit && limit > 0) {
          threads = threads.slice(0, limit);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sekme: tab,
                  sayfa: page,
                  toplam: threads.length,
                  konular: threads,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'r10_search_threads': {
        const query = args?.query;
        if (!query) throw new Error('query parametresi zorunludur.');
        const limit = Number(args?.limit) || 15;
        const result = await searchThreads(query, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'r10_filter_threads': {
        const { keyword, category, author, tab = 'sonAcilan', maxPages = 3 } = args || {};
        const result = await filterThreads({
          keyword,
          category,
          author,
          tab,
          maxPages: Number(maxPages) || 3,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'r10_track_new_threads': {
        const { tab = 'sonAcilan', category, keyword, reset = false } = args || {};
        const trackResult = await trackNewThreads({
          tab,
          category,
          keyword,
          reset: Boolean(reset),
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(trackResult, null, 2),
            },
          ],
        };
      }

      case 'r10_get_thread_details': {
        const threadUrlOrId = args?.threadUrlOrId;
        if (!threadUrlOrId) {
          throw new Error('threadUrlOrId parametresi zorunludur.');
        }

        const details = await fetchThreadDetails(threadUrlOrId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      case 'r10_get_categories': {
        const tab = args?.tab || 'sonAcilan';
        const pages = Number(args?.pages) || 3;
        const categories = await getCategories({ tab, pages });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Bilinmeyen araç: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `[Hata - ${name}]: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Sunucuyu Stdio Üzerinden Başlat
 */
async function main() {
  // Start local sync server for Chrome Extension (HTTP & WebSocket)
  try {
    startSyncServer();
  } catch (syncErr) {
    console.error('[R10 MCP Server] Sync Server warning:', syncErr.message);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[R10 MCP Server] Sunucu Stdio üzerinden başarıyla başlatıldı.');
}

main().catch((err) => {
  console.error('[R10 MCP Server] Kritik Başlangıç Hatası:', err);
  process.exit(1);
});

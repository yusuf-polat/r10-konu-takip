const cheerio = require('cheerio');
const { config, refreshSecurityToken } = require('./config.js');

// Son görülen konuları bellekte tutan Set (canlı takip için)
const seenThreadIds = new Set();
let trackerInitialized = false;

/**
 * R10 Anasayfa sekmesinden konuları çeker.
 * Desteklenen sekmeler: 'sonAcilan', 'sonCevaplanan', 'populer', 'blog'
 */
async function fetchHomepageTab({ tab = 'sonAcilan', page = 1, filter = 1, retryOnTokenError = true } = {}) {
  const url = `${config.baseUrl}/ajax.php?do=anasayfaTab`;
  const bodyParams = new URLSearchParams({
    do: 'anasayfaTab',
    id: tab,
    page: String(page),
    filter: String(filter),
    securitytoken: config.securityToken
  });

  const headers = {
    'accept': 'application/xml, text/xml, */*; q=0.01',
    'accept-language': 'tr,en;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': config.baseUrl,
    'referer': `${config.baseUrl}/`,
    'user-agent': config.userAgent,
    'x-requested-with': 'XMLHttpRequest',
    'cookie': config.cookie
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyParams.toString()
  });

  if (!response.ok) {
    throw new Error(`R10 isteği başarısız oldu: HTTP ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();

  // Güvenlik token hatası kontrolü
  if (xmlText.includes('güvenlik token') || xmlText.includes('securitytoken')) {
    if (retryOnTokenError) {
      console.error('[R10 Client] SecurityToken geçersiz, yenileniyor...');
      const newToken = await refreshSecurityToken();
      if (newToken && newToken !== config.securityToken) {
        return fetchHomepageTab({ tab, page, filter, retryOnTokenError: false });
      }
    }
    throw new Error('R10 Güvenlik Token hatası. Lütfen .env dosyasındaki R10_COOKIE ve R10_SECURITY_TOKEN değerlerini güncelleyin.');
  }

  // CDATA içerisindeki HTML içeriğini al
  const match = xmlText.match(/<icerik><!\[CDATA\[([\s\S]*?)\]\]><\/icerik>/);
  if (!match) {
    return {
      tab,
      page,
      threads: [],
      rawXml: xmlText
    };
  }

  const html = match[1];
  const $ = cheerio.load(html, null, false);
  const threads = [];

  $('li.thread').each((_, el) => {
    const $el = $(el);
    const rawId = $el.attr('id') || '';
    const threadId = rawId.replace('thread-', '');

    const $mainLink = $el.find('ol > li:first-child a[rel="ugc"]').first();
    const relHref = $mainLink.attr('href') || '';
    const threadUrl = relHref.startsWith('http') ? relHref : `${config.baseUrl}/${relHref}`;

    const $avatarImg = $mainLink.find('.avatar img');
    const avatarUrl = $avatarImg.attr('src') || '';
    const isOnline = $mainLink.find('.avatar .status.on').length > 0;

    const $tooltip = $mainLink.find('.title .titleTooltip');
    const preview = ($tooltip.attr('data-original-title') || '').trim();

    // Başlık metnini temizle
    const $titleClone = $tooltip.clone();
    $titleClone.find('span').remove();
    const title = $titleClone.text().trim();

    // Yanıt ve görüntülenme sayıları
    const $statsLi = $el.find('ol > li:nth-child(2)');
    const replies = parseInt($statsLi.find('span[title="Cevap Sayısı"]').text().trim(), 10) || 0;
    const views = parseInt($statsLi.find('span[title="Görüntülenme Sayısı"]').text().trim(), 10) || 0;

    // Yazar
    const $authorLi = $el.find('ol > li:nth-child(3)');
    const $authorLink = $authorLi.find('a');
    const author = $authorLink.text().trim();
    const authorUrl = $authorLink.attr('href') ? `${config.baseUrl}/${$authorLink.attr('href')}` : '';

    // Kategori
    const $categoryLi = $el.find('ol > li:nth-child(4)');
    const $categoryLink = $categoryLi.find('a');
    const category = $categoryLink.text().trim();
    const categoryUrl = $categoryLink.attr('href') ? `${config.baseUrl}/${$categoryLink.attr('href')}` : '';

    threads.push({
      id: threadId,
      title,
      url: threadUrl,
      preview,
      author,
      authorUrl,
      avatarUrl,
      isOnline,
      replies,
      views,
      category,
      categoryUrl
    });
  });

  return {
    tab,
    page,
    count: threads.length,
    threads
  };
}

/**
 * Başlık, kategori veya yazar bazında filtreleme yapar.
 * Birden fazla sayfayı tarayabilir.
 */
async function filterThreads({ keyword, category, author, tab = 'sonAcilan', maxPages = 3 } = {}) {
  const results = [];
  const normalizedKeyword = keyword ? keyword.toLocaleLowerCase('tr-TR') : null;
  const normalizedCategory = category ? category.toLocaleLowerCase('tr-TR') : null;
  const normalizedAuthor = author ? author.toLocaleLowerCase('tr-TR') : null;

  for (let p = 1; p <= maxPages; p++) {
    const pageData = await fetchHomepageTab({ tab, page: p });
    if (!pageData.threads || pageData.threads.length === 0) break;

    for (const thread of pageData.threads) {
      let matches = true;

      if (normalizedKeyword) {
        const titleLower = thread.title.toLocaleLowerCase('tr-TR');
        const previewLower = thread.preview.toLocaleLowerCase('tr-TR');
        if (!titleLower.includes(normalizedKeyword) && !previewLower.includes(normalizedKeyword)) {
          matches = false;
        }
      }

      if (matches && normalizedCategory) {
        const catLower = thread.category.toLocaleLowerCase('tr-TR');
        if (!catLower.includes(normalizedCategory)) {
          matches = false;
        }
      }

      if (matches && normalizedAuthor) {
        const authorLower = thread.author.toLocaleLowerCase('tr-TR');
        if (!authorLower.includes(normalizedAuthor)) {
          matches = false;
        }
      }

      if (matches) {
        results.push(thread);
      }
    }
  }

  return {
    query: { keyword, category, author, tab, maxPages },
    totalFound: results.length,
    threads: results
  };
}

/**
 * Canlı konu takipçisi (Tracker).
 * Her çağrıldığında yalnızca son kontrolden sonra AÇILMIŞ YENİ konuları döner.
 */
async function trackNewThreads({ tab = 'sonAcilan', category, keyword, reset = false } = {}) {
  const pageData = await fetchHomepageTab({ tab, page: 1 });
  const allThreads = pageData.threads || [];

  // İlk çalıştırma veya sıfırlama talebi
  if (reset || !trackerInitialized) {
    seenThreadIds.clear();
    for (const t of allThreads) {
      seenThreadIds.add(t.id);
    }
    trackerInitialized = true;
    return {
      status: 'initialized',
      message: 'Canlı takip başlatıldı. Şu anki konular hafızaya alındı. Bir sonraki çağrıda yalnızca yeni açılan konular listelenecek.',
      currentlyTrackingCount: seenThreadIds.size,
      latestThreadId: allThreads[0]?.id || null,
      latestThreadTitle: allThreads[0]?.title || null
    };
  }

  // Yeni konuları tespit et (Daha önce görülmemiş olanlar)
  const newThreads = [];
  const normalizedKeyword = keyword ? keyword.toLocaleLowerCase('tr-TR') : null;
  const normalizedCategory = category ? category.toLocaleLowerCase('tr-TR') : null;

  for (const thread of allThreads) {
    if (!seenThreadIds.has(thread.id)) {
      seenThreadIds.add(thread.id);

      // Filtre kontrolü
      let passFilter = true;
      if (normalizedKeyword) {
        const titleLower = thread.title.toLocaleLowerCase('tr-TR');
        const previewLower = thread.preview.toLocaleLowerCase('tr-TR');
        if (!titleLower.includes(normalizedKeyword) && !previewLower.includes(normalizedKeyword)) {
          passFilter = false;
        }
      }
      if (passFilter && normalizedCategory) {
        const catLower = thread.category.toLocaleLowerCase('tr-TR');
        if (!catLower.includes(normalizedCategory)) {
          passFilter = false;
        }
      }

      if (passFilter) {
        newThreads.push(thread);
      }
    }
  }

  return {
    status: 'active',
    newThreadCount: newThreads.length,
    hasNewThreads: newThreads.length > 0,
    threads: newThreads,
    totalSeenThreads: seenThreadIds.size,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Belirli bir konunun tüm detaylarını (ilk mesaj, yazar, yanıtlar) çeker.
 */
async function fetchThreadDetails(threadUrlOrId) {
  let url = threadUrlOrId;
  if (!url.startsWith('http')) {
    if (/^\d+$/.test(url)) {
      url = `${config.baseUrl}/x/${url}-post1.html`;
    } else {
      url = `${config.baseUrl}/${url.replace(/^\//, '')}`;
    }
  }

  const response = await fetch(url, {
    headers: {
      'user-agent': config.userAgent,
      'cookie': config.cookie
    }
  });

  if (!response.ok) {
    throw new Error(`Konu sayfası getirilemedi: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || $('title').text().trim();

  // İlk mesaj
  const $firstPost = $('.postList .post, .messageList .message, .post').first();
  const author = $firstPost.find('a.uToggle, .username').first().text().trim() || 'Bilinmiyor';
  const postDate = $firstPost.find('.postDate, .date, .postHead').first().text().trim().replace(/\s+/g, ' ');
  const $content = $firstPost.find('.postContent, .messageContent, .userMessage').first();
  
  // Mesaj içeriğindeki gereksiz boşlukları temizle
  const contentText = $content.text().replace(/\n\s*\n/g, '\n').trim();

  // Sonraki yanıtlar (İlk 5 yanıt)
  const replies = [];
  $('.postList .post, .messageList .message, .post').slice(1, 6).each((idx, postEl) => {
    const $p = $(postEl);
    const replyAuthor = $p.find('a.uToggle, .username').first().text().trim();
    const replyDate = $p.find('.postDate, .date, .postHead').first().text().trim().replace(/\s+/g, ' ');
    const replyContent = $p.find('.postContent, .messageContent, .userMessage').first().text().replace(/\n\s*\n/g, '\n').trim();
    if (replyAuthor && replyContent) {
      replies.push({
        author: replyAuthor,
        date: replyDate,
        content: replyContent.slice(0, 500)
      });
    }
  });

  return {
    url,
    title,
    author,
    date: postDate,
    content: contentText,
    replyCount: replies.length,
    recentReplies: replies
  };
}

/**
 * R10 dahili arama motorunu kullanarak tüm forumda arama yapar.
 */
async function searchThreads(query, limit = 20) {
  const url = `${config.baseUrl}/search.php?do=process`;
  const body = new URLSearchParams({
    query: query,
    securitytoken: config.securityToken,
    do: 'process'
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': config.userAgent,
      'cookie': config.cookie
    },
    body: body.toString()
  });

  if (!res.ok) {
    throw new Error(`Arama gerçekleştirilemedi: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const threads = [];
  $('a[href*=".html"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    // Konu linki eşleşmesi: /kategori/123456-konu-basligi.html
    if (href.match(/\/\d+-[^"']+\.html/) && !href.includes('profil/') && text.length > 8) {
      const fullUrl = href.startsWith('http') ? href : `${config.baseUrl}/${href.replace(/^\//, '')}`;
      if (!threads.some(t => t.url === fullUrl)) {
        const parts = href.replace(/^\//, '').split('/');
        const categorySlug = parts.length > 1 ? parts[0] : 'Genel';
        threads.push({
          title: text,
          url: fullUrl,
          category: categorySlug
        });
      }
    }
  });

  return {
    query,
    totalFound: threads.length,
    threads: threads.slice(0, limit)
  };
}

/**
 * Son konularda öne çıkan kategorileri listeler.
 */
async function getCategories({ tab = 'sonAcilan', pages = 3 } = {}) {
  const categoryMap = new Map();

  for (let p = 1; p <= pages; p++) {
    const data = await fetchHomepageTab({ tab, page: p });
    if (!data.threads) break;

    for (const t of data.threads) {
      if (t.category) {
        const count = categoryMap.get(t.category) || 0;
        categoryMap.set(t.category, count + 1);
      }
    }
  }

  const sortedCategories = [...categoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    scannedPages: pages,
    totalCategories: sortedCategories.length,
    categories: sortedCategories
  };
}

module.exports = {
  fetchHomepageTab,
  filterThreads,
  trackNewThreads,
  fetchThreadDetails,
  searchThreads,
  getCategories
};

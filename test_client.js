const { fetchHomepageTab, filterThreads, trackNewThreads, getCategories } = require('./src/r10-client.js');

async function run() {
  console.log('1. Testing fetchHomepageTab...');
  const latest = await fetchHomepageTab({ tab: 'sonAcilan', page: 1 });
  console.log(`Fetched ${latest.count} threads from page 1. First thread:`, latest.threads[0]?.title);

  console.log('\n2. Testing filterThreads (e.g. search "web" or "seo")...');
  const search = await filterThreads({ keyword: 'web', maxPages: 2 });
  console.log(`Found ${search.totalFound} matching threads.`);

  console.log('\n3. Testing trackNewThreads (initialization)...');
  const trackerInit = await trackNewThreads();
  console.log('Tracker init status:', trackerInit.status, 'Tracking count:', trackerInit.currentlyTrackingCount);

  console.log('\n4. Testing getCategories...');
  const cats = await getCategories({ pages: 2 });
  console.log(`Found ${cats.totalCategories} categories. Top 3:`, cats.categories.slice(0, 3));
  
  console.log('\nAll tests passed successfully!');
}

run().catch(console.error);

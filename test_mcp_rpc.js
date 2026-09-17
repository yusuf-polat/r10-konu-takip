const { spawn } = require('child_process');
const path = require('path');

async function testMcpServer() {
  const serverProcess = spawn('node', [path.join(__dirname, 'src/index.js')], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let buffer = '';

  serverProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep remainder

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        console.log('[MCP Server Yanıtı]:', json.id, json.result ? Object.keys(json.result) : json.error);
        if (json.id === 1) {
          // Initialize response received -> send tools/list
          console.log('Sunucu initialize oldu. tools/list isteniyor...');
          send({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
          });
        } else if (json.id === 2) {
          // Tools list received -> call r10_get_latest_threads
          const toolNames = json.result.tools.map(t => t.name);
          console.log('Mevcut Araçlar:', toolNames);
          console.log('\nr10_get_latest_threads çağrılıyor (limit=2)...');
          send({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'r10_get_latest_threads',
              arguments: {
                tab: 'sonAcilan',
                page: 1,
                limit: 2
              }
            }
          });
        } else if (json.id === 3) {
          console.log('\nTool sonucu alındı:');
          const parsedContent = JSON.parse(json.result.content[0].text);
          console.log('Konu Sayısı:', parsedContent.konular.length);
          console.log('İlk Konu Başlığı:', parsedContent.konular[0]?.title);
          console.log('İlk Konu Kategorisi:', parsedContent.konular[0]?.category);
          console.log('İlk Konu Yazarı:', parsedContent.konular[0]?.author);
          console.log('\nTEST BAŞARIYLA TAMAMLANDI!');
          serverProcess.kill();
          process.exit(0);
        }
      } catch (e) {
        console.error('Parse error:', e.message, 'line:', line);
      }
    }
  });

  function send(obj) {
    serverProcess.stdin.write(JSON.stringify(obj) + '\n');
  }

  // Send initialize request
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test-client', version: '1.0.0' },
      capabilities: {}
    }
  });
}

testMcpServer().catch(console.error);

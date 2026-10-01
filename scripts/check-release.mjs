// Run against a separate in-memory database; never writes to the local MySQL database.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
process.env.DB_DRIVER = 'demo';
process.env.SQLITE_PATH = ':memory:';
delete process.env.SEED_ADMIN_PASSWORD;
delete process.env.SEED_CUSTOMER_PASSWORD;
const { initSchema, closeDb } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { startHttpServer } = await import('../server/http-server.js');
let running;
try {
  assert.ok(existsSync(resolve('dist/index.html')), 'Chưa có bản build. Chạy npm.cmd run build trước.');
  await initSchema(); await seed();
  running = await startHttpServer(createApp(), { port: 0 });
  const base = `http://127.0.0.1:${running.server.address().port}`;
  const html = await (await fetch(base)).text();
  assert.ok(html.includes('Tea House'));
  const assets = [...html.matchAll(/(?:src|href)="(\/[^\"]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith('.js')));
  assert.ok(assets.some(path => path.endsWith('.css')));
  for (const path of [...assets, '/receipt.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  }
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.ok, true);
  const catalog = await (await fetch(base + '/api/catalog')).json();
  assert.equal(catalog.products.length, 12);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@teahouse.local', password: 'Admin@12345' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const report = await fetch(base + '/api/admin/reports', { headers: { Cookie: cookie } });
  assert.equal(report.status, 200);
  const state = await report.json();
  assert.equal(state.revenue, 0);
  assert.equal((await fetch(base + '/api/admin/reports/export.csv', { headers: { Cookie: cookie } })).status, 200);
  console.log('PASS bản build: HTML, JavaScript, CSS, favicon, script in, API, đăng nhập quản trị và báo cáo.');
  console.log('Kiểm tra dùng database tạm; dữ liệu MySQL của bạn không bị thay đổi.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (running) await running.stop(); await closeDb(); }

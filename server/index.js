import { initSchema, driver, closeDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';
import { startHttpServer } from './http-server.js';
try {
  await initSchema();
  if(driver==='demo')await seed();
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  const { server, stop } = await startHttpServer(createApp(), { port, host });
  console.log(`Tea House: http://${host}:${server.address().port} | database: ${driver}`);
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    try { await stop(); await closeDb(); console.log('Tea House đã dừng.'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch(e){
  if (e.code === 'EADDRINUSE') console.error('Cổng đang được sử dụng. Kiểm tra cửa sổ Tea House đã mở trước khi chạy thêm.');
  else console.error(`Không thể khởi động: ${e.message}\nKiểm tra .env hoặc hướng dẫn trong README.`);
  await closeDb();
  process.exitCode=1;
}

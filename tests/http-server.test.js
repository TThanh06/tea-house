import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHttpServer } from '../server/http-server.js';

test('server stops cleanly and repeated stop is safe', async () => {
  const { server, stop } = await startHttpServer((req, res) => res.end('ready'), { port: 0 });
  const address = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(address)).text(), 'ready');
  await Promise.all([stop(), stop()]);
  assert.equal(server.listening, false);
});

test('occupied port rejects startup instead of leaving a second server running', async () => {
  const first = await startHttpServer((req, res) => res.end(), { port: 0 });
  try {
    await assert.rejects(startHttpServer((req, res) => res.end(), { port: first.server.address().port }), { code: 'EADDRINUSE' });
  } finally { await first.stop(); }
});

test('invalid port is rejected before starting HTTP server', async () => {
  for (const port of ['wrong', -1, 65536, 1.2]) await assert.rejects(startHttpServer(() => {}, { port }));
});

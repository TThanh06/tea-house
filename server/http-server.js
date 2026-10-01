import { createServer } from 'node:http';

export async function startHttpServer(handler, { host = '127.0.0.1', port = 3000 } = {}) {
  port = Number(port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
  }
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    const failed = error => reject(error);
    server.once('error', failed);
    server.listen(port, host, () => {
      server.removeListener('error', failed);
      resolve();
    });
  });

  let closing;
  function stop() {
    if (closing) return closing;
    closing = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => server.closeAllConnections(), 5000);
      deadline.unref();
      server.close(error => {
        clearTimeout(deadline);
        if (error) reject(error); else resolve();
      });
      server.closeIdleConnections();
    });
    return closing;
  }
  return { server, stop };
}

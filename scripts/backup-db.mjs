import { db, driver, transaction, closeDb } from '../server/db.js';
import { tableNames } from './database-config.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
try {
  const tables = await transaction(async tx => {
    const result = {};
    const existing = driver === 'mysql'
      ? (await tx.all('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).map(row => row.name)
      : (await tx.all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name);
    for (const name of tableNames.filter(name => existing.includes(name))) result[name] = await tx.all(`SELECT * FROM ${name}`);
    return result;
  });
  const directory = resolve('data/db-backups');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json.gz`);
  await writeFile(path, gzipSync(JSON.stringify({ format: 'tea-house-logical-backup-v1', created_at: new Date().toISOString(), driver, tables })), { mode: 0o600, flag: 'wx' });
  console.log('Đã lưu bản sao dữ liệu cục bộ:', path);
  console.log('Không đưa thư mục data lên Git hoặc gửi kèm source.');
} finally { await closeDb(); }

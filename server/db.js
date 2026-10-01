import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { databasePassword } from '../scripts/database-config.mjs';

export const driver = process.env.DB_DRIVER || 'demo';
if (!['demo','mysql'].includes(driver)) throw new Error('DB_DRIVER must be demo or mysql');
let pool, sqlite;
if (driver === 'mysql') {
  const { default: mysql } = await import('mysql2/promise');
  pool = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'tea_house', password: databasePassword(process.env), database: process.env.DB_NAME || 'tea_house', connectionLimit: 5, charset: 'utf8mb4', decimalNumbers: true });
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const path = process.env.SQLITE_PATH || resolve('data/tea-house.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive:true });
  sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
}

function executor(connection) {
  return {
    async all(sql, params=[]) {
      if (driver === 'mysql') return (await connection.execute(sql, params))[0];
      return sqlite.prepare(sql).all(...params);
    },
    async run(sql, params=[]) {
      if (driver === 'mysql') return (await connection.execute(sql, params))[0];
      const r=sqlite.prepare(sql).run(...params); return { insertId:Number(r.lastInsertRowid), affectedRows:Number(r.changes) };
    }
  };
}
export const db=executor(pool);
let queue=Promise.resolve();
export async function transaction(fn) {
  if(driver==='mysql') {
    const conn=await pool.getConnection();
    try { await conn.beginTransaction(); const result=await fn(executor(conn)); await conn.commit(); return result; }
    catch(e) {await conn.rollback();throw e;} finally {conn.release();}
  }
  const job=queue.then(async()=>{
    sqlite.exec('BEGIN IMMEDIATE');
    try {const result=await fn(db);sqlite.exec('COMMIT');return result;} catch(e){sqlite.exec('ROLLBACK');throw e;}
  });
  queue=job.catch(()=>{});return job;
}
export async function closeDb(){if(pool)await pool.end();if(sqlite)sqlite.close();}

export async function initSchema() {
  const { applyMigrations } = await import('./migrations.js');
  if (driver === 'demo') return transaction(tx => applyMigrations(tx, driver));
  const connection = await pool.getConnection();
  const lockName = 'tea_house_schema_' + (process.env.DB_NAME || 'tea_house').slice(0, 45);
  let locked = false;
  try {
    const [[row]] = await connection.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
    if (Number(row.acquired) !== 1) throw new Error('Database migration đang được tiến trình khác sử dụng.');
    locked = true;
    await applyMigrations(executor(connection), driver);
  } finally {
    if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    connection.release();
  }
}

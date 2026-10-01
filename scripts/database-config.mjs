import { parseEnv } from 'node:util';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

export async function readEnvironment(path = resolve('.env')) {
  try { return parseEnv(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

export function databasePassword(env) {
  return env.DB_PASSWORD_BASE64
    ? Buffer.from(env.DB_PASSWORD_BASE64, 'base64').toString('utf8')
    : env.DB_PASSWORD || '';
}

export function connectionOptions(env) {
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL phải từ 1 đến 65535.');
  const database = env.DB_NAME || 'tea_house';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database)) throw new Error('Tên database chỉ dùng chữ, số và dấu gạch dưới, bắt đầu bằng chữ.');
  if (!env.DB_USER?.trim()) throw new Error('Chưa điền DB_USER.');
  return {
    host: env.DB_HOST || '127.0.0.1', port,
    user: env.DB_USER, password: databasePassword(env),
    database, charset: 'utf8mb4', connectTimeout: 5000,
  };
}

export function friendlyDatabaseError(error) {
  const messages = {
    ER_ACCESS_DENIED_ERROR: 'MySQL từ chối tài khoản hoặc mật khẩu. Kiểm tra lại thông tin dùng trong Workbench; không cần cài lại MySQL.',
    ER_DBACCESS_DENIED_ERROR: 'Tài khoản chưa có quyền truy cập hoặc tạo database này. Dùng tài khoản có quyền phù hợp trong Workbench.',
    ER_BAD_DB_ERROR: 'Database chưa tồn tại. Chạy CAU-HINH-MYSQL.cmd để tạo database riêng cho dự án.',
    ECONNREFUSED: 'Không kết nối được MySQL. Kiểm tra dịch vụ MySQL80, địa chỉ và cổng.',
    ETIMEDOUT: 'Kết nối MySQL quá thời gian chờ. Kiểm tra địa chỉ, cổng và dịch vụ.',
    ER_TABLEACCESS_DENIED_ERROR: 'Tài khoản chưa có quyền thao tác bảng của dự án.',
  };
  return messages[error.code] || `Không thể hoàn tất: ${error.code || error.message}`;
}

export const tableNames = [
  'users', 'sessions', 'categories', 'products', 'toppings', 'delivery_zones',
  'coupons', 'orders', 'order_items', 'order_history',
  'schema_migrations', 'store_settings',
];

// Read-only inspection. No passwords or existing customer records are returned.
export async function inspectDatabase(config) {
  const { database, ...options } = connectionOptions(config);
  const connection = await mysql.createConnection(options);
  try {
    const [[server]] = await connection.execute('SELECT VERSION() AS version');
    const [schemas] = await connection.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [database]);
    if (!schemas.length) return { exists: false, database, version: server.version, tables: [], users: 0 };
    const [tables] = await connection.execute('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [database]);
    const names = tables.map(row => row.name);
    const unexpected = names.filter(name => !tableNames.includes(name));
    if (unexpected.length) throw new Error('Database đã có bảng ngoài Tea House. Hãy chọn tên database riêng; không thay đổi dữ liệu đang có.');
    let users = 0;
    if (names.includes('users')) {
      const [columns] = await connection.execute('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [database, 'users']);
      if (!['id', 'name', 'email', 'password_hash', 'role', 'created_at'].every(name => columns.some(c => c.name === name))) {
        throw new Error('Bảng users không đúng cấu trúc Tea House. Hãy chọn database riêng.');
      }
      const [[count]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${database}\`.users`);
      users = Number(count.total);
    }
    return { exists: true, database, version: server.version, tables: names, users };
  } finally { await connection.end(); }
}

export async function createDatabase(config) {
  const { database, ...options } = connectionOptions(config);
  const connection = await mysql.createConnection(options);
  try {
    // Validated identifier; no DROP, user changes or global server configuration.
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally { await connection.end(); }
}

function envLine(key, value) {
  const string = String(value);
  for (const candidate of [string, `'${string}'`, `"${string}"`]) {
    const line = `${key}=${candidate}`;
    if (parseEnv(line)[key] === string && !string.includes('\n') && !string.includes('\r')) return line;
  }
  throw new Error(`Không thể lưu định dạng của ${key}; cấu hình hiện tại được giữ nguyên.`);
}

export async function saveEnvironment(config, cwd = process.cwd()) {
  const path = resolve(cwd, '.env');
  const previous = await readEnvironment(path);
  const next = { ...previous, DB_DRIVER: 'mysql', DB_HOST: config.DB_HOST,
    DB_PORT: String(config.DB_PORT), DB_NAME: config.DB_NAME, DB_USER: config.DB_USER,
    DB_PASSWORD_BASE64: Buffer.from(databasePassword(config), 'utf8').toString('base64'),
    PORT: previous.PORT || '3000', HOST: previous.HOST || '127.0.0.1' };
  delete next.DB_PASSWORD;
  delete next.SEED_ADMIN_PASSWORD;
  delete next.SEED_CUSTOMER_PASSWORD;
  const content = '# Cấu hình cục bộ Tea House. Không đưa file này lên Git.\n' +
    '# DB_PASSWORD_BASE64 chỉ là mã hóa biểu diễn, không phải mã hóa bảo mật.\n' +
    Object.entries(next).map(([key, value]) => envLine(key, value)).join('\n') + '\n';
  const backupDir = resolve(cwd, 'data/config-backups');
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  try { await copyFile(path, resolve(backupDir, `${stamp}-${randomUUID()}.env`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = resolve(backupDir, `candidate-${randomUUID()}.tmp`);
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
  return next;
}

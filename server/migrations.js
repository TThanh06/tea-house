// Ordered, additive migrations. Never edit an applied migration.
async function baseline(db, driver) {
  const id=driver==='mysql'?'INTEGER PRIMARY KEY AUTO_INCREMENT':'INTEGER PRIMARY KEY AUTOINCREMENT';
  const statements=[
    `CREATE TABLE IF NOT EXISTS users (id ${id}, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'customer', created_at VARCHAR(30) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash VARCHAR(64) PRIMARY KEY, user_id INTEGER NOT NULL, expires_at VARCHAR(30) NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS categories (id ${id}, name VARCHAR(80) NOT NULL UNIQUE)`,
    `CREATE TABLE IF NOT EXISTS products (id ${id}, name VARCHAR(100) NOT NULL, description TEXT NOT NULL, category_id INTEGER NOT NULL, price_m INTEGER NOT NULL, price_l INTEGER NOT NULL, color VARCHAR(20) NOT NULL DEFAULT '#c28b54', active INTEGER NOT NULL DEFAULT 1, available INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(category_id) REFERENCES categories(id))`,
    `CREATE TABLE IF NOT EXISTS toppings (id ${id}, name VARCHAR(80) NOT NULL, price INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS delivery_zones (id ${id}, name VARCHAR(100) NOT NULL, fee INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS coupons (id ${id}, code VARCHAR(30) NOT NULL UNIQUE, discount INTEGER NOT NULL, min_total INTEGER NOT NULL, expires_at VARCHAR(30) NOT NULL, max_uses INTEGER NOT NULL, used_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS orders (id ${id}, user_id INTEGER NOT NULL, request_key VARCHAR(80) NOT NULL, request_hash VARCHAR(64) NOT NULL, recipient VARCHAR(100) NOT NULL, phone VARCHAR(20) NOT NULL, address VARCHAR(500) NOT NULL, delivery_type VARCHAR(20) NOT NULL, zone_name VARCHAR(100) NOT NULL, note VARCHAR(500) NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL, delivery_fee INTEGER NOT NULL, total INTEGER NOT NULL, coupon_code VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', paid INTEGER NOT NULL DEFAULT 0, created_at VARCHAR(30) NOT NULL, completed_at VARCHAR(30), UNIQUE(user_id,request_key), FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS order_items (id ${id}, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name VARCHAR(100) NOT NULL, size VARCHAR(5) NOT NULL, sugar INTEGER NOT NULL, ice VARCHAR(20) NOT NULL, toppings_json TEXT NOT NULL, note VARCHAR(200) NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS order_history (id ${id}, order_id INTEGER NOT NULL, status VARCHAR(30) NOT NULL, actor_id INTEGER NOT NULL, note VARCHAR(500) NOT NULL, created_at VARCHAR(30) NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id))`
  ];
  for(const sql of statements)await db.run(sql);
}


async function hasColumn(db, driver, table, column) {
  if (driver === 'mysql') {
    const rows = await db.all('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [table, column]);
    return rows.length > 0;
  }
  return (await db.all(`PRAGMA table_info(${table})`)).some(row => row.name === column);
}

async function storeAndPhotos(db, driver) {
  // MySQL DDL commits implicitly: each step can safely resume after interruption.
  if (!await hasColumn(db, driver, 'products', 'image_path')) {
    await db.run("ALTER TABLE products ADD COLUMN image_path VARCHAR(255) NOT NULL DEFAULT ''");
  }
  if (!await hasColumn(db, driver, 'delivery_zones', 'active')) {
    await db.run('ALTER TABLE delivery_zones ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  await db.run('CREATE TABLE IF NOT EXISTS store_settings (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, address VARCHAR(500) NOT NULL, phone VARCHAR(30) NOT NULL, hours VARCHAR(150) NOT NULL, announcement VARCHAR(200) NOT NULL)');
  if (!(await db.all('SELECT id FROM store_settings WHERE id=1')).length) {
    await db.run('INSERT INTO store_settings (id,name,address,phone,hours,announcement) VALUES (?,?,?,?,?,?)', [1, 'Tea House', '', '', '', 'Pha mới cho từng đơn hàng']);
  }
}

export const migrations = [
  { id: '001_baseline', up: baseline },
  { id: '002_store_and_product_images', up: storeAndPhotos },
];

export async function applyMigrations(db, driver) {
  await db.run('CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at VARCHAR(30) NOT NULL)');
  const done = new Set((await db.all('SELECT id FROM schema_migrations')).map(row => row.id));
  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    await migration.up(db, driver);
    await db.run('INSERT INTO schema_migrations (id,applied_at) VALUES (?,?)', [migration.id, new Date().toISOString()]);
  }
}

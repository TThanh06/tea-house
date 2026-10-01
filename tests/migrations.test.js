import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations, migrations } from '../server/migrations.js';

test('legacy schema migrates additively and repeated migration preserves existing rows', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    all: async (sql, values = []) => sqlite.prepare(sql).all(...values),
    run: async (sql, values = []) => sqlite.prepare(sql).run(...values),
  };
  try {
    await migrations[0].up(db, 'demo');
    await db.run('INSERT INTO categories (name) VALUES (?)', ['Danh mục cũ']);
    await db.run('INSERT INTO products (name,description,category_id,price_m,price_l) VALUES (?,?,?,?,?)', ['Món cũ', 'Không thay dữ liệu', 1, 37000, 45000]);
    await db.run('INSERT INTO delivery_zones (name,fee) VALUES (?,?)', ['Vùng cũ', 17000]);
    await applyMigrations(db, 'demo');
    await applyMigrations(db, 'demo');
    const [product] = await db.all('SELECT * FROM products');
    assert.equal(product.name, 'Món cũ');assert.equal(product.price_m, 37000);assert.equal(product.image_path, '');
    assert.equal((await db.all('SELECT * FROM delivery_zones'))[0].active, 1);
    assert.equal((await db.all('SELECT * FROM schema_migrations')).length, 2);
    assert.equal((await db.all('SELECT * FROM store_settings')).length, 1);
  } finally { sqlite.close(); }
});

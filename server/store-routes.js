import express from 'express';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, transaction, driver } from './db.js';
import { requireValue, integer, text } from './service.js';

const filenamePattern = /^[a-f0-9-]{36}\.jpg$/;
const directory = () => resolve(process.env.UPLOAD_DIR || 'data/uploads');

export function validateJpeg(buffer) {
  requireValue(Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.length <= 2 * 1024 * 1024, 'Ảnh phải nhỏ hơn 2 MB.');
  requireValue(buffer[0] === 255 && buffer[1] === 216 && buffer.at(-2) === 255 && buffer.at(-1) === 217, 'Ảnh JPEG không hợp lệ.');
  let offset = 2;
  while (offset + 4 < buffer.length) {
    requireValue(buffer[offset] === 255, 'Cấu trúc ảnh không hợp lệ.');
    while (buffer[offset] === 255) offset++;
    const marker = buffer[offset++];
    if (marker === 218 || marker === 217) break;
    const length = buffer.readUInt16BE(offset);
    requireValue(length >= 2 && offset + length <= buffer.length, 'Ảnh bị thiếu dữ liệu.');
    if ([192, 193, 194].includes(marker)) {
      requireValue(length >= 8, 'Kích thước ảnh không hợp lệ.');
      const height = buffer.readUInt16BE(offset + 3), width = buffer.readUInt16BE(offset + 5);
      requireValue(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'Ảnh tối đa 4096 × 4096 pixel.');
      return { width, height };
    }
    offset += length;
  }
  requireValue(false, 'Không đọc được kích thước ảnh JPEG.');
}

async function removeOld(path) {
  const name = path?.replace('/api/media/', '');
  if (!name || !filenamePattern.test(name)) return;
  try { await unlink(resolve(directory(), name)); }
  catch (error) { if (error.code !== 'ENOENT') console.error('Không thể dọn ảnh cũ:', error.code); }
}

export function attachStoreRoutes(app) {
  // /api/admin authentication/authorization middleware must be registered first.
  app.get('/api/admin/store', async (req, res) => {
    const [store] = await db.all('SELECT * FROM store_settings WHERE id=1');
    const zones = await db.all('SELECT * FROM delivery_zones ORDER BY id');
    res.json({ store, zones });
  });
  app.put('/api/admin/store', async (req, res) => {
    const b = req.body;
    const values = [text(b.name, 100), text(b.address, 500), text(b.phone, 30), text(b.hours, 150), text(b.announcement, 200)];
    requireValue(values[0].length >= 2, 'Nhập tên cửa hàng.');
    requireValue(!values[2] || /^(0\d{9}|\+84\d{9})$/.test(values[2]), 'Số điện thoại cửa hàng không hợp lệ.');
    await transaction(tx => tx.run('UPDATE store_settings SET name=?,address=?,phone=?,hours=?,announcement=? WHERE id=1', values));
    res.json({ ok: true });
  });
  async function zone(id, body) {
    requireValue(text(body.name, 100).length >= 2 && integer(body.fee, 0, 1000000), 'Tên khu vực hoặc phí giao hàng không hợp lệ.');
    requireValue([0, 1, false, true].includes(body.active), 'Trạng thái khu vực không hợp lệ.');
    return transaction(async tx => {
      if (id) {
        requireValue((await tx.all('SELECT id FROM delivery_zones WHERE id=?', [id])).length, 'Không tìm thấy khu vực.', 404);
        await tx.run('UPDATE delivery_zones SET name=?,fee=?,active=? WHERE id=?', [text(body.name, 100), body.fee, Number(body.active), id]);
        return { id };
      }
      const result = await tx.run('INSERT INTO delivery_zones (name,fee,active) VALUES (?,?,?)', [text(body.name, 100), body.fee, Number(body.active)]);
      return { id: result.insertId };
    });
  }
  app.post('/api/admin/zones', async (req, res) => res.status(201).json(await zone(null, req.body)));
  app.put('/api/admin/zones/:id', async (req, res) => {
    requireValue(integer(Number(req.params.id), 1, 2147483647), 'Mã khu vực không hợp lệ.');
    res.json(await zone(Number(req.params.id), req.body));
  });
  app.put('/api/admin/products/:id/image', express.raw({ type: 'image/jpeg', limit: '2mb' }), async (req, res) => {
    requireValue(integer(Number(req.params.id), 1, 2147483647), 'Mã món không hợp lệ.');
    validateJpeg(req.body);
    const id = Number(req.params.id), name = randomUUID() + '.jpg';
    const imagePath = '/api/media/' + name;
    await mkdir(directory(), { recursive: true });
    await writeFile(resolve(directory(), name), req.body, { flag: 'wx' });
    let old;
    try {
      await transaction(async tx => {
        const [product] = await tx.all('SELECT image_path FROM products WHERE id=?'+(driver==='mysql'?' FOR UPDATE':''), [id]);
        requireValue(product, 'Không tìm thấy món.', 404);
        old = product.image_path;
        await tx.run('UPDATE products SET image_path=? WHERE id=?', [imagePath, id]);
      });
    } catch (error) { await removeOld(imagePath); throw error; }
    await removeOld(old);
    res.json({ image_path: imagePath });
  });
  app.delete('/api/admin/products/:id/image', async (req, res) => {
    const old = await transaction(async tx => {
      const [product] = await tx.all('SELECT image_path FROM products WHERE id=?'+(driver==='mysql'?' FOR UPDATE':''), [Number(req.params.id)]);
      requireValue(product, 'Không tìm thấy món.', 404);
      await tx.run("UPDATE products SET image_path='' WHERE id=?", [Number(req.params.id)]);
      return product.image_path;
    });
    await removeOld(old);
    res.json({ ok: true });
  });
  app.get('/api/media/:name', (req, res, next) => {
    if (!filenamePattern.test(req.params.name)) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=86400' });
    res.sendFile(resolve(directory(), req.params.name), error => {
      if (error && !res.headersSent) res.status(404).end();
    });
  });
}

import React, { useEffect, useState } from 'react';
import { Modal } from './ui.jsx';
import ProductImage from './ProductImage.jsx';
import { api } from '../lib/api.js';

async function normalizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP dưới 10 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f6efe3'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('Ảnh quá lớn sau xử lý. Hãy chọn ảnh nhỏ hơn.');
    return blob;
  } finally { bitmap.close(); }
}

export default function PhotoEditor({ product, onClose, onSaved }) {
  const [blob, setBlob] = useState(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!blob) { setPreview(''); return; }
    const url = URL.createObjectURL(blob); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function choose(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setError(''); setBlob(null);
    try { setBlob(await normalizePhoto(file)); }
    catch (error) { setError(error.message || 'Không đọc được ảnh.'); }
    finally { setBusy(false); }
  }
  async function save(remove = false) {
    setBusy(true); setError('');
    try {
      if (remove) await api(`/admin/products/${product.id}/image`, { method: 'DELETE' });
      else {
        const response = await fetch(`/api/admin/products/${product.id}/image`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không tải được ảnh.');
      }
      await onSaved();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <Modal title={'Ảnh: ' + product.name} onClose={busy ? () => {} : onClose}>
    <div className="photo-preview">{preview ? <img src={preview} alt="Ảnh đồ uống chuẩn bị lưu" /> : <ProductImage product={product} id="photo-editor" />}</div>
    <label className="field"><span>Chọn ảnh đồ uống</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={choose} /></label>
    <p className="muted">JPG, PNG hoặc WebP, tối đa 10 MB. Ảnh sẽ được thu nhỏ để tải nhanh trên điện thoại.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="photo-actions"><button className="primary" disabled={busy || !blob} onClick={() => save()}>{busy ? 'Đang xử lý…' : 'Lưu ảnh'}</button>
      {product.image_path && <button className="secondary" disabled={busy} onClick={() => save(true)}>Dùng lại hình minh họa</button>}</div>
  </Modal>;
}

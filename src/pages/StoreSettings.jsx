import React, { useEffect, useState } from 'react';
import { api, money } from '../lib/api.js';
import { Field, Modal } from '../components/ui.jsx';

export default function StoreSettings({ notify, refreshCatalog }) {
  const [store, setStore] = useState(null), [zones, setZones] = useState([]);
  const [edit, setEdit] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function load() {
    try { const result = await api('/admin/store'); setStore(result.store); setZones(result.zones); setError(''); }
    catch (error) { setError(error.message); }
  }
  useEffect(() => { load(); }, []);
  async function saveStore(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/admin/store', { method: 'PUT', body: store }); await refreshCatalog(); notify('Đã cập nhật thông tin cửa hàng.'); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  async function saveZone(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/admin/zones' + (edit.id ? '/' + edit.id : ''), { method: edit.id ? 'PUT' : 'POST', body: edit });
      setEdit(null); await load(); await refreshCatalog(); notify('Đã cập nhật khu vực giao hàng.');
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <div className="settings-layout">
    <section className="report-card"><h2>Thông tin cửa hàng</h2>
      {!store ? <p>{error || 'Đang tải…'}</p> : <form onSubmit={saveStore}>
        {[['name', 'Tên cửa hàng', 100], ['phone', 'Số điện thoại', 30], ['address', 'Địa chỉ nhận tại quầy', 500], ['hours', 'Giờ mở cửa', 150], ['announcement', 'Thông báo trên đầu trang', 200]].map(([key, label, max]) =>
          <Field key={key} label={label}><input value={store[key]} maxLength={max} required={key === 'name'} minLength={key === 'name' ? 2 : undefined} onChange={event => setStore({ ...store, [key]: event.target.value })} /></Field>)}
        <p className="muted">Điền thông tin thực tế để khách biết nơi nhận đồ uống. Để trống các mục chưa xác định.</p>
        {error && !edit && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin cửa hàng'}</button>
      </form>}
    </section>
    <section className="report-card"><div className="section-heading compact"><h2>Khu vực giao hàng</h2><button className="secondary" onClick={() => { setError(''); setEdit({ name: '', fee: 15000, active: 1 }); }}>Thêm khu vực</button></div>
      <p className="muted">Phí cố định theo khu vực. Tắt khu vực để ngừng nhận đơn giao đến đó.</p>
      {zones.map(zone => <div className="zone-row" key={zone.id}><div><b>{zone.name}</b><small>{money(zone.fee)} · {zone.active ? 'Đang giao' : 'Tạm ngừng'}</small></div><button className="secondary" onClick={() => { setError(''); setEdit(zone); }}>Sửa</button></div>)}
      {!zones.length && <p>Chưa có khu vực. Khách vẫn có thể nhận tại quầy.</p>}
    </section>
    {edit && <Modal title={edit.id ? 'Sửa khu vực giao hàng' : 'Thêm khu vực giao hàng'} onClose={() => { if (!busy) setEdit(null); }}>
      <form className="stack" onSubmit={saveZone}>
        <Field label="Tên khu vực"><input required minLength={2} maxLength={100} value={edit.name} onChange={event => setEdit({ ...edit, name: event.target.value })} /></Field>
        <Field label="Phí giao hàng (VNĐ)"><input type="number" required min={0} max={1000000} value={edit.fee} onChange={event => setEdit({ ...edit, fee: Number(event.target.value) })} /></Field>
        <label className="toggle"><input type="checkbox" checked={!!edit.active} onChange={event => setEdit({ ...edit, active: Number(event.target.checked) })} />Đang giao hàng</label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>Lưu khu vực</button>
      </form>
    </Modal>}
  </div>;
}

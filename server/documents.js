import { requireValue } from './service.js';

const statuses = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang pha chế',
  delivering: 'Đang giao', ready: 'Chờ nhận tại quầy', completed: 'Hoàn thành',
  cancelled: 'Đã hủy', failed: 'Giao thất bại', uncollected: 'Không đến nhận',
};
const money = value => Number(value).toLocaleString('vi-VN') + 'đ';
const localDate = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function reportPeriod(query, now = Date.now()) {
  const day = time => new Date(time + 7 * 3600000).toISOString().slice(0, 10);
  const from = query.from ?? day(now - 29 * 86400000);
  const to = query.to ?? day(now);
  function valid(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }
  requireValue(valid(from) && valid(to) && from <= to, 'Khoảng ngày không hợp lệ.');
  return {
    from, to,
    start: new Date(from + 'T00:00:00+07:00').toISOString(),
    end: new Date(to + 'T23:59:59.999+07:00').toISOString(),
  };
}

export async function revenueOrders(database, period) {
  return database.all(
    'SELECT * FROM orders WHERE status=? AND paid=1 AND completed_at>=? AND completed_at<=? ORDER BY completed_at,id',
    ['completed', period.start, period.end],
  );
}

export function csvCell(value) {
  // Keep numbers numeric, quote text and prevent spreadsheet formula evaluation.
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  let string = String(value ?? '');
  if (/^\s*[=+@-]/.test(string) || /^[\t\r\n]/.test(string)) string = "'" + string;
  return '"' + string.replaceAll('"', '""') + '"';
}

export function revenueCsv(orders) {
  const rows = [[
    'Mã đơn', 'Ngày đặt (giờ Việt Nam)', 'Ngày hoàn thành (giờ Việt Nam)',
    'Nhận hàng', 'Tiền món (VNĐ)', 'Giảm giá (VNĐ)', 'Phí giao (VNĐ)', 'Đã thu (VNĐ)',
  ]];
  for (const order of orders) rows.push([
    'TH' + String(order.id).padStart(5, '0'), localDate(order.created_at), localDate(order.completed_at),
    order.delivery_type === 'pickup' ? 'Nhận tại quầy' : 'Giao hàng',
    order.subtotal, order.discount, order.delivery_fee, order.total,
  ]);
  rows.push(['TỔNG CỘNG', '', '', '',
    ...['subtotal', 'discount', 'delivery_fee', 'total'].map(key => orders.reduce((sum, order) => sum + Number(order[key]), 0)),
  ]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function receiptHtml(order, items, store = {}) {
  const h = escapeHtml;
  const number = 'TH' + String(order.id).padStart(5, '0');
  const ice = { none: 'Không đá', less: 'Ít đá', normal: 'Đá bình thường' };
  const lines = items.map(item => {
    const toppings = JSON.parse(item.toppings_json).map(topping => topping.name).join(', ');
    const options = `Size ${item.size} · ${item.sugar}% đường · ${ice[item.ice] || item.ice}`;
    return `<tr><td><strong>${h(item.product_name)}</strong><small>${h(options)}</small>${toppings ? `<small>${h(toppings)}</small>` : ''}${item.note ? `<small>Ghi chú: ${h(item.note)}</small>` : ''}</td><td>${h(item.quantity)}</td><td>${money(item.unit_price)}</td><td>${money(item.unit_price * item.quantity)}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tea House · ${number}</title>
<style>
*{box-sizing:border-box}body{font:14px/1.6 Arial,sans-serif;background:#f4eee4;color:#342b25;margin:0;padding:30px}main{max-width:780px;background:white;margin:auto;padding:38px;border:1px solid #ddd4c8;border-radius:8px}.actions{max-width:780px;margin:0 auto 18px;display:flex;justify-content:space-between;gap:15px;align-items:center}.actions p{font-size:12px;margin:0}button{background:#8b422e;color:white;border:0;border-radius:5px;padding:12px 20px;cursor:pointer;font:inherit}.brand{font:36px Georgia,serif;margin:0;color:#8b422e}header{border-bottom:2px solid #8b422e;padding-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:15px}h1{font-size:18px;margin:10px 0 0}h2{font-size:15px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:22px 0}p{margin:5px 0;overflow-wrap:anywhere}.status{border:1px solid #c9bca9;padding:5px 9px;border-radius:4px;display:inline-block}table{border-collapse:collapse;width:100%;font-size:12px}thead{display:table-header-group}th,td{padding:13px 6px;border-bottom:1px solid #e4ded5;text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left;width:52%}td small{display:block;color:#6b655d;overflow-wrap:anywhere}tr{break-inside:avoid}.totals{margin:22px 0 0 auto;max-width:340px;break-inside:avoid}.totals div{display:flex;justify-content:space-between;gap:20px;padding:6px 0}.grand{border-top:2px solid #8b422e;font-size:20px;font-weight:bold;color:#8b422e;margin-top:8px}.foot{text-align:center;font-size:12px;color:#746b61;margin-top:30px;break-inside:avoid}.payment{font-weight:bold;margin-top:14px}@media(max-width:600px){body{padding:12px}main{padding:18px}.meta{grid-template-columns:1fr;gap:10px}.actions{align-items:start}th,td{font-size:11px;padding:10px 3px}.brand{font-size:28px}}@page{size:A4;margin:15mm}@media print{body{background:white;padding:0;font-size:12px}.actions{display:none}main{border:0;padding:0;border-radius:0;max-width:none}.meta{grid-template-columns:1fr 1fr}button{display:none}}
</style><script src="/receipt.js" defer></script></head><body><div class="actions"><p>Dùng hộp thoại in để in giấy hoặc chọn “Lưu thành PDF”.</p><button id="print-receipt" type="button">In / Lưu PDF</button></div><main><header><div><p class="brand">${h(store.name || 'Tea House')}</p>${store.address ? `<p>${h(store.address)}</p>` : ''}${store.phone ? `<p>${h(store.phone)}</p>` : ''}<h1>PHIẾU THANH TOÁN</h1></div><div><strong>${number}</strong><p>${h(localDate(order.created_at))}</p></div></header><section class="meta"><div><h2>Thông tin người nhận</h2><p>${h(order.recipient)}</p><p>${h(order.phone)}</p><p>${h(order.address)}</p></div><div><h2>Thông tin đơn hàng</h2><p>${order.delivery_type === 'pickup' ? 'Nhận tại quầy' : 'Giao hàng'}</p><p class="status">${h(statuses[order.status] || order.status)}</p><p class="payment">${order.paid ? 'ĐÃ THANH TOÁN TIỀN MẶT' : 'CHƯA THANH TOÁN'}</p>${order.completed_at ? `<p>Hoàn thành: ${h(localDate(order.completed_at))}</p>` : ''}</div></section><table><thead><tr><th>Đồ uống</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${lines}</tbody></table><section class="totals"><div><span>Tiền món</span><span>${money(order.subtotal)}</span></div><div><span>Giảm giá${order.coupon_code ? ` (${h(order.coupon_code)})` : ''}</span><span>−${money(order.discount)}</span></div><div><span>Phí giao hàng</span><span>${money(order.delivery_fee)}</span></div><div class="grand"><span>Tổng tiền</span><span>${money(order.total)}</span></div></section>${order.note ? `<p>Ghi chú: ${h(order.note)}</p>` : ''}<p class="foot">Cảm ơn bạn đã chọn ${h(store.name || 'Tea House')}.<br>Một ly trà ngon. Một ngày dịu dàng.</p></main></body></html>`;
}

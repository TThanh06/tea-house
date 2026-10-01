import { createHash } from 'node:crypto';
import { driver } from './db.js';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export function requireValue(condition,message,status=400){if(!condition)throw new HttpError(status,message);}
export function text(value,max=200){return typeof value==='string'?value.trim().slice(0,max):'';}
export function integer(value,min,max){return Number.isInteger(value)&&value>=min&&value<=max;}
const lock=driver==='mysql'?' FOR UPDATE':'';

export async function quote(tx,body,{locking=false}={}){
  requireValue(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=30,'Giỏ hàng phải có từ 1 đến 30 dòng.');
  const items=[];
  for(const item of body.items){
    requireValue(integer(item.productId,1,2147483647)&&integer(item.quantity,1,20),'Sản phẩm hoặc số lượng không hợp lệ.');
    requireValue(['M','L'].includes(item.size)&&[0,30,50,70,100].includes(item.sugar)&&['none','less','normal'].includes(item.ice),'Tùy chọn đồ uống không hợp lệ.');
    requireValue(Array.isArray(item.toppingIds)&&item.toppingIds.length<=5&&item.toppingIds.every(id=>integer(id,1,2147483647)),'Topping không hợp lệ.');
    requireValue(new Set(item.toppingIds).size===item.toppingIds.length,'Mỗi loại topping chỉ chọn một lần.');
    const [p]=await tx.all('SELECT * FROM products WHERE id=?'+(locking?lock:''),[item.productId]);
    requireValue(p&&p.active&&p.available,'Một món trong giỏ đã ngừng bán hoặc tạm hết.');
    const toppings=[];
    for(const id of [...item.toppingIds].sort((a,b)=>a-b)){
      const [t]=await tx.all('SELECT * FROM toppings WHERE id=?'+(locking?lock:''),[id]);
      requireValue(t&&t.available,'Một topping đã tạm hết. Vui lòng cập nhật giỏ hàng.');
      toppings.push({id:t.id,name:t.name,price:t.price});
    }
    const unitPrice=(item.size==='M'?p.price_m:p.price_l)+toppings.reduce((s,t)=>s+t.price,0);
    items.push({productId:p.id,name:p.name,size:item.size,sugar:item.sugar,ice:item.ice,toppings,quantity:item.quantity,note:text(item.note,200),unitPrice});
  }
  const subtotal=items.reduce((s,i)=>s+i.quantity*i.unitPrice,0);
  requireValue(['pickup','delivery'].includes(body.deliveryType),'Vui lòng chọn cách nhận hàng.');
  let fee=0,zoneName='';
  if(body.deliveryType==='delivery'){
    requireValue(integer(body.zoneId,1,2147483647),'Chọn khu vực giao hàng.');
    const [zone]=await tx.all('SELECT * FROM delivery_zones WHERE id=?'+(locking?lock:''),[body.zoneId]);
    requireValue(zone&&zone.active,'Khu vực chưa được hỗ trợ hoặc đã tạm ngừng giao hàng.');fee=zone.fee;zoneName=zone.name;
  }
  const code=text(body.couponCode,30).toUpperCase();let discount=0;
  if(code){
    const [c]=await tx.all('SELECT * FROM coupons WHERE code=?'+(locking?lock:''),[code]);
    requireValue(c&&c.active&&c.expires_at>new Date().toISOString()&&c.used_count<c.max_uses,'Mã giảm giá không hợp lệ, hết hạn hoặc hết lượt.');
    requireValue(subtotal>=c.min_total,`Đơn tối thiểu ${c.min_total.toLocaleString('vi-VN')}đ để dùng mã này.`);
    discount=Math.min(c.discount,subtotal);
  }
  return {items,subtotal,discount,deliveryFee:fee,zoneName,couponCode:code,total:subtotal-discount+fee};
}

export async function createOrder(tx,user,body){
  requireValue(typeof body.requestKey==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey),'Mã yêu cầu không hợp lệ.');
  const hash=createHash('sha256').update(JSON.stringify({...body,requestKey:undefined})).digest('hex');
  // Serialize submissions by customer, including matching idempotency keys.
  await tx.all('SELECT id FROM users WHERE id=?'+lock,[user.id]);
  const [existing]=await tx.all('SELECT id,request_hash FROM orders WHERE user_id=? AND request_key=?',[user.id,body.requestKey]);
  if(existing){requireValue(existing.request_hash===hash,'Yêu cầu đã được dùng với nội dung khác.',409);return {id:existing.id,reused:true};}
  const recipient=text(body.recipient,100),phone=text(body.phone,20),address=text(body.address,500);
  requireValue(recipient.length>=2&&/^(0\d{9}|\+84\d{9})$/.test(phone),'Nhập tên người nhận và số điện thoại Việt Nam hợp lệ.');
  requireValue(body.deliveryType!=='delivery'||address.length>=10,'Nhập địa chỉ giao hàng đầy đủ.');
  const q=await quote(tx,body,{locking:true});
  if(body.expectedTotal!==undefined)requireValue(body.expectedTotal===q.total,'Giá đã thay đổi. Vui lòng kiểm tra tổng tiền và đặt lại.',409);
  const now=new Date().toISOString();
  const [store]=await tx.all('SELECT address FROM store_settings WHERE id=1');
  const result=await tx.run('INSERT INTO orders (user_id,request_key,request_hash,recipient,phone,address,delivery_type,zone_name,note,subtotal,discount,delivery_fee,total,coupon_code,status,paid,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[user.id,body.requestKey,hash,recipient,phone,body.deliveryType==='delivery'?address:(store?.address||'Nhận tại cửa hàng'),body.deliveryType,q.zoneName,text(body.note,500),q.subtotal,q.discount,q.deliveryFee,q.total,q.couponCode,'pending',0,now]);
  for(const i of q.items)await tx.run('INSERT INTO order_items (order_id,product_id,product_name,size,sugar,ice,toppings_json,note,quantity,unit_price) VALUES (?,?,?,?,?,?,?,?,?,?)',[result.insertId,i.productId,i.name,i.size,i.sugar,i.ice,JSON.stringify(i.toppings),i.note,i.quantity,i.unitPrice]);
  if(q.couponCode)await tx.run('UPDATE coupons SET used_count=used_count+1 WHERE code=?',[q.couponCode]);
  await tx.run('INSERT INTO order_history (order_id,status,actor_id,note,created_at) VALUES (?,?,?,?,?)',[result.insertId,'pending',user.id,'Đã đặt hàng',now]);
  return {id:result.insertId,reused:false};
}
export function nextStatuses(order){
  return ({pending:['confirmed','cancelled'],confirmed:['preparing'],preparing:[order.delivery_type==='delivery'?'delivering':'ready'],delivering:['completed','failed'],ready:['completed','uncollected']})[order.status]||[];
}
export async function changeStatus(tx,user,id,status,note=''){
  const [o]=await tx.all('SELECT * FROM orders WHERE id=?'+lock,[id]);
  requireValue(o&&(user.role==='admin'||o.user_id===user.id),'Không tìm thấy đơn hàng.',404);
  if(user.role!=='admin')requireValue(status==='cancelled'&&o.status==='pending','Chỉ được hủy đơn chờ xác nhận.',409);
  requireValue(nextStatuses(o).includes(status),'Không thể chuyển sang trạng thái này.',409);
  if(['cancelled','failed','uncollected'].includes(status))requireValue(text(note).length>=3,'Vui lòng ghi lý do.');
  const now=new Date().toISOString();
  await tx.run('UPDATE orders SET status=?,paid=?,completed_at=? WHERE id=?',[status,status==='completed'?1:o.paid,status==='completed'?now:null,id]);
  // Coupon usage counts submitted orders; cancelling does not restore a use.
  await tx.run('INSERT INTO order_history (order_id,status,actor_id,note,created_at) VALUES (?,?,?,?,?)',[id,status,user.id,text(note,500),now]);
}

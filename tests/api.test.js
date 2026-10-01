import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.UPLOAD_DIR=await mkdtemp(join(tmpdir(),'tea-upload-test-'));

const mysqlTest=process.env.TEST_MYSQL==='1';
if(mysqlTest){
  assert.match(process.env.DB_NAME||'',/^tea_house_test(?:_[a-z0-9]+)?$/,'MySQL tests require an isolated tea_house_test database');
  process.env.DB_DRIVER='mysql';
  process.env.SEED_ADMIN_PASSWORD='Admin@12345';process.env.SEED_CUSTOMER_PASSWORD='Khach@12345';
}else{process.env.DB_DRIVER='demo';process.env.SQLITE_PATH=':memory:';}
const { db, initSchema, closeDb, transaction }=await import('../server/db.js');
const { seed }=await import('../server/seed.js');
const { createApp }=await import('../server/app.js');
let server,base,customerCookie,adminCookie,orderId;
const cart=()=>({items:[{productId:1,size:'L',sugar:50,ice:'less',toppingIds:[1],quantity:2,note:'Để topping riêng'}],deliveryType:'delivery',zoneId:1,couponCode:'CHAO10'});
const order=()=>({...cart(),requestKey:randomUUID(),recipient:'Khách kiểm thử',phone:'0901234567',address:'123 Đường Trà, Phường Mẫu',note:''});
async function request(path,{cookie,method='GET',body,headers={}}={}){
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
before(async()=>{if(mysqlTest)assert.equal((await db.all('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).length,0,'MySQL test database must be empty');await initSchema();await seed();server=await new Promise(resolve=>{const s=createApp().listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}/api`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));await closeDb();});

test('catalog includes seeded products and correct database mode',async()=>{const r=await request('/catalog');assert.equal(r.status,200);assert.equal(r.data.products.length,12);assert.equal(r.data.mode,mysqlTest?'mysql':'demo');});
test('customer and admin login create working sessions',async()=>{
  const c=await request('/auth/login',{method:'POST',body:{email:'khach@teahouse.local',password:'Khach@12345'}});assert.equal(c.status,200);customerCookie=c.cookie;
  const a=await request('/auth/login',{method:'POST',body:{email:'admin@teahouse.local',password:'Admin@12345'}});assert.equal(a.status,200);adminCookie=a.cookie;
  assert.equal((await request('/auth/me',{cookie:customerCookie})).data.user.role,'customer');
  assert.equal((await request('/auth/me',{cookie:adminCookie})).data.user.role,'admin');
});
test('wrong password rejected and server enforces admin access',async()=>{
  assert.equal((await request('/auth/login',{method:'POST',body:{email:'admin@teahouse.local',password:'wrong'}})).status,401);
  assert.equal((await request('/admin/orders')).status,401);
  assert.equal((await request('/admin/orders',{cookie:customerCookie})).status,403);
  assert.equal((await request('/admin/orders',{cookie:adminCookie})).status,200);
});
test('quote uses server prices, topping, discount and delivery fee',async()=>{
  const body=cart();body.items[0].unitPrice=1;body.total=1;
  const r=await request('/checkout/quote',{method:'POST',body});
  assert.equal(r.status,200);assert.equal(r.data.subtotal,98000);assert.equal(r.data.discount,10000);assert.equal(r.data.deliveryFee,15000);assert.equal(r.data.total,103000);
});
test('invalid quantity, duplicate topping and invalid options rejected',async()=>{
  for(const patch of [{quantity:-1},{quantity:1.5},{toppingIds:[1,1]},{sugar:99},{size:'XL'},{toppingIds:[999]}]){
    const body=cart();Object.assign(body.items[0],patch);assert.equal((await request('/checkout/quote',{method:'POST',body})).status,400);
  }
});
test('coupon minimum and expiry enforced',async()=>{
  const b=cart();b.items[0].quantity=1;assert.equal((await request('/checkout/quote',{method:'POST',body:b})).status,400);
  await transaction(tx=>tx.run('INSERT INTO coupons (code,discount,min_total,expires_at,max_uses) VALUES (?,?,?,?,?)',['EXPIRED',5000,0,'2020-01-01T00:00:00.000Z',100]));
  b.items[0].quantity=2;b.couponCode='EXPIRED';assert.equal((await request('/checkout/quote',{method:'POST',body:b})).status,400);
});
test('cannot order unavailable products or toppings',async()=>{
  await transaction(tx=>tx.run('UPDATE products SET available=0 WHERE id=1'));
  assert.equal((await request('/orders',{method:'POST',cookie:customerCookie,body:order()})).status,400);
  await transaction(async tx=>{await tx.run('UPDATE products SET available=1 WHERE id=1');await tx.run('UPDATE toppings SET available=0 WHERE id=1');});
  assert.equal((await request('/orders',{method:'POST',cookie:customerCookie,body:order()})).status,400);
  await transaction(tx=>tx.run('UPDATE toppings SET available=1 WHERE id=1'));
});
test('stale expected total rejected, no partial order written',async()=>{
  const before=(await db.all('SELECT COUNT(*) AS n FROM orders'))[0].n;
  assert.equal((await request('/orders',{method:'POST',cookie:customerCookie,body:{...order(),expectedTotal:1}})).status,409);
  assert.equal((await db.all('SELECT COUNT(*) AS n FROM orders'))[0].n,before);
});
test('concurrent identical order submissions create one order and coupon use',async()=>{
  const b=order(),before=(await db.all('SELECT used_count FROM coupons WHERE code=?',['CHAO10']))[0].used_count;
  const [a,c]=await Promise.all([request('/orders',{method:'POST',cookie:customerCookie,body:b}),request('/orders',{method:'POST',cookie:customerCookie,body:b})]);
  assert.deepEqual([a.status,c.status].sort(),[200,201]);assert.equal(a.data.id,c.data.id);orderId=a.data.id;
  assert.equal((await db.all('SELECT used_count FROM coupons WHERE code=?',['CHAO10']))[0].used_count,before+1);
  assert.equal((await request('/orders',{method:'POST',cookie:customerCookie,body:{...b,note:'Different'}})).status,409);
});
test('registration cannot grant admin role or access another user orders',async()=>{
  const r=await request('/auth/register',{method:'POST',body:{name:'Người khác',email:'other@example.test',password:'Password12345',role:'admin'}});assert.equal(r.status,201);assert.equal(r.data.user.role,'customer');
  const cookie=r.cookie;assert.equal((await request('/orders',{cookie})).data.length,0);
  assert.equal((await request(`/orders/${orderId}/cancel`,{method:'POST',cookie,body:{note:'Muốn hủy'}})).status,404);
});
test('illegal order transitions rejected; only pending customer cancellation allowed',async()=>{
  assert.equal((await request(`/admin/orders/${orderId}/status`,{method:'PATCH',cookie:adminCookie,body:{status:'completed'}})).status,409);
  assert.equal((await request(`/admin/orders/${orderId}/status`,{method:'PATCH',cookie:adminCookie,body:{status:'confirmed'}})).status,200);
  assert.equal((await request(`/orders/${orderId}/cancel`,{method:'POST',cookie:customerCookie,body:{note:'Đổi ý'}})).status,409);
});
test('historical order snapshots preserved after product price changes',async()=>{
  await transaction(tx=>tx.run('UPDATE products SET price_l=99000,name=? WHERE id=1',['Đổi tên món']));
  const r=await request('/orders',{cookie:customerCookie}),o=r.data.find(o=>o.id===orderId);
  assert.equal(o.items[0].unit_price,49000);assert.equal(o.items[0].product_name,'Trà sữa trân châu');assert.equal(o.total,103000);
  await transaction(tx=>tx.run('UPDATE products SET price_l=42000,name=? WHERE id=1',['Trà sữa trân châu']));
});
test('completed paid orders included in revenue only once',async()=>{
  for(const status of ['preparing','delivering','completed'])assert.equal((await request(`/admin/orders/${orderId}/status`,{method:'PATCH',cookie:adminCookie,body:{status}})).status,200);
  assert.equal((await request(`/admin/orders/${orderId}/status`,{method:'PATCH',cookie:adminCookie,body:{status:'completed'}})).status,409);
  const r=await request('/admin/reports?from=2020-01-01&to=2040-01-01',{cookie:adminCookie});assert.equal(r.status,200);assert.equal(r.data.revenue,103000);assert.equal(r.data.completed,1);assert.equal(Number(r.data.best[0].quantity),2);
});
test('pickup cancellation recorded with reason and excluded from revenue',async()=>{
  const r=await request('/orders',{method:'POST',cookie:customerCookie,body:{...order(),deliveryType:'pickup'}});
  assert.equal(r.status,201);
  assert.equal((await request(`/orders/${r.data.id}/cancel`,{method:'POST',cookie:customerCookie,body:{note:'Thay đổi kế hoạch'}})).status,200);
  const orders=await request('/orders',{cookie:customerCookie});const o=orders.data.find(o=>o.id===r.data.id);assert.equal(o.status,'cancelled');assert.equal(o.delivery_fee,0);assert.equal(o.history.length,2);
});
test('coupon last use protected against concurrent distinct orders',async()=>{
  await transaction(tx=>tx.run('INSERT INTO coupons (code,discount,min_total,expires_at,max_uses) VALUES (?,?,?,?,?)',['LASTONE',5000,0,'2040-01-01T00:00:00.000Z',1]));
  const results=await Promise.all([1,2].map(()=>request('/orders',{method:'POST',cookie:customerCookie,body:{...order(),couponCode:'LASTONE'}})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
  assert.equal((await db.all('SELECT used_count FROM coupons WHERE code=?',['LASTONE']))[0].used_count,1);
});
test('transaction rolls back an interrupted write',async()=>{
  const before=(await db.all('SELECT COUNT(*) AS n FROM categories'))[0].n;
  await assert.rejects(transaction(async tx=>{await tx.run('INSERT INTO categories (name) VALUES (?)',['rollback category']);throw new Error('intentional failure');}));
  assert.equal((await db.all('SELECT COUNT(*) AS n FROM categories'))[0].n,before);
});
test('receipt requires ownership or admin and exports the saved snapshot',async()=>{
  assert.equal((await fetch(base+`/orders/${orderId}/receipt`)).status,401);
  const other=await request('/auth/login',{method:'POST',body:{email:'other@example.test',password:'Password12345'}});
  assert.equal((await fetch(base+`/orders/${orderId}/receipt`,{headers:{Cookie:other.cookie}})).status,404);
  for(const cookie of [customerCookie,adminCookie]){
    const r=await fetch(base+`/orders/${orderId}/receipt`,{headers:{Cookie:cookie}});
    assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);
    const html=await r.text();assert.match(html,/Trà sữa trân châu/);assert.match(html,/103.000đ/);
    assert.match(r.headers.get('cache-control'),/no-store/);
  }
});
test('CSV requires admin and agrees with report paid revenue',async()=>{
  const path='/admin/reports/export.csv?from=2020-01-01&to=2040-01-01';
  assert.equal((await fetch(base+path)).status,401);
  assert.equal((await fetch(base+path,{headers:{Cookie:customerCookie}})).status,403);
  const result=await fetch(base+path,{headers:{Cookie:adminCookie}});
  assert.equal(result.status,200);assert.match(result.headers.get('content-disposition'),/attachment/);
  const csv=await result.text();assert.match(csv,/TH00001/);assert.match(csv,/103000/);
  assert.equal(csv.trim().split('\r\n').length,3); // header + single completed order + total
  for(const path of ['/admin/reports','/admin/reports/export.csv']){
    const invalid=await fetch(base+path+'?from=2026-02-30&to=2026-03-01',{headers:{Cookie:adminCookie}});
    assert.equal(invalid.status,400);
  }
});
test('store settings require admin and appear in public catalog and receipts',async()=>{
  const body={name:'Cửa hàng kiểm thử',address:'123 Đường Kiểm Thử',phone:'0901234567',hours:'08:00–21:00',announcement:'Trà pha mới mỗi ngày'};
  assert.equal((await request('/admin/store',{cookie:customerCookie,method:'PUT',body})).status,403);
  assert.equal((await request('/admin/store',{cookie:adminCookie,method:'PUT',body:{...body,phone:'bad'}})).status,400);
  assert.equal((await request('/admin/store',{cookie:adminCookie,method:'PUT',body})).status,200);
  const r=await request('/catalog');assert.equal(r.data.store.address,body.address);
  const receipt=await fetch(base+`/orders/${orderId}/receipt`,{headers:{Cookie:customerCookie}});
  assert.ok((await receipt.text()).includes(body.name));
});
test('disabled delivery zones reject new quotes while previous orders keep their fees',async()=>{
  const body={name:'Khu vực đã thay đổi',fee:25000,active:0};
  assert.equal((await request('/admin/zones/1',{method:'PUT',cookie:adminCookie,body})).status,200);
  assert.ok(!(await request('/catalog')).data.zones.some(z=>z.id===1));
  assert.equal((await request('/checkout/quote',{method:'POST',body:cart()})).status,400);
  assert.equal((await db.all('SELECT delivery_fee FROM orders WHERE id=?',[orderId]))[0].delivery_fee,15000);
  assert.equal((await request('/admin/zones/1',{method:'PUT',cookie:adminCookie,body:{...body,fee:-10}})).status,400);
});
test('admin image upload validates type, serves JPEG and supports removal',async()=>{
  const image=await readFile(new URL('./fixtures/upload.jpg',import.meta.url));
  const url=base+'/admin/products/1/image';
  assert.equal((await fetch(url,{method:'PUT',headers:{Cookie:customerCookie,'Content-Type':'image/jpeg'},body:image})).status,403);
  assert.equal((await fetch(url,{method:'PUT',headers:{Cookie:adminCookie,'Content-Type':'image/jpeg'},body:Buffer.from('<svg onload="alert(1)"></svg>')})).status,400);
  assert.equal((await fetch(url,{method:'PUT',headers:{Cookie:adminCookie,'Content-Type':'image/jpeg'},body:Buffer.alloc(2*1024*1024+1)})).status,413);
  const result=await fetch(url,{method:'PUT',headers:{Cookie:adminCookie,'Content-Type':'image/jpeg'},body:image});
  assert.equal(result.status,200);const {image_path}=await result.json();
  const media=await fetch(base.replace(/\/api$/,'')+image_path);assert.equal(media.status,200);assert.match(media.headers.get('content-type'),/image\/jpeg/);
  assert.deepEqual(Buffer.from(await media.arrayBuffer()),image);
  assert.equal((await request('/catalog')).data.products.find(p=>p.id===1).image_path,image_path);
  assert.equal((await request('/admin/products/1/image',{method:'DELETE',cookie:adminCookie})).status,200);
  assert.equal((await fetch(base.replace(/\/api$/,'')+image_path)).status,404);
  assert.equal((await request('/catalog')).data.products.find(p=>p.id===1).image_path,'');
});
test('cross-origin mutation blocked and logout invalidates session',async()=>{
  assert.equal((await request('/auth/logout',{method:'POST',cookie:customerCookie,headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('/auth/logout',{method:'POST',cookie:customerCookie})).status,200);
  assert.equal((await request('/orders',{cookie:customerCookie})).status,401);
});

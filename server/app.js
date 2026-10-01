import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { db, driver, transaction } from './db.js';
import { HttpError, requireValue, text, integer, quote, createOrder, changeStatus, nextStatuses } from './service.js';
import { reportPeriod, revenueOrders, revenueCsv, receiptHtml } from './documents.js';
import { attachStoreRoutes } from './store-routes.js';

const digest=s=>createHash('sha256').update(s).digest('hex');
const safeUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
export function createApp(){
  const app=express();app.disable('x-powered-by');app.use(express.json({limit:'64kb'}));
  app.use((req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'});
    if(req.path.startsWith('/api'))res.set('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){
      const allowed=(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000').split(',');
      if(!allowed.includes(req.headers.origin))return res.status(403).json({error:'Nguồn yêu cầu không được phép.'});
    }
    next();
  });
  const attempts=new Map();
  function limit(req,res,next){
    const now=Date.now(),key=req.ip;
    for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
    const item=attempts.get(key)||{n:0,until:now+15*60*1000};item.n++;attempts.set(key,item);
    if(item.n>40)return res.status(429).json({error:'Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.'});next();
  }
  app.use(async(req,res,next)=>{
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tea_session='))?.slice(12);
    if(token&&/^[a-f0-9]{64}$/.test(token)){
      const [u]=await db.all('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',[digest(token),new Date().toISOString()]);
      if(u)req.user=safeUser(u);
    }next();
  });
  function auth(req,res,next){if(!req.user)return next(new HttpError(401,'Vui lòng đăng nhập.'));next();}
  function admin(req,res,next){if(req.user?.role!=='admin')return next(new HttpError(403,'Bạn không có quyền quản trị.'));next();}
  async function session(user,res){
    const token=randomBytes(32).toString('hex');
    await transaction(async tx=>{await tx.run('DELETE FROM sessions WHERE expires_at<?',[new Date().toISOString()]);await tx.run('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)',[digest(token),user.id,new Date(Date.now()+7*86400000).toISOString()]);});
    res.cookie('tea_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:7*86400000,path:'/'});return safeUser(user);
  }
  app.get('/api/health',async(req,res)=>{await db.all('SELECT 1');res.json({ok:true,mode:driver});});
  app.get('/api/auth/me',(req,res)=>res.json({user:req.user||null}));
  app.post('/api/auth/register',limit,async(req,res)=>{
    const name=text(req.body.name,100),email=text(req.body.email,190).toLowerCase(),password=req.body.password;
    requireValue(name.length>=2&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Tên hoặc email không hợp lệ.');
    requireValue(typeof password==='string'&&password.length>=10&&Buffer.byteLength(password)<=72,'Mật khẩu cần từ 10 ký tự và tối đa 72 byte.');
    const hash=await bcrypt.hash(password,12);
    const result=await transaction(tx=>tx.run('INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)',[name,email,hash,'customer',new Date().toISOString()]));
    res.status(201).json({user:await session({id:result.insertId,name,email,role:'customer'},res)});
  });
  app.post('/api/auth/login',limit,async(req,res)=>{
    const email=text(req.body.email,190).toLowerCase(),password=req.body.password;
    requireValue(typeof password==='string'&&Buffer.byteLength(password)<=72,'Email hoặc mật khẩu chưa đúng.',401);
    const [u]=await db.all('SELECT * FROM users WHERE email=?',[email]);
    requireValue(u&&await bcrypt.compare(password,u.password_hash),'Email hoặc mật khẩu chưa đúng.',401);
    res.json({user:await session(u,res)});
  });
  app.post('/api/auth/logout',async(req,res)=>{
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tea_session='))?.slice(12);
    if(token)await transaction(tx=>tx.run('DELETE FROM sessions WHERE token_hash=?',[digest(token)]));
    res.clearCookie('tea_session',{path:'/'}).json({ok:true});
  });
  app.get('/api/catalog',async(req,res)=>{
    const [products,categories,toppings,zones,stores]=await Promise.all([db.all('SELECT * FROM products WHERE active=1 ORDER BY featured DESC,id'),db.all('SELECT * FROM categories ORDER BY id'),db.all('SELECT * FROM toppings ORDER BY id'),db.all('SELECT * FROM delivery_zones WHERE active=1 ORDER BY id'),db.all('SELECT * FROM store_settings WHERE id=1')]);
    res.json({products,categories,toppings,zones,store:stores[0],mode:driver});
  });
  app.post('/api/checkout/quote',async(req,res)=>res.json(await quote(db,req.body)));
  app.post('/api/orders',auth,async(req,res)=>{
    const order=await transaction(tx=>createOrder(tx,req.user,req.body));res.status(order.reused?200:201).json(order);
  });
  async function orders(req,res,all=false){
    const list=await db.all(`SELECT * FROM orders ${all?'':'WHERE user_id=?'} ORDER BY id DESC LIMIT 100`,all?[]:[req.user.id]);
    for(const o of list){o.items=await db.all('SELECT * FROM order_items WHERE order_id=?',[o.id]);o.history=await db.all('SELECT * FROM order_history WHERE order_id=? ORDER BY id',[o.id]);o.next=nextStatuses(o);delete o.request_hash;delete o.request_key;}
    res.json(list);
  }
  app.get('/api/orders',auth,(req,res)=>orders(req,res));
  app.get('/api/orders/:id/receipt',auth,async(req,res)=>{
    const id=Number(req.params.id);
    requireValue(integer(id,1,2147483647),'Không tìm thấy đơn hàng.',404);
    const [order]=await db.all('SELECT * FROM orders WHERE id=?',[id]);
    requireValue(order&&(req.user.role==='admin'||order.user_id===req.user.id),'Không tìm thấy đơn hàng.',404);
    const items=await db.all('SELECT * FROM order_items WHERE order_id=? ORDER BY id',[id]);
    res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    const [store]=await db.all('SELECT * FROM store_settings WHERE id=1');
    res.type('html').send(receiptHtml(order,items,store));
  });
  app.post('/api/orders/:id/cancel',auth,async(req,res)=>{await transaction(tx=>changeStatus(tx,req.user,Number(req.params.id),'cancelled',req.body.note));res.json({ok:true});});
  app.use('/api/admin',auth,admin);
  attachStoreRoutes(app);
  app.get('/api/admin/orders',(req,res)=>orders(req,res,true));
  app.patch('/api/admin/orders/:id/status',async(req,res)=>{await transaction(tx=>changeStatus(tx,req.user,Number(req.params.id),req.body.status,req.body.note));res.json({ok:true});});
  app.get('/api/admin/catalog',async(req,res)=>{
    const [products,categories,toppings,coupons]=await Promise.all([db.all('SELECT * FROM products ORDER BY id DESC'),db.all('SELECT * FROM categories ORDER BY id'),db.all('SELECT * FROM toppings ORDER BY id'),db.all('SELECT * FROM coupons ORDER BY id DESC')]);res.json({products,categories,toppings,coupons});
  });
  app.post('/api/admin/products',async(req,res)=>{
    res.status(201).json(await saveProduct(null,req.body));
  });
  app.put('/api/admin/products/:id',async(req,res)=>res.json(await saveProduct(Number(req.params.id),req.body)));
  async function saveProduct(id,b){
    requireValue(text(b.name,100).length>=2&&text(b.description,1000).length>=5,'Nhập tên và mô tả món.');
    requireValue(integer(b.price_m,1000,1000000)&&integer(b.price_l,1000,1000000)&&integer(b.category_id,1,2147483647),'Giá hoặc danh mục không hợp lệ.');
    requireValue(/^#[0-9a-f]{6}$/i.test(b.color),'Màu không hợp lệ.');
    const values=[text(b.name,100),text(b.description,1000),b.category_id,b.price_m,b.price_l,b.color,b.active?1:0,b.available?1:0,b.featured?1:0];
    return transaction(async tx=>{
      requireValue((await tx.all('SELECT id FROM categories WHERE id=?',[b.category_id])).length,'Danh mục không tồn tại.');
      if(id){requireValue((await tx.all('SELECT id FROM products WHERE id=?',[id])).length,'Không tìm thấy món.',404);await tx.run('UPDATE products SET name=?,description=?,category_id=?,price_m=?,price_l=?,color=?,active=?,available=?,featured=? WHERE id=?',[...values,id]);return {id};}
      const r=await tx.run('INSERT INTO products (name,description,category_id,price_m,price_l,color,active,available,featured) VALUES (?,?,?,?,?,?,?,?,?)',values);return {id:r.insertId};
    });
  }
  app.post('/api/admin/categories',async(req,res)=>{requireValue(text(req.body.name,80).length>=2,'Nhập tên danh mục.');const r=await transaction(tx=>tx.run('INSERT INTO categories (name) VALUES (?)',[text(req.body.name,80)]));res.status(201).json({id:r.insertId});});
  app.put('/api/admin/categories/:id',async(req,res)=>{requireValue(text(req.body.name,80).length>=2,'Nhập tên danh mục.');await transaction(tx=>tx.run('UPDATE categories SET name=? WHERE id=?',[text(req.body.name,80),Number(req.params.id)]));res.json({ok:true});});
  app.post('/api/admin/toppings',async(req,res)=>res.status(201).json(await saveTopping(null,req.body)));
  app.put('/api/admin/toppings/:id',async(req,res)=>res.json(await saveTopping(Number(req.params.id),req.body)));
  async function saveTopping(id,b){
    requireValue(text(b.name,80).length>=2&&integer(b.price,0,100000),'Tên hoặc giá topping không hợp lệ.');
    return transaction(async tx=>{const r=await tx.run(id?'UPDATE toppings SET name=?,price=?,available=? WHERE id=?':'INSERT INTO toppings (name,price,available) VALUES (?,?,?)',[text(b.name,80),b.price,b.available?1:0,...(id?[id]:[])]);return {id:id||r.insertId};});
  }
  app.post('/api/admin/coupons',async(req,res)=>res.status(201).json(await saveCoupon(null,req.body)));
  app.put('/api/admin/coupons/:id',async(req,res)=>res.json(await saveCoupon(Number(req.params.id),req.body)));
  async function saveCoupon(id,b){
    const code=text(b.code,30).toUpperCase();
    requireValue(/^[A-Z0-9]{3,30}$/.test(code)&&integer(b.discount,1000,1000000)&&integer(b.min_total,0,10000000)&&integer(b.max_uses,1,1000000)&&!Number.isNaN(Date.parse(b.expires_at)),'Thông tin mã giảm giá không hợp lệ.');
    const values=[code,b.discount,b.min_total,new Date(b.expires_at).toISOString(),b.max_uses,b.active?1:0];
    return transaction(async tx=>{const r=await tx.run(id?'UPDATE coupons SET code=?,discount=?,min_total=?,expires_at=?,max_uses=?,active=? WHERE id=?':'INSERT INTO coupons (code,discount,min_total,expires_at,max_uses,active) VALUES (?,?,?,?,?,?)',[...values,...(id?[id]:[])]);return {id:id||r.insertId};});
  }
  app.get('/api/admin/reports',async(req,res)=>{
    const period=reportPeriod(req.query),{from,to,start,end}=period;
    const rows=await revenueOrders(db,period);
    const created=await db.all('SELECT status,COUNT(*) AS count FROM orders WHERE created_at>=? AND created_at<=? GROUP BY status',[start,end]);
    const best=await db.all('SELECT i.product_id,i.product_name,SUM(i.quantity) AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status=? AND o.paid=1 AND o.completed_at>=? AND o.completed_at<=? GROUP BY i.product_id,i.product_name ORDER BY quantity DESC LIMIT 5',['completed',start,end]);
    const daily={};for(const o of rows){const day=new Date(Date.parse(o.completed_at)+7*3600000).toISOString().slice(0,10);daily[day]=(daily[day]||0)+o.total;}
    res.json({revenue:rows.reduce((s,o)=>s+o.total,0),completed:rows.length,created,best,daily,from,to});
  });
  app.get('/api/admin/reports/export.csv',async(req,res)=>{
    const period=reportPeriod(req.query);
    const rows=await revenueOrders(db,period);
    res.set('Content-Disposition',`attachment; filename="tea-house-doanh-thu-${period.from}-${period.to}.csv"`);
    res.type('text/csv; charset=utf-8').send(revenueCsv(rows));
  });
  app.use('/api',(req,res)=>res.status(404).json({error:'API không tồn tại.'}));
  if(existsSync(resolve('dist/index.html'))){app.use(express.static(resolve('dist')));app.get('/{*path}',(req,res)=>res.sendFile(resolve('dist/index.html')));}
  app.use((err,req,res,next)=>{
    if(err.code==='ER_DUP_ENTRY'||String(err.message).includes('UNIQUE constraint'))return res.status(409).json({error:'Email hoặc mã này đã tồn tại.'});
    if(err.type==='entity.parse.failed')return res.status(400).json({error:'Dữ liệu JSON không hợp lệ.'});
    if(!err.status)console.error(err.message);
    res.status(err.status||500).json({error:err.status?err.message:'Có lỗi xử lý. Vui lòng thử lại.'});
  });
  return app;
}

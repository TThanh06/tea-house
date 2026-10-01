import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { db, driver, transaction, initSchema, closeDb } from './db.js';

export async function seed() {
  if ((await db.all('SELECT id FROM users LIMIT 1')).length) return;
  const adminPass=process.env.SEED_ADMIN_PASSWORD || (driver==='demo'?'Admin@12345':'');
  const customerPass=process.env.SEED_CUSTOMER_PASSWORD || (driver==='demo'?'Khach@12345':'');
  if(!adminPass || !customerPass)throw new Error('Set SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD before seeding MySQL.');
  if(adminPass.length<10 || customerPass.length<10)throw new Error('Seed passwords must have at least 10 characters.');
  const hashes=await Promise.all([bcrypt.hash(adminPass,12),bcrypt.hash(customerPass,12)]);
  await transaction(async tx=>{
    for(const [i,name,email,role] of [[0,'Quản trị viên','admin@teahouse.local','admin'],[1,'Khách trải nghiệm','khach@teahouse.local','customer']])await tx.run('INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)',[name,email,hashes[i],role,new Date().toISOString()]);
    for(const name of ['Trà sữa','Trà trái cây','Matcha','Sữa tươi'])await tx.run('INSERT INTO categories (name) VALUES (?)',[name]);
    const products=[
      ['Trà sữa trân châu','Trà đen thơm dịu, sữa béo nhẹ. Một hương vị quen mà luôn khiến bạn nhớ.',1,35000,42000,'#bc8854',1],
      ['Trà sữa ô long','Ô long rang thơm, hậu trà thanh và lớp sữa mềm mịn.',1,39000,46000,'#ac794a',1],
      ['Trà sữa khoai môn','Khoai môn bùi thơm hòa cùng sữa, dịu ngọt trong từng ngụm.',1,42000,49000,'#b9a0c3',1],
      ['Trà sữa chocolate','Cacao đậm đà quyện trà và sữa. Dành cho ngày cần thêm chút ngọt.',1,42000,49000,'#89634b',0],
      ['Trà đào cam sả','Đào ngọt thanh, cam tươi và hương sả nhẹ nhàng.',2,39000,46000,'#e8aa62',1],
      ['Trà vải hoa nhài','Trà nhài thanh mát kết hợp vị vải ngọt dịu.',2,39000,46000,'#d7b47f',0],
      ['Trà chanh dây','Vị chua tươi mát của chanh dây, cân bằng cùng trà thơm.',2,35000,42000,'#d9aa39',0],
      ['Trà dâu nhiệt đới','Hương dâu tươi vui và nền trà trái cây dịu nhẹ.',2,42000,49000,'#d78786',0],
      ['Matcha latte','Matcha thơm xanh, sữa tươi mềm mịn và hậu vị thanh.',3,45000,52000,'#93a575',1],
      ['Matcha kem sữa','Matcha đậm vị với lớp kem sữa béo mịn.',3,49000,56000,'#7f9861',0],
      ['Sữa tươi đường đen','Sữa tươi mát lành cùng đường đen thơm ngọt.',4,42000,49000,'#d4b08a',1],
      ['Sữa tươi cacao','Sữa tươi và cacao nguyên chất cho một chiều thư thái.',4,42000,49000,'#ae8064',0]
    ];
    for(const row of products)await tx.run('INSERT INTO products (name,description,category_id,price_m,price_l,color,featured) VALUES (?,?,?,?,?,?,?)',row);
    for(const row of [['Trân châu đen',7000],['Trân châu trắng',8000],['Pudding trứng',10000],['Thạch dừa',7000],['Kem sữa',12000]])await tx.run('INSERT INTO toppings (name,price) VALUES (?,?)',row);
    for(const row of [['Khu vực gần cửa hàng',15000],['Khu vực lân cận',25000]])await tx.run('INSERT INTO delivery_zones (name,fee) VALUES (?,?)',row);
    await tx.run('INSERT INTO coupons (code,discount,min_total,expires_at,max_uses) VALUES (?,?,?,?,?)',['CHAO10',10000,60000,'2030-12-31T23:59:59.999Z',1000]);
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {await initSchema();await seed();console.log('Database ready. Existing data is preserved.');}catch(e){console.error(e.message);process.exitCode=1;}finally{await closeDb();}
}

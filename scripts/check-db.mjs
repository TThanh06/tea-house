import { readEnvironment, inspectDatabase, friendlyDatabaseError, tableNames } from './database-config.mjs';

try {
  const config = { ...await readEnvironment(), ...process.env };
  if ((config.DB_DRIVER || 'demo') === 'demo') {
    console.log('Đang dùng SQLite demo. Chưa chuyển sang MySQL.');
    console.log('Để cấu hình MySQL: nhấp CAU-HINH-MYSQL.cmd hoặc chạy npm.cmd run db:setup');
  } else {
    const info = await inspectDatabase(config);
    if (!info.exists) throw Object.assign(new Error(), { code: 'ER_BAD_DB_ERROR' });
    const missing = tableNames.filter(name => !info.tables.includes(name));
    console.log(`Kết nối thành công: MySQL ${info.version}, database ${info.database}.`);
    if (missing.length || !info.users) {
      console.log('Kết nối được nhưng dữ liệu khởi tạo chưa đầy đủ. Chạy npm.cmd run db:setup.');
      process.exitCode = 1;
    } else console.log('Đủ bảng và đã có tài khoản. Sẵn sàng khởi động Tea House.');
  }
} catch (error) { console.error(friendlyDatabaseError(error)); process.exitCode = 1; }

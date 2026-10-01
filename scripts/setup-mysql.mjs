import { createInterface, emitKeypressEvents } from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readEnvironment, inspectDatabase, createDatabase, saveEnvironment, friendlyDatabaseError, tableNames } from './database-config.mjs';

const execute = promisify(execFile);

async function ask(label, fallback = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve, reject) => {
      rl.once('SIGINT', () => reject(new Error('Đã hủy. Cấu hình hiện tại chưa thay đổi.')));
      rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `, answer => resolve(answer.trim() || fallback));
    });
  } finally { rl.close(); }
}

async function secret(label) {
  if (!process.stdin.isTTY) throw new Error('Hãy mở CAU-HINH-MYSQL.cmd trong cửa sổ terminal để nhập mật khẩu an toàn.');
  process.stdout.write(label + ': ');
  emitKeypressEvents(process.stdin);
  const wasRaw = !!process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      let value = '';
      function done(error) {
        process.stdin.removeListener('keypress', keypress);
        process.stdout.write('\n');
        if (error) reject(error); else resolve(value);
      }
      function keypress(character, key = {}) {
        if (key.ctrl && key.name === 'c') return done(new Error('Đã hủy. Cấu hình hiện tại chưa thay đổi.'));
        if (key.name === 'return' || key.name === 'enter') return done();
        if (key.name === 'backspace') { if (value) { value = [...value].slice(0, -1).join(''); process.stdout.write('\b \b'); } return; }
        if (character && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(character)) {
          value += character; process.stdout.write('*'.repeat([...character].length));
        }
      }
      process.stdin.on('keypress', keypress);
    });
  } finally { process.stdin.setRawMode(wasRaw); process.stdin.pause(); }
}

async function newPassword(label) {
  const password = await secret(label);
  if (password.length < 10 || Buffer.byteLength(password) > 72) throw new Error('Mật khẩu tài khoản web cần ít nhất 10 ký tự và tối đa 72 byte.');
  if (await secret('Nhập lại mật khẩu') !== password) throw new Error('Hai mật khẩu không trùng nhau. Cấu hình hiện tại chưa thay đổi.');
  return password;
}

try {
  console.log('\nTEA HOUSE — KẾT NỐI MYSQL\n');
  console.log('Nhập tài khoản MySQL đang dùng trong Workbench. Mật khẩu không hiển thị.');
  console.log('Công cụ không đổi mật khẩu MySQL, không xóa database và không chuyển dữ liệu SQLite.\n');
  const previous = await readEnvironment();
  const config = {
    DB_HOST: await ask('Máy chủ', previous.DB_HOST || '127.0.0.1'),
    DB_PORT: await ask('Cổng', previous.DB_PORT || '3306'),
    DB_NAME: await ask('Database riêng cho Tea House', previous.DB_NAME || 'tea_house'),
    DB_USER: await ask('Tên tài khoản MySQL (User)', previous.DB_USER || 'root'),
    DB_PASSWORD: await secret('Mật khẩu MySQL'),
  };
  console.log('\nĐang kiểm tra kết nối…');
  const before = await inspectDatabase(config);
  console.log(`Đã kết nối MySQL ${before.version}.`);
  const answer = await ask(before.exists
    ? `Dùng database ${before.database}, tạo bảng/dữ liệu Tea House còn thiếu? (y/n)`
    : `Tạo database mới ${before.database} và dữ liệu mẫu Tea House? (y/n)`, 'y');
  if (!['y', 'yes'].includes(answer.toLowerCase())) throw new Error('Đã hủy. Cấu hình hiện tại chưa thay đổi.');
  let adminPassword = '', customerPassword = '';
  if (!before.users) {
    console.log('\nĐặt mật khẩu đăng nhập website (khác với mật khẩu MySQL).');
    adminPassword = await newPassword('Mật khẩu cho admin@teahouse.local');
    customerPassword = await newPassword('Mật khẩu cho khach@teahouse.local');
  }
  if (!before.exists) await createDatabase(config);
  console.log('Đang khởi tạo bảng và dữ liệu…');
  const env = { ...process.env, ...config, DB_DRIVER: 'mysql', DB_PASSWORD_BASE64: '',
    SEED_ADMIN_PASSWORD: adminPassword, SEED_CUSTOMER_PASSWORD: customerPassword };
  try {
    await execute(process.execPath, [resolve('server/seed.js')], { env, timeout: 60000, windowsHide: true });
  } catch {
    throw new Error('Khởi tạo chưa hoàn tất. File .env cũ được giữ nguyên. Kiểm tra quyền tạo/ghi bảng và cấu trúc database; các bảng mới có thể đã được tạo.');
  }
  const verified = await inspectDatabase(config);
  if (!tableNames.every(name => verified.tables.includes(name)) || !verified.users) throw new Error('Database chưa đủ dữ liệu; chưa thay đổi file .env.');
  await saveEnvironment(config);
  console.log('\nTHÀNH CÔNG: đã lưu .env dùng MySQL và sao lưu cấu hình cũ trong data/config-backups.');
  console.log('Dừng cửa sổ server đang chạy bằng Ctrl+C, sau đó mở CHAY-DU-AN.cmd.');
  console.log('Đăng nhập website bằng mật khẩu web bạn vừa đặt (hoặc tài khoản có sẵn nếu database cũ).');
} catch (error) { console.error('\n' + friendlyDatabaseError(error)); process.exitCode = 1; }

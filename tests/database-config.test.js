import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectionOptions, databasePassword, saveEnvironment, readEnvironment, friendlyDatabaseError } from '../scripts/database-config.mjs';

test('setup validates database identifiers and ports before connecting', () => {
  for (const name of ['tea-house', 'tea_house;DROP DATABASE x', '', '9test']) {
    if (!name) continue;
    assert.throws(() => connectionOptions({ DB_USER: 'tester', DB_NAME: name }));
  }
  for (const port of ['0', '65536', 'abc']) assert.throws(() => connectionOptions({ DB_USER: 'tester', DB_PORT: port }));
  assert.throws(() => connectionOptions({ DB_USER: '' }));
  assert.equal(connectionOptions({ DB_USER: 'tester', DB_NAME: 'tea_house' }).database, 'tea_house');
});

test('setup saves special characters without corrupting password and backs up original env', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tea-setup-test-'));
  const original = 'DB_DRIVER=demo\nPORT=3010\nHOST=127.0.0.1\nCUSTOM_FLAG=keep\nSEED_ADMIN_PASSWORD=old-web-secret\n';
  await writeFile(join(dir, '.env'), original);
  const password = `both'quotes" #spaces \\n \\t`;
  await saveEnvironment({ DB_HOST: '127.0.0.1', DB_PORT: 3306, DB_NAME: 'tea_house', DB_USER: 'tester', DB_PASSWORD: password }, dir);
  const saved = await readEnvironment(join(dir, '.env'));
  assert.equal(saved.DB_DRIVER, 'mysql');
  assert.equal(databasePassword(saved), password);
  assert.equal(saved.PORT, '3010');
  assert.equal(saved.CUSTOM_FLAG, 'keep');
  assert.equal(saved.SEED_ADMIN_PASSWORD, undefined);
  assert.equal(saved.DB_PASSWORD, undefined);
  const backups = await readdir(join(dir, 'data/config-backups'));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(join(dir, 'data/config-backups', backups[0]), 'utf8'), original);
});

test('database password handles both manual and setup config including empty password', () => {
  assert.equal(databasePassword({ DB_PASSWORD: 'manual#password' }), 'manual#password');
  assert.equal(databasePassword({ DB_PASSWORD_BASE64: Buffer.from('wizard password').toString('base64') }), 'wizard password');
  assert.equal(databasePassword({ DB_PASSWORD_BASE64: '' }), '');
});

test('connection diagnostics do not include raw server error or password', () => {
  const error = { code: 'ER_ACCESS_DENIED_ERROR', message: 'Sensitive raw error: password' };
  assert.ok(friendlyDatabaseError(error).includes('Workbench'));
  assert.ok(!friendlyDatabaseError(error).includes('Sensitive'));
});

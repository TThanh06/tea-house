import { db, initSchema, closeDb } from '../server/db.js';
try {
  await initSchema();
  const rows = await db.all('SELECT id FROM schema_migrations ORDER BY id');
  console.log('Database sẵn sàng:', rows.map(row => row.id).join(', '));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await closeDb(); }

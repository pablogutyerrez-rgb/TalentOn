// Publica únicamente la ventana de asistencia; no modifica registros históricos.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const name = '202610260001_attendance_window_day.sql';
const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
const sha256 = createHash('sha256').update(sql).digest('hex');
const execute = process.argv.includes('--execute');
const api = new URL(process.env.SUPABASE_URL || '');
const database = new URL(process.env.SUPABASE_DATABASE_URL || '');
const project = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const validHost = database.hostname === `db.${project}.supabase.co` ||
  (database.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(database.username) === `postgres.${project}`);
if (!project || api.protocol !== 'https:' || !validHost) throw new Error('PROJECT_ROUTING_MISMATCH');
const client = new pg.Client({
  host: database.hostname, port: Number(database.port || 5432),
  user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
  database: decodeURIComponent(database.pathname.slice(1)), connectionTimeoutMillis: 15000,
  ssl: { ca: readFileSync(process.env.SUPABASE_CA_CERT), rejectUnauthorized: true, servername: database.hostname },
});
const definitionQuery = "select pg_get_functiondef('talent_private.attendance_window()'::regprocedure) as definition";

try {
  await client.connect();
  if (client.connection.stream.authorized !== true) throw new Error('TLS_NOT_VERIFIED');
  const recorded = (await client.query('select name,sha256 from talent_private.applied_migrations')).rows;
  const recordedByName = new Map(recorded.map(row => [row.name, row.sha256]));
  const pending = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort().filter(file => !recordedByName.has(file));
  console.log(`Migraciones locales aún no aplicadas: ${pending.length ? pending.join(', ') : 'ninguna'}.`);
  if (pending.some(file => file !== name)) throw new Error('OTHER_MIGRATIONS_PENDING');
  const applied = (await client.query('select sha256 from talent_private.applied_migrations where name=$1', [name])).rows[0];
  if (applied && applied.sha256 !== sha256) throw new Error('APPLIED_MIGRATION_HASH_MISMATCH');
  if (applied) {
    console.log('Migración de asistencia ya aplicada; hash verificado.');
  } else if (!execute) {
    console.log(`Pendiente: ${name}; conexión TLS y proyecto verificados.`);
  } else {
    const previous = (await client.query(definitionQuery)).rows[0].definition;
    mkdirSync('supabase/.local', { recursive: true });
    const backup = `supabase/.local/attendance-window-before-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    writeFileSync(backup, previous, { flag: 'wx', mode: 0o600 });
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtextextended('talent:migrations',0))");
    await client.query("set local lock_timeout='10s'");
    const concurrent = (await client.query('select sha256 from talent_private.applied_migrations where name=$1', [name])).rows[0];
    if (concurrent) throw new Error('MIGRATION_APPLIED_CONCURRENTLY');
    await client.query(sql.replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, ''));
    await client.query('insert into talent_private.applied_migrations(name,sha256) values($1,$2)', [name, sha256]);
    await client.query('commit');
    console.log(`Migración aplicada; definición anterior guardada en ${backup}.`);
  }
  const current = (await client.query(definitionQuery)).rows[0].definition;
  if ((applied || execute) && (!current.includes("time '09:00'") || !current.includes("time '21:30'"))) throw new Error('ATTENDANCE_WINDOW_VERIFICATION_FAILED');
  if (execute) await client.query("notify pgrst,'reload schema'");
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`ATTENDANCE_MIGRATION_FAILED: ${error.code || error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

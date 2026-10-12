// Diagnóstico exclusivamente de lectura. No carga Firebase ni ejecuta migraciones.
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let client;
try {
 const database = new URL(process.env.SUPABASE_DATABASE_URL || '');
 const api = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
 const project = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
 const user = decodeURIComponent(database.username);
 const direct = database.hostname === `db.${project}.supabase.co`;
 const pooled = database.hostname.endsWith('.pooler.supabase.com') && user === `postgres.${project}`;
 if (!project || api.protocol !== 'https:' || !['postgres:','postgresql:'].includes(database.protocol) || (!direct && !pooled)) throw new Error('PROJECT_ROUTING_MISMATCH');
 if (!process.env.SUPABASE_CA_CERT) throw new Error('SUPABASE_CA_CERT_REQUIRED');
 const ca = readFileSync(process.env.SUPABASE_CA_CERT);
 const cert = new X509Certificate(ca);
 const now = Date.now();
 if (!cert.ca || now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) throw new Error('CA_INVALID_OR_EXPIRED');
 console.log('CA: válida, vigente; SHA256 ' + cert.fingerprint256);
 console.log('Proyecto URL/API y destino PostgreSQL: coinciden (' + project + ')');
 const { default: pg } = process.env.PG_MODULE
  ? await import(pathToFileURL(process.env.PG_MODULE).href)
  : await import('pg');
 // Sin connectionString: sslmode/sslrootcert de URL no pueden sobrescribir controles TLS.
 client = new pg.Client({ host: database.hostname, port: Number(database.port || 5432),
  user, password: decodeURIComponent(database.password), database: decodeURIComponent(database.pathname.slice(1)),
  connectionTimeoutMillis: 15000, query_timeout: 15000,
  ssl: { ca, rejectUnauthorized: true, servername: database.hostname } });
 await client.connect();
 await client.query('BEGIN READ ONLY');
 const result = await client.query("select current_database() as database, current_setting('server_version') as version, current_setting('transaction_read_only') as read_only, (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl, (select version from pg_stat_ssl where pid=pg_backend_pid()) as tls_version");
 const status = result.rows[0];
 const socket = client.connection.stream;
 if (!socket.encrypted || socket.authorized !== true || status.read_only !== 'on') throw new Error('SECURE_READ_ONLY_CHECK_FAILED');
 console.log('Conexión PostgreSQL: OK; certificado servidor y hostname verificados');
 console.log(JSON.stringify({ ...status, client_tls: socket.getProtocol(), client_certificate_authorized: socket.authorized }));
 if (!status.ssl && pooled) console.log('pg_stat_ssl describe el tramo pooler→PostgreSQL, no el TLS cliente→pooler verificado.');
 await client.query('ROLLBACK');
} catch (error) {
 const safe = ['PROJECT_ROUTING_MISMATCH','SUPABASE_CA_CERT_REQUIRED','CA_INVALID_OR_EXPIRED','SECURE_READ_ONLY_CHECK_FAILED'];
 console.error('POSTGRES_CHECK_FAILED: ' + (error.code || (safe.includes(error.message) ? error.message : error.name)));
 process.exitCode = 1;
} finally { if (client) await client.end().catch(() => {}); }

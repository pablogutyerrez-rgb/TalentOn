// Read-only, TLS-verified check for a public RQ identity. Never prints DNI or names.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const dni = process.env.TARGET_DNI;
const company = process.env.TARGET_COMPANY;
if (!/^\d{8}$/.test(dni || '') || !company) throw new Error('TARGET_REQUIRED');
const api = new URL(process.env.SUPABASE_URL || '');
const db = new URL(process.env.SUPABASE_DATABASE_URL || '');
const project = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
if (!project || !(db.hostname === `db.${project}.supabase.co` || db.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(db.username) === `postgres.${project}`)) throw new Error('PROJECT_MISMATCH');
const client = new pg.Client({ host: db.hostname, port: Number(db.port || 5432), user: decodeURIComponent(db.username), password: decodeURIComponent(db.password), database: db.pathname.slice(1), ssl: { ca: readFileSync(process.env.SUPABASE_CA_CERT), rejectUnauthorized: true, servername: db.hostname } });
try {
  await client.connect();
  if (!client.connection.stream.authorized) throw new Error('TLS_NOT_VERIFIED');
  const checkLookup = process.argv.includes('--rollback-lookup');
  await client.query(checkLookup ? 'begin' : 'begin read only');
  const result = await client.query(`select p.company_id, p.role, p.enabled, p.status, p.must_change_password, p.archived_at is null as current_profile,
    coalesce((p.annotations->>'companyAccessManaged')::boolean,false) as managed,
    exists(select 1 from talent_org.user_companies m where m.auth_user_id=p.auth_user_id and m.company_id=$2 and m.enabled and m.archived_at is null) as company_membership
    from talent.profiles p where p.document_number=$1 and not p.is_context`, [dni, company]);
  console.log(JSON.stringify({ project, company, matches: result.rows.length, profiles: result.rows }));
  if (checkLookup) {
    const link = await client.query('select token_hash from talent_ops.links where company_id=$1 and active and revoked_at is null order by created_at desc limit 1', [company]);
    if (!link.rows.length) console.log(JSON.stringify({ activeLink: false }));
    else {
      const lookup = await client.query('select public.talent_ops_public_lookup($1,$2,$3) as result', [link.rows[0].token_hash, dni, 'rollback-verification']);
      console.log(JSON.stringify({ activeLink: true, lookupFound: lookup.rows[0].result?.found === true }));
    }
  }
  await client.query('rollback');
} finally { await client.end(); }

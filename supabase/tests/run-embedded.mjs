// SQL real en PostgreSQL WASM aislado. No abre conexiones remotas ni carga .env.
// PGLITE_MODULE: ruta absoluta al index.js de una instalación temporal.
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
if (!process.env.PGLITE_MODULE) throw new Error('Configura PGLITE_MODULE; no se instala ninguna dependencia en Talent-On.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'));
 for (const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(resolve('supabase/migrations',f),'utf8'));
  console.log('PASS migration '+f);
 }
 for(const f of ['invariants.sql','relational.sql','first-password.sql']) {
  await db.exec(readFileSync(resolve('supabase/tests',f),'utf8'));
  console.log('PASS tests '+f);
 }
 console.log('Multisesión/concurrencia real: ejecutar workflow PostgreSQL 17; no validada por WASM.');
 if(process.argv.includes('--catalog')) {
  const columns=await db.query("select c.relname as table_name,a.attname as column_name,format_type(a.atttypid,a.atttypmod) as data_type,case when a.attnotnull then 'NO' else 'YES' end as is_nullable,pg_get_expr(d.adbin,d.adrelid) as column_default from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='talent' and c.relkind='r' and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum");
  const constraints=await db.query("select conrelid::regclass::text as table_name,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='talent'::regnamespace order by conrelid::regclass::text,conname");
  console.log('CATALOG_JSON:'+JSON.stringify({columns:columns.rows,constraints:constraints.rows}));
 }
} catch(e) { console.error('SQL FAIL:',e.message); process.exitCode=1; }
finally { await db.close(); }

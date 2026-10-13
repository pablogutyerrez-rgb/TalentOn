// Aplicación autorizada y atómica. Nunca copia Firebase, no toca Auth ni R2.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if(!process.argv.includes('--execute'))throw Error('Requiere --execute');
const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE).href);
const {PGlite}=await import(pathToFileURL(resolve('worker/node_modules/@electric-sql/pglite/dist/index.js')).href);
const api=new URL(process.env.SUPABASE_URL),url=new URL(process.env.SUPABASE_DATABASE_URL);
const project=api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
if(!project||api.protocol!=='https:'||!(url.hostname==='db.'+project+'.supabase.co'||url.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(url.username)==='postgres.'+project))throw Error('PROJECT_MISMATCH');
const c=new pg.Client({host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),connectionTimeoutMillis:15000,ssl:{ca:readFileSync(process.env.SUPABASE_CA_CERT),rejectUnauthorized:true,servername:url.hostname}});
const identityOnly=process.argv.includes('--identity');
const profileOnly=process.argv.includes('--profile');
const globalOnly=process.argv.includes('--global');
const userOrderOnly=process.argv.includes('--user-order');
const captureFormOnly=process.argv.includes('--capture-form');
const captureSettingsOnly=process.argv.includes('--capture-settings');
const captureBuilderOnly=process.argv.includes('--capture-builder');
const guardOnly=process.argv.includes('--guard');const contextOnly=process.argv.includes('--context');const extensionOnly=identityOnly||guardOnly||contextOnly||profileOnly||globalOnly||userOrderOnly||captureFormOnly||captureSettingsOnly||captureBuilderOnly;
const names=captureBuilderOnly?['202610130017_capture_form_builder.sql']:captureSettingsOnly?['202610130016_capture_campaign_settings.sql']:captureFormOnly?['202610130015_public_capture_catalog.sql']:userOrderOnly?['202610130014_user_create_membership_order.sql']:globalOnly?['202610130013_global_dashboard_user_access.sql']:profileOnly?['202610120012_multiempresa_profile_identity.sql']:contextOnly?['202610120011_multiempresa_context_list.sql']:guardOnly?['202610120010_multiempresa_global_guard.sql']:identityOnly?['202610120009_multiempresa_identity.sql']:['202610120007_multiempresa_prepared.sql','202610120008_multiempresa_runtime.sql'];
const hash=v=>createHash('sha256').update(v).digest('hex');const quote=v=>'"'+v.replaceAll('"','""')+'"';
let isolated;
try{
 await c.connect();if(!c.connection.stream.authorized)throw Error('TLS_NOT_VERIFIED');
 const applied=(await c.query('select name,sha256 from talent_private.applied_migrations')).rows;
 for(const m of applied){if(readFileSync('supabase/migrations/'+m.name,'utf8')&&hash(readFileSync('supabase/migrations/'+m.name,'utf8'))!==m.sha256)throw Error('APPLIED_HASH_MISMATCH');}
 const pending=names.filter(n=>!applied.some(a=>a.name===n));
 if(!pending.length){console.log('Migraciones solicitadas ya aplicadas; hashes correctos.');process.exitCode=0;}
 else{
  if(pending.length!==names.length)throw Error('PARTIAL_ORG_MIGRATION_REQUIRES_REVIEW');
  const admin=(await c.query("select id,auth_user_id,company_id from talent.profiles where username='admin' and auth_user_id is not null and role='ADMIN' and enabled and status='ACTIVO' and not must_change_password and archived_at is null")).rows;
  if(admin.length!==1)throw Error('EXPLICIT_ADMIN_NOT_AVAILABLE');
  // No reubicar empresas que ya tengan registros bajo IDs reservados.
  if(!extensionOnly&&(await c.query("select count(*)::int as n from talent.companies where id in ('talent-up','techcenter','konectados')")).rows[0].n)throw Error('CATALOG_ID_CONFLICT_REQUIRES_REVIEW');
  await c.query('begin isolation level repeatable read read only');
  const tables=(await c.query("select schemaname,tablename from pg_tables where schemaname in ('talent','talent_private','talent_org') or (schemaname='public' and tablename='talent_documents') order by schemaname,tablename")).rows;
  const backup={project,createdAt:new Date().toISOString(),tables:{},functions:(await c.query("select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='talent_private' or (n.nspname='public' and p.proname like 'talent_%')")).rows.map(r=>r.definition),migrations:readdirSync('supabase/migrations').filter(n=>applied.some(a=>a.name===n)).sort().map(name=>({name,sql:readFileSync('supabase/migrations/'+name,'utf8')}))};
  for(const t of tables){const key=t.schemaname+'.'+t.tablename;backup.tables[key]=(await c.query('select to_jsonb(r) as row from '+quote(t.schemaname)+'.'+quote(t.tablename)+' r')).rows.map(r=>r.row);}
  await c.query('rollback');mkdirSync('supabase/.local',{recursive:true});
  const file='supabase/.local/multiempresa-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';writeFileSync(file,JSON.stringify(backup),{flag:'wx',mode:0o600});
  const saved=JSON.parse(readFileSync(file,'utf8'));if(saved.project!==project)throw Error('BACKUP_PROJECT_MISMATCH');
  // Ensayo de restauración exclusivamente WASM, sin credenciales Auth ni servicios remotos.
  isolated=new PGlite();await isolated.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'));
  for(const m of saved.migrations)await isolated.exec(m.sql);
  await isolated.exec('create table talent_private.applied_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now())');
  const ids=new Set(Object.values(saved.tables).flat().flatMap(row=>Object.values(row).filter(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v))));
  for(const id of ids)await isolated.query('insert into auth.users(id) values($1::uuid) on conflict do nothing',[id]);
  await isolated.exec('begin;set constraints all deferred');
  await isolated.exec("do $$ declare f record;begin for f in select conrelid::regclass as tbl,conname from pg_constraint where contype='f' and connamespace in ('talent'::regnamespace,'talent_private'::regnamespace) or (contype='f' and connamespace=(select oid from pg_namespace where nspname='talent_org')) loop execute format('alter table %s alter constraint %I deferrable initially deferred',f.tbl,f.conname);end loop;end $$;");
  await isolated.exec('truncate '+Object.keys(saved.tables).join(',')+' restart identity cascade');
  for(const key of Object.keys(saved.tables))await isolated.exec('alter table '+key+' disable trigger user');
  for(const [key,rows]of Object.entries(saved.tables)){
   for(const row of rows){const cols=Object.keys(row).map(quote).join(',');await isolated.query('insert into '+key+' ('+cols+') overriding system value select '+Object.keys(row).map(k=>'r.'+quote(k)).join(',')+' from jsonb_populate_record(null::'+key+',$1::jsonb) r on conflict do nothing',[JSON.stringify(row)]);}
   const n=(await isolated.query('select count(*)::int as n from '+key)).rows[0].n;if(n!==rows.length)throw Error('RESTORE_COUNT_FAILED:'+key);
  }
  await isolated.exec('commit');await isolated.close();isolated=undefined;
  console.log('Respaldo privado y restauración aislada verificados: '+file+'; '+tables.length+' tablas.');
  await c.query('begin');await c.query("select pg_advisory_xact_lock(hashtextextended('talent:migrations',0))");
  await c.query('set local lock_timeout=\'10s\'');
  await c.query('lock table '+Object.keys(saved.tables).join(',')+' in share row exclusive mode');
  // Comprobar nuevamente versiones bajo bloqueo para no pisar cambios durante el respaldo.
  for(const [key,rows]of Object.entries(saved.tables)){
   const current=(await c.query('select to_jsonb(r) as row from '+key+' r')).rows.map(r=>r.row);
   const stable=rs=>rs.map(r=>JSON.stringify(r)).sort().join('\n');if(stable(current)!==stable(rows))throw Error('DATA_CHANGED_DURING_BACKUP');
  }
  for(const name of pending){const sql=readFileSync('supabase/migrations/'+name,'utf8');await c.query(sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));await c.query('insert into talent_private.applied_migrations(name,sha256) values($1,$2)',[name,hash(sql)]);}
  // Única asignación inicial: cuenta admin existente, solicitada como administrador global.
  await c.query("select set_config('talent.org_actor',$1,true)",[admin[0].auth_user_id]);
  if(!extensionOnly){await c.query('insert into talent_org.global_admins(id,auth_user_id) values($1,$2)',[admin[0].id,admin[0].auth_user_id]);
   for(const company of ['talent-up','techcenter','konectados'])await c.query("select public.talent_org_member_save($1,$1,$2,'ADMIN',true,true,'{}',null)",[admin[0].auth_user_id,company]);}
  const companies=(await c.query('select public.talent_org_context($1,null) as data',[admin[0].auth_user_id])).rows[0].data.companies;
  if(companies.length<4)throw Error('ADMIN_CONTEXT_VERIFICATION_FAILED');
  for(const company of ['talent-up','techcenter','konectados']){const snapshot=(await c.query('select public.talent_org_snapshot($1,$2) as data',[admin[0].auth_user_id,company])).rows[0].data;if(snapshot.companyId!==company||snapshot.tables.campaigns.length!==saved.tables['talent.campaigns'].filter(c=>c.company_id===company).length)throw Error('CONTEXT_ISOLATION_FAILED');}
  const legacy=(await c.query('select public.talent_org_snapshot($1,$2) as data',[admin[0].auth_user_id,admin[0].company_id])).rows[0].data;
  if(legacy.tables.campaigns.length!==saved.tables['talent.campaigns'].filter(c=>c.company_id===admin[0].company_id).length)throw Error('HISTORICAL_CAMPAIGNS_CHANGED');
  await c.query('commit');await c.query("notify pgrst,'reload schema'");
  console.log(pending.join(', ')+' aplicadas atómicamente. Registros históricos conservados; Auth/R2 sin modificaciones.');
 }
}catch(e){await c.query('rollback').catch(()=>{});console.error('ORG_SETUP_FAILED:',e.code||e.message);process.exitCode=1;}
finally{await isolated?.close();await c.end();}

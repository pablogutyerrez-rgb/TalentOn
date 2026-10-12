// Migración incremental autorizada; respaldo lógico recuperable, sin Firebase/Auth/R2.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
if(!process.argv.includes('--execute'))throw new Error('Requiere --execute.');
const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE).href);
const u=new URL(process.env.SUPABASE_DATABASE_URL),api=new URL(process.env.SUPABASE_URL);
const project=api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
if(!project||api.protocol!=='https:'||!(u.hostname==='db.'+project+'.supabase.co'||(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)==='postgres.'+project)))throw new Error('PROJECT_ROUTING_MISMATCH');
const c=new pg.Client({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),connectionTimeoutMillis:15000,ssl:{ca:readFileSync(process.env.SUPABASE_CA_CERT),rejectUnauthorized:true,servername:u.hostname}});
const name='202610120006_runtime_contracts.sql',sql=readFileSync('supabase/migrations/'+name,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
const quote=(n)=>'"'+n.replaceAll('"','""')+'"';
try{
 await c.connect();
 if(c.connection.stream.authorized!==true)throw new Error('TLS_NOT_VERIFIED');
 const old=(await c.query('select sha256 from talent_private.applied_migrations where name=$1',[name])).rows[0];
 if(old){if(old.sha256!==hash)throw new Error('APPLIED_MIGRATION_HASH_MISMATCH');console.log('Migración ya aplicada, hash coincide.');}
 else{
  await c.query('begin isolation level repeatable read read only');
  const tables=(await c.query("select schemaname,tablename from pg_tables where schemaname in ('talent','talent_private') or (schemaname='public' and tablename='talent_documents') order by schemaname,tablename")).rows;
  const backup={project,at:new Date().toISOString(),migration:name,sha256:hash,tables:{},functions:[]};
  for(const t of tables)backup.tables[t.schemaname+'.'+t.tablename]=(await c.query('select to_jsonb(t) as row from '+quote(t.schemaname)+'.'+quote(t.tablename)+' t')).rows.map(r=>r.row);
  backup.functions=(await c.query("select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='talent_private' or (n.nspname='public' and p.proname like 'talent_%')")).rows.map(r=>r.definition);
  await c.query('rollback');
  mkdirSync('supabase/.local',{recursive:true});
  const file='supabase/.local/runtime-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  writeFileSync(file,JSON.stringify(backup),{flag:'wx',mode:0o600});
  const saved=JSON.parse(readFileSync(file,'utf8'));
  if(saved.project!==project||Object.keys(saved.tables).length!==tables.length)throw new Error('BACKUP_VERIFICATION_FAILED');
  console.log('Respaldo lógico protegido verificado: '+file+' ('+tables.length+' tablas)');
  await c.query('begin');
  await c.query(sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
  await c.query('insert into talent_private.applied_migrations(name,sha256) values($1,$2)',[name,hash]);
  await c.query('commit');console.log('Migración 006 aplicada atómicamente.');
 }
 const active=(await c.query("select auth_user_id from talent.profiles where role='ADMIN' and status='ACTIVO' and enabled and not must_change_password limit 1")).rows[0];
 if(active){const sample=(await c.query('select public.talent_runtime_snapshot($1::uuid,null) as result',[active.auth_user_id])).rows[0].result;console.log('Snapshot relacional remoto: OK; '+Object.keys(sample.tables).length+' tablas, sin imprimir datos');}
 await c.query("notify pgrst,'reload schema'");
}catch(e){await c.query('rollback').catch(()=>{});console.error('MIGRATION_FAILED: '+(e.code||e.message));process.exitCode=1}
finally{await c.end()}

// Inicialización MANUAL de un proyecto vacío. No lee ni copia Firebase.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
if (!process.argv.includes('--execute')) throw new Error('Requiere --execute explícito.');
const {default:pg}=await import(pathToFileURL(process.env.PG_MODULE).href);
const db=new URL(process.env.SUPABASE_DATABASE_URL);
const api=new URL(process.env.SUPABASE_URL);
const project=api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const username=process.env.TALENT_ADMIN_USERNAME?.toLowerCase();
const password=process.env.TALENT_ADMIN_PASSWORD;
if(username!=='admin'||!password||password.length<8) throw new Error('Administrador temporal inválido.');
if(!project||api.protocol!=='https:'||!(db.hostname==='db.'+project+'.supabase.co'||(db.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(db.username)==='postgres.'+project))) throw new Error('Proyecto no coincide.');
const client=new pg.Client({host:db.hostname,port:Number(db.port||5432),user:decodeURIComponent(db.username),password:decodeURIComponent(db.password),database:db.pathname.slice(1),ssl:{ca:readFileSync(process.env.SUPABASE_CA_CERT),rejectUnauthorized:true,servername:db.hostname},connectionTimeoutMillis:15000});
const key=process.env.SUPABASE_SECRET_KEY;
if(!key) throw new Error('Secret key requerida.');
const headers={apikey:key,...(key.split('.').length===3?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'};
let accountId;
try {
 await client.connect();
 const existing=(await client.query("select count(*)::integer as n from pg_tables where schemaname in ('public','talent','talent_private')")).rows[0].n;
 const accounts=(await client.query('select count(*)::integer as n from auth.users')).rows[0].n;
 if(existing!==0||accounts!==0) throw new Error('Destino no vacío: revisión/respaldo integral requeridos, sin sobrescribir.');
 const migrationNames=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
 const manifest={project,createdAt:new Date().toISOString(),applicationTablesBefore:existing,authUsersBefore:accounts,migrations:migrationNames.map(name=>({name,sha256:createHash('sha256').update(readFileSync('supabase/migrations/'+name)).digest('hex')}))};
 mkdirSync('supabase/.local',{recursive:true});
 writeFileSync('supabase/.local/new-project-baseline.json',JSON.stringify(manifest,null,2),{flag:'wx'});
 // Baseline vacío y migraciones guardadas; atomicidad de todas las DDL.
 await client.query('begin');
 for(const file of migrationNames){
  const sql=readFileSync('supabase/migrations/'+file,'utf8').replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
  await client.query(sql);
 }
 await client.query('create table talent_private.applied_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now())');
 await client.query('revoke all on talent_private.applied_migrations from public,anon,authenticated,service_role');
 for(const migration of manifest.migrations) await client.query('insert into talent_private.applied_migrations(name,sha256) values ($1,$2)',[migration.name,migration.sha256]);
 await client.query('commit');
 console.log('Esquema nuevo aplicado; historial SHA256 guardado. Sin datos Firebase.');
 const created=await fetch(api.origin+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:username+'@auth.talentcc.invalid',password,email_confirm:true,app_metadata:{must_change_password:true}})});
 if(!created.ok) { const error=await created.json().catch(()=>({})); throw new Error('Auth creación HTTP '+created.status+' '+(error.code||error.error_code||'')); }
 const account=await created.json();
 if(!/^[a-f0-9-]{36}$/i.test(account.id||'')) throw new Error('Respuesta Auth no válida.');
 accountId=account.id;
 await client.query('begin');
 await client.query("insert into talent.companies(id,name) values ($1,$2)",['talent-on','Talent-On']);
 await client.query("insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password) values ($1,$2,$3,$4,$5,'ADMIN','ACTIVO',true)",['talent-on',accountId,accountId,username,'Administrador']);
 for(const module of ['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION']) await client.query('insert into talent.user_modules(company_id,user_id,module) values ($1,$2,$3)',['talent-on',accountId,module]);
 const flag=(await client.query('select public.talent_session_profile($1::uuid) as profile',[accountId])).rows[0].profile;
 if(!flag.mustChangePassword||flag.role!=='ADMIN') throw new Error('Perfil inicial no protegido.');
 await client.query('commit');
 console.log('Cuenta admin creada; ADMIN, 5 módulos; cambio obligatorio en perfil servidor.');
 // Prueba negativa remota: el admin temporal no puede leer grupos.
 await client.query('begin');
 await client.query('set local role service_role');
 try { await client.query('select * from public.talent_group_page($1::uuid,$2)',[accountId,'talent-on']); throw new Error('Bloqueo de contraseña ausente.'); }
 catch(e){if(e.code!=='42501'||e.message!=='PASSWORD_CHANGE_REQUIRED') throw e;console.log('Bloqueo remoto antes del cambio: PASS');}
 finally {await client.query('rollback');}
 await client.query("notify pgrst, 'reload schema'");
 accountId=undefined;
} catch(e) {
 await client.query('rollback').catch(()=>{});
 if(accountId) {
  const banned=await fetch(api.origin+'/auth/v1/admin/users/'+accountId,{method:'PUT',headers,body:JSON.stringify({ban_duration:'876000h'})}).catch(()=>null);
  console.error('Cuenta nueva: '+(banned?.ok?'bloqueada por fallo de inicialización':'revisar bloqueo'));
 }
 console.error('SETUP_FAILED: '+(e.code||e.message));process.exitCode=1;
} finally {await client.end();}

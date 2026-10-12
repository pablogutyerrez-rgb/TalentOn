// Ejecutar manualmente SOLO en el nuevo proyecto. No importa ni modifica Firebase.
// El modelo relacional reemplaza la preparación documental. Bloqueo preventivo.
if (process.argv.includes('--execute')) throw new Error('Bootstrap documental obsoleto. No crear cuentas durante esta fase; preparar bootstrap relacional en la fase de activación.');
import { SupabaseRepository, supabaseAdminUser, supabaseServerHeaders } from '../worker/src/supabase.ts';
const required = ['SUPABASE_URL','TALENT_COMPANY_ID','TALENT_COMPANY_NAME','TALENT_ADMIN_USERNAME','TALENT_ADMIN_DISPLAY_NAME','TALENT_ADMIN_PASSWORD'];
const missing = required.filter(k => !process.env[k]);
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SECRET_KEY');
if (missing.length) { console.error(`Faltan variables privadas: ${missing.join(', ')}`); process.exit(1); }
if (!process.argv.includes('--execute')) { console.log('Variables presentes. No se creó ningún usuario. Agrega --execute únicamente cuando estés listo para crear el administrador.'); process.exit(0); }
const env = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
const repository = new SupabaseRepository(env), companyId = process.env.TALENT_COMPANY_ID;
if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) throw new Error('TALENT_COMPANY_ID inválido.');
const username = process.env.TALENT_ADMIN_USERNAME.toLowerCase().trim();
const users = await repository.list('users',{username}); if (users.items.length) throw new Error('El usuario ya existe. No se sobrescribió.');
const company = await repository.get(`companies/${companyId}`);
const account = await supabaseAdminUser(env,{username,password:process.env.TALENT_ADMIN_PASSWORD,displayName:process.env.TALENT_ADMIN_DISPLAY_NAME});
try {
  const writes = [], expected = { [`users/${account.id}`]: null };
  if (!company) { writes.push({ path:`companies/${companyId}`,mode:'create',data:{id:companyId,name:process.env.TALENT_COMPANY_NAME} }); expected[`companies/${companyId}`] = null; }
  writes.push({path:`users/${account.id}`,mode:'create',data:{uid:account.id,username,displayName:process.env.TALENT_ADMIN_DISPLAY_NAME,companyId,role:'ADMIN',status:'ACTIVO',enabled:true,module:['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION'],allowedModules:['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION'],scope:[],subordinateUserIds:[],createdAt:new Date().toISOString()}});
  await repository.commit(writes,expected);
  console.log('Administrador y perfil creados. No se muestran credenciales. Firebase permanece intacto.');
} catch {
  // Solo bloquea la cuenta recién creada, nunca borra cuentas ni históricos.
  await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/admin/users/${account.id}`, {method:'PUT',headers:supabaseServerHeaders(env),body:JSON.stringify({ban_duration:'876000h'})}).catch(()=>undefined);
  console.error('No se creó el perfil. La cuenta nueva no tiene acceso a datos; revisa Auth antes de reintentar.'); process.exitCode=1;
}

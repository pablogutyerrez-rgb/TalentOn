// Verificación de acceso, no cambia contraseña ni escribe datos de negocio.
const base=process.env.SUPABASE_URL.replace(/\/$/,'');
const api=(process.env.VITE_ADMIN_API_URL||process.env.VITE_WORKER_API_URL).replace(/\/$/,'');
const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let token;
try {
 const health=await fetch(api+'/health');
 const status=await health.json();
 if(status.provider!=='supabase')throw new Error('API_PROVIDER_MISMATCH');
 console.log('API provider Supabase: OK');
 const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.TALENT_ADMIN_USERNAME+'@auth.talentcc.invalid',password:process.env.TALENT_ADMIN_PASSWORD})});
 if(!login.ok)throw new Error('LOGIN_HTTP_'+login.status);
 token=(await login.json()).access_token;
 const headers={Authorization:'Bearer '+token};
 const session=await fetch(api+'/api/session',{headers});
 if(!session.ok)throw new Error('SESSION_HTTP_'+session.status);
 const profile=await session.json();
 if(profile.username!=='admin'||profile.role!=='ADMIN'||profile.mustChangePassword!==true)throw new Error('SESSION_PROFILE_MISMATCH');
 console.log('Login admin: OK; cambio obligatorio confirmado');
 const blocked=await fetch(api+'/api/campaigns',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
 if(blocked.status!==403||(await blocked.json()).message!=='PASSWORD_CHANGE_REQUIRED')throw new Error('PASSWORD_GATE_FAILED');
 console.log('Operaciones antes del cambio: BLOQUEADAS OK');
 const anonymous=await fetch(api+'/api/session');
 if(anonymous.status!==401)throw new Error('ANONYMOUS_GATE_FAILED');
 console.log('Sin autenticación: rechazado OK');
}catch(e){console.error(e.message);process.exitCode=1}
finally {
 if(token)await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token}}).catch(()=>{});
}

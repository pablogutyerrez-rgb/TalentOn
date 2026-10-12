// Solo lectura. No imprime claves, tokens, contraseñas ni filas de datos.
const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!base) { console.error('Falta SUPABASE_URL o VITE_SUPABASE_URL.'); process.exit(1); }
const url = new URL(base);
if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('URL Supabase inválida.');
let failures = 0;
async function check(name, path, key, body, expected = 200) {
  if (!key) { console.log(`${name}: PENDIENTE (falta variable de clave)`); failures++; return; }
  try {
    const result = await fetch(`${url.origin}${path}`, { method: body ? 'POST' : 'GET', headers: { apikey: key, ...(key.split('.').length === 3 ? {Authorization: `Bearer ${key}`} : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    console.log(`${name}: HTTP ${result.status}${result.status === expected ? ' OK' : ' REVISAR'}`); if (result.status !== expected) failures++;
    if (name === 'Auth público' && result.ok) { const settings = await result.json(); console.log(`Registro público: ${settings.disable_signup === true ? 'DESACTIVADO OK' : 'REVISAR EN SUPABASE'}`); if (settings.disable_signup !== true) failures++; }
    if (name === 'RPC de esquema relacional' && result.ok) { const schema = await result.json(); const valid = schema.model === 'relational' && schema.revision === '202610120004' && schema.tables === 67; console.log(`Modelo/revisión/tablas: ${valid ? 'METADATOS ESPERADOS OK' : 'REVISAR'}; no sustituye pruebas de integridad.`); if (!valid) failures++; }
  } catch { console.log(`${name}: ERROR DE CONEXIÓN`); failures++; }
}
await check('Auth público','/auth/v1/settings',publicKey);
await check('RPC de esquema relacional','/rest/v1/rpc/talent_schema_status',secret,{});
// Una clave pública NO debe ejecutar la RPC del servicio.
if (publicKey) {
  try { const r = await fetch(`${url.origin}/rest/v1/rpc/talent_schema_status`, { method: 'POST', headers: { apikey: publicKey, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) }); console.log(`Aislamiento público: ${[401,403].includes(r.status) ? 'OK' : 'NO VERIFICADO'} (HTTP ${r.status})`); if (![401,403].includes(r.status)) failures++; } catch { console.log('Aislamiento público: NO VERIFICADO'); failures++; }
}
process.exitCode = failures ? 1 : 0;

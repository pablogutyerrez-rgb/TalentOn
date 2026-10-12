// Publica únicamente el Worker existente en modo Supabase. Secretos solo por stdin.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
if(!process.argv.includes('--execute')) throw new Error('Requiere --execute.');
const cli=resolve('worker/node_modules/wrangler/bin/wrangler.js');
async function run(args,input) {
 return new Promise((resolvePromise,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{cwd:resolve('worker'),stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='';
  child.stdout.on('data',d=>{output+=d});child.stderr.on('data',d=>{output+=d});
  child.on('error',()=>reject(new Error('No se pudo iniciar Wrangler.')));
  child.on('close',code=>code===0?resolvePromise(output):reject(new Error('Wrangler falló; exit '+code)));
  child.stdin.end(input||'');
 });
}
for(const name of ['SUPABASE_URL','SUPABASE_SECRET_KEY']){
 if(!process.env[name])throw new Error('Falta '+name);
 await run(['secret','put',name],process.env[name]+'\n');
 console.log(name+': registrado como Worker Secret');
}
const output=await run(['deploy']);
// No imprime el entorno ni claves. Wrangler recibe secretos por stdin únicamente.
for(const line of output.split(/\r?\n/))if(/workers\.dev|Current Version ID|Uploaded|Deployed/.test(line)) console.log(line.trim());

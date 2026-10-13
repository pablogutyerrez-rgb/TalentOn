import {CaptureError,body,type Data} from './capture';
export const MAX_CAPTURE_FILE=2*1024*1024;
export type CaptureFile={file:File;sha256:string};
export async function readCaptureSubmission(request:Request):Promise<{input:Data;files:Map<string,File>}>{
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return {input:await body(request,131072),files:new Map()};
  // Bound the entire stream before the multipart parser allocates memory.
  const reader=request.body?.getReader();if(!reader)throw new CaptureError('INVALID_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>7*1024*1024){await reader.cancel();throw new CaptureError('Adjuntos demasiado grandes.',413);}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
  let form:FormData;
  try{form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();}catch{throw new CaptureError('INVALID_BODY');}
  const payload=form.get('payload');if(typeof payload!=='string'||payload.length>131072||form.getAll('payload').length!==1)throw new CaptureError('INVALID_BODY');
  let input:Data;try{input=JSON.parse(payload);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{throw new CaptureError('INVALID_BODY');}
  const files=new Map<string,File>();
  for(const [name,value] of form.entries()){
    if(name==='payload')continue;
    if(!name.startsWith('file:')||!(value instanceof File)||files.has(name.slice(5))||files.size>=3)throw new CaptureError('Adjunto inválido.');
    files.set(name.slice(5),value);
  }
  return {input,files};
}
export async function verifyCaptureFile(file:File):Promise<CaptureFile>{
  if(!file.size||file.size>MAX_CAPTURE_FILE)throw new CaptureError('Cada adjunto debe pesar como máximo 2 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if(!(file.type==='application/pdf'&&pdf&&/\.pdf$/i.test(file.name)||file.type==='image/jpeg'&&jpg&&/\.jpe?g$/i.test(file.name)||file.type==='image/png'&&png&&/\.png$/i.test(file.name)))throw new CaptureError('Adjunta un PDF, JPG o PNG válido.');
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {file,sha256};
}

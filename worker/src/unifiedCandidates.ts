// Transport-only identifiers: the same DNI can exist in separate companies.
// Persisted identifiers and historical relationships are never changed.
export const candidateKey=(company:string,id:string)=>id?'uc.'+encodeURIComponent(company).replaceAll('.','%2E')+'.'+encodeURIComponent(id).replaceAll('.','%2E'):id;
export function readCandidateKey(value:string){
 const match=value.match(/^uc\.([^.]+)\.(.+)$/);
 return match?{company:decodeURIComponent(match[1]),id:decodeURIComponent(match[2])}:null;
}
export function candidateReferences(value:any,company:string):any {
 if(Array.isArray(value))return value.map(v=>candidateReferences(v,company));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,
  key==='candidateId'&&typeof v==='string'?candidateKey(company,v):
  ['candidateIds','participantIds','possibleIds'].includes(key)&&Array.isArray(v)?v.map(id=>candidateKey(company,id)):
  candidateReferences(v,company)]));
}
export function unqualifyCandidates(value:any,companies:Set<string>):any {
 if(Array.isArray(value))return value.map(v=>unqualifyCandidates(v,companies));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,v])=>{
  const decode=(id:string)=>{const parsed=readCandidateKey(id);if(!parsed)return id;companies.add(parsed.company);return parsed.id;};
  return [key,key==='candidateId'&&typeof v==='string'?decode(v):
   ['candidateIds','participantIds','possibleIds'].includes(key)&&Array.isArray(v)?v.map(decode):unqualifyCandidates(v,companies)];
 }));
}

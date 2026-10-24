import {describe,it,expect} from 'vitest';
import {captureInput} from '../src/capture';
import {techCenterSections,visibleTechCenterFields,companySections,companyText} from '../../shared/techCenterForm';
import {changeCaptureAnswer} from '../../shared/techCenterForm';
import {captureConfig,publicCaptureConfig,validateCaptureCampaignConfig, type CaptureCampaignConfig} from '../../shared/captureCampaignConfig';
const config:CaptureCampaignConfig={minAge:18,maxAge:60,workdays:['Full time','Semi full'],schedules:['Turno mañana','Turno tarde'],modality:'Presencial'};

export const techApplicant = {
 documentType:'DNI',documentNumber:'99900123',fullName:'Postulante de Prueba',
 age:'25',district:'Lima, Comas',phone:'912345678',email:'fixture@example.test',
 contactCenterExperience:'No',workedAtTechCenter:'No',education:'Secundaria completa',
 preferredCampaign:'Migraciones Bitel',workday:'Semi full',availability:'Turno tarde',
 commitments:'No',modality:'Presencial',privacyAcknowledged:true,
};
describe('Formulario TECH CENTER',()=>{
 it('misma estructura, textos por empresa y catálogo exclusivo del servidor',()=>{
  const campaigns=[{id:'company-a:campaign-1',name:'Campaña de empresa A',configuration:config}];
  const sections=companySections('Empresa A',campaigns);
  expect(sections.flatMap(s=>s.fields).filter(f=>/^\d+\./.test(f.label))).toHaveLength(22);
  expect(sections.flatMap(s=>s.fields).find(f=>f.key==='workedAtTechCenter')?.label).toContain('Empresa A');
  expect(companyText('Somos TECH CENTER','Empresa A')).toBe('Somos Empresa A');
  const valid={...techApplicant,preferredCampaign:campaigns[0].id};
  expect(captureInput(valid,true,campaigns).techCenterAnswers?.preferredCampaign).toBe(campaigns[0].id);
  expect(()=>captureInput({...valid,preferredCampaign:'company-b:campaign-1'},true,campaigns)).toThrow();
  expect(()=>captureInput(valid,true,[])).toThrow();
 });
 it('incluye las 22 preguntas y no asigna una convocatoria automáticamente',()=>{
  expect(techCenterSections.flatMap(s=>s.fields).filter(f=>/^\d+\./.test(f.label))).toHaveLength(22);
  const result=captureInput({...techApplicant,campaignId:'injected',role:'ADMIN'},true);
  expect(result.techCenterAnswers?.preferredCampaign).toBe('Migraciones Bitel');
  expect(result).not.toHaveProperty('campaignId');
  expect(result.techCenterAnswers).not.toHaveProperty('role');
 });
 it('valida todos los obligatorios y declaración sin confundirla con consentimiento',()=>{
  for(const field of visibleTechCenterFields(techApplicant).filter(f=>f.required))
   expect(()=>captureInput({...techApplicant,[field.key]:''},true)).toThrow();
  expect(()=>captureInput({...techApplicant,privacyAcknowledged:false,consent:true},true)).toThrow();
  expect(()=>captureInput({...techApplicant,consent:false},true)).not.toThrow();
  expect(()=>captureInput({...techApplicant,email:'invalid'},true)).toThrow();
 });
 it('experiencia y compromisos requieren detalle solo cuando corresponda',()=>{
  expect(()=>captureInput({...techApplicant,contactCenterExperience:'Sí'},true)).toThrow();
  expect(()=>captureInput({...techApplicant,commitments:'Sí (indicar disponibilidad)'},true)).toThrow();
  expect(captureInput({...techApplicant,experienceDetails:'Oculto',commitmentsDetails:'Oculto',computer:'Sí',adjustmentDetails:'Oculto'},true).techCenterAnswers).not.toHaveProperty('experienceDetails');
  expect(captureInput({...techApplicant,computer:'Sí',adjustmentDetails:'Oculto'},true).techCenterAnswers).not.toHaveProperty('computer');
  expect(captureInput({...techApplicant,adjustmentDetails:'Oculto'},true).techCenterAnswers).not.toHaveProperty('adjustmentDetails');
 });
 it('incluye herramientas solo para remota; inclusión es voluntaria y no determina aptitud',()=>{
  for(const modality of ['Remota']){
   const result=captureInput({...techApplicant,modality,computer:'No',usbHeadset:'Sí',internet:'Sí, inalámbrica',conadis:'Sí',adjustments:'Sí',adjustmentDetails:'Acceso sin escaleras'},true);
   expect(result.techCenterAnswers).toMatchObject({computer:'No',age:'25',adjustmentDetails:'Acceso sin escaleras'});
   expect(result).not.toHaveProperty('status');
  }
 });
 it('valida edad, jornada, horarios y modalidad del catálogo; no acepta configuración del navegador',()=>{
  const campaigns=[{id:'a',name:'A',configuration:config}];
  const values={...techApplicant,preferredCampaign:'a'};
  for(const override of [{age:'17'},{age:'61'},{age:'25.5'},{workday:'Part time'},{availability:'Noche'},{modality:'Remota'},{modality:'Ambas modalidades'}])
   expect(()=>captureInput({...values,...override,configuration:{...config,workdays:['Part time']}},true,campaigns)).toThrow();
  for(const age of ['18','60'])expect(()=>captureInput({...values,age},true,campaigns)).not.toThrow();
  expect(()=>captureInput(values,true,[{id:'a',name:'A'}])).not.toThrow();
  expect(()=>captureInput(values,true,[{id:'a',name:'A',configuration:{} as CaptureCampaignConfig}])).toThrow();
  expect(()=>captureInput({...values,age:'90'},true,[{...campaigns[0],configuration:{...config,maxAge:null}}])).not.toThrow();
 });
 it('limpia respuestas al cambiar de campaña; equipos se muestran por configuración, no por valor manipulado',()=>{
  const campaigns=[{id:'a',name:'A',configuration:config},{id:'b',name:'B',configuration:{...config,modality:'Remota' as const}}];
  const {privacyAcknowledged,...formValues}=techApplicant;
  const next=changeCaptureAnswer({...formValues,computer:'Sí'},'preferredCampaign','b',campaigns);
  expect(next).toMatchObject({modality:'Remota',preferredCampaign:'b',fullName:techApplicant.fullName});
  expect(next).not.toHaveProperty('workday');expect(next).not.toHaveProperty('computer');
  expect(visibleTechCenterFields({...next,modality:'Presencial'},campaigns).some(f=>f.key==='computer')).toBe(true);
  expect(visibleTechCenterFields({...next,preferredCampaign:'a',modality:'Remota'},campaigns).some(f=>f.key==='computer')).toBe(false);
 });
 it('experiencia afirmativa exige meses y campañas; CONADIS es opcional Sí/No',()=>{
  for(const experienceMonths of ['', '0','-1','1.5'])
   expect(()=>captureInput({...techApplicant,contactCenterExperience:'Sí',experienceDetails:'Ventas',experienceMonths},true)).toThrow();
  expect(captureInput({...techApplicant,contactCenterExperience:'Sí',experienceDetails:'Ventas',experienceMonths:'12',conadis:'No'},true).techCenterAnswers).toMatchObject({experienceMonths:'12',experienceDetails:'Ventas',conadis:'No'});
 });
 it('valida configuración administrativa sin valores por defecto',()=>{
  expect(validateCaptureCampaignConfig(config)).toEqual(config);
  expect(captureConfig({...config,schedules:['09:00–18:00']})?.schedules).toEqual(['Turno mañana','Turno tarde']);
  for(const invalid of [{},{...config,minAge:60,maxAge:18},{...config,workdays:[]},{...config,schedules:[]},{...config,schedules:['Turno tarde','Turno tarde']},{...config,schedules:['09:00–18:00']},{...config,modality:'Ambas modalidades'},{...config,minAge:18.5},{...config,workdays:['Full time','Full time']}])
   expect(()=>validateCaptureCampaignConfig(invalid)).toThrow();
 });
 it('usa respaldo público sin inventar modalidad y respeta configuraciones existentes',()=>{
  expect(publicCaptureConfig(null)).toMatchObject({minAge:18,workdays:['Full time','Semi full'],modality:'Preferencia'});
  expect(publicCaptureConfig(config)).toEqual(config);
  expect(publicCaptureConfig({})).toBeUndefined();
  const campaigns=[{id:'sin-config',name:'Sin configuración',configuration:null},{id:'con-config',name:'Configurada',configuration:config}];
  expect(companySections('Talent Up',campaigns,{preferredCampaign:'sin-config'}).flatMap(s=>s.fields).find(f=>f.key==='modality')?.options).toEqual(['Presencial','Remota']);
  expect(visibleTechCenterFields({preferredCampaign:'sin-config',modality:'Remota'},campaigns).some(f=>f.key==='computer')).toBe(true);
  expect(visibleTechCenterFields({preferredCampaign:'sin-config',modality:'Presencial'},campaigns).some(f=>f.key==='computer')).toBe(false);
  expect(changeCaptureAnswer({},'preferredCampaign','sin-config',campaigns)).not.toHaveProperty('modality');
  expect(changeCaptureAnswer({},'preferredCampaign','con-config',campaigns).modality).toBe('Presencial');
 });
 it('rechaza opciones inventadas y texto excesivo; no cambia el formulario genérico',()=>{
  for(const field of visibleTechCenterFields(techApplicant).filter(f=>f.options))
   expect(()=>captureInput({...techApplicant,[field.key]:'valor inexistente'},true)).toThrow();
  expect(()=>captureInput({...techApplicant,addressReference:'x'.repeat(241)},true)).toThrow();
  expect(captureInput({...techApplicant,email:'',consent:true}).techCenterAnswers).toBeUndefined();
  expect(()=>captureInput({...techApplicant,documentType:'OTRO',documentNumber:'ABC123'},true)).not.toThrow();
 });
});

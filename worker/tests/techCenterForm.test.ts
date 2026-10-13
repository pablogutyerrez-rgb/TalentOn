import {describe,it,expect} from 'vitest';
import {captureInput} from '../src/capture';
import {techCenterSections,visibleTechCenterFields,companySections,companyText} from '../../shared/techCenterForm';

export const techApplicant = {
 documentType:'DNI',documentNumber:'99900123',fullName:'Postulante de Prueba',
 adult:'Sí',district:'Lima, Comas',phone:'912345678',email:'fixture@example.test',
 contactCenterExperience:'No',workedAtTechCenter:'No',education:'Secundaria completa',
 preferredCampaign:'Migraciones Bitel',workday:'Jornada reducida',availability:'Tarde',
 commitments:'No',modality:'Presencial',privacyAcknowledged:true,
};
describe('Formulario TECH CENTER',()=>{
 it('misma estructura, textos por empresa y catálogo exclusivo del servidor',()=>{
  const campaigns=[{id:'company-a:campaign-1',name:'Campaña de empresa A'}];
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
 it('incluye herramientas para remota y ambas; inclusión es voluntaria y no determina aptitud',()=>{
  for(const modality of ['Remota','Ambas modalidades']){
   const result=captureInput({...techApplicant,modality,computer:'No',usbHeadset:'Sí',internet:'Sí, inalámbrica',adult:'No',conadis:'Sí, deseo declararlo',adjustments:'Sí',adjustmentDetails:'Acceso sin escaleras'},true);
   expect(result.techCenterAnswers).toMatchObject({computer:'No',adult:'No',adjustmentDetails:'Acceso sin escaleras'});
   expect(result).not.toHaveProperty('status');
  }
 });
 it('rechaza opciones inventadas y texto excesivo; no cambia el formulario genérico',()=>{
  for(const field of visibleTechCenterFields(techApplicant).filter(f=>f.options))
   expect(()=>captureInput({...techApplicant,[field.key]:'valor inexistente'},true)).toThrow();
  expect(()=>captureInput({...techApplicant,addressReference:'x'.repeat(241)},true)).toThrow();
  expect(captureInput({...techApplicant,email:'',consent:true}).techCenterAnswers).toBeUndefined();
  expect(()=>captureInput({...techApplicant,documentType:'OTRO',documentNumber:'ABC123'},true)).not.toThrow();
 });
});

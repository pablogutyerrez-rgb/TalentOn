// Local rendering checks only; no browser session, external API or applicant data.
import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {TechCenterFields} from '../src/components/capture/TechCenterFields';
import {TechCenterAnswers} from '../src/components/capture/TechCenterAnswers';
import type {CaptureCampaignOption} from '../shared/techCenterForm';
const campaigns:CaptureCampaignOption[]=[{id:'onsite',name:'Campaña presencial',configuration:{minAge:18,maxAge:60,workdays:['Full time'],schedules:['09:00–18:00'],modality:'Presencial'}},
 {id:'remote',name:'Campaña remota',configuration:{minAge:18,maxAge:null,workdays:['Semi full','Part time'],schedules:['15:00–19:00'],modality:'Remota'}}];
const render=(values:Record<string,string>)=>renderToStaticMarkup(<TechCenterFields companyName="Empresa de prueba" campaigns={campaigns} values={values} onChange={()=>{}}/>);
const onsite=render({preferredCampaign:'onsite',modality:'Presencial',contactCenterExperience:'No'});
assert(!onsite.includes('headset'));assert(!onsite.includes('value="Part time"'));
assert(!onsite.includes('value="Remota"'));assert(onsite.includes('09:00–18:00'));
assert(onsite.includes('min="18" max="60"'));assert(!onsite.includes('TECH CENTER'));
assert(!onsite.includes('¿En qué campañas trabajaste?'));
const remote=render({preferredCampaign:'remote',modality:'Remota',contactCenterExperience:'Sí'});
assert(remote.includes('headset'));assert(remote.includes('computadora'));
assert(remote.includes('value="Part time"'));assert(!remote.includes('value="Full time"'));
assert(remote.includes('meses de experiencia'));assert(remote.includes('¿En qué campañas trabajaste?'));
assert(remote.includes('apoyo para participar'));assert(remote.includes('Respuesta voluntaria'));
const legacy=renderToStaticMarkup(<TechCenterAnswers answers={{adult:'Sí',modality:'Ambas modalidades',contactCenterExperience:'Sí',experienceDetails:'Un año en ventas',usbHeadset:'Sí'}}/>);
assert(legacy.includes('formulario anterior'));assert(legacy.includes('Un año en ventas'));
console.log('OK: modalidades, opciones, condiciones, edad, marca y respuestas históricas.');

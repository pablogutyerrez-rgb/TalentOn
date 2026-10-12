import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let testEnv: RulesTestEnvironment;

describe('Captación: acceso exclusivamente mediante Worker', () => {
  it('deniega lectura y escritura directa de las colecciones auxiliares', async () => {
    const collections = ['captureLinks', 'captations', 'captureIdentities', 'captureRequests', 'captureRateLimits', 'captureAudit', 'selectionApplications', 'selectionTemplates', 'selectionTemplateFamilies', 'selectionMessages'];
    await testEnv.withSecurityRulesDisabled(async context => {
      for (const name of collections) await setDoc(doc(context.firestore(), name, 'record'), { companyId: 'company-1', ownerUid: 'recruiter-1' });
    });
    for (const context of [testEnv.authenticatedContext('admin-1'), testEnv.authenticatedContext('recruiter-1'), testEnv.unauthenticatedContext()]) {
      for (const name of collections) {
        await assertFails(getDoc(doc(context.firestore(), name, 'record')));
        await assertFails(getDocs(collection(context.firestore(), name)));
        await assertFails(setDoc(doc(context.firestore(), name, 'new'), { ownerUid: 'recruiter-1' }));
      }
    }
  });
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'talentcc-rules-test',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'admin-1'), { role: 'ADMIN', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['SELECCION', 'FORMACION', 'TALENTO'] }),
      setDoc(doc(db, 'users', 'selection-lead'), { role: 'JEFE_SELECCION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['SELECCION'], scope: [] }),
      setDoc(doc(db, 'users', 'selection-analyst'), { role: 'ANALISTA_SELECCION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['SELECCION'], scope: ['campaign-1'] }),
      setDoc(doc(db, 'users', 'recruiter-1'), { role: 'RECLUTADOR', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['SELECCION'], scope: ['campaign-1'] }),
      setDoc(doc(db, 'users', 'recruiter-empty'), { role: 'RECLUTADOR', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['SELECCION'], scope: [] }),
      setDoc(doc(db, 'users', 'training-lead'), { role: 'JEFE_FORMACION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['FORMACION'], scope: [] }),
      setDoc(doc(db, 'users', 'trainer-1'), { role: 'FORMADOR', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['FORMACION'], scope: [] }),
      setDoc(doc(db, 'users', 'coord-1'), { role: 'COORDINADOR_FORMACION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['FORMACION'], scope: ['campaign-1'] }),
      setDoc(doc(db, 'users', 'coord-direct'), { role: 'COORDINADOR_FORMACION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['FORMACION'], scope: [] }),
      setDoc(doc(db, 'users', 'talent-lead'), { role: 'JEFE_TALENTO', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['TALENTO'], scope: [] }),
      setDoc(doc(db, 'users', 'talent-analyst'), { role: 'ANALISTA_TALENTO', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['TALENTO'], scope: ['campaign-1'] }),
      setDoc(doc(db, 'users', 'talent-empty'), { role: 'ANALISTA_TALENTO', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: ['TALENTO'], scope: [] }),
      setDoc(doc(db, 'users', 'moduleless'), { role: 'JEFE_SELECCION', status: 'ACTIVO', enabled: true, companyId: 'company-1', module: [] }),
      setDoc(doc(db, 'users', 'disabled-1'), { role: 'RECLUTADOR', status: 'ACTIVO', enabled: false, companyId: 'company-1', module: ['SELECCION'] }),
      setDoc(doc(db, 'users', 'other-company-user'), { role: 'JEFE_SELECCION', status: 'ACTIVO', enabled: true, companyId: 'company-2', module: ['SELECCION'], scope: [] }),
      setDoc(doc(db, 'campaigns', 'campaign-1'), { companyId: 'company-1', assignedUserIds: ['recruiter-1'], assignedAnalystId: 'selection-analyst' }),
      setDoc(doc(db, 'campaigns', 'campaign-2'), { companyId: 'company-1', assignedUserIds: [], assignedAnalystId: 'other-user' }),
      setDoc(doc(db, 'campaigns', 'campaign-other-company'), { companyId: 'company-2', assignedUserIds: [], assignedAnalystId: 'other-company-user' }),
      setDoc(doc(db, 'candidates', 'candidate-1'), { companyId: 'company-1', campaignId: 'campaign-1', trainingId: 'training-1', recruiterId: 'recruiter-1', analystId: 'analyst-1', trainerId: null }),
      setDoc(doc(db, 'candidates', 'candidate-2'), { companyId: 'company-1', campaignId: 'campaign-2', recruiterId: 'other-user', analystId: 'other-user', trainerId: null }),
      setDoc(doc(db, 'candidates', 'candidate-other-company'), { companyId: 'company-2', campaignId: 'campaign-x', recruiterId: 'other-user', analystId: 'other-user', trainerId: null }),
      setDoc(doc(db, 'trainings', 'training-1'), { companyId: 'company-1', campaignId: 'campaign-1', trainerId: 'trainer-1', coordinatorId: 'coord-1' }),
      setDoc(doc(db, 'trainings', 'training-2'), { companyId: 'company-1', trainerId: 'trainer-other', coordinatorId: 'coord-1' }),
      setDoc(doc(db, 'trainings', 'training-direct'), { companyId: 'company-1', campaignId: 'campaign-1', trainerId: 'trainer-other', coordinatorId: 'coord-direct' }),
      setDoc(doc(db, 'trainings', 'training-other-company'), { companyId: 'company-2', campaignId: 'campaign-other-company', trainerId: 'trainer-other', coordinatorId: 'other-user' }),
      setDoc(doc(db, 'candidates', 'candidate-direct'), { companyId: 'company-1', campaignId: 'campaign-1', trainingId: 'training-direct', recruiterId: 'other-user', analystId: 'other-user' }),
      setDoc(doc(db, 'candidates', 'candidate-1', 'documents', 'doc-1'), { candidateId: 'candidate-1', companyId: 'company-1', status: 'VALIDATED' }),
      setDoc(doc(db, 'candidates', 'candidate-direct', 'documents', 'doc-1'), { candidateId: 'candidate-direct', companyId: 'company-1', status: 'VALIDATED' }),
      setDoc(doc(db, 'trainings', 'training-1', 'participants', 'candidate-1'), { candidateId: 'candidate-1', companyId: 'company-1', campaignId: 'campaign-1' }),
      setDoc(doc(db, 'hiringProcesses', 'hiring-1'), { candidateId: 'candidate-1', companyId: 'company-1', campaignId: 'campaign-1' }),
      setDoc(doc(db, 'hiringProcesses', 'hiring-2'), { candidateId: 'candidate-2', companyId: 'company-1', campaignId: 'campaign-2' }),
      setDoc(doc(db, 'hiringProcesses', 'hiring-other-company'), { candidateId: 'candidate-other-company', companyId: 'company-2', campaignId: 'campaign-other-company' }),
    ]);
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

describe('Firestore RBAC', () => {
  it('permite al reclutador leer únicamente su candidato asignado', async () => {
    const db = testEnv.authenticatedContext('recruiter-1').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
  });

  it('bloquea mutaciones críticas directas desde el cliente', async () => {
    const db = testEnv.authenticatedContext('recruiter-1').firestore();
    await expect(assertFails(setDoc(doc(db, 'candidates', 'candidate-1'), { currentProcess: 'GESTION_TALENTO' }, { merge: true }))).resolves.toBeDefined();
  });

  it('bloquea candidatos, convocatorias y capacitaciones fuera del alcance', async () => {
    const recruiter = testEnv.authenticatedContext('recruiter-1').firestore();
    const trainer = testEnv.authenticatedContext('trainer-1').firestore();
    await expect(assertFails(getDoc(doc(recruiter, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(recruiter, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(recruiter, 'campaigns', 'campaign-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(trainer, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(trainer, 'trainings', 'training-2')))).resolves.toBeDefined();
  });

  it('bloquea a un usuario sin asignaciones y a un usuario deshabilitado', async () => {
    const noAssignments = testEnv.authenticatedContext('recruiter-empty').firestore();
    const disabled = testEnv.authenticatedContext('disabled-1').firestore();
    await expect(assertFails(getDoc(doc(noAssignments, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(disabled, 'candidates', 'candidate-1')))).resolves.toBeDefined();
  });

  it('permite al administrador leer cualquier empresa y bloquea perfiles ajenos a usuarios no administradores', async () => {
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const recruiter = testEnv.authenticatedContext('recruiter-1').firestore();
    await expect(assertSucceeds(getDoc(doc(admin, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(recruiter, 'users', 'recruiter-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(recruiter, 'users', 'trainer-1')))).resolves.toBeDefined();
  });

  it('bloquea toda escritura directa, incluso para administrador', async () => {
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    await expect(assertFails(setDoc(doc(admin, 'users', 'recruiter-1'), { role: 'ADMIN' }, { merge: true }))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(admin, 'candidates', 'candidate-1'), { currentProcess: 'CONTRATADO' }, { merge: true }))).resolves.toBeDefined();
  });

  it('protege documentación sensible y permite su lectura solo al responsable autorizado', async () => {
    const coordinator = testEnv.authenticatedContext('coord-1').firestore();
    const trainer = testEnv.authenticatedContext('trainer-1').firestore();
    await expect(assertSucceeds(getDoc(doc(coordinator, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(trainer, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
  });

  it('aplica alcance a Gestión de Talento y bloquea escrituras directas', async () => {
    const leader = testEnv.authenticatedContext('talent-lead').firestore();
    const analyst = testEnv.authenticatedContext('talent-analyst').firestore();
    const empty = testEnv.authenticatedContext('talent-empty').firestore();
    await expect(assertSucceeds(getDoc(doc(leader, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(analyst, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(analyst, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(empty, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(analyst, 'candidates', 'candidate-1'), { hiring: { status: 'CONTRATADO' } }, { merge: true }))).resolves.toBeDefined();
  });

  it('aplica empresa, módulo y alcance a los jefes y analistas', async () => {
    const selectionLead = testEnv.authenticatedContext('selection-lead').firestore();
    const selectionAnalyst = testEnv.authenticatedContext('selection-analyst').firestore();
    const trainingLead = testEnv.authenticatedContext('training-lead').firestore();
    const moduleless = testEnv.authenticatedContext('moduleless').firestore();
    await expect(assertSucceeds(getDoc(doc(selectionLead, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(selectionLead, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(selectionAnalyst, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(selectionAnalyst, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(trainingLead, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(moduleless, 'candidates', 'candidate-1')))).resolves.toBeDefined();
  });

  it('permite al ADMIN consultar users, campaigns, candidates y trainings de cualquier empresa', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await expect(assertSucceeds(getDocs(collection(db, 'users')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-other-company')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'trainings', 'training-other-company')))).resolves.toBeDefined();
  });

  it('limita al Jefe de Selección a su empresa y permite sus recursos del módulo', async () => {
    const db = testEnv.authenticatedContext('selection-lead').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'campaigns', 'campaign-other-company')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
  });

  it('limita al Analista de Selección a convocatorias y candidatos de su alcance', async () => {
    const db = testEnv.authenticatedContext('selection-analyst').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDocs(query(collection(db, 'candidates'), where('companyId', '==', 'company-1'), where('campaignId', '==', 'campaign-1'))))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'campaigns', 'campaign-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'trainings', 'training-1')))).resolves.toBeDefined();
  });

  it('limita al Reclutador a asignaciones directas o convocatorias asignadas', async () => {
    const db = testEnv.authenticatedContext('recruiter-1').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'campaigns', 'campaign-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'trainings', 'training-1')))).resolves.toBeDefined();
  });

  it('limita al Jefe de Formación a datos de Formación de su empresa', async () => {
    const db = testEnv.authenticatedContext('training-lead').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'trainings', 'training-other-company')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
  });

  it('permite al Coordinador su alcance y su capacitación asignada directamente', async () => {
    const scoped = testEnv.authenticatedContext('coord-1').firestore();
    const direct = testEnv.authenticatedContext('coord-direct').firestore();
    await expect(assertSucceeds(getDoc(doc(scoped, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(scoped, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(direct, 'trainings', 'training-direct')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(direct, 'candidates', 'candidate-direct')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(direct, 'candidates', 'candidate-direct', 'documents', 'doc-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(direct, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(direct, 'candidates', 'candidate-1')))).resolves.toBeDefined();
  });

  it('limita al Formador a su capacitación y participantes asignados, sin documentación sensible', async () => {
    const db = testEnv.authenticatedContext('trainer-1').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'trainings', 'training-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'trainings', 'training-1', 'participants', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'trainings', 'training-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
  });

  it('limita al Jefe de Gestión de Talento a su empresa', async () => {
    const db = testEnv.authenticatedContext('talent-lead').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'hiringProcesses', 'hiring-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-other-company')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'hiringProcesses', 'hiring-other-company')))).resolves.toBeDefined();
  });

  it('limita al Analista de Gestión de Talento a su alcance', async () => {
    const db = testEnv.authenticatedContext('talent-analyst').firestore();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'hiringProcesses', 'hiring-1')))).resolves.toBeDefined();
    await expect(assertSucceeds(getDoc(doc(db, 'candidates', 'candidate-1', 'documents', 'doc-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'candidates', 'candidate-2')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(db, 'hiringProcesses', 'hiring-2')))).resolves.toBeDefined();
  });

  it('rechaza acceso sin autenticación, deshabilitado o sin módulo', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const disabled = testEnv.authenticatedContext('disabled-1').firestore();
    const moduleless = testEnv.authenticatedContext('moduleless').firestore();
    await expect(assertFails(getDoc(doc(anonymous, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(disabled, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(disabled, 'users', 'disabled-1')))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(moduleless, 'campaigns', 'campaign-1')))).resolves.toBeDefined();
  });

  it.each([
    ['admin-1', 'users', 'recruiter-1'],
    ['selection-lead', 'campaigns', 'campaign-1'],
    ['selection-analyst', 'candidates', 'candidate-1'],
    ['recruiter-1', 'candidates', 'candidate-1'],
    ['training-lead', 'trainings', 'training-1'],
    ['coord-1', 'trainings', 'training-1'],
    ['trainer-1', 'trainings', 'training-1'],
    ['talent-lead', 'hiringProcesses', 'hiring-1'],
    ['talent-analyst', 'hiringProcesses', 'hiring-1'],
  ])('rechaza escritura directa para %s en %s/%s', async (uid, collectionName, documentIdValue) => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await expect(assertFails(setDoc(doc(db, collectionName, documentIdValue), { directWriteAttempt: true }, { merge: true }))).resolves.toBeDefined();
  });
});

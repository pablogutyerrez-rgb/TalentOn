import { randomUUID } from 'crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createDownloadUrl, createUploadUrl } from './r2';

if (!getApps().length) initializeApp();
const db = getFirestore();
const r2Secrets = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'].map(defineSecret);

type Role = 'ADMIN' | 'JEFE_SELECCION' | 'ANALISTA_SELECCION' | 'RECLUTADOR' | 'JEFE_FORMACION' | 'COORDINADOR_FORMACION' | 'FORMADOR' | 'JEFE_TALENTO' | 'ANALISTA_TALENTO';
type Actor = { uid: string; name: string; role: Role; companyId: string; scopeCampaignIds: string[] };
const selectionSequence = ['NUEVO', 'CONTACTADO', 'ENTREVISTA', 'VERIFICACION_TECNICA', 'EVALUACIONES', 'APTO_CAPACITACION'];
const selectionRoles: Role[] = ['ADMIN', 'JEFE_SELECCION', 'ANALISTA_SELECCION', 'RECLUTADOR'];
const trainingManagers: Role[] = ['ADMIN', 'JEFE_FORMACION', 'COORDINADOR_FORMACION'];
const talentRoles: Role[] = ['ADMIN', 'JEFE_TALENTO', 'ANALISTA_TALENTO'];
const modulesByRole: Record<Role, string[]> = {
  ADMIN: ['SELECCION', 'FORMACION', 'TALENTO', 'ANALITICA', 'ADMINISTRACION'], JEFE_SELECCION: ['SELECCION', 'ANALITICA'], ANALISTA_SELECCION: ['SELECCION'], RECLUTADOR: ['SELECCION'], JEFE_FORMACION: ['FORMACION', 'ANALITICA'], COORDINADOR_FORMACION: ['FORMACION'], FORMADOR: ['FORMACION'], JEFE_TALENTO: ['TALENTO', 'ANALITICA'], ANALISTA_TALENTO: ['TALENTO'],
};
const internalAuthDomain = 'auth.talentcc.invalid';
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const authEmailForUsername = (username: string) => `${username}@${internalAuthDomain}`;
const cleanUndefined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
const assertUsername = (username: string) => {
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new HttpsError('invalid-argument', 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.');
};

async function actorOf(auth: { uid: string } | undefined): Promise<Actor> {
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const snapshot = await db.doc(`users/${auth.uid}`).get();
  if (!snapshot.exists || snapshot.data()?.status !== 'ACTIVO' || snapshot.data()?.enabled === false) throw new HttpsError('permission-denied', 'Usuario no autorizado o inactivo.');
  const data = snapshot.data()!;
  return { uid: auth.uid, name: data.displayName || data.name || 'Usuario', role: data.role, companyId: data.companyId, scopeCampaignIds: data.scope || data.scopeCampaignIds || [] } as Actor;
}

function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role)) throw new HttpsError('permission-denied', 'No tienes permiso para esta operación.');
}

function assertCandidateScope(actor: Actor, candidate: FirebaseFirestore.DocumentData) {
  if (actor.role === 'ADMIN') return;
  if (candidate.companyId !== actor.companyId) throw new HttpsError('permission-denied', 'El candidato pertenece a otra empresa.');
  if (['JEFE_SELECCION', 'JEFE_FORMACION', 'COORDINADOR_FORMACION', 'JEFE_TALENTO', 'ANALISTA_TALENTO'].includes(actor.role)) return;
  if ([candidate.recruiterId, candidate.analystId, candidate.trainerId].includes(actor.uid)) return;
  if (actor.scopeCampaignIds.includes(candidate.campaignId)) return;
  throw new HttpsError('permission-denied', 'No tienes acceso a este candidato.');
}

function audit(actor: Actor, action: string, module: string, entityType: string, entityId: string, previousValue: unknown, newValue: unknown) {
  return db.collection('auditLogs').doc().set({ actorUid: actor.uid, actorName: actor.name, action, module, entityType, entityId, previousValue, newValue, timestamp: FieldValue.serverTimestamp() });
}

export const provisionUser = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, ['ADMIN']);
  const { username: rawUsername, password, displayName, role, status = 'ACTIVO', companyId = actor.companyId, scope = [], module, phone, jobTitle, subordinateUserIds = [], avatarUrl } = request.data as { username: string; password?: string; displayName: string; role: Role; status?: 'ACTIVO' | 'INACTIVO'; companyId?: string; scope?: string[]; module?: string[]; phone?: string; jobTitle?: string; subordinateUserIds?: string[]; avatarUrl?: string };
  const resolvedCompanyId = companyId || actor.companyId || 'default';
  const username = normalizeUsername(rawUsername || '');
  assertUsername(username);
  if (!displayName || !role || !modulesByRole[role] || !['ACTIVO', 'INACTIVO'].includes(status) || !password || password.length < 8) throw new HttpsError('invalid-argument', 'Datos de usuario inválidos. La contraseña debe tener al menos 8 caracteres.');
  const duplicate = await db.collection('users').where('username', '==', username).limit(1).get();
  if (!duplicate.empty) throw new HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
  const authEmail = authEmailForUsername(username);
  let authUser;
  try {
    authUser = await getAuth().getUserByEmail(authEmail);
  } catch {
    authUser = await getAuth().createUser({ email: authEmail, password, displayName, disabled: status === 'INACTIVO' });
  }
  const modules = Array.isArray(module) && module.length ? module : modulesByRole[role];
  await getAuth().updateUser(authUser.uid, { displayName, disabled: status === 'INACTIVO' });
  await db.doc(`users/${authUser.uid}`).set({ uid: authUser.uid, username, displayName, name: displayName, phone: phone || '', jobTitle: jobTitle || '', role, module: modules, allowedModules: modules, companyId: resolvedCompanyId, scope, scopeCampaignIds: scope, subordinateUserIds: Array.isArray(subordinateUserIds) ? subordinateUserIds : [], avatarUrl: avatarUrl || '', enabled: status === 'ACTIVO', status, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(actor, 'USER_PROVISIONED', 'ADMINISTRACION', 'user', authUser.uid, null, { username, role, status, companyId: resolvedCompanyId });
  return { ok: true };
});

export const updateUserAccess = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, ['ADMIN']);
  const { uid, username: rawUsername, role, module, scope = [], companyId = actor.companyId, status = 'ACTIVO', displayName, phone, jobTitle, subordinateUserIds = [], avatarUrl } = request.data as { uid: string; username?: string; role: Role; module?: string[]; scope?: string[]; companyId?: string; status?: 'ACTIVO' | 'INACTIVO'; displayName?: string; phone?: string; jobTitle?: string; subordinateUserIds?: string[]; avatarUrl?: string };
  if (!uid || !modulesByRole[role] || !['ACTIVO', 'INACTIVO'].includes(status)) throw new HttpsError('invalid-argument', 'Actualización de usuario inválida.');
  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();
  if (!existing.exists) throw new HttpsError('not-found', 'Usuario no encontrado.');
  const previous = existing.data() ?? {};
  const resolvedCompanyId = companyId || actor.companyId || previous.companyId || 'default';
  const username = rawUsername ? normalizeUsername(rawUsername) : previous.username;
  if (rawUsername) {
    assertUsername(username);
    const duplicate = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!duplicate.empty && duplicate.docs[0].id !== uid) throw new HttpsError('already-exists', 'El nombre de usuario ya está en uso.');
  }
  const modules = Array.isArray(module) && module.length ? module : modulesByRole[role];
  await getAuth().updateUser(uid, { disabled: status === 'INACTIVO', ...(displayName ? { displayName } : {}), ...(rawUsername ? { email: authEmailForUsername(username) } : {}) });
  await userRef.update(cleanUndefined({ ...(rawUsername ? { username } : {}), ...(displayName ? { displayName, name: displayName } : {}), phone: phone || '', jobTitle: jobTitle || '', role, module: modules, allowedModules: modules, scope, scopeCampaignIds: scope, subordinateUserIds: Array.isArray(subordinateUserIds) ? subordinateUserIds : [], avatarUrl: avatarUrl || '', companyId: resolvedCompanyId, enabled: status === 'ACTIVO', status, updatedAt: FieldValue.serverTimestamp() }));
  await audit(actor, 'USER_ACCESS_UPDATED', 'ADMINISTRACION', 'user', uid, null, { role, modules, scope, status, companyId: resolvedCompanyId });
  return { ok: true };
});

export const resetUserPassword = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, ['ADMIN']);
  const { uid, newPassword } = request.data as { uid: string; newPassword: string };
  if (!uid || !newPassword || newPassword.length < 8) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 8 caracteres.');
  await getAuth().updateUser(uid, { password: newPassword });
  await audit(actor, 'USER_PASSWORD_RESET', 'ADMINISTRACION', 'user', uid, null, 'RESET');
  return { ok: true };
});

export const advanceSelection = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, selectionRoles);
  const { candidateId, nextStatus, observation = '' } = request.data as { candidateId: string; nextStatus: string; observation?: string };
  if (!candidateId || !nextStatus) throw new HttpsError('invalid-argument', 'candidateId y nextStatus son obligatorios.');
  const candidateRef = db.doc(`candidates/${candidateId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(candidateRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Candidato no encontrado.');
    const candidate = snap.data()!;
    assertCandidateScope(actor, candidate);
    const current = candidate.selection?.status;
    const allowedExit = ['NO_APTO', 'DESCARTADO'];
    const expected = selectionSequence[selectionSequence.indexOf(current) + 1];
    if (nextStatus !== expected && !allowedExit.includes(nextStatus)) throw new HttpsError('failed-precondition', `Transición inválida: ${current} → ${nextStatus}.`);
    const update = { selection: { ...candidate.selection, status: nextStatus }, currentProcess: nextStatus === 'APTO_CAPACITACION' ? 'SELECCION' : candidate.currentProcess, updatedAt: FieldValue.serverTimestamp() };
    tx.update(candidateRef, update);
    tx.set(db.collection('auditLogs').doc(), { actorUid: actor.uid, actorName: actor.name, action: 'SELECTION_STATUS_CHANGED', module: 'SELECCION', entityType: 'candidate', entityId: candidateId, previousValue: current, newValue: nextStatus, observation, timestamp: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

export const createTraining = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, ['ADMIN', 'JEFE_SELECCION', 'ANALISTA_SELECCION']);
  const { campaignId, candidateIds, name, startDate, modality } = request.data as { campaignId: string; candidateIds: string[]; name: string; startDate: string; modality: string };
  if (!campaignId || !name || !startDate || !Array.isArray(candidateIds) || !candidateIds.length) throw new HttpsError('invalid-argument', 'Datos de capacitación incompletos.');
  const trainingRef = db.collection('trainings').doc();
  await db.runTransaction(async (tx) => {
    const campaign = await tx.get(db.doc(`campaigns/${campaignId}`));
    if (!campaign.exists) throw new HttpsError('not-found', 'Convocatoria no encontrada.');
    const candidates = await Promise.all(candidateIds.map((id) => tx.get(db.doc(`candidates/${id}`))));
    for (const snap of candidates) {
      if (!snap.exists) throw new HttpsError('not-found', 'Uno de los candidatos no existe.');
      const candidate = snap.data()!;
      assertCandidateScope(actor, candidate);
      if (candidate.campaignId !== campaignId || candidate.selection?.status !== 'APTO_CAPACITACION' || candidate.training?.trainingId) throw new HttpsError('failed-precondition', `Candidato ${snap.id} no es elegible para esta capacitación.`);
    }
    const payload = { companyId: campaign.data()!.companyId, campaignId, name, startDate, modality, status: 'PENDIENTE_ASIGNACION', coordinatorId: null, trainerId: null, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp() };
    tx.create(trainingRef, payload);
    for (const snap of candidates) {
      tx.update(snap.ref, { currentProcess: 'FORMACION', training: { status: 'PENDIENTE_INICIO', trainingId: trainingRef.id }, updatedAt: FieldValue.serverTimestamp() });
      tx.create(trainingRef.collection('participants').doc(snap.id), { candidateId: snap.id, status: 'PENDIENTE_INICIO', createdAt: FieldValue.serverTimestamp() });
    }
    tx.set(db.collection('auditLogs').doc(), { actorUid: actor.uid, actorName: actor.name, action: 'TRAINING_CREATED', module: 'FORMACION', entityType: 'training', entityId: trainingRef.id, previousValue: null, newValue: { campaignId, candidateIds }, timestamp: FieldValue.serverTimestamp() });
  });
  return { ok: true, trainingId: trainingRef.id };
});

export const assignTrainer = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, trainingManagers);
  const { trainingId, trainerId } = request.data as { trainingId: string; trainerId: string };
  const trainingRef = db.doc(`trainings/${trainingId}`);
  const [training, trainer] = await Promise.all([trainingRef.get(), db.doc(`users/${trainerId}`).get()]);
  if (!training.exists || !trainer.exists) throw new HttpsError('not-found', 'Capacitación o formador no encontrado.');
  if (trainer.data()!.role !== 'FORMADOR') throw new HttpsError('failed-precondition', 'El usuario indicado no es Formador.');
  if (training.data()!.companyId !== actor.companyId && actor.role !== 'ADMIN') throw new HttpsError('permission-denied', 'Empresa fuera de alcance.');
  await trainingRef.update({ trainerId, status: 'PROGRAMADA', updatedAt: FieldValue.serverTimestamp() });
  await audit(actor, 'TRAINER_ASSIGNED', 'FORMACION', 'training', trainingId, training.data()!.trainerId || null, trainerId);
  return { ok: true };
});

export const approveAlta = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, talentRoles);
  const { candidateId } = request.data as { candidateId: string };
  const candidateRef = db.doc(`candidates/${candidateId}`);
  const candidateSnap = await candidateRef.get();
  if (!candidateSnap.exists) throw new HttpsError('not-found', 'Candidato no encontrado.');
  const candidate = candidateSnap.data()!;
  assertCandidateScope(actor, candidate);
  const documents = await candidateRef.collection('documents').where('required', '==', true).get();
  const missing = documents.docs.filter((doc) => doc.data().status !== 'VALIDATED').map((doc) => doc.data().type);
  const salaryOk = ['HAS_ACCOUNT', 'REQUEST_OPENING'].includes(candidate.salaryAccount?.status);
  const failures = [candidate.training?.status !== 'APROBADO' ? 'Capacitación no aprobada' : null, candidate.ojt?.status !== 'APROBADO' ? 'OJT no aprobado' : null, missing.length ? `Documentos pendientes: ${missing.join(', ')}` : null, !salaryOk ? 'Cuenta sueldo o solicitud de apertura pendiente' : null].filter(Boolean);
  if (failures.length) throw new HttpsError('failed-precondition', failures.join(' | '));
  const processRef = db.collection('hiringProcesses').doc(candidateId);
  const batch = db.batch();
  batch.update(candidateRef, { currentProcess: 'GESTION_TALENTO', hiring: { ...(candidate.hiring || {}), status: 'PENDIENTE_CONTRATACION' }, updatedAt: FieldValue.serverTimestamp() });
  batch.set(processRef, { candidateId, companyId: candidate.companyId, status: 'PENDIENTE_CONTRATACION', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.collection('auditLogs').doc(), { actorUid: actor.uid, actorName: actor.name, action: 'ALTA_APPROVED', module: 'GESTION_TALENTO', entityType: 'candidate', entityId: candidateId, previousValue: candidate.currentProcess, newValue: 'GESTION_TALENTO', timestamp: FieldValue.serverTimestamp() });
  await batch.commit();
  return { ok: true };
});

export const confirmHiring = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, talentRoles);
  const { candidateId, employeeCode, plannedStartDate } = request.data as { candidateId: string; employeeCode: string; plannedStartDate: string };
  if (!candidateId || !employeeCode || !plannedStartDate) throw new HttpsError('invalid-argument', 'Datos de contratación incompletos.');
  const processRef = db.doc(`hiringProcesses/${candidateId}`);
  const process = await processRef.get();
  if (!process.exists || process.data()!.status !== 'PENDIENTE_CONTRATACION') throw new HttpsError('failed-precondition', 'El candidato no está habilitado para contratación.');
  if (process.data()!.companyId !== actor.companyId && actor.role !== 'ADMIN') throw new HttpsError('permission-denied', 'Empresa fuera de alcance.');
  await db.runTransaction(async (tx) => {
    const duplicate = await tx.get(db.collection('hiringProcesses').where('employeeCode', '==', employeeCode).limit(1));
    if (!duplicate.empty) throw new HttpsError('already-exists', 'El código de colaborador ya existe.');
    tx.update(processRef, { status: 'PENDIENTE_INGRESO', employeeCode, plannedStartDate, contractStatus: 'FIRMADO', updatedAt: FieldValue.serverTimestamp() });
    tx.update(db.doc(`candidates/${candidateId}`), { hiring: { status: 'PENDIENTE_INGRESO', employeeCode, plannedStartDate }, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection('auditLogs').doc(), { actorUid: actor.uid, actorName: actor.name, action: 'HIRING_CONFIRMED', module: 'GESTION_TALENTO', entityType: 'hiringProcess', entityId: candidateId, previousValue: 'PENDIENTE_CONTRATACION', newValue: 'PENDIENTE_INGRESO', timestamp: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

export const confirmIngreso = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  requireRole(actor, talentRoles);
  const { candidateId, actualStartDate } = request.data as { candidateId: string; actualStartDate: string };
  if (!candidateId || !actualStartDate) throw new HttpsError('invalid-argument', 'candidateId y fecha de ingreso son obligatorios.');
  const processRef = db.doc(`hiringProcesses/${candidateId}`);
  const process = await processRef.get();
  if (!process.exists || process.data()!.status !== 'PENDIENTE_INGRESO') throw new HttpsError('failed-precondition', 'El proceso no está pendiente de ingreso.');
  if (process.data()!.companyId !== actor.companyId && actor.role !== 'ADMIN') throw new HttpsError('permission-denied', 'Empresa fuera de alcance.');
  const batch = db.batch();
  batch.update(processRef, { status: 'INGRESO_CONFIRMADO', actualStartDate, updatedAt: FieldValue.serverTimestamp() });
  batch.update(db.doc(`candidates/${candidateId}`), { currentProcess: 'COLABORADOR', hiring: { status: 'INGRESO_CONFIRMADO', actualStartDate }, updatedAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('auditLogs').doc(), { actorUid: actor.uid, actorName: actor.name, action: 'INGRESO_CONFIRMED', module: 'GESTION_TALENTO', entityType: 'hiringProcess', entityId: candidateId, previousValue: 'PENDIENTE_INGRESO', newValue: 'INGRESO_CONFIRMADO', timestamp: FieldValue.serverTimestamp() });
  await batch.commit();
  return { ok: true };
});

export const getDocumentUploadUrl = onCall({ secrets: r2Secrets }, async (request) => {
  const actor = await actorOf(request.auth);
  const { candidateId, documentType, fileName, mimeType, size } = request.data as { candidateId: string; documentType: string; fileName: string; mimeType: string; size: number };
  const candidate = await db.doc(`candidates/${candidateId}`).get();
  if (!candidate.exists) throw new HttpsError('not-found', 'Candidato no encontrado.');
  assertCandidateScope(actor, candidate.data()!);
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedMime.includes(mimeType) || !Number.isFinite(size) || size <= 0 || size > 15 * 1024 * 1024) throw new HttpsError('invalid-argument', 'Tipo o tamaño de archivo no permitido.');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `candidates/${candidateId}/documents/${documentType}/${randomUUID()}-${safeName}`;
  return { objectKey, uploadUrl: await createUploadUrl(objectKey, mimeType), expiresInSeconds: 300 };
});

export const finalizeDocumentUpload = onCall(async (request) => {
  const actor = await actorOf(request.auth);
  const { candidateId, type, objectKey, fileName, mimeType, size, required = false } = request.data as { candidateId: string; type: string; objectKey: string; fileName: string; mimeType: string; size: number; required?: boolean };
  const candidate = await db.doc(`candidates/${candidateId}`).get();
  if (!candidate.exists) throw new HttpsError('not-found', 'Candidato no encontrado.');
  assertCandidateScope(actor, candidate.data()!);
  if (!objectKey.startsWith(`candidates/${candidateId}/documents/${type}/`)) throw new HttpsError('permission-denied', 'objectKey inválido.');
  const ref = candidate.ref.collection('documents').doc();
  await ref.create({ candidateId, type, objectKey, fileName, mimeType, size, required, status: 'UPLOADED', uploadedBy: actor.uid, uploadedAt: FieldValue.serverTimestamp() });
  await audit(actor, 'DOCUMENT_UPLOADED', 'DOCUMENTACION', 'document', ref.id, null, { candidateId, type, objectKey });
  return { ok: true, documentId: ref.id };
});

export const getDocumentDownloadUrl = onCall({ secrets: r2Secrets }, async (request) => {
  const actor = await actorOf(request.auth);
  const { candidateId, documentId } = request.data as { candidateId: string; documentId: string };
  const candidate = await db.doc(`candidates/${candidateId}`).get();
  if (!candidate.exists) throw new HttpsError('not-found', 'Candidato no encontrado.');
  assertCandidateScope(actor, candidate.data()!);
  const document = await candidate.ref.collection('documents').doc(documentId).get();
  if (!document.exists) throw new HttpsError('not-found', 'Documento no encontrado.');
  return { downloadUrl: await createDownloadUrl(document.data()!.objectKey), expiresInSeconds: 300 };
});

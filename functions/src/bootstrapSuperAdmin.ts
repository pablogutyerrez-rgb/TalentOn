import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const technicalDomain = 'auth.talentcc.invalid';
const modules = ['SELECCION', 'FORMACION', 'TALENTO', 'ANALITICA', 'ADMINISTRACION'];

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const username = argument('username')?.toLowerCase();
  const password = argument('password');
  const displayName = argument('displayName');
  const companyId = argument('companyId') || 'talentcc';
  if (!username || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || !password || password.length < 8 || !displayName) {
    throw new Error('Uso: npm run bootstrap:superadmin -- --username admin --password "minimo-8" --displayName "Super Administrador" [--companyId talentcc]');
  }
  if (!getApps().length) {
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    initializeApp({ credential: serviceAccount ? cert(require(serviceAccount)) : applicationDefault() });
  }
  const auth = getAuth();
  const db = getFirestore();
  const existingAdmins = await db.collection('users').where('role', '==', 'ADMIN').limit(1).get();
  if (!existingAdmins.empty) throw new Error('Ya existe un SUPER_ADMIN. El bootstrap solo puede ejecutarse una vez.');
  const email = `${username}@${technicalDomain}`;
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password, displayName, disabled: false });
  }
  await db.doc(`users/${user.uid}`).set({
    uid: user.uid, username, displayName, name: displayName, role: 'ADMIN', module: modules, allowedModules: modules,
    companyId, scope: [], scopeCampaignIds: [], enabled: true, status: 'ACTIVO', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('SUPER_ADMIN_CREATED');
}

main().catch(error => { console.error(error.message); process.exit(1); });

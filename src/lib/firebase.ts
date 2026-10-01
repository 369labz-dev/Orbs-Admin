import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import type { AdminRequest } from '../../../backend/functions/src/adminContract';
const env = import.meta.env;
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID, databaseURL: env.VITE_FIREBASE_DATABASE_URL });
export const auth = getAuth(app);
export const firestore = getFirestore(app);
const functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-west3');
if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
export async function adminCall<T = any>(request: Partial<AdminRequest> & Pick<AdminRequest, 'action'>): Promise<T> {
    const result = (await httpsCallable(functions, 'adminCallable')({ eventId: '', ...request })).data as any;
    if (!result.ok) {
        const error = new Error([result.rejection?.replaceAll('_', ' '), ...(result.blockers ?? []), ...(result.warnings ?? [])].filter(Boolean).join('. '));
        Object.assign(error, { details: result });
        throw error;
    }
    return result;
}
export async function deleteOrb(eventId: string, orbId: string) {
    const result = (await httpsCallable(functions, 'deleteOrbCallable')({ eventId, orbId })).data as any;
    if (!result.ok)
        throw new Error(result.rejection.replaceAll('_', ' '));
    return result;
}

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = () => {
    try {
        // Look for service account file in secrets folder
        const serviceAccountPath = path.join(process.cwd(), 'firebase-secrets', 'adda-bc00e-firebase-adminsdk-fbsvc-823dfd4e3d.json');

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            // console.log('✅ Firebase Admin SDK initialized');
        } else {
            // console.warn('⚠️ Firebase service account file not found. Push notifications will be disabled.');
        }
    } catch (error) {
        // console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    }
};

export const getFirebaseApp = () => firebaseApp;

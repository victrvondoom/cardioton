/**
 * MedScribe — Firebase Configuration
 * Initialize Firebase for Federated Learning backend.
 * 
 * To set up:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a project called "medscribe-fl"
 * 3. Enable Firestore Database (start in test mode)
 * 4. Copy your config values below
 * 5. The FL service will automatically connect
 */
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    increment,
} from 'firebase/firestore';

// ─── Firebase Config ────────────────────────────────
// Values are loaded from environment variables. Copy .env.example → .env and fill in your project config.
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ─── Firestore Collections ──────────────────────────
export const flRoundsCollection = collection(db, 'fl_rounds');
export const flSignalsCollection = collection(db, 'fl_signals');
export const flAdaptersCollection = collection(db, 'fl_adapters');
export const flDevicesCollection = collection(db, 'fl_devices');
export const flApprovedDataCollection = collection(db, 'fl_approved_data');

export {
    db,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    increment,
    collection,
};

// ─── Device ID ──────────────────────────────────────
// Each device gets a unique persistent ID
import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
    if (cachedDeviceId) return cachedDeviceId;

    let deviceId = await AsyncStorage.getItem('@medscribe_device_id');
    if (!deviceId) {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('@medscribe_device_id', deviceId);
    }
    cachedDeviceId = deviceId;
    return deviceId;
}

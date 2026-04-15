import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, getDocFromServer, getDocsFromServer, limit, increment, collectionGroup, getDocs, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { 
  signInWithPopup, 
  signOut, 
  updateProfile,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  where,
  getDocsFromServer,
  limit,
  increment,
  collectionGroup,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getBlob
};

import React, { useEffect } from 'react';
import { auth, db, doc, setDoc, getDoc } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export const UserSync: React.FC = () => {
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (user) {
      const syncUser = async () => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: googleProvider?.displayName || user.displayName || 'Anonymous',
            photoURL: googleProvider?.photoURL || user.photoURL || '',
            role: user.email === 'ig.mukesh12@gmail.com' ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            downloadCredits: 3,
            shareCredits: 3
          });
        } else if (user.email === 'ig.mukesh12@gmail.com' && userDoc.data()?.role !== 'admin') {
          // Ensure admin role is set for the specific email
          await setDoc(userRef, { role: 'admin' }, { merge: true });
        }
      };
      syncUser();
    }
  }, [user]);

  return null;
};

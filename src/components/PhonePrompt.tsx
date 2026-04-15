import React, { useState, useEffect } from 'react';
import { auth, db, doc, getDoc } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { EditProfileModal } from './EditProfileModal';

export const PhonePrompt: React.FC = () => {
  const [user] = useAuthState(auth);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (user) {
      const checkProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // If missing phone number or photoURL, prompt them
            if (!data.phoneNumber || !data.photoURL || data.displayName === 'Anonymous' || !data.displayName) {
              // Small delay to let the page load
              setTimeout(() => setShowPrompt(true), 2000);
            }
          } else {
            // New user, prompt them
            setTimeout(() => setShowPrompt(true), 2000);
          }
        } catch (err) {
          console.error('Error checking profile:', err);
        }
      };
      checkProfile();
    } else {
      setShowPrompt(false);
    }
  }, [user]);

  const handleClose = () => {
    setShowPrompt(false);
  };

  return (
    <EditProfileModal 
      isOpen={showPrompt} 
      onClose={handleClose} 
      mode="full" 
    />
  );
};

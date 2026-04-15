import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, adminOnly = false }) => {
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setIsBlocked(false);
        setRoleLoading(false);
        return;
      }

      if (user.email?.toLowerCase() === 'ig.mukesh12@gmail.com') {
        setRole('admin');
        setIsBlocked(false);
        setRoleLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.role || 'user');
          setIsBlocked(data.blocked === true);
        } else {
          setRole('user');
          setIsBlocked(false);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole('user');
        setIsBlocked(false);
      } finally {
        setRoleLoading(false);
      }
    };

    if (!loading) {
      fetchRole();
    }
  }, [user, loading]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-#F27D26 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6">
          <AlertTriangle className="text-red-500" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-[#8E9299] max-w-md">
          Your account has been blocked by the administrator. You no longer have access to this application.
        </p>
        <button 
          onClick={() => auth.signOut()}
          className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (adminOnly && !user) {
    return <Navigate to="/" />;
  }

  if (adminOnly) {
    const isMainAdmin = user?.email?.toLowerCase() === 'ig.mukesh12@gmail.com';
    const hasAdminAccess = isMainAdmin || role === 'admin' || role === 'sub-admin';
    
    if (!hasAdminAccess) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};

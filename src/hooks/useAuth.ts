import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { firebaseApi } from '../services/api';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        try {
          const userSnapshot = await firebaseApi.getUser(user.uid);
          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            setUser({
              uid: user.uid,
              ...userData,
            });
          }
        } catch (err) {
          setError('Failed to fetch user data');
          console.error('Error fetching user data:', err);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user?.uid) return;
    
    try {
      await firebaseApi.updateUser(user.uid, updates);
      setUser(prev => prev ? { ...prev, ...updates } : null);
      return { success: true };
    } catch (err) {
      setError('Failed to update profile');
      return { success: false, error: err };
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setFirebaseUser(null);
      return { success: true };
    } catch (err) {
      setError('Failed to logout');
      return { success: false, error: err };
    }
  };

  return {
    user,
    firebaseUser,
    loading,
    error,
    updateUserProfile,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Admin',
    isSuperAdmin: user?.role === 'Super Admin',
    isResidentDoctor: user?.role === 'Resident Doctor',
  };
};

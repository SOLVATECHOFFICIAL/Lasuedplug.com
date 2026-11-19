import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { buildNewUserProfile } from '../lib/authHelpers';
import { UserProfile } from '../types';

export interface AuthContextValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserProfile = useCallback(async (uid: string) => {
    if (!db) {
      setProfile(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn('Failed to load user profile:', err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      if (!auth || !db) {
        throw new Error('Firebase is not configured. Check .env.local.');
      }
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName?.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }
      const newProfile = buildNewUserProfile({
        uid: credential.user.uid,
        email: credential.user.email || email,
        fullName,
        timestamp: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', credential.user.uid), newProfile);
      setProfile(newProfile);
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase is not configured. Check .env.local.');
    }
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) {
      setUser(null);
      setProfile(null);
      return;
    }
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  }, [user, fetchUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

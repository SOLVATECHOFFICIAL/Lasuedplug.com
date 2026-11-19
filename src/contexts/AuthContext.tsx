import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
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
import {
  ACADEMIC_LOCK_MESSAGE,
  buildNewUserProfile,
  checkProfileCompleteness,
  formatFirebaseAuthError,
  getFieldCooldownStatus,
  isAcademicFieldLocked,
  NAME_LOCK_MESSAGE,
  PHONE_UPDATE_COOLDOWN_DAYS,
} from '../lib/authHelpers';
import { UserProfile } from '../types';

export interface ProfileUpdateFields {
  fullName: string;
  phone?: string;
  department?: string;
  level?: string;
  campus?: string;
}

export interface AuthContextValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isProfileComplete: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: ProfileUpdateFields) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isProfileComplete = useMemo(
    () => Boolean(user) && checkProfileCompleteness(profile),
    [user, profile]
  );

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
      const trimmedEmail = email.trim();
      const trimmedName = fullName?.trim() || '';
      const credential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      if (trimmedName) {
        await updateProfile(credential.user, { displayName: trimmedName });
      }
      const newProfile = buildNewUserProfile({
        uid: credential.user.uid,
        email: credential.user.email || trimmedEmail,
        fullName: trimmedName,
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
    await signInWithEmailAndPassword(auth, email.trim(), password);
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

  const updateUserProfile = useCallback(
    async (updates: ProfileUpdateFields) => {
      if (!auth || !db || !user) {
        throw new Error('You must be signed in to update your profile.');
      }

      const nextFullName = updates.fullName.trim();
      const nextPhone = (updates.phone || '').trim();
      const nextCampus = (updates.campus || '').trim();
      const nextDepartment = (updates.department || '').trim();
      const nextLevel = (updates.level || '').trim();

      const existingFullName = (profile?.fullName || '').trim();
      const existingPhone = (profile?.phone || '').trim();
      const existingCampus = (profile?.campus || '').trim();
      const existingDepartment = (profile?.department || '').trim();
      const existingLevel = (profile?.level || '').trim();

      if (
        isAcademicFieldLocked(existingFullName) &&
        nextFullName !== existingFullName
      ) {
        throw new Error(NAME_LOCK_MESSAGE);
      }

      if (
        (isAcademicFieldLocked(existingCampus) && nextCampus !== existingCampus) ||
        (isAcademicFieldLocked(existingDepartment) &&
          nextDepartment !== existingDepartment) ||
        (isAcademicFieldLocked(existingLevel) && nextLevel !== existingLevel)
      ) {
        throw new Error(ACADEMIC_LOCK_MESSAGE);
      }

      const phoneChanged = nextPhone !== existingPhone;
      if (phoneChanged) {
        const phoneCooldown = getFieldCooldownStatus(
          profile?.lastPhoneUpdate,
          PHONE_UPDATE_COOLDOWN_DAYS
        );
        if (phoneCooldown.isLocked) {
          const untilDate = phoneCooldown.nextAvailableDate
            ? phoneCooldown.nextAvailableDate.toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : `${phoneCooldown.remainingDays} day(s)`;
          throw new Error(`Phone locked until ${untilDate}.`);
        }
      }

      const resolvedFullName = isAcademicFieldLocked(existingFullName)
        ? existingFullName
        : nextFullName;
      const nowLocal = new Date();

      const firestoreUpdates: Record<string, unknown> = {
        fullName: resolvedFullName,
        phone: nextPhone,
        campus: isAcademicFieldLocked(existingCampus)
          ? existingCampus
          : nextCampus,
        department: isAcademicFieldLocked(existingDepartment)
          ? existingDepartment
          : nextDepartment,
        level: isAcademicFieldLocked(existingLevel) ? existingLevel : nextLevel,
        updatedAt: serverTimestamp(),
      };

      if (phoneChanged) {
        firestoreUpdates.lastPhoneUpdate = serverTimestamp();
      }

      const localUpdates: Partial<UserProfile> = {
        fullName: resolvedFullName,
        phone: nextPhone,
        campus: String(firestoreUpdates.campus),
        department: String(firestoreUpdates.department),
        level: String(firestoreUpdates.level),
        updatedAt: nowLocal,
        ...(phoneChanged ? { lastPhoneUpdate: nowLocal } : {}),
      };

      if (resolvedFullName && resolvedFullName !== user.displayName) {
        await updateProfile(user, { displayName: resolvedFullName });
      }

      const userRef = doc(db, 'users', user.uid);
      try {
        if (profile) {
          await setDoc(userRef, firestoreUpdates, { merge: true });
          setProfile({
            ...profile,
            ...localUpdates,
          });
        } else {
          const baseProfile = buildNewUserProfile({
            uid: user.uid,
            email: user.email || '',
            fullName: resolvedFullName,
            timestamp: serverTimestamp(),
          });
          const fullDoc: Record<string, unknown> = {
            ...baseProfile,
            ...firestoreUpdates,
          };
          await setDoc(userRef, fullDoc, { merge: true });
          setProfile({
            ...baseProfile,
            ...localUpdates,
            createdAt: nowLocal,
          });
        }
      } catch (err) {
        throw new Error(formatFirebaseAuthError(err));
      }
    },
    [user, profile]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isProfileComplete,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateUserProfile,
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

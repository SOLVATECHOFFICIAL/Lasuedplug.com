import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useToast } from './ToastContext';
import {
  ACADEMIC_LOCK_MESSAGE,
  BANNED_ACCOUNT_MESSAGE,
  buildNewUserProfile,
  checkProfileCompleteness,
  formatFirebaseAuthError,
  getFieldCooldownStatus,
  isAcademicFieldLocked,
  isAccountSuspended,
  NAME_LOCK_MESSAGE,
  PHONE_UPDATE_COOLDOWN_DAYS,
  SUSPENDED_ACCOUNT_MESSAGE,
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
  status: UserProfile['status'] | null;
  isSuspended: boolean;
  loading: boolean;
  isProfileComplete: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: ProfileUpdateFields) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function isEmailBannedInFirestore(email: string): Promise<boolean> {
  if (!db || !email.trim()) {
    return false;
  }
  try {
    const normalized = email.trim().toLowerCase();
    const snap = await getDocs(
      query(collection(db, 'users'), where('email', '==', normalized), limit(5))
    );
    return snap.docs.some((docSnap) => {
      const data = docSnap.data() as Partial<UserProfile>;
      return data.isBanned === true;
    });
  } catch (err) {
    console.warn('Failed to verify email ban status:', err);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();
  const suspensionToastUidRef = useRef<string | null>(null);

  const isSuspended = useMemo(() => isAccountSuspended(profile), [profile]);
  const status: UserProfile['status'] | null = profile?.status ?? null;

  const isProfileComplete = useMemo(
    () => Boolean(user) && !isSuspended && checkProfileCompleteness(profile),
    [user, profile, isSuspended]
  );

  const handleSuspendedLogout = useCallback(
    async (uid?: string | null) => {
      if (auth) {
        try {
          await firebaseSignOut(auth);
        } catch (err) {
          console.warn('Failed to sign out suspended user:', err);
        }
      }
      setUser(null);
      setProfile(null);
      const key = uid || 'suspended';
      if (suspensionToastUidRef.current !== key) {
        suspensionToastUidRef.current = key;
        showToast(SUSPENDED_ACCOUNT_MESSAGE, 'error');
      }
    },
    [showToast]
  );

  const fetchUserProfile = useCallback(
    async (uid: string, email?: string | null) => {
      if (!db) {
        setProfile(null);
        return null;
      }
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const data = {
            uid: snap.id,
            ...(snap.data() as Omit<UserProfile, 'uid'>),
          };
          if (isAccountSuspended(data)) {
            await handleSuspendedLogout(uid);
            return null;
          }
          setProfile(data);
          return data;
        }
        if (email && (await isEmailBannedInFirestore(email))) {
          await handleSuspendedLogout(uid);
          return null;
        }
        setProfile(null);
        return null;
      } catch (err) {
        console.warn('Failed to load user profile:', err);
        setProfile(null);
        return null;
      }
    },
    [handleSuspendedLogout]
  );

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      suspensionToastUidRef.current = null;
      const loadedProfile = await fetchUserProfile(
        firebaseUser.uid,
        firebaseUser.email
      );

      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      if (loadedProfile) {
        setProfile(loadedProfile);
      }

      if (db) {
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (!snap.exists()) return;
            const liveProfile = {
              uid: snap.id,
              ...(snap.data() as Omit<UserProfile, 'uid'>),
            };
            if (isAccountSuspended(liveProfile)) {
              void handleSuspendedLogout(firebaseUser.uid);
              return;
            }
            setProfile(liveProfile);
          },
          (err) => {
            console.warn('Profile status listener warning:', err);
          }
        );
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [fetchUserProfile, handleSuspendedLogout]);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      if (!auth || !db) {
        throw new Error('Firebase is not configured. Check .env.local.');
      }
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = fullName?.trim() || '';

      const emailIsBanned = await isEmailBannedInFirestore(trimmedEmail);
      if (emailIsBanned) {
        showToast(BANNED_ACCOUNT_MESSAGE, 'error');
        throw new Error(BANNED_ACCOUNT_MESSAGE);
      }

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
    [showToast]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!auth) {
        throw new Error('Firebase is not configured. Check .env.local.');
      }
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      if (db) {
        const snap = await getDoc(doc(db, 'users', credential.user.uid));
        const profileData = snap.exists()
          ? ({
              uid: snap.id,
              ...(snap.data() as Omit<UserProfile, 'uid'>),
            } as UserProfile)
          : null;

        const bannedByEmail =
          !profileData && (await isEmailBannedInFirestore(normalizedEmail));

        if (isAccountSuspended(profileData) || bannedByEmail) {
          suspensionToastUidRef.current = credential.user.uid;
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          showToast(SUSPENDED_ACCOUNT_MESSAGE, 'error');
          throw new Error(SUSPENDED_ACCOUNT_MESSAGE);
        }
      }
    },
    [showToast]
  );

  const signOut = useCallback(async () => {
    if (!auth) {
      setUser(null);
      setProfile(null);
      return;
    }
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.uid, user.email);
    }
  }, [user, fetchUserProfile]);

  const updateUserProfile = useCallback(
    async (updates: ProfileUpdateFields) => {
      if (!auth || !db || !user || isAccountSuspended(profile)) {
        throw new Error('You must be signed in with an active account to update your profile.');
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
        status,
        isSuspended,
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

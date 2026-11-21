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
  getProfilePicLockStatus,
  getUserAvatarUrl,
  isAcademicFieldLocked,
  isAccountSuspended,
  NAME_LOCK_MESSAGE,
  PHONE_UPDATE_COOLDOWN_DAYS,
  SUSPENDED_ACCOUNT_MESSAGE,
} from '../lib/authHelpers';
import { AccountType, UserProfile } from '../types';
import { getFastCache, invalidateFastCache, setFastCache } from '../lib/fastCache';
import { primeUserProfilePic } from '../lib/userAvatarCache';

export interface ProfileUpdateFields {
  fullName: string;
  phone?: string;
  accountType?: AccountType;
  department?: string;
  level?: string;
  campus?: string;
  businessName?: string;
  openingHours?: string;
  isOnlineOnly?: boolean;
}

export interface AuthContextValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  status: UserProfile['status'] | null;
  isSuspended: boolean;
  loading: boolean;
  isProfileComplete: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    accountType?: AccountType
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: ProfileUpdateFields) => Promise<void>;
  updateProfilePicture: (profilePic: string) => Promise<void>;
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
          setFastCache(`user_profile:${uid}`, data);
          primeUserProfilePic(uid, getUserAvatarUrl(data));
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

    let isMounted = true;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;
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
      setUser(firebaseUser);

      const cachedProfile = getFastCache<UserProfile>(`user_profile:${firebaseUser.uid}`);
      if (cachedProfile && !isAccountSuspended(cachedProfile)) {
        setProfile(cachedProfile);
        setLoading(false);
      }

      if (db) {
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (!snap.exists() || !isMounted) return;
            const liveProfile = {
              uid: snap.id,
              ...(snap.data() as Omit<UserProfile, 'uid'>),
            };
            if (isAccountSuspended(liveProfile)) {
              invalidateFastCache(`user_profile:${firebaseUser.uid}`);
              void handleSuspendedLogout(firebaseUser.uid);
              return;
            }
            setProfile(liveProfile);
            setFastCache(`user_profile:${firebaseUser.uid}`, liveProfile);
            primeUserProfilePic(firebaseUser.uid, getUserAvatarUrl(liveProfile));
          },
          (err) => {
            console.warn('Profile status listener warning:', err);
          }
        );
      }

      const loadedProfile = await fetchUserProfile(firebaseUser.uid, firebaseUser.email);

      if (!isMounted) return;
      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      if (loadedProfile) {
        setProfile(loadedProfile);
        setFastCache(`user_profile:${firebaseUser.uid}`, loadedProfile);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [fetchUserProfile, handleSuspendedLogout]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName?: string,
      accountType: AccountType = 'student'
    ) => {
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
        accountType,
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
    const prevUid = auth?.currentUser?.uid;
    if (prevUid) {
      invalidateFastCache(`user_profile:${prevUid}`);
    }
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

      const effectiveAccountType: AccountType =
        profile?.accountType || updates.accountType || 'student';

      const nextFullName = updates.fullName.trim();
      const nextPhone = (updates.phone || '').trim();
      const nextCampus = (updates.campus || '').trim();
      const nextDepartment = (updates.department || '').trim();
      const nextLevel = (updates.level || '').trim();
      const nextBusinessName = (updates.businessName || '').trim();
      const nextOpeningHours = (updates.openingHours || '').trim();
      const nextIsOnlineOnly = Boolean(updates.isOnlineOnly);

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
        effectiveAccountType === 'student' &&
        ((isAcademicFieldLocked(existingCampus) && nextCampus !== existingCampus) ||
          (isAcademicFieldLocked(existingDepartment) &&
            nextDepartment !== existingDepartment) ||
          (isAcademicFieldLocked(existingLevel) && nextLevel !== existingLevel))
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
        accountType: effectiveAccountType,
        updatedAt: serverTimestamp(),
      };

      const localUpdates: Partial<UserProfile> = {
        fullName: resolvedFullName,
        phone: nextPhone,
        accountType: effectiveAccountType,
        updatedAt: nowLocal,
        ...(phoneChanged ? { lastPhoneUpdate: nowLocal } : {}),
      };

      if (effectiveAccountType === 'business') {
        firestoreUpdates.businessName = nextBusinessName;
        firestoreUpdates.openingHours = nextOpeningHours;
        firestoreUpdates.isOnlineOnly = nextIsOnlineOnly;

        localUpdates.businessName = nextBusinessName;
        localUpdates.openingHours = nextOpeningHours;
        localUpdates.isOnlineOnly = nextIsOnlineOnly;
      } else {
        const resolvedCampus = isAcademicFieldLocked(existingCampus)
          ? existingCampus
          : nextCampus;
        const resolvedDepartment = isAcademicFieldLocked(existingDepartment)
          ? existingDepartment
          : nextDepartment;
        const resolvedLevel = isAcademicFieldLocked(existingLevel)
          ? existingLevel
          : nextLevel;

        firestoreUpdates.campus = resolvedCampus;
        firestoreUpdates.department = resolvedDepartment;
        firestoreUpdates.level = resolvedLevel;

        localUpdates.campus = resolvedCampus;
        localUpdates.department = resolvedDepartment;
        localUpdates.level = resolvedLevel;
      }

      if (phoneChanged) {
        firestoreUpdates.lastPhoneUpdate = serverTimestamp();
      }

      if (resolvedFullName && resolvedFullName !== user.displayName) {
        await updateProfile(user, { displayName: resolvedFullName });
      }

      const userRef = doc(db, 'users', user.uid);
      try {
        if (profile) {
          await setDoc(userRef, firestoreUpdates, { merge: true });
          const nextProfile = {
            ...profile,
            ...localUpdates,
          };
          setProfile(nextProfile);
          setFastCache(`user_profile:${user.uid}`, nextProfile);
        } else {
          const baseProfile = buildNewUserProfile({
            uid: user.uid,
            email: user.email || '',
            fullName: resolvedFullName,
            accountType: effectiveAccountType,
            timestamp: serverTimestamp(),
          });
          const fullDoc: Record<string, unknown> = {
            ...baseProfile,
            ...firestoreUpdates,
          };
          await setDoc(userRef, fullDoc, { merge: true });
          const nextProfile = {
            ...baseProfile,
            ...localUpdates,
            createdAt: nowLocal,
          };
          setProfile(nextProfile);
          setFastCache(`user_profile:${user.uid}`, nextProfile);
        }
      } catch (err) {
        throw new Error(formatFirebaseAuthError(err));
      }
    },
    [user, profile]
  );

  const updateProfilePicture = useCallback(
    async (profilePicBase64: string) => {
      if (!auth || !db || !user || isAccountSuspended(profile)) {
        throw new Error(
          'You must be signed in with an active account to update your profile picture.'
        );
      }

      const lockStatus = getProfilePicLockStatus(profile?.profilePicUpdatedAt);
      if (lockStatus.isLocked && lockStatus.lockMessage) {
        throw new Error(lockStatus.lockMessage);
      }

      const cleaned = profilePicBase64.trim();
      if (!cleaned) {
        throw new Error('Please choose a valid image file.');
      }
      if (cleaned.length > 150_000) {
        throw new Error(
          'Profile picture is too large after compression. Please select a smaller image.'
        );
      }

      const nowLocal = new Date();
      const userRef = doc(db, 'users', user.uid);
      const firestoreUpdates: Record<string, unknown> = {
        profilePic: cleaned,
        profilePicUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        if (profile) {
          await setDoc(userRef, firestoreUpdates, { merge: true });
          const nextProfile: UserProfile = {
            ...profile,
            profilePic: cleaned,
            profilePicUpdatedAt: nowLocal,
            updatedAt: nowLocal,
          };
          setProfile(nextProfile);
          setFastCache(`user_profile:${user.uid}`, nextProfile);
        } else {
          const baseProfile = buildNewUserProfile({
            uid: user.uid,
            email: user.email || '',
            fullName: user.displayName || '',
            accountType: 'student',
            timestamp: serverTimestamp(),
          });
          await setDoc(
            userRef,
            {
              ...baseProfile,
              ...firestoreUpdates,
            },
            { merge: true }
          );
          const nextProfile: UserProfile = {
            ...baseProfile,
            profilePic: cleaned,
            profilePicUpdatedAt: nowLocal,
            createdAt: nowLocal,
            updatedAt: nowLocal,
          };
          setProfile(nextProfile);
          setFastCache(`user_profile:${user.uid}`, nextProfile);
        }
        primeUserProfilePic(user.uid, cleaned);
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
        updateProfilePicture,
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

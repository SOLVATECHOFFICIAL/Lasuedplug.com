import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getUserAvatarUrl } from './authHelpers';
import { getFastCache, setFastCache } from './fastCache';
import { UserProfile } from '../types';

const memoryAvatarCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();
const subscribers = new Map<string, Set<(url: string) => void>>();

function notifySubscribers(uid: string, url: string): void {
  const listeners = subscribers.get(uid);
  if (!listeners) return;
  listeners.forEach((cb) => cb(url));
}

export function primeUserProfilePic(
  uid?: string | null,
  avatarUrl?: string | null
): void {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) return;
  const cleanUrl = (avatarUrl || '').trim();
  memoryAvatarCache.set(cleanUid, cleanUrl);
  setFastCache(`user_dp:${cleanUid}`, cleanUrl);
  notifySubscribers(cleanUid, cleanUrl);
}

export async function getUserProfilePic(uid?: string | null): Promise<string> {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) return '';

  if (memoryAvatarCache.has(cleanUid)) {
    return memoryAvatarCache.get(cleanUid) || '';
  }

  const cached = getFastCache<string>(`user_dp:${cleanUid}`, 5 * 60_000);
  if (typeof cached === 'string') {
    memoryAvatarCache.set(cleanUid, cached);
    return cached;
  }

  if (!db) {
    return '';
  }

  const existing = inflightRequests.get(cleanUid);
  if (existing) {
    return existing;
  }

  const promise = getDoc(doc(db, 'users', cleanUid))
    .then((snap) => {
      if (!snap.exists()) {
        primeUserProfilePic(cleanUid, '');
        return '';
      }
      const data = snap.data() as Partial<UserProfile>;
      const resolved = getUserAvatarUrl(data);
      primeUserProfilePic(cleanUid, resolved);
      return resolved;
    })
    .catch(() => '')
    .finally(() => {
      inflightRequests.delete(cleanUid);
    });

  inflightRequests.set(cleanUid, promise);
  return promise;
}

export function useUserProfilePic(
  uid?: string | null,
  snapshotPic?: string | null
): string {
  const cleanSnapshot = (snapshotPic || '').trim();
  const cleanUid = (uid || '').trim();

  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (cleanUid) {
      if (memoryAvatarCache.has(cleanUid)) {
        return memoryAvatarCache.get(cleanUid) || cleanSnapshot;
      }
      const cached = getFastCache<string>(`user_dp:${cleanUid}`, 5 * 60_000);
      if (typeof cached === 'string' && cached) {
        return cached;
      }
    }
    return cleanSnapshot;
  });

  useEffect(() => {
    if (!cleanUid) {
      setResolvedUrl(cleanSnapshot);
      return;
    }

    let listeners = subscribers.get(cleanUid);
    if (!listeners) {
      listeners = new Set();
      subscribers.set(cleanUid, listeners);
    }
    const listener = (nextUrl: string) => {
      setResolvedUrl(nextUrl || cleanSnapshot);
    };
    listeners.add(listener);

    if (memoryAvatarCache.has(cleanUid)) {
      const mem = memoryAvatarCache.get(cleanUid) || '';
      setResolvedUrl(mem || cleanSnapshot);
    } else {
      const cached = getFastCache<string>(`user_dp:${cleanUid}`, 5 * 60_000);
      if (typeof cached === 'string') {
        memoryAvatarCache.set(cleanUid, cached);
        setResolvedUrl(cached || cleanSnapshot);
      } else {
        if (cleanSnapshot) {
          setResolvedUrl(cleanSnapshot);
        }
        let active = true;
        void getUserProfilePic(cleanUid).then((url) => {
          if (active) {
            setResolvedUrl(url || cleanSnapshot);
          }
        });
        return () => {
          active = false;
          listeners?.delete(listener);
        };
      }
    }

    return () => {
      listeners?.delete(listener);
    };
  }, [cleanUid, cleanSnapshot]);

  return resolvedUrl || cleanSnapshot;
}

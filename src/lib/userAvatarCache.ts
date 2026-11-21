import { useEffect, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserAvatarUrl } from './authHelpers';
import { getFastCache, setFastCache } from './fastCache';
import { UserProfile } from '../types';

const AVATAR_CACHE_TTL_MS = 15 * 60_000;
const memoryAvatarCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();
const subscribers = new Map<string, Set<(url: string) => void>>();

// Micro-batch queue to coalesce card avatar lookups into 1-2 Firestore `in` queries instead of N+1 getDocs
let pendingBatchUids = new Set<string>();
let pendingResolvers = new Map<string, Array<(url: string) => void>>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function notifySubscribers(uid: string, url: string): void {
  const listeners = subscribers.get(uid);
  if (!listeners) return;
  listeners.forEach((cb) => cb(url));
}

function isPlaceholderUid(uid: string): boolean {
  return uid.startsWith('test_') || uid.startsWith('seed_');
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

async function flushAvatarBatch(): Promise<void> {
  const uidsToFetch = Array.from(pendingBatchUids);
  const resolversSnapshot = pendingResolvers;
  pendingBatchUids = new Set<string>();
  pendingResolvers = new Map<string, Array<(url: string) => void>>();
  batchTimer = null;

  if (uidsToFetch.length === 0) return;

  const resolveUid = (uid: string, url: string) => {
    primeUserProfilePic(uid, url);
    inflightRequests.delete(uid);
    const cbs = resolversSnapshot.get(uid);
    if (cbs) {
      cbs.forEach((cb) => cb(url));
    }
  };

  if (!db) {
    uidsToFetch.forEach((uid) => resolveUid(uid, ''));
    return;
  }

  const usersCol = collection(db, 'users');
  const chunks: string[][] = [];
  for (let i = 0; i < uidsToFetch.length; i += 30) {
    chunks.push(uidsToFetch.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const unresolved = new Set(chunk);
      try {
        const snap = await getDocs(
          query(usersCol, where(documentId(), 'in', chunk))
        );
        snap.docs.forEach((docSnap) => {
          unresolved.delete(docSnap.id);
          const data = docSnap.data() as Partial<UserProfile>;
          resolveUid(docSnap.id, getUserAvatarUrl(data));
        });
      } catch {
        // Non-blocking fallback when offline or restricted
      } finally {
        unresolved.forEach((uid) => resolveUid(uid, ''));
      }
    })
  );
}

export async function getUserProfilePic(uid?: string | null): Promise<string> {
  const cleanUid = (uid || '').trim();
  if (!cleanUid || isPlaceholderUid(cleanUid)) return '';

  if (memoryAvatarCache.has(cleanUid)) {
    return memoryAvatarCache.get(cleanUid) || '';
  }

  const cached = getFastCache<string>(`user_dp:${cleanUid}`, AVATAR_CACHE_TTL_MS);
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

  const promise = new Promise<string>((resolve) => {
    const list = pendingResolvers.get(cleanUid) || [];
    list.push(resolve);
    pendingResolvers.set(cleanUid, list);
    pendingBatchUids.add(cleanUid);

    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        void flushAvatarBatch();
      }, 15);
    }
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
      const cached = getFastCache<string>(
        `user_dp:${cleanUid}`,
        AVATAR_CACHE_TTL_MS
      );
      if (typeof cached === 'string' && cached) {
        return cached;
      }
    }
    return cleanSnapshot;
  });

  useEffect(() => {
    if (!cleanUid || isPlaceholderUid(cleanUid)) {
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
      const cached = getFastCache<string>(
        `user_dp:${cleanUid}`,
        AVATAR_CACHE_TTL_MS
      );
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

const DB_NAME = 'lasuedplug_persistent_v1';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

export interface IdbEntry {
  key: string;
  value: unknown;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const database = await openCacheDb();
  if (!database || !key) return null;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const row = req.result as IdbEntry | undefined;
        resolve(row ? (row.value as T) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const database = await openCacheDb();
  if (!database || !key) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, value } satisfies IdbEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDelete(key: string): Promise<void> {
  const database = await openCacheDb();
  if (!database || !key) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDeletePrefix(prefix: string): Promise<void> {
  const database = await openCacheDb();
  if (!database) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const entry = cursor.value as IdbEntry | undefined;
        if (!prefix || (entry?.key && entry.key.startsWith(prefix))) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(): Promise<void> {
  const database = await openCacheDb();
  if (!database) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGetAllEntries(): Promise<IdbEntry[]> {
  const database = await openCacheDb();
  if (!database) return [];

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result;
        resolve(Array.isArray(rows) ? (rows as IdbEntry[]) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

import { doc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import {
  GLOBAL_SETTINGS_DOC_ID,
  PLATFORM_SETTINGS_COLLECTION,
  PlatformSettings,
} from './platformSettingsHelpers';

export function subscribeToPlatformSettings(
  onUpdate: (settings: PlatformSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!db) {
    onUpdate({ maintenanceMode: false });
    return () => {};
  }

  const ref = doc(db, PLATFORM_SETTINGS_COLLECTION, GLOBAL_SETTINGS_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate({ maintenanceMode: false });
        return;
      }
      const data = snap.data() as Partial<PlatformSettings>;
      onUpdate({
        maintenanceMode: Boolean(data.maintenanceMode),
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
    },
    (err) => {
      if (onError) {
        onError(err);
      }
      onUpdate({ maintenanceMode: false });
    }
  );
}

export async function updateMaintenanceMode(
  enabled: boolean,
  updatedBy?: string | null
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not configured. Check your environment setup.');
  }

  const ref = doc(db, PLATFORM_SETTINGS_COLLECTION, GLOBAL_SETTINGS_DOC_ID);
  await setDoc(
    ref,
    {
      maintenanceMode: enabled,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || '',
    },
    { merge: true }
  );
}

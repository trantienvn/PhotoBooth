import { openDB, type IDBPDatabase } from 'idb';
import type { CaptureSession, Photo, AppSettings } from '@/types';
import { defaultAppSettings } from '@/types';

const DB_NAME = 'lumibooth-db';
const DB_VERSION = 1;

interface LumiBoothDB {
  sessions: {
    key: string;
    value: Omit<CaptureSession, 'photos'>;
    indexes: { 'by-createdAt': number };
  };
  photos: {
    key: string;
    value: Photo;
    indexes: { 'by-sessionId': string; 'by-sessionId-index': [string, number] };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

let db: IDBPDatabase<LumiBoothDB> | null = null;

async function getDB(): Promise<IDBPDatabase<LumiBoothDB>> {
  if (db) return db;
  db = await openDB<LumiBoothDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Sessions store
      if (!database.objectStoreNames.contains('sessions')) {
        const sessionsStore = database.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('by-createdAt', 'createdAt');
      }
      // Photos store
      if (!database.objectStoreNames.contains('photos')) {
        const photosStore = database.createObjectStore('photos', { keyPath: 'id' });
        photosStore.createIndex('by-sessionId', 'sessionId');
        photosStore.createIndex('by-sessionId-index', ['sessionId', 'index']);
      }
      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });
  return db;
}

// ── Session operations ─────────────────────────────────────

export async function saveSession(session: CaptureSession): Promise<void> {
  const database = await getDB();
  const { photos, ...sessionData } = session;
  await database.put('sessions', sessionData);
  // Save photos separately
  const tx = database.transaction('photos', 'readwrite');
  for (const photo of photos) {
    await tx.store.put(photo);
  }
  await tx.done;
}

export async function getSession(id: string): Promise<CaptureSession | null> {
  const database = await getDB();
  const sessionData = await database.get('sessions', id);
  if (!sessionData) return null;
  const photos = await database.getAllFromIndex('photos', 'by-sessionId', id);
  photos.sort((a, b) => a.index - b.index);
  const timelapseUrl = sessionData.timelapseBlob ? URL.createObjectURL(sessionData.timelapseBlob) : sessionData.timelapseUrl;
  return { ...sessionData, photos, timelapseUrl };
}

export async function getAllSessions(): Promise<CaptureSession[]> {
  const database = await getDB();
  const sessions = await database.getAllFromIndex('sessions', 'by-createdAt');
  const result: CaptureSession[] = [];
  for (const s of sessions.reverse()) {
    const photos = await database.getAllFromIndex('photos', 'by-sessionId', s.id);
    photos.sort((a, b) => a.index - b.index);
    const timelapseUrl = s.timelapseBlob ? URL.createObjectURL(s.timelapseBlob) : s.timelapseUrl;
    result.push({ ...s, photos, timelapseUrl });
  }
  return result;
}

export async function deleteSession(id: string): Promise<void> {
  const database = await getDB();
  const photos = await database.getAllFromIndex('photos', 'by-sessionId', id);
  const tx = database.transaction(['sessions', 'photos'], 'readwrite');
  await tx.objectStore('sessions').delete(id);
  for (const photo of photos) {
    await tx.objectStore('photos').delete(photo.id);
  }
  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['sessions', 'photos'], 'readwrite');
  await tx.objectStore('sessions').clear();
  await tx.objectStore('photos').clear();
  await tx.done;
}

// ── Photo operations ───────────────────────────────────────

export async function savePhoto(photo: Photo): Promise<void> {
  const database = await getDB();
  await database.put('photos', photo);
}

export async function updatePhoto(photo: Photo): Promise<void> {
  const database = await getDB();
  await database.put('photos', photo);
}

export async function deletePhoto(photoId: string): Promise<void> {
  const database = await getDB();
  await database.delete('photos', photoId);
}

// ── Settings operations ────────────────────────────────────

interface SettingsRecord extends AppSettings {
  id: string;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const database = await getDB();
  await database.put('settings', { ...settings, id: 'app-settings' } as SettingsRecord);
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const database = await getDB();
    const record = await database.get('settings', 'app-settings') as SettingsRecord | undefined;
    if (!record) return defaultAppSettings;
    const { id: _id, ...settings } = record;
    return { ...defaultAppSettings, ...settings };
  } catch {
    return defaultAppSettings;
  }
}

// ── Storage estimation ─────────────────────────────────────

export async function estimateStorageUsage(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

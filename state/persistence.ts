"use client";

/**
 * Minimal IndexedDB-backed session persistence for autosave. Stores each open
 * document as its `.cpe` Blob plus a small session record listing the open tabs
 * and which one is active. No external dependency — a tiny promise wrapper over
 * a single object store keyed by string.
 */

const DB_NAME = "cpe-editor";
const STORE = "kv";
const DB_VERSION = 1;

const SESSION_KEY = "session";
const DOC_PREFIX = "doc:";

export interface SessionRecord {
  docs: { id: string; name: string }[];
  activeDocId: string | null;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSession(record: SessionRecord): Promise<void> {
  try {
    await idbSet(SESSION_KEY, record);
  } catch {
    // Best-effort; ignore storage failures (private mode, quota, etc.).
  }
}

export async function loadSession(): Promise<SessionRecord | undefined> {
  try {
    return await idbGet<SessionRecord>(SESSION_KEY);
  } catch {
    return undefined;
  }
}

export async function saveDocBlob(id: string, blob: Blob): Promise<void> {
  try {
    await idbSet(DOC_PREFIX + id, blob);
  } catch {
    // ignore
  }
}

export async function loadDocBlob(id: string): Promise<Blob | undefined> {
  try {
    return await idbGet<Blob>(DOC_PREFIX + id);
  } catch {
    return undefined;
  }
}

export async function deleteDocBlob(id: string): Promise<void> {
  try {
    await idbDelete(DOC_PREFIX + id);
  } catch {
    // ignore
  }
}

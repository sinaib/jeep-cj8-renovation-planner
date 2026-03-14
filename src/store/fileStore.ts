// ─── IndexedDB file store ─────────────────────────────────────────────────────
// Stores full ProjectFile objects (including base64 dataUrl) in IndexedDB.
// Zustand/localStorage only holds lightweight metadata (fileIndex).
// Binary data never touches localStorage to avoid the 5-10MB quota limit.

const DB_NAME = 'jeep-planner-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export interface ProjectFile {
  id: string;
  taskId?: string;
  phaseId?: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  mimeType: string;
  dataUrl: string;        // base64 data URL — lives here only, never in Zustand
  size: number;           // bytes
  caption?: string;       // user-written label
  analysisNote?: string;  // AI-generated observation after image analysis
  createdAt: string;      // ISO timestamp
}

// ─── DB initialization ────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
  return dbPromise;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function saveFile(file: ProjectFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFile(id: string): Promise<ProjectFile | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as ProjectFile | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listFilesForTask(taskId: string): Promise<ProjectFile[]> {
  const all = await listAllFiles();
  return all.filter((f) => f.taskId === taskId);
}

export async function listAllFiles(): Promise<ProjectFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as ProjectFile[]);
    req.onerror = () => reject(req.error);
  });
}

export async function updateFileAnalysis(id: string, analysisNote: string): Promise<void> {
  const file = await getFile(id);
  if (!file) return;
  await saveFile({ ...file, analysisNote });
}

export async function updateFileCaption(id: string, caption: string): Promise<void> {
  const file = await getFile(id);
  if (!file) return;
  await saveFile({ ...file, caption });
}

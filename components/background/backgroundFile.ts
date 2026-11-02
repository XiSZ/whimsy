"use client";

import { useEffect, useState } from "react";

// The custom background image/video lives in IndexedDB: localStorage is too
// small for wallpapers and videos. One record, the picked File itself.
const DB_NAME = "whimsy";
const STORE = "files";
const KEY = "background";
const CHANGED_EVENT = "whimsy-background-file-changed";

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    };
  });
}

export async function saveBackgroundFile(file: File): Promise<void> {
  await withStore("readwrite", (store) => store.put(file, KEY));
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

// The stored background file (null when none or unreadable); follows saves
// made from any component.
export function useBackgroundFile(): File | null {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const load = () =>
      withStore<File | undefined>("readonly", (store) => store.get(KEY))
        .then((stored) => setFile(stored ?? null))
        .catch(() => setFile(null));
    load();
    window.addEventListener(CHANGED_EVENT, load);
    return () => window.removeEventListener(CHANGED_EVENT, load);
  }, []);

  return file;
}

// Keeps everything in this browser's IndexedDB, on this device only. No account,
// no server. Backups are a single JSON file (photos included) made by exportBackup.
import type { Box, Data, Item, Photo } from "../types";
import type { Store } from "./store";

/** Not wired into the app yet. The data methods match Store; accounts are dropped, backups added. */
export type LocalStore = Omit<Store, "linkError" | "onAuth" | "signIn" | "signOut" | "sendPasswordReset" | "setPassword"> & {
  exportBackup(): Promise<Blob>;
  importBackup(file: Blob): Promise<void>;
};

const DB_NAME = "storage-bins";
const STORES = ["boxes", "items", "photos"] as const;
type StoreName = (typeof STORES)[number];
/** A photo as saved on the device: the record plus the image itself. */
type PhotoRow = Photo & { blob: Blob; created: number };

interface Backup {
  app: "storage-bins";
  version: 1;
  saved: string;
  boxes: Box[];
  items: Item[];
  photos: (Photo & { created: number; image: string })[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const name of STORES) req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Couldn't save on this device."));
  });

const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const newId = () => crypto.randomUUID();

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function createLocalStore(): Promise<LocalStore> {
  const db = await open();
  // Ask the browser not to clear this data when space runs low. Not every browser agrees.
  navigator.storage?.persist?.().catch(() => {});

  const all = async <T>(name: StoreName) => (await result(db.transaction(name).objectStore(name).getAll())) as T[];

  /** Runs `work` in one read-write transaction and waits for it to be saved. */
  const write = async (names: StoreName[], work: (tx: IDBTransaction) => void | Promise<void>) => {
    const tx = db.transaction(names, "readwrite");
    const saved = done(tx);
    await work(tx);
    await saved;
  };

  const urls = new Map<string, string>();
  const forget = (id: string) => {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
  };

  return {
    async load(): Promise<Data> {
      const [boxes, items, photos] = await Promise.all([all<Box>("boxes"), all<Item>("items"), all<PhotoRow>("photos")]);
      boxes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      items.sort((a, b) => a.name.localeCompare(b.name));
      photos.sort((a, b) => a.created - b.created);
      return { boxes, items, photos: photos.map(({ id, box_id, path }) => ({ id, box_id, path })) };
    },

    async createBox(code, input) {
      const boxes = await all<Box>("boxes");
      if (boxes.some((b) => b.code.toLowerCase() === code.toLowerCase())) {
        throw new Error(`There's already a box ${code}.`);
      }
      await write(["boxes"], (tx) => void tx.objectStore("boxes").add({ id: newId(), code, ...input }));
    },
    async updateBox(id, input) {
      await write(["boxes"], async (tx) => {
        const s = tx.objectStore("boxes");
        const box = await result(s.get(id));
        if (!box) throw new Error("That box no longer exists.");
        s.put({ ...box, ...input });
      });
    },
    async deleteBox(box) {
      await write(["boxes", "items", "photos"], async (tx) => {
        const [items, photos] = await Promise.all([
          result(tx.objectStore("items").getAll()) as Promise<Item[]>,
          result(tx.objectStore("photos").getAll()) as Promise<PhotoRow[]>,
        ]);
        items.filter((i) => i.box_id === box.id).forEach((i) => tx.objectStore("items").delete(i.id));
        photos.filter((p) => p.box_id === box.id).forEach((p) => {
          tx.objectStore("photos").delete(p.id);
          forget(p.id);
        });
        tx.objectStore("boxes").delete(box.id);
      });
    },

    async addItem(boxId, name, quantity) {
      await write(["items"], (tx) => void tx.objectStore("items").add({ id: newId(), box_id: boxId, name, quantity, notes: null }));
    },
    async updateItem(id, patch) {
      await write(["items"], async (tx) => {
        const s = tx.objectStore("items");
        const item = await result(s.get(id));
        if (!item) throw new Error("That item no longer exists.");
        s.put({ ...item, ...patch });
      });
    },
    async deleteItem(id) {
      await write(["items"], (tx) => void tx.objectStore("items").delete(id));
    },

    async addPhoto(boxId, image) {
      const id = newId();
      const row: PhotoRow = { id, box_id: boxId, path: id, blob: image, created: Date.now() };
      await write(["photos"], (tx) => void tx.objectStore("photos").add(row));
    },
    async deletePhoto(photo) {
      await write(["photos"], (tx) => void tx.objectStore("photos").delete(photo.id));
      forget(photo.id);
    },
    async photoUrls(paths) {
      const out: Record<string, string> = {};
      const missing = paths.filter((p) => !urls.has(p));
      if (missing.length) {
        const s = db.transaction("photos").objectStore("photos");
        const rows = await Promise.all(missing.map((p) => result(s.get(p)) as Promise<PhotoRow | undefined>));
        rows.forEach((row) => row && urls.set(row.path, URL.createObjectURL(row.blob)));
      }
      for (const p of paths) if (urls.has(p)) out[p] = urls.get(p)!;
      return out;
    },

    async exportBackup() {
      const [boxes, items, photos] = await Promise.all([all<Box>("boxes"), all<Item>("items"), all<PhotoRow>("photos")]);
      const backup: Backup = {
        app: "storage-bins",
        version: 1,
        saved: new Date().toISOString(),
        boxes,
        items,
        photos: await Promise.all(
          photos.map(async ({ blob, ...p }) => ({ ...p, image: await toDataUrl(blob) })),
        ),
      };
      return new Blob([JSON.stringify(backup)], { type: "application/json" });
    },
    async importBackup(file) {
      let backup: Backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't a Storage bins backup.");
      }
      if (backup?.app !== "storage-bins" || !Array.isArray(backup.boxes) || !Array.isArray(backup.items)) {
        throw new Error("That file isn't a Storage bins backup.");
      }
      const photos: PhotoRow[] = await Promise.all(
        (backup.photos ?? []).map(async ({ image, ...p }) => ({ ...p, blob: await (await fetch(image)).blob() })),
      );
      await write([...STORES], (tx) => {
        STORES.forEach((s) => tx.objectStore(s).clear());
        backup.boxes.forEach((b) => tx.objectStore("boxes").put(b));
        backup.items.forEach((i) => tx.objectStore("items").put(i));
        photos.forEach((p) => tx.objectStore("photos").put(p));
      });
      [...urls.keys()].forEach(forget);
    },
  };
}

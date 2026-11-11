// In-memory stand-in for Supabase, used only by `npm run dev` and the demo build
// so the screens can be tried and tested without touching real data.
import type { AuthState, Box, Data, Item, Photo } from "../types";
import type { Store } from "./store";

let n = 0;
const id = () => `demo-${++n}`;

export function createMemoryStore(): Store {
  const boxes: Box[] = [
    { id: id(), code: "B-01", name: "Christmas decorations", location: "Garage, shelf 2", notes: "Fragile. Keep on top." },
    { id: id(), code: "B-02", name: "Camping gear", location: "Garage, shelf 2", notes: null },
    { id: id(), code: "B-03", name: "Winter clothes", location: "Attic", notes: null },
    { id: id(), code: "B-04", name: "Kids' keepsakes", location: "Attic", notes: null },
    { id: id(), code: "B-05", name: "Cables and chargers", location: null, notes: null },
  ];
  const seed: [number, string, number, string | null][] = [
    [0, "String lights, warm white", 4, "One strand has a dead bulb"],
    [0, "Tree topper star", 1, null],
    [0, "Glass ornaments", 24, null],
    [0, "Stockings", 5, null],
    [1, "Two-person tent", 1, null],
    [1, "Sleeping bags", 2, null],
    [1, "Camp stove", 1, "Needs a new gas canister"],
    [1, "Headlamps", 3, null],
    [2, "Wool sweaters", 6, null],
    [2, "Ski gloves", 2, null],
    [3, "School artwork, 2021 to 2024", 1, null],
    [4, "HDMI cables", 3, null],
    [4, "USB-C chargers", 2, null],
  ];
  let items: Item[] = seed.map(([b, name, quantity, notes]) => ({ id: id(), box_id: boxes[b].id, name, quantity, notes }));
  let photos: Photo[] = [];
  const blobs: Record<string, string> = {};

  const signedOut = new URLSearchParams(location.search).has("signedout");
  let state: AuthState = signedOut ? "signedOut" : "signedIn";
  const listeners = new Set<(s: AuthState) => void>();
  const emit = (s: AuthState) => {
    state = s;
    listeners.forEach((l) => l(s));
  };
  const byCode = (a: Box, b: Box) => a.code.localeCompare(b.code);

  return {
    linkError: null,
    onAuth(l) {
      listeners.add(l);
      l(state);
      return () => void listeners.delete(l);
    },
    async signIn(_email, password) {
      if (password === "wrong") throw new Error("Invalid login credentials");
      emit("signedIn");
    },
    async signOut() {
      emit("signedOut");
    },
    async sendPasswordReset() {},
    async setPassword() {
      emit("signedIn");
    },
    async load(): Promise<Data> {
      return {
        boxes: [...boxes].sort(byCode),
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
        photos: [...photos],
      };
    },
    async createBox(code, input) {
      boxes.push({ id: id(), code, ...input });
    },
    async updateBox(boxId, input) {
      Object.assign(boxes.find((b) => b.id === boxId)!, input);
    },
    async deleteBox(box) {
      boxes.splice(boxes.findIndex((b) => b.id === box.id), 1);
      items = items.filter((i) => i.box_id !== box.id);
      photos = photos.filter((p) => p.box_id !== box.id);
    },
    async addItem(boxId, name, quantity) {
      items.push({ id: id(), box_id: boxId, name, quantity, notes: null });
    },
    async updateItem(itemId, patch) {
      Object.assign(items.find((i) => i.id === itemId)!, patch);
    },
    async deleteItem(itemId) {
      items = items.filter((i) => i.id !== itemId);
    },
    async addPhoto(boxId, image) {
      const path = `${boxId}/${id()}.jpg`;
      blobs[path] = URL.createObjectURL(image);
      photos.push({ id: id(), box_id: boxId, path });
    },
    async deletePhoto(photo) {
      photos = photos.filter((p) => p.id !== photo.id);
    },
    async photoUrls(paths) {
      return Object.fromEntries(paths.filter((p) => blobs[p]).map((p) => [p, blobs[p]]));
    },
  };
}

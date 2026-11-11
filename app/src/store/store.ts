import type { AuthState, Box, BoxInput, Data, ItemPatch, Photo } from "../types";

/** Everything the screens need from the backend. Screens never talk to Supabase directly. */
export interface Store {
  /** Set when the page was opened from a reset link that has expired or was already used. */
  readonly linkError: string | null;

  onAuth(listener: (state: AuthState) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string, returnTo: string): Promise<void>;
  setPassword(password: string): Promise<void>;

  load(): Promise<Data>;

  createBox(code: string, input: BoxInput): Promise<void>;
  updateBox(id: string, input: BoxInput): Promise<void>;
  deleteBox(box: Box, photos: Photo[]): Promise<void>;

  addItem(boxId: string, name: string, quantity: number): Promise<void>;
  updateItem(id: string, patch: ItemPatch): Promise<void>;
  deleteItem(id: string): Promise<void>;

  addPhoto(boxId: string, image: Blob): Promise<void>;
  deletePhoto(photo: Photo): Promise<void>;
  /** Short-lived viewing links for private photos, keyed by path. */
  photoUrls(paths: string[]): Promise<Record<string, string>>;
}

import { createClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET, SUPABASE_KEY, SUPABASE_URL } from "../config";
import type { AuthState, Data } from "../types";
import type { Store } from "./store";

function ok<R extends { data: unknown; error: { message: string } | null }>(result: R): R["data"] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function createSupabaseStore(): Store {
  // Read these before the client consumes the URL.
  let recovering = /type=recovery/.test(location.hash);
  const rawError = /error_description=([^&]+)/.exec(location.hash)?.[1];
  const linkError = rawError ? decodeURIComponent(rawError.replace(/\+/g, " ")) : null;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const listeners = new Set<(s: AuthState) => void>();
  let state: AuthState = "loading";
  const emit = (next: AuthState) => {
    state = next;
    listeners.forEach((l) => l(next));
  };

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recovering = true;
    if (!session) {
      recovering = false;
      emit("signedOut");
    } else {
      emit(recovering ? "recovery" : "signedIn");
    }
  });

  const photos = () => sb.storage.from(PHOTO_BUCKET);

  return {
    linkError,

    onAuth(listener) {
      listeners.add(listener);
      listener(state);
      return () => void listeners.delete(listener);
    },
    async signIn(email, password) {
      ok(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async sendPasswordReset(email, returnTo) {
      ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: returnTo }));
    },
    async setPassword(password) {
      ok(await sb.auth.updateUser({ password }));
      recovering = false;
      emit("signedIn");
    },

    async load(): Promise<Data> {
      const [boxes, items, pics] = await Promise.all([
        sb.from("boxes").select("id, code, name, location, notes").order("code"),
        sb.from("items").select("id, box_id, name, quantity, notes").order("name"),
        sb.from("photos").select("id, box_id, path").order("created_at"),
      ]);
      return { boxes: ok(boxes) ?? [], items: ok(items) ?? [], photos: ok(pics) ?? [] };
    },

    async createBox(code, input) {
      ok(await sb.from("boxes").insert({ ...input, code }));
    },
    async updateBox(id, input) {
      ok(await sb.from("boxes").update(input).eq("id", id));
    },
    async deleteBox(box, boxPhotos) {
      if (boxPhotos.length) await photos().remove(boxPhotos.map((p) => p.path));
      ok(await sb.from("boxes").delete().eq("id", box.id));
    },

    async addItem(boxId, name, quantity) {
      ok(await sb.from("items").insert({ box_id: boxId, name, quantity }));
    },
    async updateItem(id, patch) {
      ok(await sb.from("items").update(patch).eq("id", id));
    },
    async deleteItem(id) {
      ok(await sb.from("items").delete().eq("id", id));
    },

    async addPhoto(boxId, image) {
      const path = `${boxId}/${Date.now()}.jpg`;
      ok(await photos().upload(path, image, { contentType: "image/jpeg" }));
      ok(await sb.from("photos").insert({ box_id: boxId, path }));
    },
    async deletePhoto(photo) {
      await photos().remove([photo.path]);
      ok(await sb.from("photos").delete().eq("id", photo.id));
    },
    async photoUrls(paths) {
      if (!paths.length) return {};
      const signed = ok(await photos().createSignedUrls(paths, 3600)) ?? [];
      const urls: Record<string, string> = {};
      signed.forEach((s, i) => {
        if (s.signedUrl) urls[paths[i]] = s.signedUrl;
      });
      return urls;
    },
  };
}

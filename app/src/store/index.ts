import type { Store } from "./store";
import { createSupabaseStore } from "./supabaseStore";

export type { Store } from "./store";

export async function createStore(): Promise<Store> {
  if (import.meta.env.MODE === "demo") {
    return (await import("./memoryStore")).createMemoryStore();
  }
  return createSupabaseStore();
}

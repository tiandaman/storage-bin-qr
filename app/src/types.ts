export interface Box {
  id: string;
  /** Short label printed on the box and used in its QR link, e.g. "B-01". Never changes. */
  code: string;
  name: string;
  location: string | null;
  notes: string | null;
}

export interface Item {
  id: string;
  box_id: string;
  name: string;
  quantity: number;
  notes: string | null;
}

export interface Photo {
  id: string;
  box_id: string;
  /** File path inside the photo bucket. */
  path: string;
}

export interface Data {
  boxes: Box[];
  items: Item[];
  photos: Photo[];
}

export type AuthState = "loading" | "signedOut" | "signedIn" | "recovery";

export type BoxInput = Pick<Box, "name" | "location" | "notes">;
export type ItemPatch = Partial<Pick<Item, "name" | "quantity" | "notes" | "box_id">>;

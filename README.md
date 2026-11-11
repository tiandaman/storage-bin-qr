# Storage bins

A phone-friendly web app for storage boxes. Each box gets a QR label. Scan it to see what's inside, and add, edit, move or remove items.

**Live app:** https://tiandaman.github.io/storage-bin-qr/

## Features
- Sign-in and password reset by email (only accounts created in Supabase can see or edit anything)
- Boxes with a short code (B-01…), name, place and notes, grouped by place
- Items with quantity and notes; move an item to another box
- Search across every box, item and place
- Photos of box contents (stored privately in Supabase Storage)
- Printable QR label sheet, plus a built-in scanner

## How it's built
- TypeScript + Preact, bundled with Vite. Source is in `app/`.
- Data: Supabase (Postgres, Auth, Storage). Setup SQL is in `supabase/schema.sql`.
- Screens only use the `Store` interface (`app/src/store/store.ts`). `supabaseStore.ts` is the real backend; `memoryStore.ts` is a demo backend for development.
- GitHub Pages serves the repo root, so the built site (`index.html`, `assets/`) is committed.

## Changing the app
```
cd app
npm install
npm run dev      # local preview with demo data
npm run build    # type-checks, builds, and copies the site to the repo root
```
Commit the result and push to `main` to publish.

QR codes link to `…/#/box/<CODE>`. Keep that route stable so printed labels keep working.

## Adding someone
Supabase dashboard → Authentication → Users → Add user → Create new user (tick Auto Confirm).

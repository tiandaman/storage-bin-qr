# Storage Bins

A phone-friendly web app for storage boxes. Each box gets a QR label. Scan it to see what's inside, and add, edit, move or remove items.

**Live app:** https://tiandaman.github.io/storage-bin-qr/

## Features
- Sign-in (only accounts you create in Supabase can see or edit anything)
- Boxes with a short code (B-01…), name, location and notes
- Items with quantity and notes; move an item to another box
- Search across every box, item and location
- Photos of box contents (stored privately in Supabase Storage)
- Printable QR label sheet, plus a built-in scanner page

## How it's built
- Plain HTML/CSS/JS, hosted on GitHub Pages (no build step)
- Data: Supabase (Postgres + Auth + Storage). Setup SQL is in `supabase/schema.sql`
- `config.js` holds the project URL and publishable key (safe to be public; Row Level Security protects the data)

## Adding someone
Supabase dashboard → Authentication → Users → Add user → Create new user (tick Auto Confirm).

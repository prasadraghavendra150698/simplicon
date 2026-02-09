# Simplicon Tax Website

Static site for Simplicon Tax Advisors LLP. US tax filing services—individual, business, ITIN, FBAR, amendments, etc.

Built with Vite + TypeScript. HTML/CSS frontend.

## Client portal (sign in, uploads, admin)

This repo includes a basic client portal:

- `/auth` â€“ sign in / sign up
- `/portal` â€“ client dashboard (create request, upload documents, messages)
- `/admin` â€“ admin dashboard (review uploads, request missing docs, messages)

### Supabase setup

1. Create a Supabase project.
2. In Supabase **SQL Editor**, run: `supabase/schema.sql`
3. Add your admin email (SQL Editor):

```sql
insert into public.admins (email) values ('admin@example.com');
```

4. Set the Supabase env vars in `.env` or `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Note: `VITE_` env vars are embedded into the frontend at build time. For Vercel/Netlify, add them in the project environment variables and redeploy.

## Run locally

```bash
npm install
npm run dev
```

Runs on localhost:5173. `npm run build` for production.

## Deploy

Vercel: connect the repo, set env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO) for the contact form. Build command: `npm run build`, output: `dist`.

## Structure

Portal files:
- `auth.html`, `portal.html`, `admin.html`
- `supabase/schema.sql`

- `index.html` – homepage
- `about.html`, `contact.html`, `services.html`, `pricing.html`, `resources.html` – other pages
- `src/` – TS for nav, contact form, carousels, scroll effects
- `api/submit-contact.ts` – Vercel serverless, sends form to email via SMTP

Contact form posts to `/api/submit-contact`. Needs SMTP env vars on Vercel.

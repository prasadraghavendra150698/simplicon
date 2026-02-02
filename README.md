# Simplicon Tax Website

Static site for Simplicon Tax Advisors LLP. US tax filing services—individual, business, ITIN, FBAR, amendments, etc.

Built with Vite + TypeScript. HTML/CSS frontend.

## Run locally

```bash
npm install
npm run dev
```

Runs on localhost:5173. `npm run build` for production.

## Deploy

Vercel: connect the repo, set env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO) for the contact form. Build command: `npm run build`, output: `dist`.

## Structure

- `index.html` – homepage
- `about.html`, `contact.html`, `services.html`, `pricing.html`, `resources.html` – other pages
- `src/` – TS for nav, contact form, carousels, scroll effects
- `api/submit-contact.ts` – Vercel serverless, sends form to email via SMTP

Contact form posts to `/api/submit-contact`. Needs SMTP env vars on Vercel.

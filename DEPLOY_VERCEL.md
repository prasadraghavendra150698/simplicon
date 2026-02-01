# Deploy to Vercel

## Quick Deploy

1. Push your code to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite and configures the build

## Environment Variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Description | Required |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP server (e.g. smtp.gmail.com, smtp.office365.com) | Yes |
| `SMTP_PORT` | Port (465 for SSL, 587 for TLS) | Yes |
| `SMTP_USER` | SMTP username / email | Yes |
| `SMTP_PASS` | SMTP password or app password | Yes |
| `EMAIL_FROM` | Sender email address | Yes |
| `EMAIL_TO` | Where form submissions are sent | Yes |

## Contact Form

The contact form submits to `/api/submit-contact` (Vercel serverless function). Form submissions are sent to `EMAIL_TO` via Nodemailer.

## Local Development

- **Static site:** `npm run dev` (Vite dev server on port 5173)
- **With API (form):** `vercel dev` (runs Vite + API routes locally)

## Build

- **Command:** `npm run build`
- **Output:** `dist/`
- **API routes:** `api/` (auto-deployed as serverless functions)

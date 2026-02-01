# Deploy to Vercel

## Quick Deploy

1. Push your code to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite and configures the build

## Environment Variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Description | Required |
|----------|-------------|----------|
| `RESEND_API_KEY` | Resend API key for sending emails | Yes |
| `ADMIN_EMAIL` | Where form submissions go (default: info@simplicontax.com) | No |
| `FROM_EMAIL` | Sender email (default: onboarding@resend.dev) | No |

## Contact Form

The contact form submits to `/api/submit-contact` (Vercel serverless function). Form submissions are sent to `ADMIN_EMAIL` and users receive an acknowledgement email.

## Local Development

- **Static site:** `npm run dev` (Vite dev server on port 5173)
- **With API (form):** `vercel dev` (runs Vite + API routes locally)

## Build

- **Command:** `npm run build`
- **Output:** `dist/`
- **API routes:** `api/` (auto-deployed as serverless functions)

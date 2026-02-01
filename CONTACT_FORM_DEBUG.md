# Contact Form Debug Guide

When you see "Request timed out", follow these steps to find the exact issue.

---

## Step 1: Check Browser Console (F12 → Console)

After submitting the form and getting the timeout:

1. Look for these logs in order:
   - `CONTACT FORM JS LOADED` → Form handler loaded ✓
   - `SUBMIT HANDLER FIRED` → Submit event fired ✓
   - `FETCH STARTED https://yoursite.com/api/submit-contact` → Fetch began ✓
   - `FETCH COMPLETE 200` → API responded (if you see this, no timeout)
   - `[CONTACT FORM] TIMEOUT after 25 seconds` → Request never completed

2. If you see **TIMEOUT**:
   - The API either never responded, or took >25 seconds
   - Go to Step 2 and Step 3

---

## Step 2: Check Network Tab (F12 → Network)

1. Submit the form again
2. Filter by "submit-contact" or "api"
3. Find the `POST /api/submit-contact` request

**What do you see?**

| Status | Meaning |
|--------|---------|
| **Pending** (never completes) | API not responding. Either: (a) API route doesn't exist on Vercel, (b) API is hanging inside, (c) CORS/network issue |
| **404** | API route not found. Check Vercel deployment - is `api/submit-contact.ts` deployed? |
| **500** | API error. Check Vercel Function Logs (Step 3). Response body may have `error` message. |
| **200** | Success! Form should show success message. If not, frontend bug. |

---

## Step 3: Check Vercel Function Logs

1. Go to [Vercel Dashboard](https://vercel.com) → Your Project
2. Click **Logs** or **Deployments** → Latest deployment → **Functions**
3. Submit the form again
4. Look for logs from `/api/submit-contact`

**What do you see?**

| Last log seen | Issue |
|---------------|-------|
| **Nothing** | API never hit. Request not reaching Vercel. Check: (a) Correct deployment URL, (b) API route exists in `api/` folder |
| `[CONTACT API] 1. REQUEST RECEIVED` | API hit ✓ |
| `[CONTACT API] 2. Parsing request body...` | Stuck parsing body (rare) |
| `[CONTACT API] 4. Env vars OK` then nothing | Stuck at step 5-6: **SMTP connection hanging** |
| `[CONTACT API] 6. Verifying SMTP connection...` then nothing | **SMTP verify() hanging** - SMTP server unreachable or slow |
| `[CONTACT API] 8. Sending email...` then nothing | **sendMail() hanging** - SMTP server slow or blocking |
| `[CONTACT API] ERROR at step: ...` | Check the error message |

---

## Step 4: Common Issues & Fixes

### A. "API never hit" (no logs, request pending)

- **Cause**: API route not deployed or wrong URL
- **Fix**: Ensure `api/submit-contact.ts` exists. Redeploy. Check Vercel project settings → Functions.

### B. "Stuck at step 6" (SMTP verify hanging)

- **Cause**: SMTP server unreachable, wrong host/port, or firewall blocking
- **Fix**:
  - Verify `SMTP_HOST` and `SMTP_PORT` (e.g. `smtp.gmail.com`, `465`)
  - For Gmail: Use App Password, enable "Less secure app access" or use OAuth
  - Test SMTP from another tool (e.g. nodemailer locally)

### C. "Missing env vars" (step 4 returns 500)

- **Cause**: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO not set
- **Fix**: Vercel → Project → Settings → Environment Variables. Add all 6. Redeploy.

### D. "Invalid login" / "SMTP auth failed"

- **Cause**: Wrong SMTP_USER or SMTP_PASS
- **Fix**: For Gmail, use App Password (not regular password). For other providers, check credentials.

### E. "ECONNREFUSED"

- **Cause**: SMTP server not reachable from Vercel (wrong host/port, or provider blocks serverless)
- **Fix**: Some SMTP providers block serverless. Try Resend, SendGrid, or Mailgun API instead of raw SMTP.

---

## Quick Test: Is the API reachable?

Run in browser console (on your deployed site):

```javascript
fetch('/api/submit-contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'test', email: 'test@test.com', message: 'test' })
}).then(r => r.json()).then(console.log).catch(console.error);
```

- **404**: API route doesn't exist
- **400**: API works! (validation error - expected for test data)
- **500**: API hit but error (check Vercel logs for details)
- **Timeout**: API not responding (same as form issue)

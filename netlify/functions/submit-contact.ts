/**
 * Netlify Function - Contact Form Submission
 * Sends form data to admin and acknowledgement to user
 * Requires: RESEND_API_KEY, ADMIN_EMAIL env vars (add in Netlify dashboard)
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

// Professional HTML email template for admin (form submission copy)
function adminEmailHtml(data: { name: string; email: string; phone: string; subject: string; message: string }, logoUrl: string): string {
  const subjectLabel = { general: 'General Tax', specific: 'Specific Question', other: 'Other' }[data.subject] || data.subject;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0fdf4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding:32px 40px;background:linear-gradient(135deg,#0c4a6e 0%,#082f49 100%);text-align:center;">
        <img src="${logoUrl}" alt="Simplicon Tax Advisors" width="160" height="48" style="object-fit:contain;">
        <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:12px 0 0;">New Contact Form Submission</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#64748b;font-size:12px;text-transform:uppercase;">Name</strong></td></tr>
          <tr><td style="padding:8px 0 16px;font-size:16px;color:#0f172a;">${escapeHtml(data.name)}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#64748b;font-size:12px;text-transform:uppercase;">Email</strong></td></tr>
          <tr><td style="padding:8px 0 16px;"><a href="mailto:${escapeHtml(data.email)}" style="color:#0c4a6e;text-decoration:none;">${escapeHtml(data.email)}</a></td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#64748b;font-size:12px;text-transform:uppercase;">Phone</strong></td></tr>
          <tr><td style="padding:8px 0 16px;font-size:16px;color:#0f172a;">${data.phone ? escapeHtml(data.phone) : '—'}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#64748b;font-size:12px;text-transform:uppercase;">Subject</strong></td></tr>
          <tr><td style="padding:8px 0 16px;font-size:16px;color:#0f172a;">${escapeHtml(subjectLabel)}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#64748b;font-size:12px;text-transform:uppercase;">Message</strong></td></tr>
          <tr><td style="padding:8px 0 0;font-size:16px;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px;background:#f8fafc;font-size:12px;color:#64748b;text-align:center;">
        Simplicon Tax Advisors LLP | Trading as Simplicon Tax
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Professional HTML email template for user acknowledgement
function acknowledgementEmailHtml(name: string, logoUrl: string): string {
  const firstName = name.split(' ')[0] || name;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - Simplicon Tax Advisors</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0fdf4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding:32px 40px;background:linear-gradient(135deg,#0c4a6e 0%,#082f49 100%);text-align:center;">
        <img src="${logoUrl}" alt="Simplicon Tax Advisors" width="160" height="48" style="object-fit:contain;">
        <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:12px 0 0;">Simplifying Taxes, Amplifying Returns</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#0f172a;font-weight:600;">Thank You, ${escapeHtml(firstName)}!</h1>
        <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.6;">
          We have received your message and will get back to you within 1-2 business days.
        </p>
        <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.6;">
          In the meantime, feel free to reach us at <a href="mailto:info@simplicontax.com" style="color:#0c4a6e;text-decoration:none;">info@simplicontax.com</a> or call <a href="tel:+919959778797" style="color:#0c4a6e;text-decoration:none;">+91 99597 78797</a>.
        </p>
        <p style="margin:0;font-size:16px;color:#475569;line-height:1.6;">
          Best regards,<br>
          <strong style="color:#0f172a;">Simplicon Tax Advisors LLP</strong>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px;background:#f8fafc;font-size:12px;color:#64748b;text-align:center;">
        Simplicon Tax Advisors LLP | Trading as Simplicon Tax | Founded in 2024
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'info@simplicontax.com';
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  const siteUrl = process.env.URL || event.headers['origin'] || 'https://simplicon.netlify.app';
  const logoUrl = `${siteUrl}/Simplicon_logo.png`;

  let body: { name?: string; email?: string; phone?: string; subject?: string; message?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, phone, subject, message } = body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name, email, and message are required' }) };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Email service not configured. Add RESEND_API_KEY in Netlify environment variables.',
      }),
    };
  }

  try {
    // 1. Send form copy to admin
    const { error: adminError } = await resend.emails.send({
      from: `Simplicon Tax Advisors <${fromEmail}>`,
      to: [adminEmail],
      replyTo: email.trim(),
      subject: `New Contact: ${name.trim()} - ${subject || 'General Tax'}`,
      html: adminEmailHtml(
        {
          name: name.trim(),
          email: email.trim(),
          phone: (phone || '').trim(),
          subject: subject || 'general',
          message: message.trim(),
        },
        logoUrl
      ),
    });

    if (adminError) {
      console.error('Admin email error:', adminError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send form submission' }) };
    }

    // 2. Send acknowledgement to user
    const { error: ackError } = await resend.emails.send({
      from: `Simplicon Tax Advisors <${fromEmail}>`,
      to: [email.trim()],
      subject: 'Thank You for Contacting Simplicon Tax Advisors',
      html: acknowledgementEmailHtml(name.trim(), logoUrl),
    });

    if (ackError) {
      console.error('Acknowledgement email error:', ackError);
      // Admin email succeeded, so we still return success
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Form submitted successfully' }),
    };
  } catch (err) {
    console.error('Form submission error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process form submission' }),
    };
  }
};

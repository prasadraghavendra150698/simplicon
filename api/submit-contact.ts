import nodemailer from "nodemailer";

const log = (step: string): void => {
  console.log(`[CONTACT API] ${step}`);
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export default async function handler(request: Request): Promise<Response> {
  log("1. REQUEST RECEIVED");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET") {
    return jsonResponse({ ok: true, message: "Contact API reachable" }, 200);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    log("2. Parsing request body...");
    const body = await request.json();
    const { name, email, message, phone, subject } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return jsonResponse({ error: "Name, email, and message are required" }, 400);
    }
    log("3. Body OK");

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM;
    const to = process.env.EMAIL_TO;

    if (!host || !port || !user || !pass || !from || !to) {
      log("ERROR: Missing env vars - host:" + !!host + " port:" + !!port + " user:" + !!user + " pass:" + !!pass + " from:" + !!from + " to:" + !!to);
      return jsonResponse({ error: "Email service not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO in Vercel." }, 500);
    }
    log("4. Env vars OK");

    log("5. Creating SMTP transporter...");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    let emailText = message.trim();
    if (phone?.trim()) emailText += `\n\nPhone: ${phone.trim()}`;
    if (subject) emailText += `\nSubject: ${subject}`;

    log("6. Sending email...");
    await transporter.sendMail({
      from,
      to,
      subject: `New contact from ${name.trim()}`,
      replyTo: email.trim(),
      text: emailText,
    });

    log("7. DONE - Email sent");
    return jsonResponse({ success: true }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR at step: " + msg);
    console.error("CONTACT API ERROR:", err);
    const userMsg = err instanceof Error && msg.includes("ECONNREFUSED")
      ? "SMTP server unreachable. Check SMTP_HOST and SMTP_PORT."
      : err instanceof Error && (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
      ? "SMTP connection timed out. Check SMTP server and firewall."
      : err instanceof Error && msg.includes("Invalid login")
      ? "SMTP auth failed. Check SMTP_USER and SMTP_PASS."
      : "Email send failed: " + msg;
    return jsonResponse({ error: userMsg }, 500);
  }
}

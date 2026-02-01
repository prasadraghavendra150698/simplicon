import nodemailer from "nodemailer";

const log = (step: string): void => {
  console.log(`[CONTACT API] ${step}`);
};

export default async function handler(request: Request): Promise<Response> {
  log("1. REQUEST RECEIVED");

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    log("2. Parsing request body...");
    const body = await request.json();
    const { name, email, message, phone, subject } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Email service not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO in Vercel." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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

    log("6. Verifying SMTP connection (this may take up to 10s)...");
    await transporter.verify();
    log("7. SMTP verified OK");

    let emailText = message.trim();
    if (phone?.trim()) emailText += `\n\nPhone: ${phone.trim()}`;
    if (subject) emailText += `\nSubject: ${subject}`;

    log("8. Sending email...");
    await transporter.sendMail({
      from,
      to,
      subject: `New contact from ${name.trim()}`,
      replyTo: email.trim(),
      text: emailText,
    });

    log("9. DONE - Email sent");
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
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
    return new Response(
      JSON.stringify({ error: userMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

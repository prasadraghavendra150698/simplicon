import nodemailer from "nodemailer";

const log = (step: string): void => {
  console.log(`[CONTACT API] ${step}`);
};

export default async function handler(req: any, res: any) {
  log("1. REQUEST RECEIVED (" + req.method + ")");

  // CORS Headers
  const setCors = (response: any) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "Contact API reachable" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    log("2. Parsing request body...");
    // In Vercel Node.js, body is already parsed if Content-Type is application/json
    const body = req.body;
    const { name, email, message, phone, inquiry_type } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      log("3a. Validation failed: missing fields");
      return res.status(400).json({ success: false, message: "Name, email, and message are required" });
    }
    if (!inquiry_type?.trim()) {
      log("3b. Validation failed: missing inquiry type");
      return res.status(400).json({ success: false, message: "Inquiry type is required" });
    }
    log("4. Body OK: " + name);

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM;
    const to = process.env.EMAIL_TO;

    if (!host || !port || !user || !pass || !from || !to) {
      log("ERROR: Missing env vars");
      return res.status(500).json({ success: false, message: "Email service not configured in Vercel environment variables." });
    }
    log("5. Env vars OK");

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    let emailText = message.trim();
    if (inquiry_type?.trim()) emailText += `\n\nInquiry Type: ${inquiry_type.trim()}`;
    if (phone?.trim()) emailText += `\nPhone: ${phone.trim()}`;

    log("6. Sending email...");

    // Create a promise that rejects after 15 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("SMTP_TIMEOUT")), 15000);
    });

    const sendMailPromise = transporter.sendMail({
      from,
      to,
      subject: `[${inquiry_type?.trim() || "General"}] New contact from ${name.trim()}`,
      replyTo: email.trim(),
      text: emailText,
    });

    // Race the email sending against the 15s timeout
    await Promise.race([sendMailPromise, timeoutPromise]);

    log("7. DONE - Email sent");
    return res.status(200).json({ success: true, message: "Message sent successfully" });

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR at step: " + msg);

    let userMsg = "Email send failed. please try again later.";
    let status = 500;

    if (msg === "SMTP_TIMEOUT") {
      userMsg = "Email service timed out. Check your SMTP settings or provider.";
    } else if (msg.includes("ECONNREFUSED")) {
      userMsg = "SMTP server unreachable. Check SMTP_HOST and SMTP_PORT.";
    } else if (msg.includes("Invalid login")) {
      userMsg = "SMTP authentication failed. Check SMTP_USER and SMTP_PASS.";
    } else {
      userMsg = "Error: " + msg;
    }

    return res.status(status).json({ success: false, message: userMsg });
  }
}


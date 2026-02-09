import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
  const setCors = (response: any) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM || "info@simplicontax.com";

    if (!host || !port || !user || !pass) {
      return res.status(500).json({ success: false, message: "Email service not configured" });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Simplicon Support" <${from}>`,
      to,
      subject,
      text: body,
      html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <img src="https://simplicon-tax.vercel.app/Simplicon_logo.png" alt="Simplicon Logo" style="height: 45px; display: block; margin: 0 auto;">
              </div>
              
              <!-- Content -->
              <div style="padding: 32px 24px;">
                <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600;">Update on your Request</h2>
                <div style="color: #475569; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${body}</div>
                
                <div style="margin-top: 32px; text-align: center;">
                    <a href="https://simplicon-tax.vercel.app/portal" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">View in Portal</a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">
                  &copy; ${new Date().getFullYear()} Simplicon Tax Advisors LLP.<br>
                  This is an automated notification. Please do not reply directly.
                </p>
              </div>
            </div>
            `
    });

    return res.status(200).json({ success: true, message: "Notification sent" });

  } catch (err: any) {
    console.error("Email Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

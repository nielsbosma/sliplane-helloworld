import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURITY, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;

export const mailConfigured = Boolean(SMTP_HOST && SMTP_FROM);

const transport = mailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURITY === "tls",
      ignoreTLS: SMTP_SECURITY === "none",
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    })
  : undefined;

export const sendTestMail = (to) =>
  transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Hello from Sliplane Hello World",
    text: "Your SMTP settings work.",
  });

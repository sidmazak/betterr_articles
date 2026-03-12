import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getNotificationSettings } from "@/lib/db/settings";

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter | null> {
  const settings = getNotificationSettings();
  if (!settings?.email) return null;

  if (settings.use_gmail && settings.smtp_user && settings.smtp_pass) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });
  } else if (settings.smtp_host && settings.smtp_port) {
    transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      auth:
        settings.smtp_user && settings.smtp_pass
          ? { user: settings.smtp_user, pass: settings.smtp_pass }
          : undefined,
    });
  }
  return transporter;
}

export type NotificationEvent = "crawl_complete" | "calendar_generated" | "article_published";

export async function sendNotification(
  event: NotificationEvent,
  subject: string,
  body: string,
  projectName?: string
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings?.email) return false;

  const shouldNotify =
    (event === "crawl_complete" && settings.notify_on_crawl) ||
    (event === "calendar_generated" && settings.notify_on_calendar) ||
    (event === "article_published" && settings.notify_on_article);

  if (!shouldNotify) return false;

  try {
    const transport = await getTransporter();
    if (!transport) return false;

    await transport.sendMail({
      from: settings.smtp_user || settings.email,
      to: settings.email,
      subject: `[${process.env.NEXT_PUBLIC_SITE_NAME}] ${subject}`,
      text: body,
      html: `<div style="font-family: sans-serif;"><h2>${subject}</h2>${projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : ""}<pre style="white-space: pre-wrap;">${body}</pre></div>`,
    });
    return true;
  } catch (err) {
    console.error("Notification send failed:", err);
    return false;
  }
}

/**
 * Client-safe publishing constants. Import this from client components.
 * Do not import lib/publishing from client - it uses the database.
 */

export const PUBLISHING_PLATFORMS = [
  { id: "wordpress", name: "WordPress", fields: ["siteUrl", "username", "appPassword"] },
  { id: "ghost", name: "Ghost", fields: ["adminUrl", "apiKey"] },
  { id: "medium", name: "Medium", fields: ["integrationToken", "userId"] },
  { id: "webhook", name: "Webhook (Odoo, Wix, custom)", fields: ["webhookUrl"] },
];

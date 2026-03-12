/**
 * Client-safe publishing constants. Import this from client components.
 * Do not import lib/publishing from client - it uses the database.
 */

export const PUBLISHING_PLATFORMS = [
  {
    id: "wordpress",
    name: "WordPress",
    description: "Publish posts to a WordPress site with an application password.",
    docs: "Use a WordPress user account that can create posts. Generate an Application Password from the user's profile and paste it here.",
    fields: [
      { id: "siteUrl", label: "Site URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "username", label: "Username", type: "text", placeholder: "editor@example.com", required: true },
      { id: "appPassword", label: "Application password", type: "password", placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx", required: true, secret: true },
      { id: "status", label: "Post status", type: "text", placeholder: "draft", required: false, help: "Use 'draft' or 'publish' depending on your workflow." },
    ],
  },
  {
    id: "ghost",
    name: "Ghost",
    description: "Publish HTML content to Ghost using the Admin API.",
    docs: "Use the Ghost Admin API URL and an Admin API key in the '<id>:<secret>' format from Ghost Integrations.",
    fields: [
      { id: "adminUrl", label: "Admin URL", type: "text", placeholder: "https://yourblog.com", required: true },
      { id: "apiKey", label: "Admin API key", type: "password", placeholder: "id:secret", required: true, secret: true },
      { id: "status", label: "Post status", type: "text", placeholder: "draft", required: false, help: "Use 'draft' or 'published'." },
    ],
  },
  {
    id: "medium",
    name: "Medium",
    description: "Publish markdown drafts to a Medium user profile.",
    docs: "Medium requires a user integration token and target user ID. Posts are sent as markdown.",
    fields: [
      { id: "integrationToken", label: "Integration token", type: "password", placeholder: "Medium token", required: true, secret: true },
      { id: "userId", label: "User ID", type: "text", placeholder: "your-medium-user-id", required: true },
      { id: "publishStatus", label: "Publish status", type: "text", placeholder: "draft", required: false, help: "Use 'draft', 'public', or another Medium-supported status." },
    ],
  },
  {
    id: "wix",
    name: "Wix",
    description: "Create Wix Blog draft posts through the Wix Blog API.",
    docs: "Requires a Wix API key with blog scopes and the Wix site ID for the target site.",
    fields: [
      { id: "apiKey", label: "API key", type: "password", placeholder: "Wix API key", required: true, secret: true },
      { id: "siteId", label: "Site ID", type: "text", placeholder: "wix-site-id", required: true },
      { id: "language", label: "Language", type: "text", placeholder: "en", required: false, help: "Optional IETF language code for draft posts." },
    ],
  },
  {
    id: "odoo",
    name: "Odoo",
    description: "Create blog posts in Odoo using the external JSON-RPC API.",
    docs: "Requires an Odoo base URL, database name, username, password, and a numeric blog ID that content should be published into.",
    fields: [
      { id: "baseUrl", label: "Base URL", type: "text", placeholder: "https://yourcompany.odoo.com", required: true },
      { id: "database", label: "Database", type: "text", placeholder: "mycompany", required: true },
      { id: "username", label: "Username", type: "text", placeholder: "bot@example.com", required: true },
      { id: "password", label: "Password or API password", type: "password", placeholder: "Odoo password", required: true, secret: true },
      { id: "blogId", label: "Blog ID", type: "text", placeholder: "1", required: true, help: "Numeric Odoo blog ID that will own new posts." },
    ],
  },
  {
    id: "webhook",
    name: "Custom webhook",
    description: "Send articles to any custom endpoint with configurable payload and authentication.",
    docs: "Use placeholders like {{title}}, {{content}}, {{excerpt}}, and {{tags}} inside the payload template. This is ideal for custom CMS, internal services, or unsupported platforms.",
    fields: [
      { id: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://example.com/publish", required: true },
      { id: "method", label: "HTTP method", type: "text", placeholder: "POST", required: false },
      { id: "authType", label: "Auth type", type: "text", placeholder: "none | bearer | basic | header", required: false },
      { id: "authHeaderName", label: "Auth header name", type: "text", placeholder: "Authorization", required: false },
      { id: "authToken", label: "Auth token / header value", type: "password", placeholder: "secret token", required: false, secret: true },
      { id: "username", label: "Basic auth username", type: "text", placeholder: "username", required: false },
      { id: "password", label: "Basic auth password", type: "password", placeholder: "password", required: false, secret: true },
      { id: "headersJson", label: "Extra headers JSON", type: "textarea", placeholder: "{\"X-Source\":\"better_articles\"}", required: false, help: "Optional JSON object of extra headers." },
      { id: "payloadTemplate", label: "Payload template", type: "textarea", placeholder: "{\"title\":\"{{title}}\",\"content\":\"{{content}}\",\"excerpt\":\"{{excerpt}}\",\"tags\":{{tags}}}", required: false, help: "Leave blank to send the default JSON payload." },
      { id: "publishedUrlPath", label: "Published URL response path", type: "text", placeholder: "data.url", required: false, help: "Dot path to extract a published URL from the webhook JSON response." },
    ],
  },
];

export const PUBLISHING_SECRET_FIELD_IDS = new Set(
  PUBLISHING_PLATFORMS.flatMap((platform) =>
    platform.fields.filter((field) => field.secret).map((field) => field.id)
  )
);

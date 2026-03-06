/**
 * Next.js instrumentation. Runs when the app starts (dev and production).
 * Starts the in-app cron worker for processing pending crawl jobs.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronWorker } = await import("./lib/cron-worker");
    startCronWorker();
  }
}

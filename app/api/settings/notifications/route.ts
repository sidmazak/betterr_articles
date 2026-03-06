import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationSettings,
  saveNotificationSettings,
  updateNotificationSettings,
} from "@/lib/db/settings";

export async function GET() {
  try {
    const settings = getNotificationSettings();
    return NextResponse.json(settings ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get notification settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      use_gmail,
      notify_on_crawl,
      notify_on_calendar,
      notify_on_article,
    } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const saved = saveNotificationSettings({
      email,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      use_gmail,
      notify_on_crawl,
      notify_on_calendar,
      notify_on_article,
    });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save notification settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    updateNotificationSettings(id, updates);
    return NextResponse.json(getNotificationSettings());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update notification settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/notifications?userId=...&unreadOnly=true
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const notifs = await db.notification.findMany({
    where: unreadOnly ? { userId, leida: false } : { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await db.notification.count({
    where: { userId, leida: false },
  });

  return NextResponse.json({ notifications: notifs, unreadCount });
}

/**
 * POST /api/notifications/mark-read
 * Body: { userId, notificationId? } -- si no se pasa ID, marca todas como leídas
 */
export async function POST(req: NextRequest) {
  const { userId, notificationId } = await req.json();

  if (notificationId) {
    await db.notification.update({
      where: { id: notificationId },
      data: { leida: true },
    });
  } else {
    await db.notification.updateMany({
      where: { userId, leida: false },
      data: { leida: true },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Servicio de Audit Log - Log de acciones administrativas.
 * Cumple spec sección hardening.
 */
import { v4 as uuidv4 } from "uuid";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";

export interface AuditLogEntry {
  id: number;
  adminId: string;
  targetUserId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  details: Record<string, unknown> | null,
  targetUserId: string | null = null
): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO audit_logs (admin_id, target_user_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      adminId,
      targetUserId,
      action,
      details ? JSON.stringify(details) : null
    );
    logger.info({ adminId, targetUserId, action, details }, "Admin action logged");
  } catch (e) {
    logger.error({ error: (e as Error).message, adminId, action }, "Failed to write audit log");
  }
}

export async function getAuditLogs(
  filters: { adminId?: string; targetUserId?: string; action?: string; from?: Date; to?: Date; limit?: number; offset?: number }
): Promise<AuditLogEntry[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.adminId) {
    where.push(`admin_id = $${paramIndex++}`);
    params.push(filters.adminId);
  }
  if (filters.targetUserId) {
    where.push(`target_user_id = $${paramIndex++}`);
    params.push(filters.targetUserId);
  }
  if (filters.action) {
    where.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters.from) {
    where.push(`created_at >= $${paramIndex++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    where.push(`created_at <= $${paramIndex++}`);
    params.push(filters.to);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const query = `
    SELECT id, admin_id, target_user_id, action, details, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;
  params.push(limit, offset);

  try {
    const results = (await db.$queryRawUnsafe(query, ...params)) as AuditLogEntry[];
    return results || [];
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to fetch audit logs");
    return [];
  }
}

export async function getAuditLogStats(): Promise<{ total: number; byAction: Record<string, number> }> {
  try {
    const totalResult = (await db.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM audit_logs`
    )) as { total: bigint }[];
    const total = totalResult?.[0]?.total ? Number(totalResult[0].total) : 0;

    const byAction = (await db.$queryRawUnsafe(
      `SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action`
    )) as { action: string; count: bigint }[];

    return {
      total,
      byAction: Object.fromEntries(byAction.map(r => [r.action, Number(r.count)])),
    };
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Failed to fetch audit log stats");
    return { total: 0, byAction: {} };
  }
}
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

type AuditClient = typeof prisma | Prisma.TransactionClient;

export async function writeAudit(
  client: AuditClient,
  input: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    correspondenceId?: string;
    ipAddress?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      correspondenceId: input.correspondenceId,
      ipAddress: input.ipAddress,
      metadata: input.metadata,
    },
  });
}

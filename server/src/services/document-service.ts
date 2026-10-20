import { createHash } from "node:crypto";
import {
  ConfidentialityLevel,
  NotificationKind,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { writeAudit } from "./audit-service";
import {
  detectDocumentType,
  documentStorage,
  maximumDocumentBytes,
  safeOriginalFileName,
} from "./document-storage";
import { requireVisibleCorrespondence } from "./workflow-service";

const classifications: ConfidentialityLevel[] = [
  ConfidentialityLevel.NORMAL,
  ConfidentialityLevel.CONFIDENTIAL,
  ConfidentialityLevel.RESTRICTED,
  ConfidentialityLevel.SECRET,
];

export function canReadClassification(
  classification: ConfidentialityLevel,
  permissions: string[],
) {
  if (classification === ConfidentialityLevel.NORMAL) return true;
  const permission: Record<Exclude<ConfidentialityLevel, "NORMAL">, string> = {
    CONFIDENTIAL: "correspondence:read:confidential",
    RESTRICTED: "correspondence:read:restricted",
    SECRET: "correspondence:read:secret",
  };
  return permissions.includes(permission[classification]);
}

function validateClassification(
  document: ConfidentialityLevel,
  correspondence: ConfidentialityLevel,
  permissions: string[],
) {
  if (classifications.indexOf(document) < classifications.indexOf(correspondence)) {
    throw new AppError(400, "Document classification cannot be less restrictive than its correspondence.");
  }
  if (
    !canReadClassification(document, permissions)
  ) {
    throw new AppError(403, "You cannot access documents at this classification.");
  }
}

function formatDownloadName(fileName: string) {
  const fallback = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 150) || "document";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function uploadDocument(
  input: {
    correspondenceId: string;
    originalFileName: string;
    bytes: Buffer;
    classification: ConfidentialityLevel;
    actionId?: string;
  },
  actor: { id: string; permissions: string[]; departmentId?: string | null },
  ipAddress?: string,
) {
  if (!input.bytes.length) throw new AppError(400, "Uploaded document is empty.");
  if (input.bytes.length > maximumDocumentBytes) {
    throw new AppError(413, "Document exceeds the 10 MB upload limit.");
  }
  const originalFileName = safeOriginalFileName(input.originalFileName);
  const detected = detectDocumentType(originalFileName, input.bytes);
  const correspondence = await requireVisibleCorrespondence(input.correspondenceId, actor);
  validateClassification(
    input.classification,
    correspondence.confidentiality,
    actor.permissions,
  );
  if (input.actionId) {
    const action = await prisma.actionItem.findFirst({
      where: { id: input.actionId, correspondenceId: correspondence.id },
      select: { id: true },
    });
    if (!action) throw new AppError(400, "The supporting action does not belong to this correspondence.");
  }

  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const storageKey = await documentStorage.store(input.bytes, detected.extension);
  try {
    return await prisma.$transaction(async (tx) => {
      const sequence = await tx.documentVersionSequence.upsert({
        where: {
          correspondenceId_originalFileName: {
            correspondenceId: correspondence.id,
            originalFileName,
          },
        },
        create: {
          correspondenceId: correspondence.id,
          originalFileName,
          lastValue: 1,
        },
        update: { lastValue: { increment: 1 } },
        select: { lastValue: true },
      });
      const document = await tx.document.create({
        data: {
          correspondenceId: correspondence.id,
          fileName: storageKey,
          originalFileName,
          mimeType: detected.mimeType,
          storageKey,
          fileSize: BigInt(input.bytes.length),
          checksum,
          classification: input.classification,
          version: sequence.lastValue,
          uploadedById: actor.id,
          actionId: input.actionId,
        },
        select: {
          id: true,
          correspondenceId: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          checksum: true,
          version: true,
          classification: true,
          createdAt: true,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "document.uploaded",
        entity: "Document",
        entityId: document.id,
        correspondenceId: correspondence.id,
        ipAddress,
        metadata: {
          originalFileName,
          version: document.version,
          fileSize: document.fileSize.toString(),
          checksum,
          classification: document.classification,
        },
      });
      await tx.notification.create({
        data: {
          userId: correspondence.createdById,
          correspondenceId: correspondence.id,
          kind: NotificationKind.WORKFLOW_UPDATE,
          message: "A document was added to a correspondence item you registered.",
        },
      });
      return { ...document, fileSize: document.fileSize.toString() };
    });
  } catch (error) {
    try {
      await documentStorage.remove(storageKey);
    } catch (cleanupError) {
      console.error("Could not remove a document after its metadata transaction failed.", cleanupError);
    }
    throw error;
  }
}

export async function listDocuments(
  correspondenceId: string,
  actor: { id: string; permissions: string[]; departmentId?: string | null },
) {
  const correspondence = await prisma.correspondence.findUnique({
    where: { id: correspondenceId },
  });
  if (!correspondence) throw new AppError(404, "Correspondence was not found.");
  if (correspondence.archivedAt) {
    if (!actor.permissions.includes("correspondence:read:archive")) {
      throw new AppError(403, "You cannot access documents in archived correspondence.");
    }
  } else {
    await requireVisibleCorrespondence(correspondenceId, actor);
  }
  const documents = await prisma.document.findMany({
    where: { correspondenceId },
    orderBy: [{ originalFileName: "asc" }, { version: "desc" }],
    select: {
      id: true,
      correspondenceId: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      checksum: true,
      version: true,
      classification: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });
  const visible = documents.filter((document) => {
    try {
      validateClassification(
        document.classification,
        correspondence.confidentiality,
        actor.permissions,
      );
      return true;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) return false;
      throw error;
    }
  });
  return visible.map((document) => ({
    ...document,
    fileSize: document.fileSize.toString(),
  }));
}

export async function downloadDocument(
  documentId: string,
  actor: { id: string; permissions: string[]; departmentId?: string | null },
  ipAddress?: string,
) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { correspondence: true },
  });
  if (!document || !document.originalFileName) throw new AppError(404, "Document was not found.");
  if (document.correspondence.archivedAt) {
    if (!actor.permissions.includes("correspondence:read:archive")) {
      throw new AppError(403, "You cannot access documents in archived correspondence.");
    }
  } else {
    await requireVisibleCorrespondence(document.correspondenceId, actor);
  }
  validateClassification(
    document.classification,
    document.correspondence.confidentiality,
    actor.permissions,
  );

  try {
    await documentStorage.assertAvailable(document.storageKey);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new AppError(404, "Document content is unavailable.");
    }
    throw error;
  }
  const stream = documentStorage.open(document.storageKey);
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: actor.id,
      action: "document.downloaded",
      entity: "Document",
      entityId: document.id,
      correspondenceId: document.correspondenceId,
      ipAddress,
      metadata: { version: document.version, checksum: document.checksum },
    });
  });
  return {
    stream,
    mimeType: document.mimeType,
    contentLength: Number(document.fileSize),
    contentDisposition: formatDownloadName(document.originalFileName),
  };
}

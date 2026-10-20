import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "../utils/app-error";
import {
  detectDocumentType,
  PrivateLocalDocumentStorage,
  safeOriginalFileName,
} from "./document-storage";

describe("document storage validation", () => {
  it("strips directory components and control characters from original names", () => {
    expect(safeOriginalFileName("C:\\incoming\\letter\n.pdf")).toBe("letter.pdf");
  });

  it("rejects unsupported file extensions", () => {
    expect(() => safeOriginalFileName("payload.exe")).toThrow(AppError);
  });

  it("accepts PDF documents with a matching content signature", () => {
    expect(detectDocumentType("letter.pdf", Buffer.from("%PDF-1.7"))).toEqual({
      extension: ".pdf",
      mimeType: "application/pdf",
    });
  });

  it("stores and streams back a PDF from private storage", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mofaic-documents-"));
    const storage = new PrivateLocalDocumentStorage(directory);
    const bytes = Buffer.from("%PDF-1.7\nsample PDF bytes");
    try {
      const { extension } = detectDocumentType("letter.pdf", bytes);
      const key = await storage.store(bytes, extension);
      await storage.assertAvailable(key);
      const chunks: Buffer[] = [];
      for await (const chunk of storage.open(key)) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks)).toEqual(bytes);
      await storage.remove(key);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects non-PDF files and content that does not match a PDF extension", () => {
    expect(() => safeOriginalFileName("image.png")).toThrow(AppError);
    expect(() => detectDocumentType("letter.pdf", Buffer.from("not a PDF"))).toThrow(AppError);
  });
});

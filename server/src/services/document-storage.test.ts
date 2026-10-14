import { describe, expect, it } from "vitest";
import { AppError } from "../utils/app-error";
import { detectDocumentType, safeOriginalFileName } from "./document-storage";

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

  it("rejects non-PDF files and content that does not match a PDF extension", () => {
    expect(() => safeOriginalFileName("image.png")).toThrow(AppError);
    expect(() => detectDocumentType("letter.pdf", Buffer.from("not a PDF"))).toThrow(AppError);
  });
});

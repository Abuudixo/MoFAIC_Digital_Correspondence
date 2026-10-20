import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { documentUpload } from "./document-upload";

describe("document upload middleware", () => {
  it("parses the PDF document and classification multipart fields", async () => {
    const app = express();
    app.post("/upload", documentUpload, (req, res) => {
      res.json({
        fileName: req.file?.originalname,
        mimeType: req.file?.mimetype,
        classification: req.body.classification,
      });
    });

    const response = await request(app)
      .post("/upload")
      .field("classification", "NORMAL")
      .attach("document", Buffer.from("%PDF-1.7\nsample"), {
        filename: "letter.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    expect(response.body).toEqual({
      fileName: "letter.pdf",
      mimeType: "application/pdf",
      classification: "NORMAL",
    });
  });
});

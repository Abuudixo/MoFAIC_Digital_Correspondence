import multer from "multer";
import { maximumDocumentBytes } from "../services/document-storage";

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maximumDocumentBytes,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 100,
  },
}).single("document");

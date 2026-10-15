import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const localEnv = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")].find(
  existsSync,
);
if (localEnv) dotenv.config({ path: localEnv });

const optionalSetting = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3000),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    DOCUMENT_STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    DOCUMENT_STORAGE_DIR: z.string().default(resolve(process.cwd(), ".private-documents")),
    R2_ENDPOINT: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().url().optional(),
    ),
    R2_BUCKET: optionalSetting,
    R2_ACCESS_KEY_ID: optionalSetting,
    R2_SECRET_ACCESS_KEY: optionalSetting,
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, "Use a duration such as 15m or 1h")
      .default("15m"),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(160).optional(),
    BOOTSTRAP_ADMIN_EMAIL: z
      .string()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase())
      .optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
  })
  .superRefine((value, context) => {
    const bootstrapValues = [
      value.BOOTSTRAP_ADMIN_NAME,
      value.BOOTSTRAP_ADMIN_EMAIL,
      value.BOOTSTRAP_ADMIN_PASSWORD,
    ];
    if (bootstrapValues.some(Boolean) && bootstrapValues.some((item) => !item)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set all three bootstrap administrator variables together.",
        path: ["BOOTSTRAP_ADMIN_EMAIL"],
      });
    }

    if (value.DOCUMENT_STORAGE_DRIVER === "r2") {
      for (const key of [
        "R2_ENDPOINT",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when DOCUMENT_STORAGE_DRIVER=r2.`,
            path: [key],
          });
        }
      }
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
  throw new Error("Set the required environment variables before starting the API.");
}

export const env = result.data;

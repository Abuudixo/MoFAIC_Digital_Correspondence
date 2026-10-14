import { describe, expect, it } from "vitest";
import {
  CorrespondenceDirection,
  CorrespondenceStatus,
  CorrespondenceType,
} from "@prisma/client";
import {
  createCorrespondenceSchema,
  listCorrespondenceSchema,
  loginSchema,
  reportSchema,
} from "./schemas";
import { readableWhere } from "../services/correspondence-service";

describe("request validation", () => {
  it("normalizes login email addresses", () => {
    expect(
      loginSchema.parse({ email: "  STAFF@EXAMPLE.TEST ", password: "pass" })
        .email,
    ).toBe("staff@example.test");
  });

  it("rejects direct registration of archived correspondence", () => {
    const result = createCorrespondenceSchema.safeParse({
      direction: CorrespondenceDirection.INCOMING,
      type: CorrespondenceType.LETTER,
      subject: "Fictional subject",
      sender: "Fictional sender",
      recipient: "Fictional recipient",
      departmentId: "00000000-0000-4000-8000-000000000001",
      status: CorrespondenceStatus.ARCHIVED,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid pagination limits and inverted date ranges", () => {
    expect(listCorrespondenceSchema.safeParse({ limit: "101" }).success).toBe(
      false,
    );
    expect(
      listCorrespondenceSchema.safeParse({
        dateFrom: "2026-03-10",
        dateTo: "2026-03-01",
      }).success,
    ).toBe(false);
  });

  it("includes the entire selected end date in date filters", () => {
    const result = listCorrespondenceSchema.parse({ dateTo: "2026-03-10" });
    expect(result.dateTo?.toISOString()).toBe("2026-03-10T23:59:59.999Z");
  });

  it("only enables the department dashboard breakdown when requested", () => {
    expect(reportSchema.parse({}).departmentDashboard).toBe(false);
    expect(
      reportSchema.parse({
        departmentId: "00000000-0000-4000-8000-000000000001",
        departmentDashboard: "true",
      }).departmentDashboard,
    ).toBe(true);
  });

  it("scopes department users to their department across allowed classifications", () => {
    const where = readableWhere(
      "00000000-0000-4000-8000-000000000001",
      [
        "correspondence:read:department",
        "correspondence:read:confidential",
        "correspondence:read:restricted",
        "correspondence:read:secret",
      ],
      "00000000-0000-4000-8000-000000000002",
    );
    expect(JSON.stringify(where)).toContain(
      '"departmentId":"00000000-0000-4000-8000-000000000002"',
    );
    expect(JSON.stringify(where)).not.toContain(
      '"departmentId":"00000000-0000-4000-8000-000000000001"',
    );
  });
});

import { describe, expect, it } from "vitest";
import { ConfidentialityLevel } from "@prisma/client";
import { canRead, formatReferenceNumber } from "./correspondence-service";

describe("formatReferenceNumber", () => {
  it("formats reference numbers with a four-digit sequence", () => {
    expect(formatReferenceNumber(2026, 1)).toBe("COR-2026-0001");
    expect(formatReferenceNumber(2026, 12345)).toBe("COR-2026-12345");
  });

  describe("department correspondence access", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    const homeDepartmentId = "00000000-0000-4000-8000-000000000002";
    const otherDepartmentId = "00000000-0000-4000-8000-000000000003";
    const permissions = [
      "correspondence:read:department",
      "correspondence:read:confidential",
      "correspondence:read:restricted",
      "correspondence:read:secret",
    ];

    it("allows a department user to read assigned-classification records in their department", () => {
      expect(
        canRead(
          {
            confidentiality: ConfidentialityLevel.SECRET,
            createdById: "00000000-0000-4000-8000-000000000004",
            assignedToId: null,
            departmentId: homeDepartmentId,
          },
          userId,
          permissions,
          homeDepartmentId,
        ),
      ).toBe(true);
    });

    it("does not allow a department user to read another department's records", () => {
      expect(
        canRead(
          {
            confidentiality: ConfidentialityLevel.CONFIDENTIAL,
            createdById: "00000000-0000-4000-8000-000000000004",
            assignedToId: null,
            departmentId: otherDepartmentId,
          },
          userId,
          permissions,
          homeDepartmentId,
        ),
      ).toBe(false);
    });

    it("keeps ministry-wide access subject to classification permissions", () => {
      const record = {
        confidentiality: ConfidentialityLevel.SECRET,
        createdById: "00000000-0000-4000-8000-000000000004",
        assignedToId: null,
        departmentId: otherDepartmentId,
      };
      expect(
        canRead(record, userId, ["correspondence:read:any"], homeDepartmentId),
      ).toBe(false);
      expect(
        canRead(
          record,
          userId,
          ["correspondence:read:any", "correspondence:read:secret"],
          homeDepartmentId,
        ),
      ).toBe(true);
    });

    it("does not make classification permission a substitute for assignment or department scope", () => {
      const record = {
        confidentiality: ConfidentialityLevel.CONFIDENTIAL,
        createdById: "00000000-0000-4000-8000-000000000004",
        assignedToId: null,
        departmentId: otherDepartmentId,
      };
      expect(
        canRead(
          record,
          userId,
          ["correspondence:read:confidential"],
          homeDepartmentId,
        ),
      ).toBe(false);
    });
  });

  it("rejects invalid years and sequence values", () => {
    expect(() => formatReferenceNumber(1999, 1)).toThrow(RangeError);
    expect(() => formatReferenceNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatReferenceNumber(2026.5, 1)).toThrow(RangeError);
  });
});

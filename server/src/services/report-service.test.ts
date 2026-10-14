import { CorrespondenceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isOverdue } from "./report-service";

describe("overdue reporting", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("marks past-due active correspondence overdue", () => {
    expect(
      isOverdue(
        {
          dueDate: new Date("2026-09-30T00:00:00.000Z"),
          status: CorrespondenceStatus.IN_PROGRESS,
        },
        now,
      ),
    ).toBe(true);
  });

  it("excludes records without a past due date and completed statuses", () => {
    expect(isOverdue({ dueDate: null, status: CorrespondenceStatus.IN_PROGRESS }, now)).toBe(false);
    expect(
      isOverdue(
        {
          dueDate: new Date("2026-09-30T00:00:00.000Z"),
          status: CorrespondenceStatus.CLOSED,
        },
        now,
      ),
    ).toBe(false);
  });

  it("does not mark a correspondence overdue until its due date has passed", () => {
    expect(
      isOverdue(
        {
          dueDate: new Date("2026-10-01T00:00:00.000Z"),
          status: CorrespondenceStatus.OPEN,
        },
        now,
      ),
    ).toBe(false);
  });
});

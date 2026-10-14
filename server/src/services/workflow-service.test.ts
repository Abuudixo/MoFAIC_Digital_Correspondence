import { describe, expect, it } from "vitest";
import { closureRequirementError } from "./workflow-service";

describe("workbook closure rules", () => {
  it("requires every assigned action to be completed", () => {
    expect(closureRequirementError(1, 2, "/Correspondence/2026/Incoming")).toContain(
      "Complete all assigned actions",
    );
  });

  it("requires a supporting file or registered file location", () => {
    expect(closureRequirementError(0, 0, null)).toContain("file location or attach");
  });

  it("allows closure after actions and evidence are complete", () => {
    expect(closureRequirementError(0, 1, null)).toBeNull();
    expect(closureRequirementError(0, 0, "  /Correspondence/2026/Incoming  ")).toBeNull();
  });
});

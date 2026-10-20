import { describe, expect, it } from "vitest";
import { ConfidentialityLevel } from "@prisma/client";
import { canReadClassification } from "./document-service";

describe("document classification access", () => {
  it("allows normal documents after correspondence visibility is verified", () => {
    expect(
      canReadClassification(ConfidentialityLevel.NORMAL, []),
    ).toBe(true);
  });

  it("requires the matching permission for confidential documents", () => {
    expect(
      canReadClassification(ConfidentialityLevel.CONFIDENTIAL, []),
    ).toBe(false);
    expect(
      canReadClassification(ConfidentialityLevel.CONFIDENTIAL, [
        "correspondence:read:confidential",
      ]),
    ).toBe(true);
  });

  it("requires the matching permission for restricted documents", () => {
    expect(
      canReadClassification(ConfidentialityLevel.RESTRICTED, [
        "correspondence:read:confidential",
      ]),
    ).toBe(false);
    expect(
      canReadClassification(ConfidentialityLevel.RESTRICTED, [
        "correspondence:read:restricted",
      ]),
    ).toBe(true);
  });

  it("requires the matching permission for secret documents", () => {
    expect(
      canReadClassification(ConfidentialityLevel.SECRET, []),
    ).toBe(false);
    expect(
      canReadClassification(ConfidentialityLevel.SECRET, [
        "correspondence:read:secret",
      ]),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { parseResearchLocations } from "@/lib/research/places";

describe("research locations", () => {
  it("parses and deduplicates explicit locations", () => {
    expect(parseResearchLocations("Wilmington, DE; Philadelphia, PA\nWilmington, DE")).toEqual([
      "Wilmington, DE",
      "Philadelphia, PA"
    ]);
  });

  it("rejects server-side near-me searches", () => {
    expect(() => parseResearchLocations("near me")).toThrow("explicit city and state");
  });
});

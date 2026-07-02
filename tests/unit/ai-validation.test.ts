import { describe, expect, it } from "vitest";
import { mandatoryOptOutSentence } from "@/lib/constants";
import { validateInitialEmailDraft } from "@/lib/email/validation";
import { sampleLeads } from "@/lib/sample-data";

describe("AI draft validation", () => {
  it("accepts a compliant initial email", () => {
    const lead = sampleLeads[0];
    const body = `Hi Avery,

I noticed Maple Street Bakery has Missing calls to action. I run OutreachFlow Studio and build simple websites for local businesses. I thought a cleaner homepage could make catering inquiries easier to start. I would be happy to create a complimentary homepage mockup in exchange for a short 10-15 minute call. ${mandatoryOptOutSentence}

Best,
Akhil`;

    const result = validateInitialEmailDraft({ subject: "Homepage idea", body }, lead, "Best\nAkhil");

    expect(result.valid).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(65);
    expect(result.wordCount).toBeLessThanOrEqual(100);
  });

  it("rejects missing opt-out and unsupported claim language", () => {
    const lead = sampleLeads[0];
    const result = validateInitialEmailDraft(
      {
        subject: "Homepage audit",
        body: "Hi Avery, I reviewed your website and found problems. Can we talk?"
      },
      lead
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("opt-out");
    expect(result.errors.join(" ")).toContain("unsupported claim");
  });
});

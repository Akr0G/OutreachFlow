import { describe, expect, it } from "vitest";
import { mandatoryOptOutSentence } from "@/lib/constants";
import { buildLocalDraft, draftVariations } from "@/lib/email/draft-variations";
import { validateInitialEmailDraft } from "@/lib/email/validation";
import { sampleLeads, sampleSettings } from "@/lib/sample-data";

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

  it("varies compliant local initial drafts", () => {
    const lead = sampleLeads[0];
    const drafts = draftVariations.map((variation) => buildLocalDraft(lead, "initial", sampleSettings, variation));
    const subjects = new Set(drafts.map((draft) => draft.subject));

    expect(subjects.size).toBeGreaterThan(1);
    for (const draft of drafts) {
      const result = validateInitialEmailDraft(draft, lead, "Best\nAkhil");
      expect(result.valid).toBe(true);
    }
  });

  it("keeps exact LLC business names in compliant local drafts", () => {
    const lead = {
      ...sampleLeads[0],
      business_name: "Turn of the Wrench, LLC",
      contact_name: null,
      observed_website_issues: ["Outdated design" as const],
      issue_details: "Website listing is not using an HTTPS URL."
    };
    const drafts = draftVariations.map((variation) => buildLocalDraft(lead, "initial", sampleSettings, variation));

    for (const draft of drafts) {
      const result = validateInitialEmailDraft(draft, lead, "Best\nAkhil");
      expect(draft.body).toContain("Turn of the Wrench, LLC");
      expect(result.valid).toBe(true);
    }
  });
});

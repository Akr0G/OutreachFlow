import { describe, expect, it } from "vitest";
import {
  assertValidStatusTransition,
  canCreateFollowUpDraft,
  canCreateInitialDraft,
  canSendDraft
} from "@/lib/business-rules";
import { sampleDrafts, sampleLeads, sampleSettings } from "@/lib/sample-data";

describe("outreach eligibility", () => {
  it("allows an initial draft only for a ready non-blocked lead", () => {
    const ready = sampleLeads.find((lead) => lead.status === "Ready")!;
    const blocked = { ...ready, status: "Do Not Contact" as const };

    expect(canCreateInitialDraft(ready).allowed).toBe(true);
    expect(canCreateInitialDraft(blocked).allowed).toBe(false);
  });

  it("creates one follow-up exactly on the configured due date", () => {
    const sent = sampleLeads.find((lead) => lead.business_name === "Northside Auto Repair")!;

    expect(canCreateFollowUpDraft(sent, sampleDrafts, new Date("2026-07-02T12:00:00.000Z"), 5).allowed).toBe(true);
    expect(canCreateFollowUpDraft(sent, sampleDrafts, new Date("2026-07-01T12:00:00.000Z"), 5).allowed).toBe(false);
  });

  it("blocks follow-up eligibility after any reply status", () => {
    const sent = sampleLeads.find((lead) => lead.business_name === "Northside Auto Repair")!;
    const replied = { ...sent, status: "Replied" as const };

    expect(canCreateFollowUpDraft(replied, sampleDrafts, new Date("2026-07-02T12:00:00.000Z"), 5).allowed).toBe(false);
  });
});

describe("send and status rules", () => {
  it("prevents sending drafts that are not approved", () => {
    const lead = sampleLeads.find((item) => item.business_name === "BrightSmile Dental")!;
    const draft = sampleDrafts.find((item) => item.lead_id === lead.id)!;

    expect(canSendDraft(lead, draft, sampleSettings, 0).allowed).toBe(false);
    expect(canSendDraft(lead, { ...draft, state: "approved" }, sampleSettings, 0).allowed).toBe(true);
  });

  it("prevents invalid status transitions", () => {
    expect(assertValidStatusTransition("Ready", "Draft Created").allowed).toBe(true);
    expect(assertValidStatusTransition("Ready", "Sent").allowed).toBe(false);
    expect(assertValidStatusTransition("Do Not Contact", "Ready").allowed).toBe(false);
  });
});

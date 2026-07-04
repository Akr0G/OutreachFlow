import { describe, expect, it } from "vitest";
import { assertSenderMatchesConnectedMailbox } from "@/lib/email/deliverability";

describe("sender alignment", () => {
  it("accepts the connected Gmail address case-insensitively", () => {
    expect(() => assertSenderMatchesConnectedMailbox({
      sender_email: "Owner@Example.com",
      gmail_connection_metadata: { connected: true, email: "owner@example.com" }
    })).not.toThrow();
  });

  it("blocks an unverified From address", () => {
    expect(() => assertSenderMatchesConnectedMailbox({
      sender_email: "sales@example.com",
      gmail_connection_metadata: { connected: true, email: "owner@example.com" }
    })).toThrow("must match the connected Gmail mailbox");
  });
});

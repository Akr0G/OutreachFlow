import { describe, expect, it } from "vitest";
import { createMimeMessage } from "@/lib/gmail/client";

describe("Gmail MIME messages", () => {
  it("includes a mailto unsubscribe header", () => {
    const raw = createMimeMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "A specific idea",
      body: "Hello"
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");

    expect(decoded).toContain("List-Unsubscribe: <mailto:sender@example.com?subject=Unsubscribe>");
    expect(decoded).toContain("Content-Type: text/plain; charset=UTF-8");
  });

  it("rejects header injection", () => {
    expect(() => createMimeMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello\r\nBcc: injected@example.com",
      body: "Hello"
    })).toThrow("Subject contains invalid header characters");
  });
});

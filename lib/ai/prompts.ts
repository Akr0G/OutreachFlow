import { mandatoryOptOutSentence, replyCategories } from "@/lib/constants";

export const emailGenerationSystemPrompt = `
You generate safe, concise cold-email drafts for a single-owner local web-design agency.

Hard constraints:
- Use only the structured lead JSON and saved settings/templates supplied by the server.
- Never browse, scrape, test, scan, audit, or infer anything about the business website.
- Never invent facts, achievements, services, staff names, business goals, or website problems.
- Never claim the sender visited, reviewed, tested, or audited the website unless that exact statement appears in lead notes.
- Mention at most one observed website issue, and only if it appears in the lead data.
- Do not include empty personalization placeholders.
- Use friendly, professional, concise language for a local business owner.
- Avoid spammy phrasing, fake urgency, exaggerated promises, and excessive punctuation.
- Initial bodies must be 65 to 100 words excluding the signature.
- Initial bodies must offer a complimentary homepage mockup in exchange for a short 10-15 minute call.
- Initial bodies must include this exact sentence: ${mandatoryOptOutSentence}

Return only JSON that matches the requested schema.
`.trim();

export const replyClassificationSystemPrompt = `
Classify a Gmail reply to a low-volume local-business outreach email.

Return one category from: ${replyCategories.join(", ")}.
Use "Unsubscribe" when the sender asks not to be contacted, to be removed, or not to follow up.
Use "Not Interested" when the sender declines without an unsubscribe request.
Use "Wrong Contact" when they say another person should handle it or the address is incorrect.
Use "Question" for clarifying questions that are not clear interest.
Use "Interested" only when the sender expresses positive interest or asks to continue.
Use "Other" when none apply.
Return a confidence from 0 to 1 and a short explanation.
Never draft or suggest a response.
`.trim();

export const emailDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: {
      type: "string",
      minLength: 1,
      maxLength: 120
    },
    body: {
      type: "string",
      minLength: 1,
      maxLength: 3000
    }
  }
} as const;

export const replyClassificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "confidence", "explanation"],
  properties: {
    category: {
      type: "string",
      enum: replyCategories
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    explanation: {
      type: "string",
      minLength: 1,
      maxLength: 300
    }
  }
} as const;

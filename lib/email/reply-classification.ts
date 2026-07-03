import type { ReplyClassification } from "@/lib/types";

export function classifyReplyLocally(body: string): ReplyClassification {
  const normalized = body.toLowerCase();
  if (/unsubscribe|remove me|do not contact|don't contact/.test(normalized)) {
    return { category: "Unsubscribe", confidence: 0.9, explanation: "The reply asks to stop contact." };
  }
  if (/not interested|no thanks|not a fit/.test(normalized)) {
    return { category: "Not Interested", confidence: 0.82, explanation: "The reply declines the offer." };
  }
  if (/who should|wrong person|contact .* instead/.test(normalized)) {
    return { category: "Wrong Contact", confidence: 0.75, explanation: "The reply points to another contact." };
  }
  if (/\?|how much|examples|available|tell me more|send/.test(normalized)) {
    return { category: "Question", confidence: 0.66, explanation: "The reply asks a question and needs review." };
  }
  if (/interested|sounds good|let's|yes|open to|would like/.test(normalized)) {
    return { category: "Interested", confidence: 0.84, explanation: "The reply expresses positive interest." };
  }
  return { category: "Other", confidence: 0.5, explanation: "No clear intent was detected." };
}

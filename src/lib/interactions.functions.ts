import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  supplements: z.array(z.string().min(1).max(100)).max(30),
  medications: z.array(z.string().min(1).max(100)).max(30),
});

export type Severity = "DANGEROUS" | "CAUTION" | "SAFE";

export type InteractionResult = {
  interactions: {
    items: string[];
    severity: Severity;
    explanation: string;
  }[];
  timing: {
    item: string;
    recommended_time: string; // e.g. "08:00"
    advice: string;
  }[];
};

const SystemPrompt = `You are a clinical pharmacology assistant. Given a list of supplements and prescription medications, return STRICT JSON with this shape:
{
  "interactions": [
    { "items": ["A","B"], "severity": "DANGEROUS"|"CAUTION"|"SAFE", "explanation": "short reason" }
  ],
  "timing": [
    { "item": "Name", "recommended_time": "HH:MM 24h", "advice": "short instructions e.g. with food, away from calcium" }
  ]
}
Rules:
- Cover EVERY pair (supplement+supplement, supplement+med, med+med). If no concern, include one entry with severity "SAFE".
- One timing entry per unique item (both supplements and medications).
- Be concise but specific. No markdown. No prose outside JSON. No code fences.`;

export const checkInteractions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<InteractionResult> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    if (data.supplements.length === 0 && data.medications.length === 0) {
      return { interactions: [], timing: [] };
    }

    const userMessage = `Supplements: ${data.supplements.join(", ") || "(none)"}\nMedications: ${data.medications.join(", ") || "(none)"}\n\nReturn the JSON now.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        messages: [
          { role: "system", content: SystemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: InteractionResult;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON object
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { interactions: [], timing: [] };
    }
    return {
      interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
      timing: Array.isArray(parsed.timing) ? parsed.timing : [],
    };
  });

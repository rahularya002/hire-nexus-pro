import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  title: z.string().min(2).max(160),
  companyName: z.string().max(160).nullish(),
  location: z.string().max(160).nullish(),
  experience: z.string().max(120).nullish(),
  salary: z.string().max(160).nullish(),
  employmentType: z.string().max(80).nullish(),
  skills: z.array(z.string().max(80)).max(40).nullish(),
});

export type GenerateJdInput = z.infer<typeof InputSchema>;

/**
 * Draft a full job description from a role title (plus whatever context the
 * form already has). Uses the Lovable AI Gateway — server-side only.
 */
export const generateJobDescription = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured on this project");

    const facts = [
      `Job title: ${data.title}`,
      data.companyName ? `Company / client: ${data.companyName}` : null,
      data.location ? `Location: ${data.location}` : null,
      data.employmentType ? `Employment type: ${data.employmentType}` : null,
      data.experience ? `Experience required: ${data.experience}` : null,
      data.salary ? `Compensation: ${data.salary}` : null,
      data.skills?.length ? `Skills / tags: ${data.skills.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        signal: AbortSignal.timeout(45_000),
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              [
                "You are an expert recruitment copywriter. Write a concise, realistic job description from the given role details.",
                "Format as plain text with these section headings on their own lines, each followed by short '- ' bullets:",
                "About the role (2-3 sentences, no bullets)",
                "Key responsibilities (5-7 bullets)",
                "Required skills (5-8 bullets)",
                "Nice to have (3-4 bullets)",
                "Only include a 'What we offer' section when compensation or experience details are supplied (3 bullets).",
                "Infer seniority and domain from the title. Never invent a company name, perks, or benefits that were not supplied.",
                "Do not use markdown bold/asterisks, do not add a preamble, and do not repeat the input as a list.",
              ].join(" "),
          },
          { role: "user", content: facts },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep generating descriptions.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Description generation failed [${res.status}]: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("AI returned an empty description");
    return { description: text.slice(0, 8000) };
  });

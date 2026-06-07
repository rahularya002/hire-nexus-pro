import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  jobTitle: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  experience: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  openings: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
});

export type AiExtractedJd = z.infer<typeof Schema>;

/**
 * Extract structured JD fields with Lovable AI Gateway (Gemini Flash).
 * Far more reliable than regex for unstructured JDs.
 */
export const extractJdWithAi = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ text: z.string().min(20).max(20_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract recruiting fields from job descriptions. Return ONLY via the extract_jd tool. Use null for missing fields. Keep values short. For salary include currency and range. For experience use formats like '5-8 years' or '5+ years'. Skills are individual technologies/competencies (10-15 max).",
          },
          { role: "user", content: data.text.slice(0, 18_000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_jd",
              description: "Return structured JD fields.",
              parameters: {
                type: "object",
                properties: {
                  jobTitle: { type: ["string", "null"] },
                  location: { type: ["string", "null"] },
                  experience: { type: ["string", "null"] },
                  salary: { type: ["string", "null"] },
                  openings: { type: ["string", "null"] },
                  skills: { type: ["array", "null"], items: { type: "string" } },
                },
                required: ["jobTitle", "location", "experience", "salary", "openings", "skills"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_jd" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI JD extract failed [${res.status}]: ${txt.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return {} as AiExtractedJd;
    const parsed = Schema.safeParse(JSON.parse(args));
    return parsed.success ? parsed.data : ({} as AiExtractedJd);
  });
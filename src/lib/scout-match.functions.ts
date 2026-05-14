import { createServerFn } from "@tanstack/react-start";

export type ScoutCandidate = {
  name: string;
  title: string;
  location: string;
  experience: string;
  matchScore: number;
  highlights: string[];
  currentCompany: string;
  reasoning: string;
};

type Input = {
  jobTitle: string;
  location?: string;
  experience?: string;
  skills?: string;
  jd?: string;
  fileName?: string | null;
};

export const scoutCandidates = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input?.jobTitle || input.jobTitle.trim().length < 2) {
      throw new Error("Job title is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI is not configured", candidates: [] as ScoutCandidate[] };
    }

    const userBrief = [
      `Role: ${data.jobTitle}`,
      data.location ? `Location: ${data.location}` : null,
      data.experience ? `Experience: ${data.experience}` : null,
      data.skills ? `Required skills: ${data.skills}` : null,
      data.jd ? `Job description:\n${data.jd}` : null,
      data.fileName ? `Attached JD file: ${data.fileName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are AI Talent Scout for TalentFlow, an Indian recruitment agency. Given a role brief, generate 5 plausible, realistic candidate matches drawn from the Indian talent market. Use believable Indian names, real Indian companies (Razorpay, Flipkart, Swiggy, Zerodha, Paytm, Tata Digital, Reliance Jio, Cred, Nykaa, Meesho, Zomato, PhonePe, etc.), and ground match scores honestly (60-98). Return ONLY via the propose_candidates tool.",
            },
            { role: "user", content: userBrief },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "propose_candidates",
                description: "Return 5 candidate matches for the role.",
                parameters: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      minItems: 5,
                      maxItems: 5,
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          title: { type: "string" },
                          currentCompany: { type: "string" },
                          location: { type: "string" },
                          experience: { type: "string", description: "e.g. 8 years" },
                          matchScore: { type: "number", minimum: 0, maximum: 100 },
                          highlights: {
                            type: "array",
                            items: { type: "string" },
                            minItems: 2,
                            maxItems: 4,
                          },
                          reasoning: { type: "string", description: "1-2 sentences why they match" },
                        },
                        required: [
                          "name",
                          "title",
                          "currentCompany",
                          "location",
                          "experience",
                          "matchScore",
                          "highlights",
                          "reasoning",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["candidates"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "propose_candidates" } },
        }),
      });

      if (res.status === 429) {
        return { error: "Rate limit reached. Please try again shortly.", candidates: [] };
      }
      if (res.status === 402) {
        return {
          error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
          candidates: [],
        };
      }
      if (!res.ok) {
        const txt = await res.text();
        console.error("Scout match error:", res.status, txt);
        return { error: "Talent Scout is unavailable. Please try again.", candidates: [] };
      }

      const json = (await res.json()) as {
        choices?: {
          message?: {
            tool_calls?: { function?: { name?: string; arguments?: string } }[];
          };
        }[];
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        return { error: "No candidates returned. Try refining the role brief.", candidates: [] };
      }
      const parsed = JSON.parse(args) as { candidates: ScoutCandidate[] };
      return { error: null as string | null, candidates: parsed.candidates ?? [] };
    } catch (e) {
      console.error("Scout match exception:", e);
      return { error: "Talent Scout failed. Please try again.", candidates: [] };
    }
  });
import { createServerFn } from "@tanstack/react-start";

type ScoutInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  sources?: string[];
  clientName?: string | null;
};

export const scoutChat = createServerFn({ method: "POST" })
  .inputValidator((input: ScoutInput) => {
    if (!input || !Array.isArray(input.messages)) {
      throw new Error("messages array required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sources = data.sources && data.sources.length > 0
      ? data.sources.join(", ")
      : "all available platforms";

    const clientLine = data.clientName
      ? `\nActive client context: ${data.clientName}. Tailor candidate suggestions, outreach tone, and shortlists to this client's hiring style.`
      : "";

    const systemPrompt = `You are AI Talent Scout, an expert technical recruiter assistant for TalentFlow, a recruitment agency in India.
Help recruiters source, evaluate and shortlist candidates for open roles.
Be concise, structured (use markdown lists & headings), and action-oriented.
Active sourcing channels for this session: ${sources}. Tailor sourcing strategies, boolean search strings, and outreach templates to these channels. When "Internal database" is selected, prioritize the recruiter's existing candidate pool first.${clientLine}
When given a job description or role brief, respond with: ideal candidate profile, must-have skills, sourcing channels, and 3 sample outreach message templates.
When asked about a candidate, give a balanced evaluation with strengths, gaps, and suggested interview questions.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        signal: AbortSignal.timeout(45_000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) {
      return { error: "Rate limit reached. Please try again in a moment." };
    }
    if (res.status === 402) {
      return { error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." };
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("Scout AI error:", res.status, t);
      return { error: "AI service error. Please try again." };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });
import "server-only";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a professional corporate secretary who writes formal meeting minutes.
Given rough bullet points, produce well-structured formal minutes as PLAIN TEXT.
Rules:
- Output plain text only. Do NOT use Markdown: no "#", "*", "_", backticks, or horizontal rules ("---").
- Use simple numbered headings on their own line (e.g. "1. Preliminaries") followed by plain paragraphs.
- Do not use decorative symbols such as "/", "//", "...", "###", bullets with symbols, or emoji.
- Keep the language professional, concise and grounded in the given points; do not invent facts.`;

/** Strip Markdown / decorative artifacts the model may still emit. */
function cleanMinutes(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n");
  t = t.replace(/```+/g, "");
  t = t.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/__(.*?)__/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
  t = t.replace(/^\s*[-*+•]\s+/gm, "• ");
  t = t.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
  t = t.replace(/\*{1,2}/g, "");
  t = t.replace(/_{1,2}/g, "");
  t = t.replace(/\.{3,}/g, ".");
  t = t.replace(/\s*\/{2,}\s*/g, " / ");
  t = t.replace(/[ \t]+$/gm, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export async function generateMinutes(input: {
  title: string;
  meetingDate?: string | null;
  attendees?: string | null;
  points: string;
}): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured. Add it to your .env or Vercel environment.");

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const userPrompt = [
    `Meeting title: ${input.title}`,
    input.meetingDate ? `Date: ${input.meetingDate}` : null,
    input.attendees ? `Attendees: ${input.attendees}` : null,
    "",
    "Rough points to turn into minutes:",
    input.points,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("The AI returned an empty response. Try again.");
  return cleanMinutes(content);
}

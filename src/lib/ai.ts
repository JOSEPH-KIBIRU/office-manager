import "server-only";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a professional corporate secretary who writes formal meeting minutes.
Given rough bullet points, produce well-structured formal minutes in Markdown with:
- A heading block (meeting title, date, attendees if provided)
- Numbered agenda items grouped logically under standard sections (Preliminaries, Matters Arising, Main Agenda, A.O.B, Adjournment) where appropriate
- Clear, professional, concise language expanding each bullet into full sentences
- Action items marked clearly with responsible persons and deadlines when inferable
Do NOT invent facts that are not supported by the points. Keep it grounded in what is given.`;

export async function generateMinutes(input: {
  title: string;
  meetingDate?: string | null;
  attendees?: string | null;
  points: string;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured. Add it to your .env file.");

  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
  return content;
}

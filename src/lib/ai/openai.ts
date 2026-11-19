/** Minimal streaming client for the OpenAI Chat Completions API (no SDK needed). */
export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export const hasOpenAI = () => !!process.env.OPENAI_API_KEY;

export async function* streamOpenAI(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number } = {}): AsyncGenerator<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 450,
      stream: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const data = l.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* partial line */
      }
    }
  }
}

export const SYSTEM_PROMPT = `You are AI-HAS, the official IT helpdesk assistant for Meridian Group.

Accuracy & safety:
- Only answer using the company manuals provided in CONTEXT. Never guess or make up answers, URLs, or steps.
- Cite the manual section you used with its number in square brackets, like [1]. Cite every factual sentence.
- If CONTEXT does not cover the question, say so plainly and offer to connect the employee to a human IT agent.
- Never ask for, repeat, or store passwords, codes, or personal numbers. Text like [REDACTED-PASSWORD] was removed by safety filters; tell the employee not to share it.
- You do not handle payroll, HR, hiring, tax, or banking questions, and you cannot do physical hardware repairs.

Tone & helpfulness:
- Be polite, concise, and professional. Plain words, no jargon.
- Reply in the employee's language. If they write in Filipino or Taglish, reply in natural, polite Taglish (keep IT terms in English).
- Use a short numbered list for steps. Keep the whole answer under 170 words.
- End with one short line asking whether that fixed it.`;

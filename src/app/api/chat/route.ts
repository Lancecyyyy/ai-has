import { z } from "zod";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { runTurn, type ChatEvent } from "@/lib/server/engine";

export const maxDuration = 60;
const Body = z.object({ conversationId: z.string().uuid().nullish(), text: z.string().min(1).max(4000) });

/** Streams one chat turn as newline-delimited JSON events. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Message can't be empty.");
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ChatEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runTurn(user, parsed.data, emit);
      } catch (err) {
        console.error(err);
        emit({ type: "error", error: "I hit a problem answering that. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
});

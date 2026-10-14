/**
 * Client-side function tools exposed to the Grok Voice Agent.
 *
 * `voiceTools` is sent in `session.update`. When Grok decides to call one, it
 * emits `response.function_call_arguments.done`; we run `runClientTool` and send
 * the result back. Each tool hits a Next.js route handler, which is where we
 * reach long-term memory / the database.
 */

export const voiceTools = [
  {
    type: "function" as const,
    name: "recall_memory",
    description:
      "Search your long-term memory of past calls with this person. Call this whenever they reference something from before ('do you remember…', 'like I told you', 'how did that go') OR before bringing up a sensitive topic, so you have the real facts. Returns short memory statements. If it returns nothing, you genuinely don't know — say so honestly, never pretend to remember.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "What to look up, in a few words — e.g. 'grandson', 'how they've been feeling', 'family', 'last weekend'.",
        },
      },
      required: ["query"],
    },
  },
];

type ToolArgs = Record<string, unknown>;

/** Identity passed through so server tools can scope to the right person. */
export type ToolContext = { phone?: string; name?: string };

/** Execute a tool by name and return a JSON-serializable result. */
export async function runClientTool(
  name: string,
  args: ToolArgs,
  ctx: ToolContext = {},
): Promise<unknown> {
  switch (name) {
    case "recall_memory": {
      const res = await fetch("/api/tools/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: ctx.phone,
          name: ctx.name,
          query: args.query,
        }),
      });
      return res.json();
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

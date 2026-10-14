import { inngest } from "./safetyconnect__src_inngest__client";
import { ingestRecalls } from "./safetyconnect__src_inngest__ingest";
import { runDefense } from "./orchestrate";

// Placeholder function used to verify the Inngest dev server connection in Phase 0.
export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello" }] },
  async ({ event, step }) => {
    const greeting = await step.run("greet", async () => {
      return `SafetyConnect online — received ${event.name}`;
    });
    return { ok: true, greeting };
  },
);

export const functions = [helloWorld, ingestRecalls, runDefense];

import { serve } from "inngest/next";
import { inngest } from "@/inngest/safetyconnect__src_inngest__client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

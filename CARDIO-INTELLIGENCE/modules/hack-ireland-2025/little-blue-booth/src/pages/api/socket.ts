import type { NextApiRequest } from "next";
import { initSocket, type NextApiResponseWithSocket } from "~/lib/hack_ireland_2025__src_lib__socket";

export default function handler(
  _request: NextApiRequest,
  response: NextApiResponseWithSocket,
) {
  try {
    initSocket(response);
    response.status(200).json({ success: true });
  } catch (error) {
    console.error("Socket initialization error:", error);
    response.status(500).json({ success: false, error: "Failed to initialize socket" });
  }
}

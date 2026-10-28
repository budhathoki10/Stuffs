import { cronAuthorized } from "@/lib/cron";
import { runAllMonitors } from "@/lib/services/monitors";

export const maxDuration = 300;

/** Every 10 minutes (see vercel.json): check each monitored client site and send alerts. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runAllMonitors());
}

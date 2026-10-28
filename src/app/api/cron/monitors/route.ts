import { cronAuthorized } from "@/lib/cron";
import { runAllMonitors } from "@/lib/services/monitors";

export const maxDuration = 300;

/** Vercel Cron entry point for monitoring. For cron-job.org, use /api/cron-job/monitors instead. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runAllMonitors());
}

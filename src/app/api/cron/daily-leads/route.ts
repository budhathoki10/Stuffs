import { cronAuthorized } from "@/lib/cron";
import { runDailyJob } from "@/lib/jobs";

export const maxDuration = 300;

/** Vercel Cron entry point. For cron-job.org, use /api/cron-job/daily instead. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDailyJob());
}

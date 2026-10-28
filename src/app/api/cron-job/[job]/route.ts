import { after } from "next/server";
import { cronJobAuthorized } from "@/lib/cron";
import { isJobName, JOBS } from "@/lib/jobs";

// The job keeps running after the response for up to this long.
export const maxDuration = 300;

/**
 * Entry point for cron-job.org: /api/cron-job/daily (once a day) and /api/cron-job/monitors
 * (every 10 minutes). cron-job.org gives up on a request after 30 seconds, so we answer at
 * once with 202 and do the work afterwards; results go to the server logs. Add `?wait=1` to
 * run in the foreground and see the result, e.g. when testing by hand.
 */
async function handle(request: Request, ctx: RouteContext<"/api/cron-job/[job]">) {
  if (!cronJobAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  if (!isJobName(job)) return Response.json({ error: `Unknown job. Use one of: ${Object.keys(JOBS).join(", ")}` }, { status: 404 });

  const run = async () => {
    const started = Date.now();
    try {
      const result = await JOBS[job]();
      console.info(`cron-job ${job} finished in ${Date.now() - started} ms`, result);
      return result;
    } catch (err) {
      console.error(`cron-job ${job} failed`, err);
      throw err;
    }
  };

  if (new URL(request.url).searchParams.get("wait") === "1") {
    try {
      return Response.json({ job, result: await run() });
    } catch {
      return Response.json({ job, error: "The job failed. See the server logs." }, { status: 500 });
    }
  }

  after(() => run().catch(() => {}));
  return Response.json({ job, started: new Date().toISOString() }, { status: 202, headers: { "cache-control": "no-store" } });
}

export { handle as GET, handle as POST };

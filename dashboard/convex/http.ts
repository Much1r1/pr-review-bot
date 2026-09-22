import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/submitRun",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("x-review-bot-secret");
    if (secret !== process.env.REVIEW_BOT_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    const runId = await ctx.runMutation(api.runs.submitRun, {
      repo: body.repo,
      pr_number: body.pr_number,
      head_sha: body.head_sha,
      total_findings: body.total_findings,
      any_critical: body.any_critical,
      findings: body.findings,
    });

    return new Response(JSON.stringify({ ok: true, runId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
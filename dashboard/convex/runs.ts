import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submitRun = mutation({
  args: {
    repo: v.string(),
    pr_number: v.number(),
    head_sha: v.string(),
    total_findings: v.number(),
    any_critical: v.boolean(),
    findings: v.array(
      v.object({
        category: v.union(
          v.literal("security"),
          v.literal("code_review"),
          v.literal("dependency")
        ),
        severity: v.string(),
        file: v.string(),
        line: v.optional(v.number()),
        message: v.string(),
        code_snippet: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("runs", {
      repo: args.repo,
      pr_number: args.pr_number,
      head_sha: args.head_sha,
      timestamp: Date.now(),
      total_findings: args.total_findings,
      any_critical: args.any_critical,
    });
    for (const f of args.findings) {
      await ctx.db.insert("findings", { run_id: runId, ...f });
    }
    return runId;
  },
});

export const listRepos = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("runs").collect();
    const repos = [...new Set(runs.map((r) => r.repo))];
    return repos;
  },
});

export const listRuns = query({
  args: { repo: v.string() },
  handler: async (ctx, args) => {
    const runs = await ctx.db.query("runs").order("desc").collect();
    const filtered =
      args.repo === "all" ? runs : runs.filter((r) => r.repo === args.repo);

    return filtered.map((r) => ({
      _id: r._id,
      repo: r.repo,
      pr_number: r.pr_number,
      head_sha: r.head_sha,
      timestamp: r.timestamp,
      total_findings: r.total_findings,
      any_critical: r.any_critical,
    }));
  },
});

export const getTrendData = query({
  args: { repo: v.string() },
  handler: async (ctx, args) => {
    const runs = await ctx.db.query("runs").collect();
    const filtered =
      args.repo === "all" ? runs : runs.filter((r) => r.repo === args.repo);
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    const results = [];
    for (const run of sorted) {
      const findings = await ctx.db
        .query("findings")
        .filter((q) => q.eq(q.field("run_id"), run._id))
        .collect();

      const counts = {
        critical: 0,
        high: 0,
        warning: 0,
        info: 0,
        security: 0,
        code_review: 0,
        dependency: 0,
      };

      findings.forEach((f) => {
        if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
        if (f.category in counts) counts[f.category as keyof typeof counts]++;
      });

      const dateStr = new Date(run.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      results.push({
        run_id: run._id,
        pr_number: run.pr_number,
        repo: run.repo,
        timestamp: run.timestamp,
        dateStr,
        head_sha: run.head_sha,
        total_findings: run.total_findings,
        any_critical: run.any_critical,
        ...counts,
      });
    }

    return results;
  },
});
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mutation called by python client or seed logic to write run + findings in one batch
export const saveRunAndFindings = mutation({
  args: {
    repo: v.string(),
    pr_number: v.number(),
    head_sha: v.string(),
    timestamp: v.optional(v.number()),
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
    const timestamp = args.timestamp ?? Date.now();

    // Optional auth validation if CONVEX_AUTH_SECRET environment variable is configured in Convex deployment
    const authSecret = process.env.CONVEX_AUTH_SECRET;
    if (authSecret) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized: Mutation requires authentication.");
      }
    }

    const runId = await ctx.db.insert("runs", {
      repo: args.repo,
      pr_number: args.pr_number,
      head_sha: args.head_sha,
      timestamp,
      total_findings: args.total_findings,
      any_critical: args.any_critical,
    });

    const insertedFindingIds: Array<any> = [];
    try {
      for (const f of args.findings) {
        const findingId = await ctx.db.insert("findings", {
          run_id: runId,
          category: f.category,
          severity: f.severity,
          file: f.file,
          line: f.line,
          message: f.message,
          code_snippet: f.code_snippet,
        });
        insertedFindingIds.push(findingId);
      }
    } catch (err) {
      // Roll back insertions on failure to avoid orphaned runs
      for (const fid of insertedFindingIds) {
        await ctx.db.delete(fid);
      }
      await ctx.db.delete(runId);
      throw new Error(`Failed to insert findings for run: ${err instanceof Error ? err.message : String(err)}`);
    }

    return runId;
  },
});

// Query all distinct repos
export const listRepos = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("runs").collect();
    const repoSet = new Set<string>();
    runs.forEach((r) => repoSet.add(r.repo));
    return Array.from(repoSet).sort();
  },
});

// Query recent runs, optionally filtered by repo
export const listRuns = query({
  args: {
    repo: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q;
    if (args.repo && args.repo !== "all") {
      q = ctx.db
        .query("runs")
        .withIndex("by_repo", (q) => q.eq("repo", args.repo!));
    } else {
      q = ctx.db.query("runs");
    }

    const runs = await q.collect();
    // Sort descending by timestamp
    runs.sort((a, b) => b.timestamp - a.timestamp);

    if (args.limit) {
      return runs.slice(0, args.limit);
    }
    return runs;
  },
});

// Query details for a specific run including all its findings
export const getRunDetails = query({
  args: {
    run_id: v.id("runs"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) return null;

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_run_id", (q) => q.eq("run_id", args.run_id))
      .collect();

    return {
      run,
      findings,
    };
  },
});

// Query aggregated trend data over time (grouped by run or date)
export const getTrendData = query({
  args: {
    repo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let runs;
    if (args.repo && args.repo !== "all") {
      runs = await ctx.db
        .query("runs")
        .withIndex("by_repo", (q) => q.eq("repo", args.repo!))
        .collect();
    } else {
      runs = await ctx.db.query("runs").collect();
    }

    runs.sort((a, b) => a.timestamp - b.timestamp);

    const trend = [];
    for (const run of runs) {
      const findings = await ctx.db
        .query("findings")
        .withIndex("by_run_id", (q) => q.eq("run_id", run._id))
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

      for (const f of findings) {
        if (f.severity in counts) {
          counts[f.severity as keyof typeof counts]++;
        }
        if (f.category in counts) {
          counts[f.category as keyof typeof counts]++;
        }
      }

      const dateStr = new Date(run.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      trend.push({
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

    return trend;
  },
});

// Seed data mutation for demo / local testing when Convex is empty
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("runs").first();
    if (existing) {
      return { message: "Database already has data. Skipping seed." };
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Run 1: Much1r1/pr-review-bot - PR #12 (Bait PR with real SQL Injection & Timing Attack)
    const run1Id = await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 12,
      head_sha: "a1b2c3d4e5f6789012345678901234567890a1b2",
      timestamp: now - 3 * dayMs,
      total_findings: 5,
      any_critical: true,
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "security",
      severity: "critical",
      file: "scripts/test_bait.py",
      line: 18,
      message: "SQL Injection: Query built using unsanitized string formatting with user input.",
      code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{username}\'"',
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "security",
      severity: "critical",
      file: "scripts/test_bait.py",
      line: 25,
      message: "Command Injection: Unsanitized user input passed to subprocess.run with shell=True.",
      code_snippet: 'result = subprocess.run(user_command, shell=True, capture_output=True)',
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "security",
      severity: "high",
      file: "scripts/test_bait.py",
      line: 11,
      message: "Hardcoded Secret: Stripe Live API Key detected in source code.",
      code_snippet: 'STRIPE_API_KEY = "sk_live_51H8x9kL3mN2pQeRtWyUvAbCdEfGhIjKlMnOpQrSt"',
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "security",
      severity: "high",
      file: "scripts/test_bait.py",
      line: 35,
      message: "Timing Attack: Non-constant-time comparison used for password comparison.",
      code_snippet: "return candidate == real_password",
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "code_review",
      severity: "warning",
      file: "scripts/test_bait.py",
      line: 30,
      message: "Use of eval() on untrusted user input allows arbitrary code execution.",
      code_snippet: "return eval(user_supplied_expr)",
    });

    // Run 2: Much1r1/pr-review-bot - PR #14 (Security fixes applied)
    const run2Id = await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 14,
      head_sha: "f9e8d7c6b5a4321098765432109876543210f9e8",
      timestamp: now - 2 * dayMs,
      total_findings: 1,
      any_critical: false,
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "code_review",
      severity: "info",
      file: "src/main.py",
      line: 42,
      message: "Consider adding timeout parameters to external HTTP client calls.",
      code_snippet: "client = GitHubClient.from_env()",
    });

    // Run 3: Much1r1/e-commerce-api - PR #45 (Multi-repo demonstration)
    const run3Id = await ctx.db.insert("runs", {
      repo: "Much1r1/e-commerce-api",
      pr_number: 45,
      head_sha: "3f2e1d0c9b8a7654321098765432109876543210",
      timestamp: now - 1 * dayMs,
      total_findings: 3,
      any_critical: true,
    });

    await ctx.db.insert("findings", {
      run_id: run3Id,
      category: "dependency",
      severity: "critical",
      file: "pyyaml@5.1",
      line: undefined,
      message: "GHSA-f456-j9vh-773f: Arbitrary code execution vulnerability in PyYAML 5.1 deserialization.",
      code_snippet: undefined,
    });

    await ctx.db.insert("findings", {
      run_id: run3Id,
      category: "security",
      severity: "high",
      file: "api/auth.py",
      line: 88,
      message: "JWT secret hardcoded in configuration file.",
      code_snippet: 'JWT_SECRET = "super-secret-key-12345"',
    });

    await ctx.db.insert("findings", {
      run_id: run3Id,
      category: "code_review",
      severity: "warning",
      file: "api/views.py",
      line: 102,
      message: "Unhandled exception in API view handler might expose internal stack traces.",
      code_snippet: "except Exception:\n    return HttpResponseServerError(traceback.format_exc())",
    });

    // Run 4: Much1r1/e-commerce-api - PR #48 (Dependency patch)
    await ctx.db.insert("runs", {
      repo: "Much1r1/e-commerce-api",
      pr_number: 48,
      head_sha: "8a7b6c5d4e3f2109876543210987654321098a7b",
      timestamp: now - 4 * 3600 * 1000,
      total_findings: 0,
      any_critical: false,
    });

    return { message: "Demo data successfully seeded!", seededRuns: 4 };
  },
});

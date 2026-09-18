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

    // --- REPO 1: Much1r1/pr-review-bot ---

    // Run 1: pr-review-bot - PR #10 (Initial pipeline setup)
    const run1Id = await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 10,
      head_sha: "e1f2a3b4c5d6789012345678901234567890e1f2",
      timestamp: now - 10 * dayMs,
      total_findings: 2,
      any_critical: false,
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "code_review",
      severity: "warning",
      file: "src/github_client.py",
      line: 45,
      message: "HTTP request missing explicit timeout parameter.",
      code_snippet: "response = requests.get(url, headers=self.headers)",
    });

    await ctx.db.insert("findings", {
      run_id: run1Id,
      category: "code_review",
      severity: "info",
      file: "src/diff_parser.py",
      line: 12,
      message: "Unused import statement 're' detected.",
      code_snippet: "import re",
    });

    // Run 2: pr-review-bot - PR #12 (Bait PR with real caught vulnerabilities)
    const run2Id = await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 12,
      head_sha: "a1b2c3d4e5f6789012345678901234567890a1b2",
      timestamp: now - 7 * dayMs,
      total_findings: 5,
      any_critical: true,
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "security",
      severity: "critical",
      file: "scripts/test_bait.py",
      line: 18,
      message: "SQL Injection: Query built using unsanitized string formatting with user input.",
      code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{username}\'"',
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "security",
      severity: "critical",
      file: "scripts/test_bait.py",
      line: 25,
      message: "Command Injection: Unsanitized user input passed to subprocess.run with shell=True.",
      code_snippet: 'result = subprocess.run(user_command, shell=True, capture_output=True)',
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "security",
      severity: "high",
      file: "scripts/test_bait.py",
      line: 11,
      message: "Hardcoded Secret: Stripe Live API Key detected in source code.",
      code_snippet: 'STRIPE_API_KEY = "sk_live_51H8x9kL3mN2pQeRtWyUvAbCdEfGhIjKlMnOpQrSt"',
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "security",
      severity: "high",
      file: "scripts/test_bait.py",
      line: 35,
      message: "Timing Attack: Non-constant-time comparison used for password comparison.",
      code_snippet: "return candidate == real_password",
    });

    await ctx.db.insert("findings", {
      run_id: run2Id,
      category: "code_review",
      severity: "warning",
      file: "scripts/test_bait.py",
      line: 30,
      message: "Use of eval() on untrusted user input allows arbitrary code execution.",
      code_snippet: "return eval(user_supplied_expr)",
    });

    // Run 3: pr-review-bot - PR #14 (Security remediation PR)
    const run3Id = await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 14,
      head_sha: "f9e8d7c6b5a4321098765432109876543210f9e8",
      timestamp: now - 5 * dayMs,
      total_findings: 1,
      any_critical: false,
    });

    await ctx.db.insert("findings", {
      run_id: run3Id,
      category: "code_review",
      severity: "info",
      file: "src/main.py",
      line: 42,
      message: "Consider adding docstrings to public helper functions.",
      code_snippet: "def process_review_results(results):",
    });

    // Run 4: pr-review-bot - PR #18 (Clean PR - RAG Indexing optimizations)
    await ctx.db.insert("runs", {
      repo: "Much1r1/pr-review-bot",
      pr_number: 18,
      head_sha: "c4d3e2f1a0987654321098765432109876543210",
      timestamp: now - 2 * dayMs,
      total_findings: 0,
      any_critical: false,
    });

    // --- REPO 2: Much1r1/e-commerce-api ---

    // Run 5: e-commerce-api - PR #32 (Payment gateway integration)
    const run5Id = await ctx.db.insert("runs", {
      repo: "Much1r1/e-commerce-api",
      pr_number: 32,
      head_sha: "3f2e1d0c9b8a7654321098765432109876543210",
      timestamp: now - 9 * dayMs,
      total_findings: 3,
      any_critical: true,
    });

    await ctx.db.insert("findings", {
      run_id: run5Id,
      category: "dependency",
      severity: "critical",
      file: "pyyaml@5.1",
      line: undefined,
      message: "GHSA-f456-j9vh-773f: Arbitrary code execution vulnerability in PyYAML 5.1 deserialization.",
      code_snippet: undefined,
    });

    await ctx.db.insert("findings", {
      run_id: run5Id,
      category: "security",
      severity: "high",
      file: "api/auth.py",
      line: 88,
      message: "JWT secret hardcoded in configuration file.",
      code_snippet: 'JWT_SECRET = "super-secret-key-12345"',
    });

    await ctx.db.insert("findings", {
      run_id: run5Id,
      category: "code_review",
      severity: "warning",
      file: "api/views.py",
      line: 102,
      message: "Unhandled exception in API view handler might expose internal stack traces.",
      code_snippet: "except Exception:\n    return HttpResponseServerError(traceback.format_exc())",
    });

    // Run 6: e-commerce-api - PR #35 (User profile update endpoint)
    const run6Id = await ctx.db.insert("runs", {
      repo: "Much1r1/e-commerce-api",
      pr_number: 35,
      head_sha: "7a8b9c0d1e2f3456789012345678901234567890",
      timestamp: now - 6 * dayMs,
      total_findings: 2,
      any_critical: false,
    });

    await ctx.db.insert("findings", {
      run_id: run6Id,
      category: "dependency",
      severity: "high",
      file: "requests@2.25.0",
      line: undefined,
      message: "CVE-2023-32681: Unintended leak of Authorization header on cross-domain redirect.",
      code_snippet: undefined,
    });

    await ctx.db.insert("findings", {
      run_id: run6Id,
      category: "security",
      severity: "warning",
      file: "api/routes.py",
      line: 64,
      message: "Missing rate limiting decorator on sensitive auth endpoint.",
      code_snippet: "@app.route('/api/v1/auth/login', methods=['POST'])",
    });

    // Run 7: e-commerce-api - PR #48 (Dependency patch & security hardening)
    await ctx.db.insert("runs", {
      repo: "Much1r1/e-commerce-api",
      pr_number: 48,
      head_sha: "8a7b6c5d4e3f2109876543210987654321098a7b",
      timestamp: now - 1 * dayMs,
      total_findings: 0,
      any_critical: false,
    });

    // --- REPO 3: Much1r1/auth-service ---

    // Run 8: auth-service - PR #5 (OAuth2 callback implementation)
    const run8Id = await ctx.db.insert("runs", {
      repo: "Much1r1/auth-service",
      pr_number: 5,
      head_sha: "b9c8d7e6f5a4321098765432109876543210b9c8",
      timestamp: now - 8 * dayMs,
      total_findings: 4,
      any_critical: true,
    });

    await ctx.db.insert("findings", {
      run_id: run8Id,
      category: "security",
      severity: "critical",
      file: "src/webhooks.py",
      line: 34,
      message: "Missing HMAC signature verification on incoming payment webhook.",
      code_snippet: "def handle_webhook(request):\n    payload = request.get_json()",
    });

    await ctx.db.insert("findings", {
      run_id: run8Id,
      category: "security",
      severity: "high",
      file: "src/config.py",
      line: 15,
      message: "CORS configured with wildcard origin '*' while credentials mode is enabled.",
      code_snippet: "CORS_ALLOW_ALL_ORIGINS = True",
    });

    await ctx.db.insert("findings", {
      run_id: run8Id,
      category: "security",
      severity: "high",
      file: "src/tokens.py",
      line: 52,
      message: "Hardcoded secret key used for signing session tokens.",
      code_snippet: 'SECRET_KEY = "dev-secret-do-not-use-in-prod"',
    });

    await ctx.db.insert("findings", {
      run_id: run8Id,
      category: "code_review",
      severity: "warning",
      file: "src/logger.py",
      line: 22,
      message: "Verbose debug logging exposes raw user passwords in application logs.",
      code_snippet: 'logger.debug(f"Authenticating user {username} with pass {password}")',
    });

    // Run 9: auth-service - PR #8 (Password hash configuration)
    const run9Id = await ctx.db.insert("runs", {
      repo: "Much1r1/auth-service",
      pr_number: 8,
      head_sha: "1a2b3c4d5e6f7890123456789012345678901a2b",
      timestamp: now - 3 * dayMs,
      total_findings: 1,
      any_critical: false,
    });

    await ctx.db.insert("findings", {
      run_id: run9Id,
      category: "code_review",
      severity: "warning",
      file: "src/passwords.py",
      line: 19,
      message: "PBKDF2 iteration count (10,000) is below OWASP recommended minimum (600,000).",
      code_snippet: "hash = pbkdf2_sha256.hash(password, rounds=10000)",
    });

    // Run 10: auth-service - PR #11 (Final production release preparation)
    await ctx.db.insert("runs", {
      repo: "Much1r1/auth-service",
      pr_number: 11,
      head_sha: "d5e6f7a8b9c0123456789012345678901234d5e6",
      timestamp: now - 12 * 3600 * 1000,
      total_findings: 0,
      any_critical: false,
    });

    return { message: "Demo data successfully seeded!", seededRuns: 10 };
  },
});

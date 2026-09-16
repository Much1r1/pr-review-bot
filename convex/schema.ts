import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    repo: v.string(),
    pr_number: v.number(),
    head_sha: v.string(),
    timestamp: v.number(),
    total_findings: v.number(),
    any_critical: v.boolean(),
  })
    .index("by_repo", ["repo"])
    .index("by_repo_and_timestamp", ["repo", "timestamp"]),

  findings: defineTable({
    run_id: v.id("runs"),
    category: v.union(
      v.literal("security"),
      v.literal("code_review"),
      v.literal("dependency")
    ),
    severity: v.string(), // "critical" | "high" | "warning" | "info"
    file: v.string(),
    line: v.optional(v.number()),
    message: v.string(),
    code_snippet: v.optional(v.string()),
  }).index("by_run_id", ["run_id"]),
});

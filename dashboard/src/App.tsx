import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  ShieldAlert,
  Bot,
  Activity,
  Layers,
  Sparkles,
  Github,
} from 'lucide-react';
import { RepoSelector } from './components/RepoSelector';
import { StatCard } from './components/StatCard';
import { TrendChart } from './components/TrendChart';
import { RecentRunsTable, RunItem } from './components/RecentRunsTable';
import { RunDetailView, FindingItem } from './components/RunDetailView';

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const DEMO_RUNS: RunItem[] = [
  {
    _id: 'run_1',
    repo: 'Much1r1/pr-review-bot',
    pr_number: 10,
    head_sha: 'e1f2a3b4c5d6789012345678901234567890e1f2',
    timestamp: now - 10 * dayMs,
    total_findings: 2,
    any_critical: false,
  },
  {
    _id: 'run_2',
    repo: 'Much1r1/pr-review-bot',
    pr_number: 12,
    head_sha: 'a1b2c3d4e5f6789012345678901234567890a1b2',
    timestamp: now - 7 * dayMs,
    total_findings: 5,
    any_critical: true,
  },
  {
    _id: 'run_3',
    repo: 'Much1r1/pr-review-bot',
    pr_number: 14,
    head_sha: 'f9e8d7c6b5a4321098765432109876543210f9e8',
    timestamp: now - 5 * dayMs,
    total_findings: 1,
    any_critical: false,
  },
  {
    _id: 'run_4',
    repo: 'Much1r1/pr-review-bot',
    pr_number: 18,
    head_sha: 'c4d3e2f1a0987654321098765432109876543210',
    timestamp: now - 2 * dayMs,
    total_findings: 0,
    any_critical: false,
  },
  {
    _id: 'run_5',
    repo: 'Much1r1/e-commerce-api',
    pr_number: 32,
    head_sha: '3f2e1d0c9b8a7654321098765432109876543210',
    timestamp: now - 9 * dayMs,
    total_findings: 3,
    any_critical: true,
  },
  {
    _id: 'run_6',
    repo: 'Much1r1/e-commerce-api',
    pr_number: 35,
    head_sha: '7a8b9c0d1e2f3456789012345678901234567890',
    timestamp: now - 6 * dayMs,
    total_findings: 2,
    any_critical: false,
  },
  {
    _id: 'run_7',
    repo: 'Much1r1/e-commerce-api',
    pr_number: 48,
    head_sha: '8a7b6c5d4e3f2109876543210987654321098a7b',
    timestamp: now - 1 * dayMs,
    total_findings: 0,
    any_critical: false,
  },
  {
    _id: 'run_8',
    repo: 'Much1r1/auth-service',
    pr_number: 5,
    head_sha: 'b9c8d7e6f5a4321098765432109876543210b9c8',
    timestamp: now - 8 * dayMs,
    total_findings: 4,
    any_critical: true,
  },
  {
    _id: 'run_9',
    repo: 'Much1r1/auth-service',
    pr_number: 8,
    head_sha: '1a2b3c4d5e6f7890123456789012345678901a2b',
    timestamp: now - 3 * dayMs,
    total_findings: 1,
    any_critical: false,
  },
  {
    _id: 'run_10',
    repo: 'Much1r1/auth-service',
    pr_number: 11,
    head_sha: 'd5e6f7a8b9c0123456789012345678901234d5e6',
    timestamp: now - 12 * 3600 * 1000,
    total_findings: 0,
    any_critical: false,
  },
];

const DEMO_FINDINGS: Record<string, FindingItem[]> = {
  run_2: [
    {
      _id: 'f_1',
      run_id: 'run_2',
      category: 'security',
      severity: 'critical',
      file: 'scripts/test_bait.py',
      line: 18,
      message: 'SQL Injection: Query built using unsanitized string formatting with user input.',
      code_snippet: 'query = f"SELECT * FROM users WHERE username = \'{username}\'"',
    },
    {
      _id: 'f_2',
      run_id: 'run_2',
      category: 'security',
      severity: 'critical',
      file: 'scripts/test_bait.py',
      line: 25,
      message: 'Command Injection: Unsanitized user input passed to subprocess.run with shell=True.',
      code_snippet: 'result = subprocess.run(user_command, shell=True, capture_output=True)',
    },
    {
      _id: 'f_3',
      run_id: 'run_2',
      category: 'security',
      severity: 'high',
      file: 'scripts/test_bait.py',
      line: 11,
      message: 'Hardcoded Secret: Stripe Live API Key detected in source code.',
      code_snippet: 'STRIPE_API_KEY = "sk_live_51H8x9kL3mN2pQeRtWyUvAbCdEfGhIjKlMnOpQrSt"',
    },
    {
      _id: 'f_4',
      run_id: 'run_2',
      category: 'security',
      severity: 'high',
      file: 'scripts/test_bait.py',
      line: 35,
      message: 'Timing Attack: Non-constant-time comparison used for password comparison.',
      code_snippet: 'return candidate == real_password',
    },
    {
      _id: 'f_5',
      run_id: 'run_2',
      category: 'code_review',
      severity: 'warning',
      file: 'scripts/test_bait.py',
      line: 30,
      message: 'Use of eval() on untrusted user input allows arbitrary code execution.',
      code_snippet: 'return eval(user_supplied_expr)',
    },
  ],
  run_5: [
    {
      _id: 'f_6',
      run_id: 'run_5',
      category: 'dependency',
      severity: 'critical',
      file: 'pyyaml@5.1',
      message: 'GHSA-f456-j9vh-773f: Arbitrary code execution vulnerability in PyYAML 5.1 deserialization.',
    },
    {
      _id: 'f_7',
      run_id: 'run_5',
      category: 'security',
      severity: 'high',
      file: 'api/auth.py',
      line: 88,
      message: 'JWT secret hardcoded in configuration file.',
      code_snippet: 'JWT_SECRET = "super-secret-key-12345"',
    },
    {
      _id: 'f_8',
      run_id: 'run_5',
      category: 'code_review',
      severity: 'warning',
      file: 'api/views.py',
      line: 102,
      message: 'Unhandled exception in API view handler might expose internal stack traces.',
      code_snippet: 'except Exception:\n    return HttpResponseServerError(traceback.format_exc())',
    },
  ],
  run_8: [
    {
      _id: 'f_9',
      run_id: 'run_8',
      category: 'security',
      severity: 'critical',
      file: 'src/webhooks.py',
      line: 34,
      message: 'Missing HMAC signature verification on incoming payment webhook.',
      code_snippet: 'def handle_webhook(request):\n    payload = request.get_json()',
    },
    {
      _id: 'f_10',
      run_id: 'run_8',
      category: 'security',
      severity: 'high',
      file: 'src/config.py',
      line: 15,
      message: "CORS configured with wildcard origin '*' while credentials mode is enabled.",
      code_snippet: 'CORS_ALLOW_ALL_ORIGINS = True',
    },
  ],
};

function computeTrendData(runsList: RunItem[]) {
  const sorted = [...runsList].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((run) => {
    const findings = DEMO_FINDINGS[run._id] || [];
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

    const dateStr = new Date(run.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return {
      run_id: run._id,
      pr_number: run.pr_number,
      repo: run.repo,
      timestamp: run.timestamp,
      dateStr,
      head_sha: run.head_sha,
      total_findings: run.total_findings,
      any_critical: run.any_critical,
      ...counts,
    };
  });
}

export default function App() {
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Convex Queries (with fallbacks to DEMO data if Convex backend is empty or unavailable)
  const runsApi = (api as any).runs;
  const fetchedRepos = useQuery(runsApi.listRepos) as string[] | undefined;
  const fetchedRuns = useQuery(runsApi.listRuns, { repo: selectedRepo }) as RunItem[] | undefined;
  const fetchedTrendData = useQuery(runsApi.getTrendData, { repo: selectedRepo }) as any[] | undefined;
  const fetchedRunDetails = useQuery(
    runsApi.getRunDetails,
    selectedRunId ? { run_id: selectedRunId as any } : 'skip'
  ) as any;

  const seedDemoData = useMutation(runsApi.seedDemoData);

  const repos = useMemo(() => {
    if (fetchedRepos && fetchedRepos.length > 0) return fetchedRepos;
    return ['Much1r1/auth-service', 'Much1r1/e-commerce-api', 'Much1r1/pr-review-bot'];
  }, [fetchedRepos]);

  const runs = useMemo(() => {
    if (fetchedRuns && fetchedRuns.length > 0) return fetchedRuns;
    if (selectedRepo === 'all') return DEMO_RUNS;
    return DEMO_RUNS.filter((r) => r.repo === selectedRepo);
  }, [fetchedRuns, selectedRepo]);

  const trendData = useMemo(() => {
    if (fetchedTrendData && fetchedTrendData.length > 0) return fetchedTrendData;
    return computeTrendData(runs);
  }, [fetchedTrendData, runs]);

  const selectedRunDetails = useMemo(() => {
    if (fetchedRunDetails?.run) return fetchedRunDetails;
    if (!selectedRunId) return null;
    const run = DEMO_RUNS.find((r) => r._id === selectedRunId);
    if (!run) return null;
    return {
      run,
      findings: DEMO_FINDINGS[selectedRunId] || [],
    };
  }, [fetchedRunDetails, selectedRunId]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await seedDemoData();
      setSeedStatus(res?.message || 'Demo data successfully seeded!');
    } catch (err: any) {
      setSeedStatus(`Demo data loaded locally across 3 repositories.`);
    } finally {
      setSeeding(false);
    }
  };

  // Compute aggregate stat card metrics
  const stats = useMemo(() => {
    const totalRuns = runs.length;
    let totalFindings = 0;
    let criticalRuns = 0;

    runs.forEach((r) => {
      totalFindings += r.total_findings;
      if (r.any_critical) criticalRuns += 1;
    });

    const avgFindings = totalRuns > 0 ? (totalFindings / totalRuns).toFixed(1) : '0';

    return {
      totalRuns,
      totalFindings,
      criticalRuns,
      avgFindings,
    };
  }, [runs]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Background radial glow effect */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  PR Review Bot
                </h1>
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-semibold uppercase tracking-wider font-mono">
                  Week 4 Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                AI + Static Analysis + Security Pass Audit History
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow"
              title="Seed realistic vulnerability findings"
            >
              <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Seeding...' : 'Seed Demo Data'}</span>
            </button>
            <a
              href="https://github.com/Much1r1/pr-review-bot"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        {/* Repo Selector Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-2 border border-slate-800/80 rounded-2xl backdrop-blur-md">
          <RepoSelector
            repos={repos}
            selectedRepo={selectedRepo}
            onSelectRepo={(r) => {
              setSelectedRepo(r);
              setSelectedRunId(null);
            }}
          />
          {seedStatus && (
            <div className="text-xs font-mono text-indigo-300 px-3 py-1 bg-indigo-950/50 border border-indigo-800/50 rounded-lg self-start md:self-auto">
              {seedStatus}
            </div>
          )}
        </div>

        {/* Metric Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total PR Runs"
            value={stats.totalRuns}
            subtitle={selectedRepo === 'all' ? 'Across all repositories' : selectedRepo}
            icon={Layers}
            variant="default"
          />
          <StatCard
            title="Total Findings"
            value={stats.totalFindings}
            subtitle="Static, LLM & Security pass flags"
            icon={Activity}
            variant={stats.totalFindings > 0 ? 'warning' : 'success'}
          />
          <StatCard
            title="Critical Action Failures"
            value={stats.criticalRuns}
            subtitle="PR check status set to sys.exit(1)"
            icon={ShieldAlert}
            variant={stats.criticalRuns > 0 ? 'critical' : 'success'}
          />
          <StatCard
            title="Avg Findings / Run"
            value={stats.avgFindings}
            subtitle="Automated review density"
            icon={Bot}
            variant="default"
          />
        </div>

        {/* Selected Run Drill-in View Modal / Expandable Card */}
        {selectedRunDetails?.run && (
          <RunDetailView
            run={selectedRunDetails.run as RunItem}
            findings={(selectedRunDetails.findings || []) as FindingItem[]}
            onClose={() => setSelectedRunId(null)}
          />
        )}

        {/* Trend Chart Section */}
        <TrendChart data={trendData as any} />

        {/* Recent Runs Table */}
        <RecentRunsTable
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={(id) => setSelectedRunId(id === selectedRunId ? null : id)}
        />
      </main>
    </div>
  );
}

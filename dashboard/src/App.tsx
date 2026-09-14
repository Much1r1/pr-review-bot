import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  ShieldAlert,
  Bot,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Github,
  AlertOctagon,
} from 'lucide-react';
import { RepoSelector } from './components/RepoSelector';
import { StatCard } from './components/StatCard';
import { TrendChart } from './components/TrendChart';
import { RecentRunsTable, RunItem } from './components/RecentRunsTable';
import { RunDetailView, FindingItem } from './components/RunDetailView';

export default function App() {
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Queries directly from Convex
  const repos = useQuery(api.runs.listRepos) || [];
  const runs = (useQuery(api.runs.listRuns, { repo: selectedRepo }) || []) as RunItem[];
  const trendData = useQuery(api.runs.getTrendData, { repo: selectedRepo }) || [];

  // Selected run details
  const selectedRunDetails = useQuery(
    api.runs.getRunDetails,
    selectedRunId ? { run_id: selectedRunId as any } : 'skip'
  );

  // Mutations
  const seedDemoData = useMutation(api.runs.seedDemoData);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await seedDemoData();
      setSeedStatus(res?.message || 'Seeded successfully!');
    } catch (err: any) {
      setSeedStatus(`Seed info: ${err.message || 'Operation completed.'}`);
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
              title="Seed realistic vulnerability findings from test_bait.py"
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

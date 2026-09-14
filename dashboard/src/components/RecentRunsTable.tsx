import React from 'react';
import { GitPullRequest, ShieldAlert, CheckCircle2, ChevronRight, Clock } from 'lucide-react';

export interface RunItem {
  _id: string;
  repo: string;
  pr_number: number;
  head_sha: string;
  timestamp: number;
  total_findings: number;
  any_critical: boolean;
}

interface RecentRunsTableProps {
  runs: RunItem[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export const RecentRunsTable: React.FC<RecentRunsTableProps> = ({
  runs,
  selectedRunId,
  onSelectRun,
}) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Recent Review Runs</h2>
          <p className="text-xs text-slate-400 mt-1">
            Click any run row to view inline comments, severity breakdown, and flagged code snippets.
          </p>
        </div>
        <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-full font-mono">
          {runs.length} Run{runs.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800/80">
            <tr>
              <th className="py-3.5 px-5">Repository</th>
              <th className="py-3.5 px-5">PR #</th>
              <th className="py-3.5 px-5">Head Commit</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5">Total Findings</th>
              <th className="py-3.5 px-5">Timestamp</th>
              <th className="py-3.5 px-5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No review runs found for the selected filter.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const isSelected = selectedRunId === run._id;
                const formattedDate = new Date(run.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={run._id}
                    onClick={() => onSelectRun(run._id)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-600/15 text-slate-100 border-l-4 border-l-indigo-500'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-4 px-5 font-mono text-indigo-300 font-semibold">
                      {run.repo}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center space-x-1.5 font-mono text-slate-200">
                        <GitPullRequest className="w-3.5 h-3.5 text-slate-400" />
                        <span>#{run.pr_number}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-400">
                      {run.head_sha.substring(0, 7)}
                    </td>
                    <td className="py-4 px-5">
                      {run.any_critical ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-semibold">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Action Failed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Passed</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          run.total_findings > 0
                            ? 'bg-amber-500/10 text-amber-400 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {run.total_findings} finding{run.total_findings === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-400 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formattedDate}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <ChevronRight
                        className={`w-4 h-4 ml-auto transition-transform ${
                          isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'
                        }`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

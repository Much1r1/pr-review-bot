import React from 'react';
import {
  ShieldAlert,
  Bot,
  Package,
  AlertTriangle,
  Info,
  GitPullRequest,
  Clock,
  X,
  Code2,
  FileCode2,
} from 'lucide-react';
import { RunItem } from './RecentRunsTable';

export interface FindingItem {
  _id: string;
  run_id: string;
  category: 'security' | 'code_review' | 'dependency';
  severity: string; // "critical" | "high" | "warning" | "info"
  file: string;
  line?: number;
  message: string;
  code_snippet?: string;
}

interface RunDetailViewProps {
  run: RunItem;
  findings: FindingItem[];
  onClose: () => void;
}

export const RunDetailView: React.FC<RunDetailViewProps> = ({
  run,
  findings,
  onClose,
}) => {
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'security':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3" />
            <span>Security Pass</span>
          </span>
        );
      case 'dependency':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Package className="w-3 h-3" />
            <span>Dependency</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Bot className="w-3 h-3" />
            <span>Code Review</span>
          </span>
        );
    }
  };

  const getSeverityBadge = (severity?: string | null) => {
    switch ((severity || 'info').toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-rose-600 text-white">
            <AlertTriangle className="w-3 h-3" />
            <span>Critical</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40">
            <span>High</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/40">
            <Info className="w-3 h-3" />
            <span>Info</span>
          </span>
        );
    }
  };

  const safeFindings = findings || [];
  const safeHeadSha = run.head_sha ? run.head_sha : 'unknown';

  const formattedDate = run.timestamp
    ? new Date(run.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Unknown Date';

  return (
    <div className="bg-slate-900/90 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all"
        title="Close drill-down view"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold text-slate-100 font-mono">
              {run.repo}
            </span>
            <span className="flex items-center space-x-1 text-sm font-semibold font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
              <GitPullRequest className="w-4 h-4" />
              <span>PR #{run.pr_number}</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2 font-mono">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formattedDate}</span>
            </span>
            <span>•</span>
            <span>SHA: {safeHeadSha}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-auto pr-10">
          {run.any_critical && (
            <span className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-lg flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Critical Check Failed</span>
            </span>
          )}
          <span className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg font-mono">
            {safeFindings.length} Finding{safeFindings.length === 1 ? '' : 's'} Logged
          </span>
        </div>
      </div>

      {/* Findings List */}
      <div className="mt-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <span>Detailed Findings & Flagged Code</span>
        </h3>

        {safeFindings.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-sm">
            ✅ Clean run — No automated flags or vulnerabilities detected for this PR.
          </div>
        ) : (
          safeFindings.map((finding) => (
            <div
              key={finding._id}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-inner space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 font-mono text-xs text-slate-200 font-semibold">
                  <FileCode2 className="w-4 h-4 text-slate-400" />
                  <span className="text-indigo-300">{finding.file}</span>
                  {finding.line !== undefined && finding.line !== null && (
                    <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                      Line {finding.line}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {getCategoryBadge(finding.category)}
                  {getSeverityBadge(finding.severity)}
                </div>
              </div>

              <p className="text-xs text-slate-200 font-sans leading-relaxed pl-1">
                {finding.message}
              </p>

              {finding.code_snippet && (
                <div className="mt-2 bg-slate-900 border border-slate-800/80 rounded-lg p-3 font-mono text-xs overflow-x-auto text-emerald-400 shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Flagged Code Snippet:
                  </span>
                  <pre className="whitespace-pre-wrap">{finding.code_snippet}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { GitFork, Layers } from 'lucide-react';

interface RepoSelectorProps {
  repos: string[];
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  repos,
  selectedRepo,
  onSelectRepo,
}) => {
  return (
    <div className="flex items-center space-x-3 bg-slate-900/80 backdrop-blur-md p-1.5 border border-slate-800 rounded-xl">
      <div className="flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <GitFork className="w-4 h-4 text-indigo-400" />
        <span>Repository:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => onSelectRepo('all')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectedRepo === 'all'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Repositories</span>
        </button>
        {repos.map((repo) => (
          <button
            key={repo}
            onClick={() => onSelectRepo(repo)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              selectedRepo === repo
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {repo}
          </button>
        ))}
      </div>
    </div>
  );
};

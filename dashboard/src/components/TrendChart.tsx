import React, { useState, useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface TrendItem {
  dateStr: string;
  pr_number: number;
  total_findings: number;
  critical: number;
  high: number;
  warning: number;
  info: number;
  security: number;
  code_review: number;
  dependency: number;
}

interface TrendChartProps {
  data: TrendItem[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [groupBy, setGroupBy] = useState<'severity' | 'category'>('severity');
  const baseId = useId().replace(/:/g, '');

  const idCritical = `colorCritical_${baseId}`;
  const idHigh = `colorHigh_${baseId}`;
  const idWarning = `colorWarning_${baseId}`;
  const idInfo = `colorInfo_${baseId}`;
  const idSecurity = `colorSecurity_${baseId}`;
  const idReview = `colorReview_${baseId}`;
  const idDep = `colorDep_${baseId}`;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">Findings Trend Over Time</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historical distribution of code review, security, and dependency advisories across runs.
          </p>
        </div>

        <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setGroupBy('severity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              groupBy === 'severity'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Severity
          </button>
          <button
            onClick={() => setGroupBy('category')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              groupBy === 'category'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Category
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No run history available for trend analysis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {/* Severity Gradients */}
                <linearGradient id={idCritical} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={idHigh} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={idWarning} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={idInfo} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>

                {/* Category Gradients */}
                <linearGradient id={idSecurity} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={idReview} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id={idDep} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="dateStr" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.75rem',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                }}
              />

              {groupBy === 'severity' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="critical"
                    name="Critical"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill={`url(#${idCritical})`}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    name="High"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill={`url(#${idHigh})`}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="warning"
                    name="Warning"
                    stroke="#eab308"
                    fillOpacity={1}
                    fill={`url(#${idWarning})`}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="info"
                    name="Info"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill={`url(#${idInfo})`}
                    stackId="1"
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="security"
                    name="Security"
                    stroke="#e11d48"
                    fillOpacity={1}
                    fill={`url(#${idSecurity})`}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="dependency"
                    name="Dependency"
                    stroke="#a855f7"
                    fillOpacity={1}
                    fill={`url(#${idDep})`}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="code_review"
                    name="Code Review"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill={`url(#${idReview})`}
                    stackId="1"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
        {groupBy === 'severity' ? (
          <>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Critical</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>High</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span>Warning</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Info</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span>Security Pass</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Dependency Vulnerabilities</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Code Review / Static Rules</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

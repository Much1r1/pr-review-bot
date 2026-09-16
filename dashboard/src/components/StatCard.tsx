import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'critical' | 'warning' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  const variantStyles = {
    default: {
      border: 'border-slate-800',
      iconBg: 'bg-indigo-500/10 text-indigo-400',
      glow: 'from-indigo-500/5 to-transparent',
    },
    critical: {
      border: 'border-rose-900/50',
      iconBg: 'bg-rose-500/10 text-rose-400',
      glow: 'from-rose-500/10 to-transparent',
    },
    warning: {
      border: 'border-amber-900/50',
      iconBg: 'bg-amber-500/10 text-amber-400',
      glow: 'from-amber-500/10 to-transparent',
    },
    success: {
      border: 'border-emerald-900/50',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      glow: 'from-emerald-500/10 to-transparent',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border ${style.border} rounded-2xl p-5 shadow-xl transition-all duration-300 hover:border-slate-700`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${style.glow} rounded-bl-full pointer-events-none`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-100 mt-2 font-mono">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${style.iconBg}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

'use client';

interface ResultCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

export default function ResultCard({ title, value, subtitle, color = 'blue', size = 'md' }: ResultCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <p className={`font-bold ${colorClasses[color]} ${sizeClasses[size]}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}



'use client';

import Link from 'next/link';

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';
}

const colorClasses = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30',
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30',
};

export default function ToolCard({ title, description, href, icon, color = 'blue' }: ToolCardProps) {
  return (
    <Link 
      href={href}
      className="group block bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all duration-300"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-colors ${colorClasses[color]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </Link>
  );
}



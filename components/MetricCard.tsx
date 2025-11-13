'use client';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

const colorClasses = {
  green: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  yellow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  red: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  gray: 'border-gray-300 bg-gray-50 dark:bg-gray-800',
};

const textColorClasses = {
  green: 'text-green-700 dark:text-green-300',
  yellow: 'text-yellow-700 dark:text-yellow-300',
  red: 'text-red-700 dark:text-red-300',
  blue: 'text-blue-700 dark:text-blue-300',
  gray: 'text-gray-700 dark:text-gray-300',
};

export default function MetricCard({ title, value, subtitle, color }: MetricCardProps) {
  return (
    <div className={`border-2 rounded-lg p-4 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
        {title}
      </h3>
      <p className={`text-2xl font-bold mb-1 ${textColorClasses[color]}`}>
        {value}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}


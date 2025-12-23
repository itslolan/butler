'use client';

import { useState } from 'react';
import { ChartConfig } from '@/lib/chart-types';
import { formatCurrency, formatCompactCurrency, getChartColors, getIncomeExpenseColors } from '@/lib/chart-utils';
import TreemapRenderer from './TreemapRenderer';
import SankeyRenderer from './SankeyRenderer';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Brush,
} from 'recharts';

interface ChartRendererProps {
  config: ChartConfig;
  height?: number | `${number}%`;
  className?: string;
  showLegend?: boolean; // Render legend outside chart (chat/mobile)
}

export default function ChartRenderer({ config, height = 300, className, showLegend = false }: ChartRendererProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const INITIAL_CATEGORY_LIMIT = 6;
  const { type, data, xAxisLabel, yAxisLabel, currency, colors } = config;

  // Handle treemap separately
  if (type === 'treemap') {
    return <TreemapRenderer data={data} currency={currency} height={height} showLegend={showLegend} />;
  }

  // Handle sankey separately - use larger default height for sankey
  if (type === 'sankey') {
    const sankeyHeight = height === 300 ? 500 : height; // Use 500 as default instead of 300
    return <SankeyRenderer config={config} height={sankeyHeight} className={className} />;
  }

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <p className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs font-medium" style={{ color: entry.color }}>
              {entry.name}: {currency ? formatCurrency(entry.value, 'USD') : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format axis ticks
  const formatYAxisTick = (value: number) => {
    if (currency) {
      return formatCompactCurrency(value, 'USD');
    }
    return value.toLocaleString();
  };

  // Get colors for the chart
  const chartColors = colors || getChartColors(data.length);
  const { income: incomeColor, expenses: expensesColor } = getIncomeExpenseColors();

  // Transform data for recharts
  const chartData = data.map((point) => ({
    name: point.label,
    value: point.value,
    value2: point.value2,
  }));

  const renderPieLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;

    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderPieLegendFromData = () => {
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {chartData.map((entry, index) => (
          <div key={`legend-${entry.name}-${index}`} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: chartColors[index % chartColors.length] }}
            />
            <span className="truncate">{entry.name}</span>
          </div>
        ))}
      </div>
    );
  };

  // Pie legends rendered by Recharts are overlay-positioned, which can look cramped in chat.
  // When showLegend is enabled, render the legend as normal DOM below or beside the chart.
  if (type === 'pie' && showLegend) {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const chartHeight = typeof height === 'number' ? height : 300;
    
    const visibleData = showAllCategories ? chartData : chartData.slice(0, INITIAL_CATEGORY_LIMIT);
    const hasMore = chartData.length > INITIAL_CATEGORY_LIMIT;

    return (
      <div className={`w-full flex flex-col md:flex-row items-start md:items-center gap-6 ${className || ''}`}>
        {/* Chart Section */}
        <div className="relative w-full md:w-1/2 flex-shrink-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={140}
                innerRadius={85}
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={chartColors[index % chartColors.length]}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {currency ? formatCompactCurrency(total, typeof currency === 'string' ? currency : 'USD') : total.toLocaleString()}
            </span>
            <span className="text-base text-gray-500 font-medium mt-1">Total</span>
          </div>
        </div>

        {/* Legend Section - Grid */}
        <div className="w-full flex flex-col min-w-0">
          <div 
            className={`w-full grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 content-start transition-all duration-300 ${
              showAllCategories ? 'max-h-[300px] overflow-y-auto pr-2' : ''
            }`}
          >
            {visibleData.map((entry, index) => {
               // Calculate original index to maintain consistent colors when filtered
               const originalIndex = chartData.findIndex(item => item.name === entry.name);
               const percentage = ((entry.value / total) * 100).toFixed(1);
               return (
                 <div key={`legend-${index}`} className="flex items-start gap-3 text-sm">
                    <div 
                       className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" 
                       style={{ backgroundColor: chartColors[originalIndex % chartColors.length] }}
                    />
                    <div className="flex flex-col min-w-0">
                       <span className="font-medium text-gray-700 dark:text-gray-300 truncate" title={entry.name}>
                         {entry.name}
                       </span>
                       <span className="text-gray-900 dark:text-white font-semibold text-xs mt-0.5">
                         {currency ? formatCurrency(entry.value, typeof currency === 'string' ? currency : 'USD') : entry.value.toLocaleString()} 
                         <span className="text-gray-500 font-normal ml-1">({percentage}%)</span>
                       </span>
                    </div>
                 </div>
               );
            })}
          </div>

          {hasMore && !showAllCategories && (
            <button
              onClick={() => setShowAllCategories(true)}
              className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors self-start"
            >
              <span>+ Show all categories</span>
            </button>
          )}

          {hasMore && showAllCategories && (
            <button
              onClick={() => setShowAllCategories(false)}
              className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors self-start"
            >
              <span>Show less</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' && (
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/40 dark:stroke-gray-700/40" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tickFormatter={formatYAxisTick}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[0]} 
              strokeWidth={3}
              dot={{ fill: chartColors[0], r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name={yAxisLabel || 'Value'}
            />
          </LineChart>
        )}

        {type === 'bar' && (
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/40 dark:stroke-gray-700/40" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tickFormatter={formatYAxisTick}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="value" fill={chartColors[0] || incomeColor} name="Income" radius={[4, 4, 0, 0]} />
            {data.some(d => d.value2 !== undefined) && (
              <Bar dataKey="value2" fill={chartColors[1] || expensesColor} name="Expenses" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        )}

        {type === 'pie' && (
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={0}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={chartColors[index % chartColors.length]} 
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" align="center" content={renderPieLegend} />
          </PieChart>
        )}

        {type === 'area' && (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors[0]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={chartColors[0]} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/40 dark:stroke-gray-700/40" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tickFormatter={formatYAxisTick}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              axisLine={{ stroke: 'currentColor', opacity: 0.2 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[0]} 
              strokeWidth={3}
              fill="url(#colorValue)"
              name={yAxisLabel || 'Value'}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}


'use client';

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/chart-utils';
import { ChartDataPoint } from '@/lib/chart-types';
import { useState } from 'react';

interface TreemapRendererProps {
  data: ChartDataPoint[];
  currency?: boolean;
  height?: number | `${number}%`;
  showLegend?: boolean; // For mobile
}

export default function TreemapRenderer({ data, currency, height = 400, showLegend = false }: TreemapRendererProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Flatten data for Recharts Treemap
  const flattenedData = data.flatMap(group => 
    group.children?.map(child => ({
      name: child.label,
      size: child.value,
      group: group.label,
      color: child.color,
    })) || []
  );

  // Custom content for treemap rectangles
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, size, group, color } = props;
    
    // Calculate if we should show text (only for larger rectangles)
    const showText = width > 80 && height > 40;
    const showName = width > 120 && height > 60;
    
    const isHovered = hoveredItem === name;
    
    return (
      <g
        onMouseEnter={() => setHoveredItem(name)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          opacity={isHovered ? 1 : 0.9}
          style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
        />
        
        {/* Group label for large sections */}
        {showText && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - (showName ? 10 : 0)}
              textAnchor="middle"
              fill="#fff"
              fontSize={showName ? 14 : 12}
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              {group}
            </text>
            
            {showName && (
              <>
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 8}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={11}
                  opacity={0.9}
                  style={{ pointerEvents: 'none' }}
                >
                  {name}
                </text>
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 24}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={12}
                  fontWeight="500"
                  style={{ pointerEvents: 'none' }}
                >
                  {currency ? formatCurrency(size) : size}
                </text>
              </>
            )}
          </>
        )}
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{data.group}</p>
          <p className="font-medium text-gray-700 dark:text-gray-200 text-xs mt-1">{data.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {currency ? formatCurrency(data.size) : data.size}
          </p>
        </div>
      );
    }
    return null;
  };

  // Group data for legend
  const groupedForLegend = data.reduce((acc, group) => {
    acc[group.label] = {
      total: group.value,
      color: group.color || '',
      categories: group.children || [],
    };
    return acc;
  }, {} as Record<string, { total: number; color: string; categories: ChartDataPoint[] }>);

  // Calculate actual height value
  const actualHeight = typeof height === 'number' ? height : 300;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0" style={{ minHeight: showLegend ? `${actualHeight}px` : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={flattenedData}
            dataKey="size"
            aspectRatio={showLegend ? 16 / 9 : 4 / 3}
            stroke="#fff"
            fill="#8884d8"
            content={<CustomTreemapContent />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Mobile Legend */}
      {showLegend && (
        <div className="mt-6 space-y-4 pb-2">
          {Object.entries(groupedForLegend).map(([groupName, groupData]) => (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div 
                  className="w-4 h-4 rounded shrink-0" 
                  style={{ backgroundColor: groupData.color }}
                />
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  {groupName}
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {currency ? formatCurrency(groupData.total) : groupData.total}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 ml-6">
                {groupData.categories.map((cat) => (
                  <div key={cat.label} className="flex items-center gap-2 text-xs min-w-0">
                    <div 
                      className="w-3 h-3 rounded shrink-0" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {cat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

